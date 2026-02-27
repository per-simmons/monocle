'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { WSClient } from '@/lib/ws-client';

interface SimulatorViewProps {
  serverUrl: string;
  onInspectToggle?: (active: boolean) => void;
  inspectActive?: boolean;
}

export function SimulatorView({ serverUrl, onInspectToggle, inspectActive }: SimulatorViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [connected, setConnected] = useState(false);
  const [fps, setFps] = useState(0);
  const clientRef = useRef<WSClient | null>(null);
  const frameCountRef = useRef(0);

  const handleFrame = useCallback((blob: Blob) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    frameCountRef.current++;

    createImageBitmap(blob).then((bitmap) => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Set canvas to match frame aspect ratio on first frame
      if (canvas.width !== bitmap.width || canvas.height !== bitmap.height) {
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
      }

      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
    });
  }, []);

  useEffect(() => {
    const wsUrl = serverUrl.replace('http', 'ws') + '/stream';
    const client = new WSClient(wsUrl, handleFrame, setConnected);
    clientRef.current = client;
    client.connect();

    // FPS counter
    const fpsInterval = setInterval(() => {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
    }, 1000);

    return () => {
      client.disconnect();
      clearInterval(fpsInterval);
    };
  }, [serverUrl, handleFrame]);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)]">
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
              ? 'bg-[var(--accent)] border-[var(--accent)] text-white'
              : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          }`}
        >
          Inspect
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden bg-[var(--bg-primary)]">
        {connected ? (
          <div className="relative max-h-full" style={{ aspectRatio: '9/19.5' }}>
            {/* iPhone bezel */}
            <div className="absolute inset-0 rounded-[3rem] border-2 border-[var(--border)] pointer-events-none z-10">
              {/* Notch / Dynamic Island */}
              <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-full" />
            </div>
            <canvas
              ref={canvasRef}
              className="w-full h-full object-contain rounded-[2.8rem]"
            />
          </div>
        ) : (
          <div className="text-center text-[var(--text-secondary)]">
            <div className="text-4xl mb-4">🔍</div>
            <p className="text-sm">Connecting to simulator...</p>
            <p className="text-xs mt-1">Make sure the Monocle server is running on {serverUrl}</p>
          </div>
        )}
      </div>
    </div>
  );
}
