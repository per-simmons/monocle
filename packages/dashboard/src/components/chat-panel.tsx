'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

interface ToolCall {
  id: string;
  name: string;
  params: Record<string, unknown>;
  result?: Array<Record<string, unknown>>;
  status: 'running' | 'done';
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  toolCalls?: ToolCall[];
  images?: string[]; // base64 data URIs
  timestamp: Date;
}

interface ChatPanelProps {
  onRefInsert?: string;
}

export function ChatPanel({ onRefInsert }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Session ID for multi-turn conversation (Agent SDK resume)
  const sessionIdRef = useRef<string | null>(null);

  // Initialize welcome message on client only
  useEffect(() => {
    if (!mounted) {
      setMounted(true);
      setMessages([{
        id: '0',
        role: 'agent',
        content: 'Monocle is ready. Type a command like "take a screenshot" or "QA this app" to start.',
        timestamp: new Date(),
      }]);
    }
  }, [mounted]);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, status]);

  // Insert ref from inspector click
  useEffect(() => {
    if (onRefInsert) {
      setInput((prev) => prev + (prev ? ' ' : '') + onRefInsert);
      inputRef.current?.focus();
    }
  }, [onRefInsert]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setStatus('Thinking...');

    // Create agent message placeholder
    const agentId = (Date.now() + 1).toString();

    setMessages((prev) => [...prev, {
      id: agentId,
      role: 'agent',
      content: '',
      toolCalls: [],
      images: [],
      timestamp: new Date(),
    }]);

    const abort = new AbortController();
    abortRef.current = abort;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          sessionId: sessionIdRef.current,
        }),
        signal: abort.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete SSE events
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6);

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(data);
          } catch {
            continue;
          }

          switch (event.type) {
            // Agent SDK session ID
            case 'session':
              sessionIdRef.current = event.sessionId as string;
              break;

            case 'text':
              fullText += event.content as string;
              setMessages((prev) => prev.map((m) =>
                m.id === agentId ? { ...m, content: fullText } : m
              ));
              setStatus('');
              break;

            case 'tool_call':
              setStatus(`Running ${event.name as string}...`);
              setMessages((prev) => prev.map((m) =>
                m.id === agentId ? {
                  ...m,
                  toolCalls: [...(m.toolCalls || []), {
                    id: event.id as string,
                    name: event.name as string,
                    params: event.params as Record<string, unknown>,
                    status: 'running' as const,
                  }],
                } : m
              ));
              break;

            case 'tool_result': {
              const resultArr = event.result as Array<Record<string, unknown>>;
              const newImages: string[] = [];

              // Extract any screenshots from tool results
              for (const r of resultArr || []) {
                if (r.type === 'image' && r.data) {
                  newImages.push(`data:${r.mimeType || 'image/jpeg'};base64,${r.data}`);
                }
              }

              setMessages((prev) => prev.map((m) => {
                if (m.id !== agentId) return m;
                return {
                  ...m,
                  images: [...(m.images || []), ...newImages],
                  toolCalls: (m.toolCalls || []).map((tc) =>
                    tc.id === event.id
                      ? { ...tc, result: resultArr, status: 'done' as const }
                      : tc
                  ),
                };
              }));
              setStatus('Thinking...');
              break;
            }

            // Tool progress status updates from Agent SDK
            case 'status':
              setStatus(event.content as string);
              break;

            case 'done':
              setStatus('');
              break;

            case 'error':
              fullText += `\n\nError: ${event.content as string}`;
              setMessages((prev) => prev.map((m) =>
                m.id === agentId ? { ...m, content: fullText } : m
              ));
              setStatus('');
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) => prev.map((m) =>
          m.id === agentId
            ? { ...m, content: `Error: ${(err as Error).message}` }
            : m
        ));
      }
    } finally {
      setLoading(false);
      setStatus('');
      abortRef.current = null;
    }
  }, [input, loading]);

  const stopAgent = () => {
    abortRef.current?.abort();
    setLoading(false);
    setStatus('');
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--text-secondary)]">
          Agent Chat
        </h2>
        {loading && (
          <button
            onClick={stopAgent}
            className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
          >
            Stop
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-[var(--accent)] text-white'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-primary)]'
              }`}
            >
              {msg.content && (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}

              {/* Inline screenshots */}
              {msg.images && msg.images.length > 0 && (
                <div className="mt-2 space-y-2">
                  {msg.images.map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt={`Screenshot ${i + 1}`}
                      className="rounded max-w-full border border-[var(--border)]"
                    />
                  ))}
                </div>
              )}

              {/* Tool calls */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 space-y-1">
                  {msg.toolCalls.map((tc) => (
                    <details key={tc.id} className="text-xs">
                      <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1">
                        {tc.status === 'running' ? (
                          <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                        ) : (
                          <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
                        )}
                        {tc.name}({Object.keys(tc.params).length > 0 ? Object.keys(tc.params).join(', ') : ''})
                      </summary>
                      <pre className="mt-1 p-2 rounded bg-[var(--bg-primary)] overflow-x-auto text-[10px] max-h-32 overflow-y-auto">
                        {tc.result
                          ? JSON.stringify(
                              tc.result.filter((r) => r.type !== 'image'),
                              null,
                              2
                            )
                          : JSON.stringify(tc.params, null, 2)}
                      </pre>
                    </details>
                  ))}
                </div>
              )}

              <div className="text-[10px] mt-1 opacity-50" suppressHydrationWarning>
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Status indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm">
              {status ? (
                <span className="text-[var(--text-secondary)] text-xs flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
                  {status}
                </span>
              ) : (
                <span className="inline-flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-[var(--border)]">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Tell the agent what to do..."
            className="flex-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-lg px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none focus:border-[var(--accent)]"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-white text-sm rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
