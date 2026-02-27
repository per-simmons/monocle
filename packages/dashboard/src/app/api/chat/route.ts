import Anthropic from '@anthropic-ai/sdk';
import { monocleTools } from '../../../lib/tool-definitions';

const MONOCLE_SERVER = process.env.MONOCLE_SERVER_URL || 'http://localhost:7200';

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

interface ToolContent {
  type: string;
  text?: string;
  source?: { type: string; media_type: string; data: string };
}

/**
 * Execute a tool by calling the Monocle server's REST API.
 */
async function executeTool(
  name: string,
  params: Record<string, unknown>
): Promise<{ anthropic: ToolContent[]; client: Record<string, unknown>[] }> {
  const res = await fetch(`${MONOCLE_SERVER}/api/tools/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, params }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const text = `Tool error: ${err.error || res.statusText}`;
    return {
      anthropic: [{ type: 'text', text }],
      client: [{ type: 'text', text }],
    };
  }

  const result = await res.json();
  const anthropic: ToolContent[] = [];
  const client: Record<string, unknown>[] = [];

  for (const block of result.content || []) {
    if (block.type === 'text') {
      anthropic.push({ type: 'text', text: block.text });
      client.push({ type: 'text', text: block.text });
    } else if (block.type === 'image') {
      anthropic.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: block.mimeType || 'image/jpeg',
          data: block.data,
        },
      });
      client.push({ type: 'image', data: block.data, mimeType: block.mimeType || 'image/jpeg' });
    }
  }

  if (anthropic.length === 0) {
    anthropic.push({ type: 'text', text: 'Tool returned no content' });
    client.push({ type: 'text', text: 'Tool returned no content' });
  }

  return { anthropic, client };
}

export async function POST(req: Request) {
  const { messages: clientMessages } = await req.json();

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  // Build the Anthropic message history from client messages
  const messages: Anthropic.Messages.MessageParam[] = clientMessages.map(
    (m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })
  );

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      }

      try {
        let turnCount = 0;
        const maxTurns = 50;

        // Agentic loop: keep going until Claude stops calling tools
        while (turnCount < maxTurns) {
          turnCount++;

          const response = await anthropic.messages.create({
            model: 'claude-opus-4-6',
            max_tokens: 16384,
            system: SYSTEM_PROMPT,
            tools: monocleTools,
            messages,
          });

          // Send text blocks to client
          for (const block of response.content) {
            if (block.type === 'text') {
              send({ type: 'text', content: block.text });
            }
          }

          // If no tool calls, we're done
          const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use'
          );

          if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
            break;
          }

          // Execute tools and build results for both client display and next API call
          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];

          for (const block of toolUseBlocks) {
            send({ type: 'tool_call', name: block.name, params: block.input, id: block.id });

            const { anthropic: anthropicContent, client: clientContent } = await executeTool(
              block.name,
              block.input as Record<string, unknown>
            );

            send({ type: 'tool_result', name: block.name, id: block.id, result: clientContent });

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: anthropicContent as Anthropic.Messages.ToolResultBlockParam['content'],
            });
          }

          // Append to message history for next iteration
          messages.push({ role: 'assistant', content: response.content });
          messages.push({ role: 'user', content: toolResults });
        }

        if (turnCount >= maxTurns) {
          send({ type: 'text', content: '\n\n[Agent reached maximum turn limit]' });
        }

        send({ type: 'done' });
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
