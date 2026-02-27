import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as simctl from '../../bridges/simctl.js';
import { config } from '../../config.js';
import type { ToolContext } from '../server.js';

export function registerRecordingTools(server: McpServer, ctx: ToolContext) {
  server.tool(
    'startRecording',
    'Start video recording of the simulator screen (H.264)',
    {
      filename: z.string().optional().describe('Output filename (default: auto-generated)'),
    },
    async ({ filename }) => {
      const udid = await ctx.getDeviceUdid();
      const name = filename ?? `recording-${randomUUID().slice(0, 8)}.mp4`;
      const outputPath = join(config.sessionsDir, name);

      await simctl.startRecording(udid, outputPath);
      ctx.session?.logAction('startRecording', { filename: name }, {});

      return {
        content: [{ type: 'text' as const, text: `Recording started → ${outputPath}` }],
      };
    }
  );

  server.tool(
    'stopRecording',
    'Stop the current video recording and return the file path',
    {},
    async () => {
      const path = await simctl.stopRecording();
      ctx.session?.logAction('stopRecording', {}, { path });

      return {
        content: [{ type: 'text' as const, text: `Recording saved → ${path}` }],
      };
    }
  );
}
