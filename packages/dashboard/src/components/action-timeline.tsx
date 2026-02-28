'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, type ActionEntry } from '@/lib/api-client';

interface ActionTimelineProps {
  sessionId: string | null;
}

/* Color categories for tool types — OKLCH-based tailwind palette */
const TOOL_COLORS: Record<string, string> = {
  // Interaction — amber
  tap: 'text-amber-400',
  tapByText: 'text-amber-400',
  tapById: 'text-amber-400',
  doubleTap: 'text-amber-400',
  longPress: 'text-amber-400',
  swipe: 'text-amber-400',
  // Input — cyan
  type: 'text-cyan-400',
  typeInto: 'text-cyan-400',
  pressKey: 'text-cyan-400',
  // Observation — green
  screenshot: 'text-emerald-400',
  getScreenText: 'text-emerald-400',
  listElements: 'text-teal-400',
  findElement: 'text-teal-400',
  getElementInfo: 'text-teal-400',
  // Wait/Assert — purple
  waitForElement: 'text-violet-400',
  waitForText: 'text-violet-400',
  assertVisible: 'text-violet-400',
  // App control — rose
  launchApp: 'text-rose-400',
  terminateApp: 'text-rose-400',
  getDeviceInfo: 'text-rose-400',
  openUrl: 'text-rose-400',
  // Recording — red
  startRecording: 'text-red-400',
  stopRecording: 'text-red-400',
};

const TOOL_BG: Record<string, string> = {
  tap: 'bg-amber-400/10', tapByText: 'bg-amber-400/10', tapById: 'bg-amber-400/10',
  doubleTap: 'bg-amber-400/10', longPress: 'bg-amber-400/10', swipe: 'bg-amber-400/10',
  type: 'bg-cyan-400/10', typeInto: 'bg-cyan-400/10', pressKey: 'bg-cyan-400/10',
  screenshot: 'bg-emerald-400/10', getScreenText: 'bg-emerald-400/10',
  listElements: 'bg-teal-400/10', findElement: 'bg-teal-400/10', getElementInfo: 'bg-teal-400/10',
  waitForElement: 'bg-violet-400/10', waitForText: 'bg-violet-400/10', assertVisible: 'bg-violet-400/10',
  launchApp: 'bg-rose-400/10', terminateApp: 'bg-rose-400/10', getDeviceInfo: 'bg-rose-400/10', openUrl: 'bg-rose-400/10',
  startRecording: 'bg-red-400/10', stopRecording: 'bg-red-400/10',
};

const DOT_COLORS: Record<string, string> = {
  tap: 'bg-amber-400', tapByText: 'bg-amber-400', tapById: 'bg-amber-400',
  doubleTap: 'bg-amber-400', longPress: 'bg-amber-400', swipe: 'bg-amber-400',
  type: 'bg-cyan-400', typeInto: 'bg-cyan-400', pressKey: 'bg-cyan-400',
  screenshot: 'bg-emerald-400', getScreenText: 'bg-emerald-400',
  listElements: 'bg-teal-400', findElement: 'bg-teal-400', getElementInfo: 'bg-teal-400',
  waitForElement: 'bg-violet-400', waitForText: 'bg-violet-400', assertVisible: 'bg-violet-400',
  launchApp: 'bg-rose-400', terminateApp: 'bg-rose-400', getDeviceInfo: 'bg-rose-400', openUrl: 'bg-rose-400',
  startRecording: 'bg-red-400', stopRecording: 'bg-red-400',
};

function formatParams(params: Record<string, unknown>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => {
    const val = typeof v === 'string' ? v : JSON.stringify(v);
    return `${k}=${val}`;
  }).join(' ');
}

export function ActionTimeline({ sessionId }: ActionTimelineProps) {
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoScrollRef = useRef(true);

  const fetchActions = useCallback(async () => {
    if (!sessionId) return;
    try {
      const data = await api.getActions(sessionId);
      setActions(data.actions);
    } catch {
      // Session may not exist yet
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    fetchActions();
    const interval = setInterval(fetchActions, 2000);
    return () => clearInterval(interval);
  }, [sessionId, fetchActions]);

  // Auto-scroll to bottom when new actions arrive
  useEffect(() => {
    if (autoScrollRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [actions]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    autoScrollRef.current = scrollHeight - scrollTop - clientHeight < 40;
  };

  if (!sessionId) {
    return (
      <div className="h-full flex items-center justify-center text-[var(--text-secondary)] text-xs">
        No active session
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--text-secondary)]">
          Timeline
        </h2>
        <span className="text-xs text-[var(--text-secondary)]">
          {actions.length} action{actions.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Vertical scrollable log */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden font-mono text-xs"
      >
        {actions.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--text-secondary)] text-xs">
            Actions will appear here as the agent works...
          </div>
        ) : (
          <div>
            {actions.map((action, idx) => {
              const color = TOOL_COLORS[action.tool] ?? 'text-zinc-400';
              const bg = TOOL_BG[action.tool] ?? 'bg-zinc-400/10';
              const dot = DOT_COLORS[action.tool] ?? 'bg-zinc-400';
              const isSelected = selectedIdx === idx;
              const time = new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const params = formatParams(action.params || {});
              const durationMs = action.duration_ms;

              return (
                <button
                  key={idx}
                  onClick={() => setSelectedIdx(isSelected ? null : idx)}
                  className={`w-full text-left px-3 py-1.5 flex items-center gap-2 transition-colors hover:bg-[var(--bg-tertiary)] ${
                    isSelected ? 'bg-[var(--bg-tertiary)]' : ''
                  }`}
                >
                  {/* Color dot */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />

                  {/* Timestamp */}
                  <span className="text-[var(--text-secondary)] shrink-0 w-[68px]">{time}</span>

                  {/* Tool name */}
                  <span className={`font-semibold shrink-0 ${color}`}>{action.tool}</span>

                  {/* Params */}
                  {params && (
                    <span className="text-[var(--text-secondary)] truncate">{params}</span>
                  )}

                  {/* Duration */}
                  {durationMs !== undefined && (
                    <span className="ml-auto text-[var(--text-secondary)] shrink-0">
                      {durationMs}ms
                    </span>
                  )}

                  {/* Status badge */}
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] ${bg} ${color}`}>
                    {action.status === 'error' ? 'ERR' : 'OK'}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected action detail panel */}
      {selectedIdx !== null && actions[selectedIdx] && (
        <div className="border-t border-[var(--border)] p-3 bg-[var(--bg-secondary)] max-h-[40%] overflow-y-auto">
          <div className="flex items-center gap-2 mb-2">
            <span className={`w-2 h-2 rounded-full ${DOT_COLORS[actions[selectedIdx].tool] ?? 'bg-zinc-400'}`} />
            <span className={`font-mono text-sm font-semibold ${TOOL_COLORS[actions[selectedIdx].tool] ?? 'text-zinc-400'}`}>
              {actions[selectedIdx].tool}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date(actions[selectedIdx].timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase text-[var(--text-secondary)] mb-1">Params</div>
              <pre className="text-[10px] font-mono bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-24">
                {JSON.stringify(actions[selectedIdx].params, null, 2)}
              </pre>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--text-secondary)] mb-1">Result</div>
              <pre className="text-[10px] font-mono bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-24">
                {JSON.stringify(actions[selectedIdx].result, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
