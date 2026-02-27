import { createServer } from 'node:http';
import { createApiRouter } from './api/router.js';
import { WebSocketHub } from './stream/ws-hub.js';
import { createMcpServer } from './mcp/server.js';
import { buildRegistry } from './mcp/tools/registry.js';
import { config } from './config.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as simctl from './bridges/simctl.js';

const isStdio = process.argv.includes('--stdio');

async function main() {
  // Always create MCP server (registers tools, boots session)
  const { server: mcpServer, ctx } = await createMcpServer();

  // Build callable registry from MCP-registered tools (for REST API)
  buildRegistry(mcpServer);

  if (isStdio) {
    // Stdio-only mode (for Claude Code, Cursor, etc.)
    const transport = new StdioServerTransport();
    await mcpServer.connect(transport);
    console.error('[monocle] MCP server running on stdio');
    return;
  }

  // Full server mode: REST API + WebSocket streaming + MCP over HTTP
  const app = createApiRouter();

  // Elements endpoint (needs access to tool context)
  app.get('/api/elements', async (_req, res) => {
    try {
      const elements = ctx.refs.getAllElements();
      res.json({ elements });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  // Screenshot endpoint
  app.get('/api/screenshot', async (_req, res) => {
    try {
      const udid = await ctx.getDeviceUdid();
      const buffer = await simctl.screenshot(udid, 'jpeg');
      res.set('Content-Type', 'image/jpeg');
      res.send(buffer);
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  const httpServer = createServer(app);

  // WebSocket hub for live simulator streaming
  const wsHub = new WebSocketHub(httpServer);

  // Auto-start streaming if a device is booted
  try {
    const udid = await ctx.getDeviceUdid();
    wsHub.startStreaming(udid);
    console.log(`[monocle] Live streaming started for device ${udid}`);
  } catch {
    console.log('[monocle] No booted simulator — streaming will start when a device connects');
  }

  // Stream control endpoints
  app.post('/api/stream/start', async (_req, res) => {
    try {
      const udid = await ctx.getDeviceUdid();
      wsHub.startStreaming(udid);
      res.json({ status: 'streaming', udid });
    } catch (err) {
      res.status(500).json({ error: (err as Error).message });
    }
  });

  app.post('/api/stream/stop', (_req, res) => {
    wsHub.stopStreaming();
    res.json({ status: 'stopped' });
  });

  app.get('/api/stream/status', (_req, res) => {
    res.json({ clients: wsHub.getClientCount() });
  });

  httpServer.listen(config.port, () => {
    console.log(`[monocle] Server running on http://localhost:${config.port}`);
    console.log(`[monocle] WebSocket stream at ws://localhost:${config.port}/stream`);
    console.log(`[monocle] REST API at http://localhost:${config.port}/api`);
  });
}

main().catch((err) => {
  console.error('[monocle] Fatal error:', err);
  process.exit(1);
});
