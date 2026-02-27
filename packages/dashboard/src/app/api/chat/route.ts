import { query } from '@anthropic-ai/claude-agent-sdk';

const MONOCLE_ROOT = process.env.MONOCLE_ROOT || '/Users/patsimmons/client-coding/monocle';

const SYSTEM_PROMPT = `You are Monocle, an autonomous QA agent for iOS apps. You explore apps thoroughly and report bugs, slow loads, broken UI, and unexpected behavior.

Your process:
1. Screenshot the current screen to see what's there
2. List elements to understand the UI structure
3. Systematically explore: tap every button, navigate every tab, test every input
4. Screenshot before and after each action to verify results
5. Note timing — if something takes more than 2-3 seconds to load, flag it
6. Try edge cases: empty inputs, rapid taps, back navigation
7. When done, summarize: what works, what's broken, what's slow

Use element refs (@e1, @e2) for precise interactions. Always screenshot to verify results.
Always call listElements before trying to interact with specific elements.`;

/** Strip the MCP prefix from tool names for display */
function displayName(mcpName: string): string {
  return mcpName.replace(/^mcp__monocle__/, '');
}

export async function POST(req: Request) {
  const { message, sessionId } = await req.json();

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      // Track tool_use_id → display name
      const toolNames = new Map<string, string>();

      try {
        const q = query({
          prompt: message,
          options: {
            model: 'claude-opus-4-6',
            systemPrompt: SYSTEM_PROMPT,
            cwd: MONOCLE_ROOT,
            mcpServers: {
              monocle: {
                command: `${MONOCLE_ROOT}/node_modules/.bin/tsx`,
                args: [`${MONOCLE_ROOT}/packages/server/src/index.ts`, '--stdio'],
              },
            },
            tools: [], // Disable built-in Claude Code tools
            allowedTools: ['mcp__monocle__*'], // Auto-approve all Monocle MCP tools
            permissionMode: 'bypassPermissions',
            allowDangerouslySkipPermissions: true,
            includePartialMessages: true,
            maxTurns: 50,
            ...(sessionId ? { resume: sessionId } : {}),
          },
        });

        for await (const msg of q) {
          switch (msg.type) {
            // ── System init → send session ID to client ──
            case 'system': {
              if ('subtype' in msg && msg.subtype === 'init') {
                send({ type: 'session', sessionId: msg.session_id });
              }
              break;
            }

            // ── Streaming events → text deltas + tool_use starts ──
            case 'stream_event': {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const ev = (msg as any).event;

              // Tool call starts
              if (ev?.type === 'content_block_start') {
                const block = ev.content_block;
                if (block?.type === 'tool_use') {
                  const name = displayName(block.name);
                  toolNames.set(block.id, name);
                  send({
                    type: 'tool_call',
                    name,
                    id: block.id,
                    params: {},
                  });
                }
              }

              // Text streaming
              if (ev?.type === 'content_block_delta') {
                if (ev.delta?.type === 'text_delta') {
                  send({ type: 'text', content: ev.delta.text });
                }
              }
              break;
            }

            // ── User messages (tool results with images) ──
            case 'user': {
              // Skip replayed messages from session resume
              if ('isReplay' in msg && (msg as Record<string, unknown>).isReplay) break;

              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const content = (msg as any).message?.content;
              if (!Array.isArray(content)) break;

              for (const block of content) {
                if (block.type !== 'tool_result') continue;

                const toolUseId = block.tool_use_id as string;
                const name = toolNames.get(toolUseId) || 'unknown';

                // Normalize content to array
                const resultContent = Array.isArray(block.content)
                  ? block.content
                  : typeof block.content === 'string'
                    ? [{ type: 'text', text: block.content }]
                    : [];

                // Build client-friendly result array
                const clientResult: Record<string, unknown>[] = [];
                for (const item of resultContent) {
                  if (item.type === 'text') {
                    clientResult.push({ type: 'text', text: item.text });
                  } else if (item.type === 'image') {
                    const src = item.source;
                    if (src?.type === 'base64') {
                      clientResult.push({
                        type: 'image',
                        data: src.data,
                        mimeType: src.media_type || 'image/jpeg',
                      });
                    }
                  }
                }

                send({
                  type: 'tool_result',
                  name,
                  id: toolUseId,
                  result: clientResult,
                });
              }
              break;
            }

            // ── Tool progress → status updates ──
            case 'tool_progress': {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const progress = msg as any;
              const name = displayName(progress.tool_name || '');
              send({ type: 'status', name, content: `Running ${name}...` });
              break;
            }

            // ── Result → done or error ──
            case 'result': {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const result = msg as any;
              if (result.subtype === 'success') {
                send({ type: 'done' });
              } else {
                const errors = result.errors?.join(', ') || result.subtype;
                send({ type: 'error', content: `Agent error: ${errors}` });
              }
              break;
            }
          }
        }
      } catch (err) {
        send({
          type: 'error',
          content: `Agent error: ${(err as Error).message}`,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
