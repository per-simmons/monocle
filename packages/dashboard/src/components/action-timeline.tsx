'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type ActionEntry } from '@/lib/api-client';

interface ActionTimelineProps {
  sessionId: string | null;
}

const TOOL_ICONS: Record<string, string> = {
  tap: '👆',
  tapByText: '👆',
  tapById: '👆',
  doubleTap: '👆👆',
  longPress: '✊',
  swipe: '👉',
  type: '⌨️',
  typeInto: '⌨️',
  pressKey: '⌨️',
  screenshot: '📸',
  getScreenText: '📖',
  listElements: '🔍',
  findElement: '🔍',
  getElementInfo: 'ℹ️',
  waitForElement: '⏳',
  waitForText: '⏳',
  assertVisible: '✅',
  launchApp: '🚀',
  terminateApp: '🛑',
  getDeviceInfo: '📱',
  openUrl: '🔗',
  startRecording: '🔴',
  stopRecording: '⏹',
};

export function ActionTimeline({ sessionId }: ActionTimelineProps) {
  const [actions, setActions] = useState<ActionEntry[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

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

      {/* Horizontal timeline strip */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex items-stretch h-full gap-1 p-2 min-w-max">
          {actions.map((action, idx) => {
            const icon = TOOL_ICONS[action.tool] ?? '🔧';
            const isSelected = selectedIdx === idx;
            const time = new Date(action.timestamp).toLocaleTimeString();

            return (
              <button
                key={idx}
                onClick={() => setSelectedIdx(isSelected ? null : idx)}
                className={`flex flex-col items-center justify-center px-3 py-2 rounded-lg min-w-[80px] transition-colors ${
                  isSelected
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:bg-[var(--border)]'
                }`}
              >
                <span className="text-lg">{icon}</span>
                <span className="text-[10px] font-mono mt-1 truncate max-w-[70px]">
                  {action.tool}
                </span>
                <span className="text-[9px] opacity-60">{time}</span>
              </button>
            );
          })}

          {actions.length === 0 && (
            <div className="flex items-center text-xs text-[var(--text-secondary)] px-4">
              Actions will appear here as the agent works...
            </div>
          )}
        </div>
      </div>

      {/* Selected action detail */}
      {selectedIdx !== null && actions[selectedIdx] && (
        <div className="border-t border-[var(--border)] p-3 bg-[var(--bg-secondary)]">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm">{TOOL_ICONS[actions[selectedIdx].tool] ?? '🔧'}</span>
            <span className="font-mono text-sm text-[var(--accent)]">
              {actions[selectedIdx].tool}
            </span>
            <span className="text-xs text-[var(--text-secondary)]">
              {new Date(actions[selectedIdx].timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <div className="text-[10px] uppercase text-[var(--text-secondary)] mb-1">Params</div>
              <pre className="text-[10px] bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-24">
                {JSON.stringify(actions[selectedIdx].params, null, 2)}
              </pre>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--text-secondary)] mb-1">Result</div>
              <pre className="text-[10px] bg-[var(--bg-primary)] p-2 rounded overflow-x-auto max-h-24">
                {JSON.stringify(actions[selectedIdx].result, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
