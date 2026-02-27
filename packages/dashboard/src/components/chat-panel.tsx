'use client';

import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  toolCalls?: ToolCall[];
  timestamp: Date;
}

interface ToolCall {
  name: string;
  params: Record<string, unknown>;
  result?: Record<string, unknown>;
}

interface ChatPanelProps {
  onRefInsert?: string;
}

export function ChatPanel({ onRefInsert }: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'agent',
      content: 'Monocle is ready. I can interact with the iOS simulator — try "take a screenshot" or "list all elements".',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Insert ref from inspector click
  useEffect(() => {
    if (onRefInsert) {
      setInput((prev) => prev + (prev ? ' ' : '') + onRefInsert);
      inputRef.current?.focus();
    }
  }, [onRefInsert]);

  const sendMessage = async () => {
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

    // For now, this is a placeholder — in production this would call Claude SDK
    // with the MCP server tools available
    try {
      const agentMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: 'Agent integration coming soon. The MCP server is running — connect it to Claude Code or Cursor to use the 21+ tools.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, agentMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--text-secondary)]">
          Agent Chat
        </h2>
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
              <p className="whitespace-pre-wrap">{msg.content}</p>

              {/* Tool calls */}
              {msg.toolCalls?.map((tc, i) => (
                <details key={i} className="mt-2 text-xs">
                  <summary className="cursor-pointer text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                    {tc.name}({Object.keys(tc.params).join(', ')})
                  </summary>
                  <pre className="mt-1 p-2 rounded bg-[var(--bg-primary)] overflow-x-auto text-[10px]">
                    {JSON.stringify(tc.result ?? tc.params, null, 2)}
                  </pre>
                </details>
              ))}

              <div className="text-[10px] mt-1 opacity-50">
                {msg.timestamp.toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[var(--bg-tertiary)] rounded-lg px-3 py-2 text-sm">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--text-secondary)] animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
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
