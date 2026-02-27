import type { IDBElement } from '../bridges/idb.js';

export interface ElementNode {
  /** Short ref like "@e1", "@e2" */
  ref: string;
  /** Element type — "Button", "StaticText", "TextField", etc. */
  type: string;
  /** Accessibility label */
  label: string | null;
  /** Current value (for inputs, sliders, etc.) */
  value: string | null;
  /** Accessibility identifier */
  id: string | null;
  /** Bounding box in iOS logical coordinates */
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** AX role */
  role: string;
  /** Whether the element is enabled/interactive */
  enabled: boolean;
  /** Help text */
  help: string | null;
}

/**
 * Manages element refs (@e1, @e2, ...) for a session.
 * Refs are stable within a session — same element retains same ref
 * as long as its accessibility ID and approximate position match.
 */
export class ElementRefManager {
  private counter = 0;
  private refMap = new Map<string, ElementNode>();
  private idToRef = new Map<string, string>();
  private positionCache = new Map<string, { x: number; y: number }>();

  /**
   * Assign refs to a flat list of IDB elements.
   * Returns annotated ElementNode[] with @eN refs.
   */
  assignRefs(elements: IDBElement[]): ElementNode[] {
    const nodes: ElementNode[] = [];

    for (const el of elements) {
      // Skip the root Application element
      if (el.type === 'Application') continue;

      const label = el.AXLabel || null;
      const value = el.AXValue || null;
      const id = el.AXUniqueId || null;

      // Try to find existing ref for this element (stability)
      let ref = this.findExistingRef(id, el.frame);

      if (!ref) {
        // Assign new ref
        this.counter++;
        ref = `@e${this.counter}`;
      }

      const node: ElementNode = {
        ref,
        type: el.type,
        label,
        value,
        id,
        frame: { ...el.frame },
        role: el.role,
        enabled: el.enabled,
        help: el.help || null,
      };

      this.refMap.set(ref, node);
      if (id) {
        this.idToRef.set(id, ref);
      }
      this.positionCache.set(ref, { x: el.frame.x, y: el.frame.y });

      nodes.push(node);
    }

    return nodes;
  }

  /**
   * Look up an element by its ref.
   */
  getByRef(ref: string): ElementNode | null {
    return this.refMap.get(ref) ?? null;
  }

  /**
   * Get all current elements with refs.
   */
  getAllElements(): ElementNode[] {
    return Array.from(this.refMap.values());
  }

  /**
   * Clear all refs (called on session reset).
   */
  reset(): void {
    this.counter = 0;
    this.refMap.clear();
    this.idToRef.clear();
    this.positionCache.clear();
  }

  /**
   * Try to find an existing ref for an element based on accessibility ID
   * and approximate position (within 10px).
   */
  private findExistingRef(
    id: string | null,
    frame: { x: number; y: number }
  ): string | null {
    // First try by accessibility ID
    if (id) {
      const existing = this.idToRef.get(id);
      if (existing) return existing;
    }

    // Then try by approximate position
    for (const [ref, pos] of this.positionCache) {
      if (
        Math.abs(pos.x - frame.x) < 10 &&
        Math.abs(pos.y - frame.y) < 10
      ) {
        return ref;
      }
    }

    return null;
  }
}
