import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as idb from '../../bridges/idb.js';
import { resolveSelector, parseSelector } from '../../refs/resolver.js';
import type { ToolContext } from '../server.js';

export function registerInspectionTools(server: McpServer, ctx: ToolContext) {
  server.tool(
    'listElements',
    'Get the accessibility tree with element refs (@e1, @e2, ...). Use refs in other commands.',
    {},
    async () => {
      const udid = await ctx.getDeviceUdid();
      const rawElements = await idb.describeAll(udid);
      const nodes = ctx.refs.assignRefs(rawElements);

      const lines = nodes.map((n) => {
        const label = n.label || n.value || '(no label)';
        const frame = `(${n.frame.x.toFixed(0)},${n.frame.y.toFixed(0)} ${n.frame.width.toFixed(0)}x${n.frame.height.toFixed(0)})`;
        return `${n.ref} ${n.type} "${label}" ${frame}${n.id ? ` id="${n.id}"` : ''}`;
      });

      ctx.session?.logAction('listElements', {}, { count: nodes.length });

      return {
        content: [{
          type: 'text' as const,
          text: `Found ${nodes.length} elements:\n${lines.join('\n')}`,
        }],
      };
    }
  );

  server.tool(
    'findElement',
    'Find a single element by text, accessibility ID, ref, or type',
    {
      selector: z.string().describe('Element selector — @e3 (ref), "Login" (text), #login-btn (ID)'),
    },
    async ({ selector }) => {
      const udid = await ctx.getDeviceUdid();
      if (ctx.refs.getAllElements().length === 0) {
        const rawElements = await idb.describeAll(udid);
        ctx.refs.assignRefs(rawElements);
      }

      const node = resolveSelector(parseSelector(selector), ctx.refs);
      if (!node) {
        return { content: [{ type: 'text' as const, text: `No element found for "${selector}"` }] };
      }

      ctx.session?.logAction('findElement', { selector }, { ref: node.ref });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(node, null, 2),
        }],
      };
    }
  );

  server.tool(
    'getElementInfo',
    'Get detailed info about an element by its ref',
    {
      ref: z.string().describe('Element ref like "@e3"'),
    },
    async ({ ref }) => {
      const node = ctx.refs.getByRef(ref);
      if (!node) {
        return { content: [{ type: 'text' as const, text: `Element ${ref} not found` }], isError: true };
      }

      ctx.session?.logAction('getElementInfo', { ref }, {});

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(node, null, 2),
        }],
      };
    }
  );
}
