import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ElementRefManager } from '../refs/element-refs.js';
import { SessionManager } from '../session/manager.js';
import * as simctl from '../bridges/simctl.js';
import { registerAllTools } from './tools/index.js';

export interface ToolContext {
  refs: ElementRefManager;
  session: SessionManager | null;
  getDeviceUdid: () => Promise<string>;
}

/**
 * Create and start the Monocle MCP server.
 * Supports stdio transport (for Claude Code, Cursor, etc.).
 */
export async function createMcpServer(): Promise<{
  server: McpServer;
  ctx: ToolContext;
}> {
  const server = new McpServer({
    name: 'monocle',
    version: '0.1.0',
  });

  const refs = new ElementRefManager();
  let cachedUdid: string | null = null;

  // Start a session with the current device
  const device = await simctl.getBootedDevice();
  let session: SessionManager | null = null;
  if (device) {
    session = await SessionManager.create(device.name, device.udid);
    cachedUdid = device.udid;
  }

  const ctx: ToolContext = {
    refs,
    session,
    getDeviceUdid: async () => {
      if (cachedUdid) return cachedUdid;
      const d = await simctl.getBootedDevice();
      if (!d) throw new Error('No booted iOS simulator found. Boot one with: xcrun simctl boot <udid>');
      cachedUdid = d.udid;
      return d.udid;
    },
  };

  // Register all 21+ tools
  registerAllTools(server, ctx);

  return { server, ctx };
}

/**
 * Start MCP server with stdio transport.
 */
export async function startStdioServer(): Promise<void> {
  const { server } = await createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
