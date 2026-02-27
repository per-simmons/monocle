import { exec } from '../utils/exec.js';
import { resolve } from 'node:path';
import { homedir } from 'node:os';

/**
 * Path to the idb binary inside our managed venv.
 * Users can override via MONOCLE_IDB_PATH env var.
 */
const IDB_BIN =
  process.env.MONOCLE_IDB_PATH ??
  resolve(homedir(), 'client-coding/monocle/.idb-venv/bin/idb');

export interface IDBElement {
  AXLabel: string | null;
  AXValue: string | null;
  AXUniqueId: string | null;
  AXFrame: string;
  type: string;
  role: string;
  role_description: string | null;
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  enabled: boolean;
  help: string | null;
  title: string | null;
  subrole: string | null;
  content_required: boolean;
  custom_actions: string[];
}

/**
 * Get the full accessibility tree from the simulator.
 * Returns flat array of all elements with iOS logical coordinates.
 */
export async function describeAll(udid: string): Promise<IDBElement[]> {
  const { stdout } = await exec(IDB_BIN, [
    'ui', 'describe-all',
    '--udid', udid,
  ], { timeout: 15_000 });

  try {
    return JSON.parse(stdout.trim()) as IDBElement[];
  } catch {
    return [];
  }
}

/**
 * Tap at iOS logical coordinates.
 */
export async function tap(udid: string, x: number, y: number): Promise<void> {
  await exec(IDB_BIN, [
    'ui', 'tap',
    String(Math.round(x)), String(Math.round(y)),
    '--udid', udid,
  ], { timeout: 10_000 });
}

/**
 * Double tap at coordinates.
 */
export async function doubleTap(udid: string, x: number, y: number): Promise<void> {
  await tap(udid, x, y);
  await sleep(100);
  await tap(udid, x, y);
}

/**
 * Long press at coordinates (idb doesn't have native long press, simulate with tap + duration).
 */
export async function longPress(
  udid: string,
  x: number,
  y: number,
  _durationMs: number = 1000
): Promise<void> {
  // idb ui tap doesn't have a duration flag — use swipe from same point to same point
  // which effectively holds the touch at that position
  await exec(IDB_BIN, [
    'ui', 'swipe',
    String(Math.round(x)), String(Math.round(y)),
    String(Math.round(x)), String(Math.round(y)),
    '--duration', String(_durationMs / 1000),
    '--udid', udid,
  ], { timeout: Math.max(15_000, _durationMs + 5000) });
}

/**
 * Swipe between two points.
 */
export async function swipe(
  udid: string,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  durationMs: number = 300
): Promise<void> {
  await exec(IDB_BIN, [
    'ui', 'swipe',
    String(Math.round(fromX)), String(Math.round(fromY)),
    String(Math.round(toX)), String(Math.round(toY)),
    '--duration', String(durationMs / 1000),
    '--udid', udid,
  ], { timeout: 15_000 });
}

/**
 * Type text into the currently focused element.
 */
export async function typeText(udid: string, text: string): Promise<void> {
  await exec(IDB_BIN, [
    'ui', 'text',
    text,
    '--udid', udid,
  ], { timeout: 10_000 });
}

/**
 * Press a hardware button.
 */
export async function pressButton(
  udid: string,
  button: 'home' | 'lock' | 'siri' | 'volumeUp' | 'volumeDown'
): Promise<void> {
  const buttonMap: Record<string, string> = {
    home: 'HOME',
    lock: 'LOCK',
    siri: 'SIRI',
    volumeUp: 'VOLUME_UP',
    volumeDown: 'VOLUME_DOWN',
  };

  await exec(IDB_BIN, [
    'ui', 'button',
    buttonMap[button] ?? button.toUpperCase(),
    '--udid', udid,
  ], { timeout: 10_000 });
}

/**
 * Press a specific key.
 */
export async function pressKey(udid: string, keycode: number): Promise<void> {
  await exec(IDB_BIN, [
    'ui', 'key',
    String(keycode),
    '--udid', udid,
  ], { timeout: 10_000 });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
