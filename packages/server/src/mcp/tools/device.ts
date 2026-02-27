import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as simctl from '../../bridges/simctl.js';
import type { ToolContext } from '../server.js';

export function registerDeviceTools(server: McpServer, ctx: ToolContext) {
  server.tool(
    'listDevices',
    'List all available iOS simulators',
    {},
    async () => {
      const devices = await simctl.listDevices();
      const lines = devices.map((d) => {
        const status = d.state === 'Booted' ? '[BOOTED]' : '[off]';
        return `${status} ${d.name} (${d.udid}) — ${d.runtime.split('.').pop()}`;
      });

      return {
        content: [{ type: 'text' as const, text: lines.join('\n') || 'No simulators found' }],
      };
    }
  );

  server.tool(
    'launchApp',
    'Launch an app by bundle ID on the simulator',
    {
      bundleId: z.string().describe('App bundle ID (e.g., "live.vibin.app")'),
    },
    async ({ bundleId }) => {
      const udid = await ctx.getDeviceUdid();
      await simctl.launchApp(udid, bundleId);
      ctx.session?.logAction('launchApp', { bundleId }, {});
      return { content: [{ type: 'text' as const, text: `Launched ${bundleId}` }] };
    }
  );

  server.tool(
    'terminateApp',
    'Terminate a running app',
    {
      bundleId: z.string().describe('App bundle ID'),
    },
    async ({ bundleId }) => {
      const udid = await ctx.getDeviceUdid();
      await simctl.terminateApp(udid, bundleId);
      ctx.session?.logAction('terminateApp', { bundleId }, {});
      return { content: [{ type: 'text' as const, text: `Terminated ${bundleId}` }] };
    }
  );

  server.tool(
    'getDeviceInfo',
    'Get info about the current simulator (name, OS, screen size)',
    {},
    async () => {
      const device = await simctl.getBootedDevice();
      if (!device) {
        return { content: [{ type: 'text' as const, text: 'No booted simulator' }], isError: true };
      }

      const info = {
        name: device.name,
        udid: device.udid,
        state: device.state,
        runtime: device.runtime,
      };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(info, null, 2) }],
      };
    }
  );

  server.tool(
    'openUrl',
    'Open a URL or deep link in the simulator',
    {
      url: z.string().describe('URL or deep link to open'),
    },
    async ({ url }) => {
      const udid = await ctx.getDeviceUdid();
      await simctl.openUrl(udid, url);
      ctx.session?.logAction('openUrl', { url }, {});
      return { content: [{ type: 'text' as const, text: `Opened ${url}` }] };
    }
  );
}
