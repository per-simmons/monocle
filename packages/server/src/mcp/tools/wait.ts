import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as idb from '../../bridges/idb.js';
import { resolveSelector, parseSelector } from '../../refs/resolver.js';
import { waitFor } from '../../utils/retry.js';
import { config } from '../../config.js';
import type { ToolContext } from '../server.js';

export function registerWaitTools(server: McpServer, ctx: ToolContext) {
  server.tool(
    'waitForElement',
    'Wait until an element matching the selector appears on screen',
    {
      selector: z.string().describe('Element selector — "Login", #login-btn, @e3'),
      timeoutMs: z.number().optional().describe(`Timeout in ms (default: ${config.waitTimeout})`),
    },
    async ({ selector, timeoutMs }) => {
      const udid = await ctx.getDeviceUdid();
      const parsed = parseSelector(selector);

      const node = await waitFor(async () => {
        const elements = await idb.describeAll(udid);
        ctx.refs.assignRefs(elements);
        return resolveSelector(parsed, ctx.refs);
      }, {
        timeoutMs: timeoutMs ?? config.waitTimeout,
        label: `element "${selector}"`,
      });

      ctx.session?.logAction('waitForElement', { selector, timeoutMs }, { ref: node.ref });

      return {
        content: [{
          type: 'text' as const,
          text: `Found ${node.ref} "${node.label}" (${node.type}) at (${node.frame.x.toFixed(0)},${node.frame.y.toFixed(0)})`,
        }],
      };
    }
  );

  server.tool(
    'waitForText',
    'Wait until specific text appears anywhere on screen',
    {
      text: z.string().describe('Text to wait for'),
      timeoutMs: z.number().optional().describe(`Timeout in ms (default: ${config.waitTimeout})`),
    },
    async ({ text, timeoutMs }) => {
      const udid = await ctx.getDeviceUdid();
      const lower = text.toLowerCase();

      await waitFor(async () => {
        const elements = await idb.describeAll(udid);
        const found = elements.some(
          (el) =>
            el.AXLabel?.toLowerCase().includes(lower) ||
            el.AXValue?.toLowerCase().includes(lower)
        );
        return found ? true : null;
      }, {
        timeoutMs: timeoutMs ?? config.waitTimeout,
        label: `text "${text}"`,
      });

      ctx.session?.logAction('waitForText', { text, timeoutMs }, {});

      return {
        content: [{ type: 'text' as const, text: `Text "${text}" found on screen` }],
      };
    }
  );

  server.tool(
    'assertVisible',
    'Assert that an element is visible on screen. Returns error if not found.',
    {
      selector: z.string().describe('Element selector'),
    },
    async ({ selector }) => {
      const udid = await ctx.getDeviceUdid();
      const elements = await idb.describeAll(udid);
      ctx.refs.assignRefs(elements);

      const parsed = parseSelector(selector);
      const node = resolveSelector(parsed, ctx.refs);

      ctx.session?.logAction('assertVisible', { selector }, { found: !!node });

      if (!node) {
        return {
          content: [{ type: 'text' as const, text: `ASSERTION FAILED: "${selector}" is not visible` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text' as const, text: `PASS: ${node.ref} "${node.label}" is visible` }],
      };
    }
  );
}
