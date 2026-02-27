import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

export function screenshotCommand(options: { output?: string; format?: string }) {
  try {
    // Find booted device
    const raw = execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], {
      encoding: 'utf-8',
    });
    const data = JSON.parse(raw) as {
      devices: Record<string, Array<{ udid: string; name: string; state: string; isAvailable: boolean }>>;
    };

    let booted: { udid: string; name: string } | null = null;
    for (const sims of Object.values(data.devices)) {
      const found = sims.find((s) => s.state === 'Booted' && s.isAvailable);
      if (found) {
        booted = found;
        break;
      }
    }

    if (!booted) {
      console.error('No booted simulator found. Boot one first.');
      process.exit(1);
    }

    const format = options.format ?? 'jpeg';
    const output = options.output ?? `screenshot.${format === 'jpeg' ? 'jpg' : 'png'}`;

    console.log(`Capturing ${booted.name} (${booted.udid})...`);

    const buffer = execFileSync('xcrun', [
      'simctl', 'io', booted.udid, 'screenshot',
      `--type=${format}`,
      '-',
    ], { maxBuffer: 50 * 1024 * 1024 });

    writeFileSync(output, buffer);
    console.log(`Saved to ${output} (${(buffer.length / 1024).toFixed(0)}KB)`);
  } catch (err) {
    console.error('Screenshot failed:', (err as Error).message);
    process.exit(1);
  }
}
