import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as simctl from '../../bridges/simctl.js';
import * as idb from '../../bridges/idb.js';
import { processScreenshot } from '../../utils/image.js';
import { config } from '../../config.js';
import type { ToolContext } from '../server.js';

export function registerScreenTools(server: McpServer, ctx: ToolContext) {
  server.tool(
    'screenshot',
    'Capture a screenshot of the current simulator screen',
    {
      format: z.enum(['jpeg', 'png']).optional().describe('Image format (default: jpeg)'),
      width: z.number().optional().describe('Resize width in pixels (default: 1024)'),
    },
    async ({ format, width }) => {
      const udid = await ctx.getDeviceUdid();
      const raw = await simctl.screenshot(udid, format ?? 'jpeg');
      const processed = await processScreenshot(raw, {
        format: format ?? 'jpeg',
        width: width ?? config.screenshotWidth,
        quality: config.jpegQuality,
      });

      ctx.session?.logAction('screenshot', { format, width }, {
        size: processed.length,
      });

      return {
        content: [{
          type: 'image' as const,
          data: processed.toString('base64'),
          mimeType: format === 'png' ? 'image/png' : 'image/jpeg',
        }],
      };
    }
  );

  server.tool(
    'getScreenText',
    'Get all visible text on the current screen',
    {},
    async () => {
      const udid = await ctx.getDeviceUdid();
      const elements = await idb.describeAll(udid);

      const texts: string[] = [];
      for (const el of elements) {
        if (el.AXLabel && el.AXLabel.trim()) {
          texts.push(el.AXLabel.trim());
        }
        if (el.AXValue && el.AXValue.trim() && el.AXValue !== el.AXLabel) {
          texts.push(el.AXValue.trim());
        }
      }

      const text = texts.join('\n');
      ctx.session?.logAction('getScreenText', {}, { textLength: text.length });

      return {
        content: [{ type: 'text' as const, text }],
      };
    }
  );
}
