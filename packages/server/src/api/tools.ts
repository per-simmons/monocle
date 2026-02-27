import { Router } from 'express';
import { toolRegistry } from '../mcp/tools/registry.js';

export const toolsRouter = Router();

/**
 * POST /api/tools/execute
 * Execute a Monocle tool by name. Used by the dashboard agent loop.
 *
 * Body: { name: string, params: Record<string, unknown> }
 * Returns: MCP-style { content: [...], isError? }
 */
toolsRouter.post('/execute', async (req, res) => {
  const { name, params } = req.body as { name: string; params?: Record<string, unknown> };

  if (!name) {
    res.status(400).json({ error: 'Missing tool name' });
    return;
  }

  const tool = toolRegistry.get(name);
  if (!tool) {
    res.status(404).json({ error: `Tool "${name}" not found`, available: [...toolRegistry.keys()] });
    return;
  }

  try {
    const result = await tool.handler(params ?? {});
    res.json(result);
  } catch (err) {
    res.status(500).json({
      content: [{ type: 'text', text: `Tool error: ${(err as Error).message}` }],
      isError: true,
    });
  }
});

/**
 * GET /api/tools
 * List all available tools.
 */
toolsRouter.get('/', (_req, res) => {
  const tools = [...toolRegistry.entries()].map(([name, entry]) => ({
    name,
    description: entry.description,
  }));
  res.json({ tools, count: tools.length });
});
