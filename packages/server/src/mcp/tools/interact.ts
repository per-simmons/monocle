import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as idb from '../../bridges/idb.js';
import { resolveSelector, getElementCenter, parseSelector } from '../../refs/resolver.js';
import type { ToolContext } from '../server.js';

export function registerInteractionTools(server: McpServer, ctx: ToolContext) {
  server.tool(
    'tap',
    'Tap at coordinates or element ref. Use x/y for coordinates, or ref for element ref like "@e3"',
    {
      x: z.number().optional().describe('X coordinate (iOS logical points)'),
      y: z.number().optional().describe('Y coordinate (iOS logical points)'),
      ref: z.string().optional().describe('Element ref like "@e3"'),
    },
    async ({ x, y, ref }) => {
      const udid = await ctx.getDeviceUdid();

      if (ref) {
        const node = ctx.refs.getByRef(ref);
        if (!node) return { content: [{ type: 'text' as const, text: `Element ${ref} not found. Run listElements first.` }], isError: true };
        const center = getElementCenter(node);
        await idb.tap(udid, center.x, center.y);
        ctx.session?.logAction('tap', { ref }, { element: node.label });
        return { content: [{ type: 'text' as const, text: `Tapped ${ref} "${node.label}" at (${center.x.toFixed(0)}, ${center.y.toFixed(0)})` }] };
      }

      if (x !== undefined && y !== undefined) {
        await idb.tap(udid, x, y);
        ctx.session?.logAction('tap', { x, y }, {});
        return { content: [{ type: 'text' as const, text: `Tapped at (${x}, ${y})` }] };
      }

      return { content: [{ type: 'text' as const, text: 'Provide either x/y coordinates or a ref' }], isError: true };
    }
  );

  server.tool(
    'tapByText',
    'Tap an element matching visible text',
    {
      text: z.string().describe('Text to find and tap'),
      exact: z.boolean().optional().describe('Require exact match (default: false)'),
    },
    async ({ text, exact }) => {
      const udid = await ctx.getDeviceUdid();
      await refreshElementsIfNeeded(ctx, udid);

      const node = resolveSelector({ type: 'text', value: text, exact: exact ?? false }, ctx.refs);
      if (!node) return { content: [{ type: 'text' as const, text: `No element found matching text "${text}"` }], isError: true };

      const center = getElementCenter(node);
      await idb.tap(udid, center.x, center.y);
      ctx.session?.logAction('tapByText', { text }, { element: node.label, ref: node.ref });
      return { content: [{ type: 'text' as const, text: `Tapped ${node.ref} "${node.label}" at (${center.x.toFixed(0)}, ${center.y.toFixed(0)})` }] };
    }
  );

  server.tool(
    'tapById',
    'Tap an element matching accessibility ID',
    {
      accessibilityId: z.string().describe('Accessibility identifier to find'),
    },
    async ({ accessibilityId }) => {
      const udid = await ctx.getDeviceUdid();
      await refreshElementsIfNeeded(ctx, udid);

      const node = resolveSelector({ type: 'id', value: accessibilityId }, ctx.refs);
      if (!node) return { content: [{ type: 'text' as const, text: `No element found with ID "${accessibilityId}"` }], isError: true };

      const center = getElementCenter(node);
      await idb.tap(udid, center.x, center.y);
      ctx.session?.logAction('tapById', { accessibilityId }, { element: node.label, ref: node.ref });
      return { content: [{ type: 'text' as const, text: `Tapped ${node.ref} "${node.label}" at (${center.x.toFixed(0)}, ${center.y.toFixed(0)})` }] };
    }
  );

  server.tool(
    'doubleTap',
    'Double tap at coordinates or element ref',
    {
      x: z.number().optional(),
      y: z.number().optional(),
      ref: z.string().optional(),
    },
    async ({ x, y, ref }) => {
      const udid = await ctx.getDeviceUdid();
      const coords = resolveCoords(ctx, ref, x, y);
      if (!coords) return { content: [{ type: 'text' as const, text: 'Provide x/y or ref' }], isError: true };
      await idb.doubleTap(udid, coords.x, coords.y);
      ctx.session?.logAction('doubleTap', { x: coords.x, y: coords.y }, {});
      return { content: [{ type: 'text' as const, text: `Double tapped at (${coords.x.toFixed(0)}, ${coords.y.toFixed(0)})` }] };
    }
  );

  server.tool(
    'longPress',
    'Long press at coordinates or element ref',
    {
      x: z.number().optional(),
      y: z.number().optional(),
      ref: z.string().optional(),
      durationMs: z.number().optional().describe('Duration in milliseconds (default: 1000)'),
    },
    async ({ x, y, ref, durationMs }) => {
      const udid = await ctx.getDeviceUdid();
      const coords = resolveCoords(ctx, ref, x, y);
      if (!coords) return { content: [{ type: 'text' as const, text: 'Provide x/y or ref' }], isError: true };
      await idb.longPress(udid, coords.x, coords.y, durationMs ?? 1000);
      ctx.session?.logAction('longPress', { x: coords.x, y: coords.y, durationMs }, {});
      return { content: [{ type: 'text' as const, text: `Long pressed at (${coords.x.toFixed(0)}, ${coords.y.toFixed(0)}) for ${durationMs ?? 1000}ms` }] };
    }
  );

  server.tool(
    'swipe',
    'Swipe between two points or in a direction',
    {
      fromX: z.number().optional(),
      fromY: z.number().optional(),
      toX: z.number().optional(),
      toY: z.number().optional(),
      direction: z.enum(['up', 'down', 'left', 'right']).optional().describe('Swipe direction (alternative to from/to coords)'),
      durationMs: z.number().optional().describe('Swipe duration (default: 300)'),
    },
    async ({ fromX, fromY, toX, toY, direction, durationMs }) => {
      const udid = await ctx.getDeviceUdid();

      let fx: number, fy: number, tx: number, ty: number;

      if (direction) {
        // Use center of screen with standard swipe distance
        const cx = 195, cy = 422; // Center of iPhone screen
        const dist = 300;
        switch (direction) {
          case 'up': fx = cx; fy = cy + dist / 2; tx = cx; ty = cy - dist / 2; break;
          case 'down': fx = cx; fy = cy - dist / 2; tx = cx; ty = cy + dist / 2; break;
          case 'left': fx = cx + dist / 2; fy = cy; tx = cx - dist / 2; ty = cy; break;
          case 'right': fx = cx - dist / 2; fy = cy; tx = cx + dist / 2; ty = cy; break;
        }
      } else if (fromX !== undefined && fromY !== undefined && toX !== undefined && toY !== undefined) {
        fx = fromX; fy = fromY; tx = toX; ty = toY;
      } else {
        return { content: [{ type: 'text' as const, text: 'Provide from/to coordinates or direction' }], isError: true };
      }

      await idb.swipe(udid, fx!, fy!, tx!, ty!, durationMs ?? 300);
      ctx.session?.logAction('swipe', { fromX: fx!, fromY: fy!, toX: tx!, toY: ty!, direction }, {});
      return { content: [{ type: 'text' as const, text: `Swiped from (${fx!.toFixed(0)},${fy!.toFixed(0)}) to (${tx!.toFixed(0)},${ty!.toFixed(0)})` }] };
    }
  );

  server.tool(
    'type',
    'Type text into the currently focused element',
    {
      text: z.string().describe('Text to type'),
    },
    async ({ text }) => {
      const udid = await ctx.getDeviceUdid();
      await idb.typeText(udid, text);
      ctx.session?.logAction('type', { text }, {});
      return { content: [{ type: 'text' as const, text: `Typed "${text}"` }] };
    }
  );

  server.tool(
    'typeInto',
    'Find an element by ref/text/ID, tap it, then type text',
    {
      selector: z.string().describe('Element selector — @e3, "Search", or #search-field'),
      text: z.string().describe('Text to type'),
    },
    async ({ selector, text }) => {
      const udid = await ctx.getDeviceUdid();
      await refreshElementsIfNeeded(ctx, udid);

      const node = resolveSelector(parseSelector(selector), ctx.refs);
      if (!node) return { content: [{ type: 'text' as const, text: `Element "${selector}" not found` }], isError: true };

      const center = getElementCenter(node);
      await idb.tap(udid, center.x, center.y);
      await new Promise((r) => setTimeout(r, 300));
      await idb.typeText(udid, text);

      ctx.session?.logAction('typeInto', { selector, text }, { element: node.label, ref: node.ref });
      return { content: [{ type: 'text' as const, text: `Tapped ${node.ref} "${node.label}" and typed "${text}"` }] };
    }
  );

  server.tool(
    'pressKey',
    'Press a hardware key',
    {
      key: z.enum(['home', 'lock', 'siri', 'volumeUp', 'volumeDown']).describe('Key to press'),
    },
    async ({ key }) => {
      const udid = await ctx.getDeviceUdid();
      await idb.pressButton(udid, key);
      ctx.session?.logAction('pressKey', { key }, {});
      return { content: [{ type: 'text' as const, text: `Pressed ${key}` }] };
    }
  );
}

function resolveCoords(
  ctx: ToolContext,
  ref?: string,
  x?: number,
  y?: number
): { x: number; y: number } | null {
  if (ref) {
    const node = ctx.refs.getByRef(ref);
    if (node) return getElementCenter(node);
  }
  if (x !== undefined && y !== undefined) return { x, y };
  return null;
}

async function refreshElementsIfNeeded(ctx: ToolContext, udid: string) {
  if (ctx.refs.getAllElements().length === 0) {
    const elements = await (await import('../../bridges/idb.js')).describeAll(udid);
    ctx.refs.assignRefs(elements);
  }
}
