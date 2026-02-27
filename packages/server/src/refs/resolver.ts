import type { ElementNode, ElementRefManager } from './element-refs.js';

export type SelectorType = 'text' | 'id' | 'ref' | 'type';

export interface Selector {
  type: SelectorType;
  value: string;
  exact?: boolean;
  index?: number;
}

/**
 * Resolves selectors to elements using a priority chain:
 * 1. By ref (@e1, @e2) — direct lookup
 * 2. By text — match label or value
 * 3. By accessibility ID — match AXUniqueId
 * 4. By type — match element type (with optional index)
 */
export function resolveSelector(
  selector: Selector | string,
  refs: ElementRefManager
): ElementNode | null {
  // String shorthand — detect type
  if (typeof selector === 'string') {
    selector = parseSelector(selector);
  }

  const elements = refs.getAllElements();

  switch (selector.type) {
    case 'ref':
      return refs.getByRef(selector.value);

    case 'text':
      return findByText(elements, selector.value, selector.exact ?? false);

    case 'id':
      return findById(elements, selector.value);

    case 'type':
      return findByType(elements, selector.value, selector.index ?? 0);

    default:
      return null;
  }
}

/**
 * Parse a string selector into a Selector object.
 * "@e3" → ref, "Login" → text, "#login-btn" → id
 */
export function parseSelector(input: string): Selector {
  if (input.startsWith('@e')) {
    return { type: 'ref', value: input };
  }
  if (input.startsWith('#')) {
    return { type: 'id', value: input.slice(1) };
  }
  return { type: 'text', value: input };
}

/**
 * Get the center coordinates of an element's frame.
 */
export function getElementCenter(node: ElementNode): { x: number; y: number } {
  return {
    x: node.frame.x + node.frame.width / 2,
    y: node.frame.y + node.frame.height / 2,
  };
}

function findByText(
  elements: ElementNode[],
  text: string,
  exact: boolean
): ElementNode | null {
  const lower = text.toLowerCase();

  // Exact match first
  for (const el of elements) {
    if (el.label === text || el.value === text) return el;
  }

  if (!exact) {
    // Case-insensitive match
    for (const el of elements) {
      if (el.label?.toLowerCase() === lower || el.value?.toLowerCase() === lower) {
        return el;
      }
    }

    // Partial match (contains)
    for (const el of elements) {
      if (
        el.label?.toLowerCase().includes(lower) ||
        el.value?.toLowerCase().includes(lower)
      ) {
        return el;
      }
    }
  }

  return null;
}

function findById(elements: ElementNode[], id: string): ElementNode | null {
  return elements.find((el) => el.id === id) ?? null;
}

function findByType(
  elements: ElementNode[],
  type: string,
  index: number
): ElementNode | null {
  const matches = elements.filter(
    (el) => el.type.toLowerCase() === type.toLowerCase()
  );
  return matches[index] ?? null;
}
