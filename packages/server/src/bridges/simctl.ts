import { type ChildProcess } from 'node:child_process';
import { exec, execBuffer, spawnProcess } from '../utils/exec.js';

export interface SimDevice {
  udid: string;
  name: string;
  state: 'Booted' | 'Shutdown' | string;
  deviceTypeIdentifier: string;
  isAvailable: boolean;
  runtime: string;
}

export interface RecordingHandle {
  process: ChildProcess;
  outputPath: string;
}

let activeRecording: RecordingHandle | null = null;

/**
 * List all available iOS simulators.
 */
export async function listDevices(): Promise<SimDevice[]> {
  const { stdout } = await exec('xcrun', ['simctl', 'list', 'devices', '--json']);
  const data = JSON.parse(stdout) as {
    devices: Record<string, Array<{
      udid: string;
      name: string;
      state: string;
      deviceTypeIdentifier: string;
      isAvailable: boolean;
    }>>;
  };

  const devices: SimDevice[] = [];
  for (const [runtime, sims] of Object.entries(data.devices)) {
    for (const sim of sims) {
      if (sim.isAvailable) {
        devices.push({ ...sim, runtime });
      }
    }
  }
  return devices;
}

/**
 * Get the first booted device, or null.
 */
export async function getBootedDevice(): Promise<SimDevice | null> {
  const devices = await listDevices();
  return devices.find((d) => d.state === 'Booted') ?? null;
}

/**
 * Boot a simulator by UDID.
 */
export async function boot(udid: string): Promise<void> {
  await exec('xcrun', ['simctl', 'boot', udid]);
}

/**
 * Shutdown a simulator by UDID.
 */
export async function shutdown(udid: string): Promise<void> {
  await exec('xcrun', ['simctl', 'shutdown', udid]);
}

/**
 * Capture a screenshot from the booted simulator.
 * Returns raw image buffer (JPEG or PNG).
 */
export async function screenshot(
  udid: string,
  format: 'jpeg' | 'png' = 'jpeg'
): Promise<Buffer> {
  const { stdout } = await execBuffer('xcrun', [
    'simctl', 'io', udid, 'screenshot',
    `--type=${format}`,
    '-', // pipe to stdout
  ], { timeout: 10_000 });
  return stdout;
}

/**
 * Install an app on the simulator.
 */
export async function installApp(udid: string, appPath: string): Promise<void> {
  await exec('xcrun', ['simctl', 'install', udid, appPath]);
}

/**
 * Launch an app by bundle ID.
 */
export async function launchApp(udid: string, bundleId: string): Promise<void> {
  await exec('xcrun', ['simctl', 'launch', udid, bundleId]);
}

/**
 * Terminate a running app.
 */
export async function terminateApp(udid: string, bundleId: string): Promise<void> {
  await exec('xcrun', ['simctl', 'terminate', udid, bundleId]);
}

/**
 * Open a URL or deep link in the simulator.
 */
export async function openUrl(udid: string, url: string): Promise<void> {
  await exec('xcrun', ['simctl', 'openurl', udid, url]);
}

/**
 * Start video recording. Returns a handle to stop it later.
 */
export async function startRecording(
  udid: string,
  outputPath: string
): Promise<RecordingHandle> {
  if (activeRecording) {
    throw new Error('Recording already in progress. Stop it first.');
  }
  const process = spawnProcess('xcrun', [
    'simctl', 'io', udid, 'recordVideo',
    '--codec=h264',
    outputPath,
  ]);
  activeRecording = { process, outputPath };
  return activeRecording;
}

/**
 * Stop the current video recording.
 */
export async function stopRecording(): Promise<string> {
  if (!activeRecording) {
    throw new Error('No recording in progress.');
  }
  const { process, outputPath } = activeRecording;

  // Send SIGINT to gracefully stop recording
  process.kill('SIGINT');

  // Wait for process to exit
  await new Promise<void>((resolve) => {
    process.on('exit', () => resolve());
    setTimeout(resolve, 5000); // fallback timeout
  });

  activeRecording = null;
  return outputPath;
}
