import { spawn, ChildProcess } from 'child_process';

const MONOCLE_ROOT = process.env.MONOCLE_ROOT || '/Users/patsimmons/client-coding/monocle';

/* ── Detailed logging ── */
const LOG_PREFIX = '[monocle-chat]';
function log(level: 'info' | 'warn' | 'error' | 'debug', ...args: unknown[]) {
  const ts = new Date().toISOString().slice(11, 23); // HH:mm:ss.SSS
  const tag = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'debug' ? '🔍' : '▶';
  console[level === 'debug' ? 'log' : level](`${LOG_PREFIX} ${ts} ${tag}`, ...args);
}

const SYSTEM_PROMPT = `You are Monocle, an autonomous agent for iOS apps. You can QA apps, fix bugs, and make code changes — all while seeing the results live in the simulator.

## Capabilities
1. **QA Testing**: Explore apps, find bugs, test interactions
2. **Code Editing**: Read, edit, and write source files using your built-in tools (Read, Edit, Write, Bash, Glob, Grep)
3. **Live Verification**: After making code changes, the app hot-reloads and you can immediately verify the fix in the simulator

## Observation Strategy (Hierarchy-First)
- ALWAYS call listElements first to get the structured UI tree — this is your primary way to understand what's on screen
- Use screenshot to see the visual layout and catch rendering issues
- After every action (tap, swipe, type), call listElements again to verify state changed
- Use element refs (@e1, @e2, etc.) from listElements for precise interactions

## Speed Rules
- Do NOT watch videos or wait for media to finish playing. Verify the player loaded, then move on.
- Do NOT read full articles/posts. Verify the content screen loaded, then go back.
- Do NOT scroll to the bottom of infinite feeds. Check a few items, then move on.
- Spend no more than 2 actions per screen before moving to the next.

## QA Process
1. **Map the app**: Screenshot + listElements on the initial screen. Identify all navigation paths.
2. **Explore systematically**: Visit every screen. For each:
   - List all interactive elements
   - Tap/interact with each one
   - Verify the result
   - Screenshot to document
3. **Test inputs**: For every text field — valid input, empty, edge cases
4. **Test navigation**: Back nav from every screen, tab state persistence
5. **Check timing**: Flag anything > 2 seconds
6. **Check visual quality**: Cut-off text, overlapping, broken images, placeholder text

## Code Editing Process
When asked to fix bugs or make changes:
1. First understand the issue (screenshot, listElements)
2. Use Bash/Glob/Grep to find the relevant source files
3. Use Read to examine the code
4. Use Edit/Write to make changes
5. Wait for hot reload, then screenshot to verify the fix
6. If the fix didn't work, iterate

## Reporting
After exploring, provide a structured report:
- **Working well**: Features that function correctly
- **Bugs found**: Broken functionality, crashes, errors (with screenshots)
- **Performance issues**: Slow loads, laggy transitions
- **Visual issues**: Layout problems, rendering glitches
- **Suggestions**: UX improvements noticed during testing`;

/* ─────────── MCP Client (stdio JSON-RPC to local Monocle server) ─────────── */

interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

class McpClient {
  private proc: ChildProcess | null = null;
  private buffer = '';
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  private nextId = 1;
  tools: McpTool[] = [];

