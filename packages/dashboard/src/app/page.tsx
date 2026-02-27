'use client';

import { useState, useCallback } from 'react';
import { SimulatorView } from '@/components/simulator-view';
import { ChatPanel } from '@/components/chat-panel';
import { ElementInspector } from '@/components/element-inspector';
import { ActionTimeline } from '@/components/action-timeline';
import { DeviceSelector } from '@/components/device-selector';
import { SessionControls } from '@/components/session-controls';

const SERVER_URL = 'http://localhost:7200';

export default function DashboardPage() {
  const [inspectActive, setInspectActive] = useState(false);
  const [selectedRef, setSelectedRef] = useState<string | undefined>();
  const [sessionId, setSessionId] = useState<string | null>(null);

  const handleRefSelect = useCallback((ref: string) => {
    setSelectedRef(ref);
  }, []);

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold tracking-tight">
            <span className="text-[var(--accent)]">Monocle</span>
          </h1>
          <span className="text-xs text-[var(--text-secondary)]">Playwright for Mobile</span>
        </div>
        <div className="flex items-center gap-4">
          <DeviceSelector />
          <SessionControls onSessionChange={setSessionId} />
        </div>
      </header>

      {/* Main content — three-panel layout */}
      <div className="flex flex-1 min-h-0">
        {/* Left: Chat Panel */}
        <div className="w-[380px] border-r border-[var(--border)] flex flex-col">
          <ChatPanel onRefInsert={selectedRef} />
        </div>

        {/* Center: Simulator View + Inspector Overlay */}
        <div className="flex-1 relative flex flex-col">
          <div className="flex-1 relative">
            <SimulatorView
              serverUrl={SERVER_URL}
              inspectActive={inspectActive}
              onInspectToggle={setInspectActive}
            />
            <ElementInspector
              active={inspectActive}
              onRefSelect={handleRefSelect}
            />
          </div>
        </div>
      </div>

      {/* Bottom: Action Timeline */}
      <div className="h-[180px] border-t border-[var(--border)] bg-[var(--bg-secondary)]">
        <ActionTimeline sessionId={sessionId} />
      </div>
    </div>
  );
}
