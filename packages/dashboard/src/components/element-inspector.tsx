'use client';

import { useEffect, useState, useCallback } from 'react';
import { api, type ElementNode } from '@/lib/api-client';

interface ElementInspectorProps {
  active: boolean;
  onRefSelect?: (ref: string) => void;
}

const TYPE_COLORS: Record<string, string> = {
  Button: '#ededed',
  StaticText: '#22c55e',
  TextField: '#f59e0b',
  SecureTextField: '#f59e0b',
  Image: '#ec4899',
  Cell: '#06b6d4',
  default: '#64748b',
};

function getColor(type: string): string {
  return TYPE_COLORS[type] ?? TYPE_COLORS.default;
}

export function ElementInspector({ active, onRefSelect }: ElementInspectorProps) {
  const [elements, setElements] = useState<ElementNode[]>([]);
  const [hoveredRef, setHoveredRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchElements = useCallback(async () => {
    try {
      const data = await api.getElements();
      setElements(data.elements);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    fetchElements();
    const interval = setInterval(fetchElements, 3000);
    return () => clearInterval(interval);
  }, [active, fetchElements]);

  if (!active) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      {/* Element overlay rectangles */}
      {elements.map((el) => {
        if (!el.frame || el.frame.width === 0) return null;
        const color = getColor(el.type);
        const isHovered = hoveredRef === el.ref;

        return (
          <div
            key={el.ref}
            className="absolute pointer-events-auto cursor-pointer transition-opacity"
            style={{
              left: `${(el.frame.x / 430) * 100}%`,
              top: `${(el.frame.y / 932) * 100}%`,
              width: `${(el.frame.width / 430) * 100}%`,
              height: `${(el.frame.height / 932) * 100}%`,
              border: `2px solid ${color}`,
              backgroundColor: isHovered ? `${color}33` : `${color}11`,
              opacity: isHovered ? 1 : 0.7,
            }}
            onMouseEnter={() => setHoveredRef(el.ref)}
            onMouseLeave={() => setHoveredRef(null)}
            onClick={() => onRefSelect?.(el.ref)}
          >
            {isHovered && (
              <div
                className="absolute -top-7 left-0 px-2 py-0.5 rounded text-[10px] whitespace-nowrap z-30"
                style={{ backgroundColor: color, color: '#fff' }}
              >
                {el.ref} | {el.label || el.type} | {el.type}
              </div>
            )}
          </div>
        );
      })}

      {/* Element list sidebar */}
      <div className="absolute top-0 right-0 w-56 h-full pointer-events-auto bg-[var(--bg-secondary)] border-l border-[var(--border)] overflow-y-auto">
        <div className="p-2 border-b border-[var(--border)]">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide">
            Elements ({elements.length})
          </h3>
        </div>
        {error && (
          <div className="p-2 text-xs text-[var(--error)]">{error}</div>
        )}
        <div className="divide-y divide-[var(--border)]">
          {elements.map((el) => (
            <button
              key={el.ref}
              className={`w-full text-left px-2 py-1.5 text-xs hover:bg-[var(--bg-tertiary)] transition-colors ${
                hoveredRef === el.ref ? 'bg-[var(--bg-tertiary)]' : ''
              }`}
              onMouseEnter={() => setHoveredRef(el.ref)}
              onMouseLeave={() => setHoveredRef(null)}
              onClick={() => onRefSelect?.(el.ref)}
            >
              <span className="font-mono text-[var(--accent)]">{el.ref}</span>
              <span className="ml-1.5" style={{ color: getColor(el.type) }}>
                {el.type}
              </span>
              {el.label && (
                <span className="ml-1.5 text-[var(--text-secondary)] truncate block">
                  &quot;{el.label}&quot;
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