  async start(): Promise<void> {
    const tsxBin = `${MONOCLE_ROOT}/node_modules/.bin/tsx`;
    const serverPath = `${MONOCLE_ROOT}/packages/server/src/index.ts`;

    log('info', `Starting LOCAL MCP server: ${tsxBin} ${serverPath} --stdio`);

    this.proc = spawn(tsxBin, [serverPath, '--stdio'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: MONOCLE_ROOT,
      env: { ...process.env, NODE_ENV: 'development' },
    });

    this.proc.stdout!.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString();
      this.processBuffer();
    });

    this.proc.stderr!.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg) log('debug', `MCP stderr: ${msg.slice(0, 200)}`);
    });

    this.proc.on('exit', (code) => {
      log('warn', `MCP server exited with code ${code}`);
      for (const [, p] of this.pending) {
        p.reject(new Error(`MCP server exited with code ${code}`));
      }
      this.pending.clear();
    });

    // Initialize MCP protocol
    const initResult = await this.rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'monocle-dashboard', version: '0.1.0' },
    });
    log('info', `MCP initialized: ${JSON.stringify(initResult).slice(0, 100)}`);

    // List available tools
    const toolsResult = await this.rpc('tools/list', {}) as { tools: McpTool[] };
    this.tools = toolsResult.tools;
    log('info', `MCP tools loaded: ${this.tools.length} tools — [${this.tools.map(t => t.name).join(', ')}]`);
  }

  private processBuffer(): void {
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const msg = JSON.parse(trimmed);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!;
          this.pending.delete(msg.id);
          if (msg.error) {
            p.reject(new Error(`MCP error: ${msg.error.message || JSON.stringify(msg.error)}`));
          } else {
            p.resolve(msg.result);
          }
        }
      } catch {
        log('debug', `MCP unparseable line: ${trimmed.slice(0, 100)}`);
      }
    }
  }

  private rpc(method: string, params: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      const msg = JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n';
      log('debug', `MCP → ${method} (id=${id})`);
      this.proc!.stdin!.write(msg);

      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id);
          reject(new Error(`MCP timeout: ${method} (id=${id})`));
        }
      }, 30000);
    });
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const callStart = Date.now();
    log('info', `  🔧 MCP call: ${name}(${JSON.stringify(args).slice(0, 150)})`);
    const result = await this.rpc('tools/call', { name, arguments: args });
    const elapsed = Date.now() - callStart;
    log('info', `  ✅ MCP result: ${name} (${elapsed}ms)`);
    return result;
  }

  stop(): void {
    if (this.proc) {
      log('info', 'Stopping MCP server');
      this.proc.kill('SIGTERM');
      this.proc = null;
    }
  }
}

/* ─────────── Remote Claude CLI on Mac Mini ─────────── */

const MAC_MINI_SSH = 'mac-mini-pivot'; // SSH config alias → pivotagents@192.168.1.100
const CLAUDE_BIN = '/opt/homebrew/bin/claude';

/**
 * Architecture: "Split Brain" agent pattern
 *
 * 1. Claude runs on Mac Mini (authenticated, Max plan, separate rate limits)
 * 2. MCP tools run locally (control the iOS simulator on this machine)
 * 3. This API route bridges them:
 *    - Sends prompt to Claude on Mac Mini (no MCP servers configured)
 *    - Claude responds with tool_use blocks
 *    - We execute tools locally via MCP
 *    - We feed tool results back to Claude via session resume
 *    - Repeat until Claude says end_turn
 */

