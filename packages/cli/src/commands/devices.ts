import { execFileSync } from 'node:child_process';

export function devicesCommand() {
  try {
    const raw = execFileSync('xcrun', ['simctl', 'list', 'devices', '--json'], {
      encoding: 'utf-8',
    });
    const data = JSON.parse(raw) as {
      devices: Record<string, Array<{
        udid: string;
        name: string;
        state: string;
        isAvailable: boolean;
      }>>;
    };

    console.log('\nAvailable iOS Simulators:\n');

    let count = 0;
    for (const [runtime, sims] of Object.entries(data.devices)) {
      const available = sims.filter((s) => s.isAvailable);
      if (available.length === 0) continue;

      const runtimeName = runtime.split('.').pop()?.replace(/-/g, ' ') ?? runtime;
      console.log(`  ${runtimeName}:`);

      for (const sim of available) {
        const status = sim.state === 'Booted' ? ' (Booted)' : '';
        console.log(`    ${sim.name}${status}  ${sim.udid}`);
        count++;
      }
      console.log();
    }

    console.log(`${count} simulator(s) available.`);
  } catch (err) {
    console.error('Failed to list devices. Is Xcode installed?');
    console.error((err as Error).message);
    process.exit(1);
  }
}
