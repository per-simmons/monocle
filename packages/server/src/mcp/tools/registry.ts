import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface ToolEntry {
  description: string;
  handler: (params: Record<string, unknown>) => Promise<{
    content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
    isError?: boolean;
  }>;
}

/**
 * Runtime-callable registry of all Monocle tools.
 * Built from the MCP server's internal tool registry after registration.
 */
export const toolRegistry = new Map<string, ToolEntry>();

/**
 * Extract registered tools from the MCP server's internal state
 * and build a callable registry for the REST API.
 *
 * Must be called AFTER registerAllTools().
 */
export function buildRegistry(server: McpServer): void {
  const internal = (server as any)._registeredTools as Record<string, any> | undefined;
  if (!internal) {
    console.warn('[monocle] Could not access MCP server tool registry');
    return;
  }

  for (const [name, entry] of Object.entries(internal)) {
    const hasInputSchema = !!entry.inputSchema;

    toolRegistry.set(name, {
      description: entry.description ?? '',
      handler: async (params) => {
        // MCP tool handlers: with schema → handler(args, extra), without → handler(extra)
        if (hasInputSchema) {
          return await Promise.resolve(entry.handler(params, {}));
        } else {
          return await Promise.resolve(entry.handler({}));
        }
      },
    });
  }

  console.log(`[monocle] Tool registry: ${toolRegistry.size} tools callable via REST`);
}