interface ClaudeToolUse {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

interface ClaudeStreamMessage {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>;
    stop_reason?: string;
    usage?: { input_tokens: number; output_tokens: number };
  };
  result?: string;
  total_cost_usd?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/** Build tool definitions as a JSON file for --allowedTools */
function buildToolDefinitionsPrompt(tools: McpTool[]): string {
  const lines = ['Available tools (call them by name with JSON arguments):'];
  for (const t of tools) {
    const params = t.inputSchema.properties
      ? Object.entries(t.inputSchema.properties as Record<string, { type?: string; description?: string }>)
          .map(([k, v]) => `${k}: ${v.type || 'any'} — ${v.description || ''}`)
          .join('; ')
      : 'no params';
    lines.push(`- ${t.name}: ${t.description} | Params: ${params}`);
  }
  return lines.join('\n');
}

/** Run Claude CLI on Mac Mini via SSH, parse stream-json output */
async function runClaudeOnMacMini(
  prompt: string,
  sessionId?: string,
  signal?: AbortSignal,
): Promise<AsyncGenerator<ClaudeStreamMessage>> {
  // Strategy: pipe prompt through SSH stdin → cat > tmpfile on Mac Mini.
  // Then claude reads the file. This avoids ALL shell escaping issues.
  const tmpFile = `/tmp/monocle-prompt-${Date.now()}.txt`;
  const resumeFlag = sessionId ? ` --resume '${sessionId}'` : '';

  // Remote command: capture stdin to file, run claude from file, cleanup
  const remoteCmd = [
    'export PATH=/opt/homebrew/bin:$PATH',
    'security unlock-keychain -p jeternumber2 ~/Library/Keychains/login.keychain-db 2>/dev/null',
    `cat > ${tmpFile}`,
    `${CLAUDE_BIN} -p "$(cat ${tmpFile})" --output-format stream-json --verbose --max-turns 1 --model claude-opus-4-6 --tools ''${resumeFlag}`,
    `rm -f ${tmpFile}`,
  ].join('; ');

  log('info', `SSH → Mac Mini: claude (prompt: ${prompt.length} chars${sessionId ? ', resume: ' + sessionId : ''})`);

  const proc = spawn('ssh', [MAC_MINI_SSH, remoteCmd], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Kill SSH process when abort signal fires
  const killProc = () => {
    if (!proc.killed) {
      log('info', '🛑 Abort signal — killing SSH process');
      proc.kill('SIGTERM');
      // Also kill any claude processes on Mac Mini
      spawn('ssh', [MAC_MINI_SSH, 'pkill -f "claude.*stream-json" 2>/dev/null'], {
        stdio: 'ignore',
      });
    }
  };
  signal?.addEventListener('abort', killProc, { once: true });

  // Pipe the prompt through stdin — no shell escaping needed
  proc.stdin!.write(prompt);
  proc.stdin!.end();

  // Safety: kill process if it hasn't produced output in 3 minutes
  const TURN_TIMEOUT_MS = 180_000;

  // Return async generator that yields parsed JSON messages
  async function* generate(): AsyncGenerator<ClaudeStreamMessage> {
    let buffer = '';

    const messageQueue: ClaudeStreamMessage[] = [];
    let done = false;
    let resolveWait: (() => void) | null = null;
    let lastActivity = Date.now();

    // Timeout watchdog — kills process if no output for 3 min
    const watchdog = setInterval(() => {
      if (Date.now() - lastActivity > TURN_TIMEOUT_MS && !done) {
        log('warn', `Turn timeout (${TURN_TIMEOUT_MS / 1000}s no output) — killing`);
        killProc();
      }
    }, 10_000);

    proc.stdout!.on('data', (chunk: Buffer) => {
      lastActivity = Date.now();
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const msg = JSON.parse(trimmed) as ClaudeStreamMessage;
          messageQueue.push(msg);
          resolveWait?.();
        } catch {
          log('debug', `Claude unparseable: ${trimmed.slice(0, 100)}`);
        }
      }
    });

    proc.stderr!.on('data', (chunk: Buffer) => {
      lastActivity = Date.now();
      const msg = chunk.toString().trim();
      if (msg) log('debug', `Claude stderr: ${msg.slice(0, 200)}`);
    });

    proc.on('close', () => {
      done = true;
      clearInterval(watchdog);
      signal?.removeEventListener('abort', killProc);
      resolveWait?.();
    });

    while (true) {
      if (signal?.aborted) { clearInterval(watchdog); break; }
      if (messageQueue.length > 0) {
        yield messageQueue.shift()!;
      } else if (done) {
        break;
      } else {
        await new Promise<void>(r => { resolveWait = r; });
        resolveWait = null;
      }
    }
  }

  return generate();
}

/* ─────────── Session state ─────────── */

interface SessionState {
  macMiniSessionId: string | null;
  conversationHistory: Array<{ role: string; content: string }>;
}
const sessions = new Map<string, SessionState>();

/* ─────────── POST handler ─────────── */

