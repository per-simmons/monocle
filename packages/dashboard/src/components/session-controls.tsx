'use client';

import { useState, useEffect } from 'react';
import { api, type SessionMeta } from '@/lib/api-client';

interface SessionControlsProps {
  onSessionChange?: (sessionId: string | null) => void;
}

export function SessionControls({ onSessionChange }: SessionControlsProps) {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [activeSession, setActiveSession] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const data = await api.getSessions();
        setSessions(data.sessions);
        // Auto-select the most recent active session
        const active = data.sessions.find((s) => !s.endedAt);
        if (active && !activeSession) {
          setActiveSession(active.id);
          onSessionChange?.(active.id);
        }
      } catch {
        // Server may not be running
      }
    };

    fetchSessions();
    const interval = setInterval(fetchSessions, 5000);
    return () => clearInterval(interval);
  }, [activeSession, onSessionChange]);

  return (
    <div className="flex items-center gap-3">
      <select
        value={activeSession ?? ''}
        onChange={(e) => {
          const id = e.target.value || null;
          setActiveSession(id);
          onSessionChange?.(id);
        }}
        className="bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
      >
        <option value="">No session</option>
        {sessions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.id} — {s.deviceName} ({s.actionCount} actions)
            {s.endedAt ? '' : ' [active]'}
          </option>
        ))}
      </select>
    </div>
  );
}
