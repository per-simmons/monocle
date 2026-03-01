'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { WSClient } from '@/lib/ws-client';

const DEVICE_SCALE = 3;

interface SimulatorViewProps {
  serverUrl: string;
  onInspectToggle?: (active: boolean) => void;
  inspectActive?: boolean;
}

export function SimulatorView({ serverUrl, onInspectToggle, inspectActive }: SimulatorViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [connected, setConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const clientRef = useRef<WSClient | null>(null);
  const frameCountRef = useRef(0);
  const prevUrlRef = useRef<string | null>(null);
  const frameSizeRef = useRef({ width: 0, height: 0 });
  const [tapFeedback, setTapFeedback] = useState<{ x: number; y: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; clientX: number; clientY: number } | null>(null);

  const handleFrame = useCallback((blob: Blob) => {
    const img = imgRef.current;
    if (!img) return;
    frameCountRef.current++;
    if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    const url = URL.createObjectURL(blob);
    prevUrlRef.current = url;
    img.src = url;
  }, []);

  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (img) frameSizeRef.current = { width: img.naturalWidth, height: img.naturalHeight };
  }, []);

  /** Convert screen pixel to iOS logical coordinate */
  const toLogical = useCallback((clientX: number, clientY: number) => {
    const img = imgRef.current;
    if (!img || frameSizeRef.current.width === 0) return null;
    const rect = img.getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top) / rect.height;
    return {
      x: (relX * frameSizeRef.current.width) / DEVICE_SCALE,
      y: (relY * frameSizeRef.current.height) / DEVICE_SCALE,
    };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, clientX: e.clientX, clientY: e.clientY };
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLImageElement>) => {
    if (dragRef.current) {
      dragRef.current.clientX = e.clientX;
      dragRef.current.clientY = e.clientY;
    }
  }, []);

  const handleMouseUp = useCallback(async (e: React.MouseEvent<HTMLImageElement>) => {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const img = imgRef.current;
    if (!img) return;
    const rect = img.getBoundingClientRect();

    if (dist < 8) {
      // Short movement = tap
      const pos = toLogical(e.clientX, e.clientY);
      if (!pos) return;
      setTapFeedback({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      setTimeout(() => setTapFeedback(null), 300);
      try {
        await fetch(`${serverUrl}/api/tap`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ x: pos.x, y: pos.y }),
        });
      } catch (err) {
        console.error('Tap failed:', err);
      }
    } else {
      // Drag = swipe
      const start = toLogical(drag.startX, drag.startY);
      const end = toLogical(e.clientX, e.clientY);
      if (!start || !end) return;
      try {
        await fetch(`${serverUrl}/api/swipe`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startX: start.x, startY: start.y,
            endX: end.x, endY: end.y,
            duration: 0.3,
          }),
        });
      } catch (err) {
        console.error('Swipe failed:', err);
      }
    }
  }, [serverUrl, toLogical]);

  useEffect(() => {
    const wsUrl = serverUrl.replace('http', 'ws') + '/stream';
    const client = new WSClient(wsUrl, handleFrame, setConnected);
    clientRef.current = client;
    client.connect();
    const fpsInterval = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);
    return () => {
      client.disconnect();
      clearInterval(fpsInterval);
      if (prevUrlRef.current) URL.revokeObjectURL(prevUrlRef.current);
    };
  }, [serverUrl, handleFrame]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-[var(--text-secondary)]">
            Simulator
          </h2>
          <span className={`inline-block w-2 h-2 rounded-full ${connected ? 'bg-[var(--success)]' : 'bg-[var(--error)]'}`} />
          {connected && (
            <span className="text-xs text-[var(--text-secondary)]">{fps} fps</span>
          )}
        </div>
        <button
          onClick={() => onInspectToggle?.(!inspectActive)}
          className={`px-3 py-1 text-xs rounded-md border transition-colors ${
            inspectActive
              ? 'bg-[var(--accent)] border-[var(--accent)] text-black'
              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          }`}
        >
          Inspect
        </button>
      </div>

      {/* Simulator — absolutely positioned inside a relative container to guarantee containment */}
      <div className="flex-1 min-h-0 relative bg-[var(--bg-primary)]">
        {connected ? (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            {/* iPhone bezel frame */}
            <div className="relative h-full max-w-full" style={{ aspectRatio: '9 / 19.5' }}>
              {/* Outer bezel */}
              <div className="absolute -inset-[6px] rounded-[3rem] bg-gradient-to-b from-[#2a2a2e] to-[#1a1a1e] shadow-[0_0_30px_rgba(0,0,0,0.5)]" />
              {/* Inner bezel edge */}
              <div className="absolute -inset-[3px] rounded-[2.85rem] bg-gradient-to-b from-[#3a3a3e] via-[#222226] to-[#1a1a1e]" />
              {/* Screen area */}
              <div className="absolute inset-0 rounded-[2.7rem] overflow-hidden bg-black">
                {/* Dynamic Island */}
                <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-[90px] h-[28px] bg-black rounded-full z-20" />
                {/* Tap feedback */}
                {tapFeedback && (
                  <div
                    className="absolute w-8 h-8 -ml-4 -mt-4 rounded-full bg-white/30 animate-ping z-20 pointer-events-none"
                    style={{ left: tapFeedback.x, top: tapFeedback.y }}
                  />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={imgRef}
                  alt="Simulator"
                  onLoad={handleImageLoad}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  draggable={false}
                  className="h-full w-full object-contain cursor-pointer select-none"
                />
              </div>
              {/* Side button (right) */}
              <div className="absolute -right-[8px] top-[28%] w-[4px] h-[60px] rounded-r-sm bg-[#2a2a2e]" />
              {/* Volume buttons (left) */}
              <div className="absolute -left-[8px] top-[22%] w-[4px] h-[28px] rounded-l-sm bg-[#2a2a2e]" />
              <div className="absolute -left-[8px] top-[30%] w-[4px] h-[45px] rounded-l-sm bg-[#2a2a2e]" />
              <div className="absolute -left-[8px] top-[38%] w-[4px] h-[45px] rounded-l-sm bg-[#2a2a2e]" />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center text-[var(--text-secondary)]">
              <p className="text-sm">Connecting to simulator...</p>
              <p className="text-xs mt-1 opacity-60">Make sure the Monocle server is running</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
