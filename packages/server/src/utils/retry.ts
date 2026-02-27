/**
 * Wait for a condition to be true, polling with exponential backoff.
 * Polls at 200ms, 400ms, 800ms, 1600ms, then every 1600ms until timeout.
 */
export async function waitFor<T>(
  fn: () => Promise<T | null>,
  options?: { timeoutMs?: number; label?: string }
): Promise<T> {
  const timeout = options?.timeoutMs ?? 5000;
  const label = options?.label ?? 'condition';
  const start = Date.now();
  const intervals = [200, 400, 800, 1600];
  let attempt = 0;

  while (Date.now() - start < timeout) {
    const result = await fn();
    if (result !== null) return result;

    const delay = intervals[Math.min(attempt, intervals.length - 1)]!;
    await sleep(delay);
    attempt++;
  }

  throw new Error(`Timeout waiting for ${label} after ${timeout}ms`);
}

/**
 * Execute an action and retry once if the screen didn't change.
 * Takes a pre-action screenshot hash and post-action screenshot hash function.
 */
export async function retryIfNoChange(
  action: () => Promise<void>,
  getScreenHash: () => Promise<string>,
  options?: { waitMs?: number }
): Promise<void> {
  const waitMs = options?.waitMs ?? 2000;
  const preHash = await getScreenHash();

  await action();
  await sleep(waitMs);

  const postHash = await getScreenHash();
  if (preHash === postHash) {
    // Screen didn't change — retry once
    await action();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