export async function POST(req: Request) {
  const { message, sessionId: clientSessionId } = await req.json();
  const startTime = Date.now();

  const ourSessionId = clientSessionId || `monocle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const session = sessions.get(ourSessionId) || { macMiniSessionId: null, conversationHistory: [] };
  const isResume = !!clientSessionId && sessions.has(clientSessionId);

  // Use the request's abort signal to detect client disconnect (Stop/Clear)
  const abortController = new AbortController();
  const signal = abortController.signal;

  // When client disconnects, trigger abort
  req.signal.addEventListener('abort', () => {
    log('info', '🛑 Client disconnected — aborting agent loop');
    abortController.abort();
  }, { once: true });

  log('info', `══════════════════════════════════════`);
  log('info', `── NEW REQUEST ──`);
  log('info', `Prompt: "${message.slice(0, 120)}${message.length > 120 ? '...' : ''}"`);
  log('info', `Session: ${ourSessionId} (${isResume ? 'resume' : 'new'})`);
  log('info', `Architecture: Claude on Mac Mini ↔ MCP tools local`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: Record<string, unknown>) {
        if (signal.aborted) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller may be closed if client disconnected
        }
      }

      let mcp: McpClient | null = null;
      let toolCallCount = 0;
      let turnCount = 0;
      const MAX_TURNS = 25;

      try {
        // ── 1. Start local MCP server (controls simulator) ──
        mcp = new McpClient();
        await mcp.start();
        send({ type: 'status', content: 'Connected to simulator...' });
        send({ type: 'session', sessionId: ourSessionId });

        // ── 2. Build the prompt with tool definitions ──
        // Since Claude on Mac Mini has no MCP servers configured,
        // we embed tool definitions in the system prompt and ask Claude
        // to output tool calls in a structured format we can parse.
        const toolDefs = buildToolDefinitionsPrompt(mcp.tools);

        const fullSystemPrompt = `${SYSTEM_PROMPT}

## Tool Calling
You have access to the following tools for interacting with the iOS simulator. To call a tool, output a tool call block in this EXACT format:

<tool_call>
{"name": "toolName", "arguments": {"param1": "value1"}}
</tool_call>

You can call multiple tools by using multiple <tool_call> blocks.

After outputting tool calls, STOP and wait for results. Results will be provided in <tool_result> blocks.

${toolDefs}

IMPORTANT: Always use <tool_call> blocks for tool invocations. Do not describe what you would do — actually call the tools.`;

        // Build the user message, including any tool results from the previous turn
        let userMessage = message;
        if (!isResume) {
          // First message — just the user's prompt
          userMessage = `[System Prompt]\n${fullSystemPrompt}\n\n[User Request]\n${message}`;
        }

        // ── 3. Agentic loop ──
        let currentPrompt = userMessage;

        while (turnCount < MAX_TURNS && !signal.aborted) {
          turnCount++;
          const turnStart = Date.now();
          log('info', `── Turn ${turnCount}/${MAX_TURNS} ──`);

          send({ type: 'status', content: turnCount === 1 ? 'Thinking...' : 'Analyzing results...' });

          // Run Claude on Mac Mini
          const messages = await runClaudeOnMacMini(
            currentPrompt,
            session.macMiniSessionId || undefined,
            signal,
          );

          let fullText = '';
          let stopReason = '';
          let macSessionId = '';

          for await (const msg of messages) {
            log('debug', `Claude msg type: ${msg.type}${msg.subtype ? '/' + msg.subtype : ''}`);

            if (msg.type === 'system' && msg.subtype === 'init') {
              macSessionId = msg.session_id || '';
              session.macMiniSessionId = macSessionId;
              log('info', `Mac Mini session: ${macSessionId}`);
            }

            if (msg.type === 'assistant' && msg.message) {
              for (const block of msg.message.content) {
                if (block.type === 'text' && block.text) {
                  fullText += block.text;
                }
              }
              stopReason = msg.message.stop_reason || '';
              if (msg.message.usage) {
                log('info', `  Usage: ${msg.message.usage.input_tokens}in / ${msg.message.usage.output_tokens}out`);
              }
            }

            if (msg.type === 'result') {
              const elapsed = ((Date.now() - turnStart) / 1000).toFixed(1);
              log('info', `  Turn ${turnCount} completed: ${elapsed}s | cost: $${msg.total_cost_usd?.toFixed(4) || '?'}`);
            }
          }

          log('info', `  Claude text (${fullText.length} chars): "${fullText.slice(0, 150)}..."`);

          // ── 4. Parse tool calls from Claude's response ──
          const toolCallRegex = /<tool_call>\s*(\{[\s\S]*?\})\s*<\/tool_call>/g;
          const toolCalls: Array<{ name: string; arguments: Record<string, unknown> }> = [];
          let textWithoutToolCalls = fullText;

          let match;
          while ((match = toolCallRegex.exec(fullText)) !== null) {
            try {
              const parsed = JSON.parse(match[1]);
              toolCalls.push(parsed);
            } catch (e) {
              log('error', `Failed to parse tool call: ${(e as Error).message}`);
            }
          }

          // Remove tool call blocks and any leaked tool_result blocks from text
          textWithoutToolCalls = fullText
            .replace(/<tool_call>[\s\S]*?<\/tool_call>/g, '')
            .replace(/<tool_result[\s\S]*?<\/tool_result>/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

          // Send text to client
          if (textWithoutToolCalls) {
            send({ type: 'text', content: textWithoutToolCalls });
          }

          // ── 5. If no tool calls, we're done ──
          if (toolCalls.length === 0) {
            log('info', `No tool calls — agent finished`);
            break;
          }

          // ── 6. Execute tool calls locally via MCP ──
          log('info', `  ${toolCalls.length} tool call(s) to execute`);
          const toolResultParts: string[] = [];

          for (const tc of toolCalls) {
            if (signal.aborted) break;
            toolCallCount++;
            const tcId = `tc-${toolCallCount}`;

            send({
              type: 'tool_call',
              name: tc.name,
              id: tcId,
              params: tc.arguments,
            });

            send({ type: 'status', content: `Running ${tc.name}...` });

            try {
              const mcpResult = await mcp.callTool(tc.name, tc.arguments);
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const resultContent = (mcpResult as any)?.content;
              const clientResult: Record<string, unknown>[] = [];
              const textParts: string[] = [];

              if (Array.isArray(resultContent)) {
                for (const item of resultContent) {
                  if (item.type === 'text') {
                    textParts.push(item.text);
                    clientResult.push({ type: 'text', text: item.text });
                  } else if (item.type === 'image') {
                    const src = item.source || item;
                    const data = src.data || item.data;
                    const mediaType = src.media_type || src.mimeType || 'image/jpeg';
                    if (data) {
                      clientResult.push({ type: 'image', data, mimeType: mediaType });
                      textParts.push('[Screenshot captured — image attached]');
                      log('info', `    📸 Screenshot (${(data.length / 1024).toFixed(0)}KB)`);
                    }
                  }
                }
              } else if (typeof resultContent === 'string') {
                textParts.push(resultContent);
                clientResult.push({ type: 'text', text: resultContent });
              }

              // Build result for Claude
              toolResultParts.push(`<tool_result name="${tc.name}">\n${textParts.join('\n')}\n</tool_result>`);

              send({
                type: 'tool_result',
                name: tc.name,
                id: tcId,
                result: clientResult,
              });
            } catch (err) {
              const errMsg = (err as Error).message;
              log('error', `  ❌ ${tc.name} FAILED: ${errMsg}`);

              toolResultParts.push(`<tool_result name="${tc.name}" error="true">\nError: ${errMsg}\n</tool_result>`);

              send({
                type: 'tool_result',
                name: tc.name,
                id: tcId,
                result: [{ type: 'text', text: `Error: ${errMsg}` }],
              });
            }
          }

          // ── 7. Feed results back to Claude for next turn ──
          currentPrompt = `Here are the tool results:\n\n${toolResultParts.join('\n\n')}\n\nContinue your QA work based on these results. If you need more information, call more tools. If you're done, provide your report.`;
        }

        if (turnCount >= MAX_TURNS) {
          log('warn', `Hit max turns (${MAX_TURNS})`);
          send({ type: 'text', content: '\n\n⚠️ Reached maximum turn limit. Send another message to continue.' });
        }

        // Save session
        sessions.set(ourSessionId, session);

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('info', `══════════════════════════════════════`);
        log('info', `── DONE ── ${elapsed}s | ${turnCount} turns | ${toolCallCount} tool calls`);
        log('info', `══════════════════════════════════════`);
        send({ type: 'done' });

      } catch (err) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        log('error', `── EXCEPTION ── ${elapsed}s | ${(err as Error).message}`);
        log('error', (err as Error).stack || '(no stack)');
        send({
          type: 'error',
          content: `Agent error: ${(err as Error).message}`,
        });
      } finally {
        mcp?.stop();
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
