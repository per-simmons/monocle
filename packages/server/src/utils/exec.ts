import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

export interface ExecBufferResult {
  stdout: Buffer;
  stderr: string;
}

/**
 * Execute a command and return string output.
 */
export async function exec(
  cmd: string,
  args: string[],
  options?: { timeout?: number; cwd?: string }
): Promise<ExecResult> {
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    timeout: options?.timeout ?? 30_000,
    maxBuffer: 10 * 1024 * 1024, // 10MB
    cwd: options?.cwd,
  });
  return { stdout: stdout.toString(), stderr: stderr.toString() };
}

/**
 * Execute a command and return raw Buffer output (for screenshots).
 */
export async function execBuffer(
  cmd: string,
  args: string[],
  options?: { timeout?: number }
): Promise<ExecBufferResult> {
  const { stdout, stderr } = await execFileAsync(cmd, args, {
    timeout: options?.timeout ?? 30_000,
    maxBuffer: 50 * 1024 * 1024, // 50MB for screenshots
    encoding: 'buffer',
  });
  return {
    stdout: stdout as unknown as Buffer,
    stderr: (stderr as unknown as Buffer).toString(),
  };
}

/**
 * Spawn a long-running process (e.g., video recording).
 * Returns the ChildProcess so the caller can manage its lifecycle.
 */
export function spawnProcess(
  cmd: string,
  args: string[],
  options?: { cwd?: string }
): ChildProcess {
  return spawn(cmd, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: options?.cwd,
  });
}
