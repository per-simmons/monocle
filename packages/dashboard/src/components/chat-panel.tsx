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

/* ── Tool color categories ── */
const TOOL_COLORS: Record<string, string> = {
  tap: 'text-amber-400', tapByText: 'text-amber-400', tapById: 'text-amber-400',
  doubleTap: 'text-amber-400', longPress: 'text-amber-400', swipe: 'text-amber-400',
  type: 'text-cyan-400', typeInto: 'text-cyan-400', pressKey: 'text-cyan-400',
  screenshot: 'text-emerald-400', getScreenText: 'text-emerald-400',
  listElements: 'text-teal-400', findElement: 'text-teal-400', getElementInfo: 'text-teal-400',
  waitForElement: 'text-violet-400', waitForText: 'text-violet-400', assertVisible: 'text-violet-400',
  launchApp: 'text-rose-400', terminateApp: 'text-rose-400', getDeviceInfo: 'text-rose-400',
  openUrl: 'text-rose-400', startRecording: 'text-red-400', stopRecording: 'text-red-400',
  listDevices: 'text-rose-400',
};
const DOT_COLORS: Record<string, string> = {
  tap: 'bg-amber-400', tapByText: 'bg-amber-400', tapById: 'bg-amber-400',
  doubleTap: 'bg-amber-400', longPress: 'bg-amber-400', swipe: 'bg-amber-400',
  type: 'bg-cyan-400', typeInto: 'bg-cyan-400', pressKey: 'bg-cyan-400',
  screenshot: 'bg-emerald-400', getScreenText: 'bg-emerald-400',
  listElements: 'bg-teal-400', findElement: 'bg-teal-400', getElementInfo: 'bg-teal-400',
  waitForElement: 'bg-violet-400', waitForText: 'bg-violet-400', assertVisible: 'bg-violet-400',
  launchApp: 'bg-rose-400', terminateApp: 'bg-rose-400', getDeviceInfo: 'bg-rose-400',
  openUrl: 'bg-rose-400', startRecording: 'bg-red-400', stopRecording: 'bg-red-400',
  listDevices: 'bg-rose-400',
};

/* ── Wave animation CSS (injected once) ── */
const waveCSS = `
@keyframes monocle-wave {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-8px); }
}
@keyframes monocle-pulse-ring {
  0% { transform: scale(0.8); opacity: 1; }
  100% { transform: scale(2.2); opacity: 0; }
}
@keyframes monocle-tool-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.monocle-wave-dot {
  animation: monocle-wave 1.2s ease-in-out infinite;
}
.monocle-tool-enter {
  animation: monocle-tool-enter 0.3s ease-out;
}
`;

export function ChatPanel({ onRefInsert }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Session ID for multi-turn conversation
  const sessionIdRef = useRef<string | null>(null);

  // Inject CSS once
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('monocle-wave-css')) {
      const style = document.createElement('style');
      style.id = 'monocle-wave-css';
      style.textContent = waveCSS;
      document.head.appendChild(style);
    }
  }, []);

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
    setStatus('Connecting to simulator...');

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
              setStatus('Analyzing results...');
              break;
            }

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

  const clearChat = () => {
    stopAgent();
    sessionIdRef.current = null;
    setMessages([{
      id: Date.now().toString(),
      role: 'agent',
      content: 'Monocle is ready. Type a command like "take a screenshot" or "QA this app" to start.',
      timestamp: new Date(),
    }]);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--border)] flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--text-secondary)]">
          Agent Chat
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={stopAgent}
            disabled={!loading}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              loading
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'text-[var(--text-secondary)] opacity-40 cursor-not-allowed'
            }`}
          >
            Stop
          </button>
          <button
            onClick={clearChat}
            className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--text-secondary)] transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div key={msg.id}>
            {/* Message bubble */}
            <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-black'
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

                {!msg.content && !msg.images?.length && !msg.toolCalls?.length && msg.role === 'agent' && (
                  <span className="text-[var(--text-secondary)] text-xs italic">...</span>
                )}

                <div className="text-[10px] mt-1 opacity-50" suppressHydrationWarning>
                  {msg.timestamp.toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Tool call timeline — displayed OUTSIDE the bubble as a visible timeline */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="ml-2 mt-1 mb-1 border-l-2 border-[var(--border)] pl-3 space-y-1">
                {msg.toolCalls.map((tc) => {
                  const color = TOOL_COLORS[tc.name] ?? 'text-zinc-400';
                  const dot = DOT_COLORS[tc.name] ?? 'bg-zinc-400';
                  return (
                    <div
                      key={tc.id}
                      className="monocle-tool-enter flex items-center gap-2 py-1 text-xs font-mono"
                    >
                      {/* Status indicator */}
                      {tc.status === 'running' ? (
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className={`absolute inline-flex h-full w-full rounded-full ${dot} opacity-75 animate-ping`} />
                          <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${dot}`} />
                        </span>
                      ) : (
                        <span className={`inline-flex rounded-full h-2.5 w-2.5 shrink-0 ${dot}`} />
                      )}

                      {/* Tool name */}
                      <span className={`font-semibold ${color}`}>{tc.name}</span>

                      {/* Params preview */}
                      {Object.keys(tc.params).length > 0 && (
                        <span className="text-[var(--text-secondary)] truncate max-w-[180px]">
                          {Object.entries(tc.params).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(' ')}
                        </span>
                      )}

                      {/* Result indicator */}
                      {tc.status === 'done' && (
                        <span className="text-green-400 ml-auto shrink-0 text-[10px]">OK</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {/* Active thinking/status indicator */}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-tertiary)] rounded-lg px-4 py-3 text-sm">
              {status ? (
                <span className="text-[var(--text-secondary)] text-xs flex items-center gap-2">
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75 animate-ping" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]" />
                  </span>
                  {status}
                </span>
              ) : (
                <div className="flex items-center gap-1.5">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className="monocle-wave-dot w-1.5 h-1.5 rounded-full bg-[var(--accent)]"
                      style={{ animationDelay: `${i * 0.12}s` }}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick-start prompts — shown when idle with no conversation */}
      {!loading && messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {[
            { label: 'Full QA', prompt: 'Run a full QA pass on this app. Explore every screen, test every interaction, and report all bugs.' },
            { label: 'Screenshot', prompt: 'Take a screenshot of the current screen and describe what you see.' },
            { label: 'Map all screens', prompt: 'Map every screen in the app. Navigate through all tabs and menus, screenshot each one, and list the navigation paths.' },
            { label: 'Test inputs', prompt: 'Find all text inputs in the app and test them with valid data, empty input, and edge cases. Report any issues.' },
            { label: 'Check performance', prompt: 'Navigate through the app and measure how long each screen takes to load. Flag anything slower than 2 seconds.' },
            { label: 'Record a walkthrough', prompt: 'Start a screen recording, do a complete walkthrough of the app, then stop recording.' },
          ].map((tag) => (
            <button
              key={tag.label}
              onClick={() => { setInput(tag.prompt); inputRef.current?.focus(); }}
              className="px-3 py-1.5 text-xs rounded-full border border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {tag.label}
            </button>
          ))}
        </div>
      )}

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
            className="px-4 py-2 bg-[var(--accent)] hover:bg-[var(--accent-hover)] disabled:opacity-50 text-black text-sm rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
