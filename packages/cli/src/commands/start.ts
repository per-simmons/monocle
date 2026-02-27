import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const serverEntry = resolve(__dirname, '../../../server/src/index.ts');

export async function startCommand(options: { port?: string; stdio?: boolean }) {
  const args = ['tsx', serverEntry];
  if (options.stdio) {
    args.push('--stdio');
  }

  const env = { ...process.env };
  if (options.port) {
    env.MONOCLE_PORT = options.port;
  }

  console.log('[monocle] Starting server...');

  const child = spawn('npx', args, {
    stdio: options.stdio ? ['pipe', 'pipe', 'inherit'] : 'inherit',
    env,
    cwd: resolve(__dirname, '../../..'),
  });

  if (options.stdio) {
    // In stdio mode, pipe stdin/stdout for MCP
    process.stdin.pipe(child.stdin!);
    child.stdout!.pipe(process.stdout);
  }

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
  });
}
