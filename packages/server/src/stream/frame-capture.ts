import { EventEmitter } from 'node:events';
import * as simctl from '../bridges/simctl.js';
import { fastHash } from '../utils/image.js';
import { config } from '../config.js';

/**
 * Captures simulator screenshots at an adaptive frame rate.
 * Emits 'frame' events with JPEG Buffer payloads.
 * Deduplicates identical frames using a fast hash.
 */
export class FrameCapture extends EventEmitter {
  private udid: string;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private lastHash = '';
  private unchangedCount = 0;
  private currentFps: number;

  constructor(udid: string) {
    super();
    this.udid = udid;
    this.currentFps = config.streamFps;
  }

  start(): void {
    if (this.intervalId) return;
    this.scheduleNext();
  }

  stop(): void {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * Reset to active mode — called after a tap/swipe so the capture
   * immediately picks up the screen change instead of staying idle.
   */
  resetToActive(): void {
    this.lastHash = '';
    this.unchangedCount = 0;
    this.currentFps = config.streamActiveFps;
  }

  private scheduleNext(): void {
    const interval = 1000 / this.currentFps;
    this.intervalId = setTimeout(async () => {
      await this.capture();
      if (this.intervalId !== null) {
        this.scheduleNext();
      }
    }, interval);
  }

  private async capture(): Promise<void> {
    try {
      const buffer = await simctl.screenshot(this.udid, 'jpeg');
      const hash = fastHash(buffer);

      if (hash === this.lastHash) {
        this.unchangedCount++;
        // Slow down if screen hasn't changed
        if (this.unchangedCount > 10) {
          this.currentFps = config.streamIdleFps;
        }
        // Still emit at idle rate so clients see a live connection
        if (this.unchangedCount % config.streamIdleFps === 0) {
          this.emit('frame', buffer);
        }
        return;
      }

      // Screen changed — speed up
      this.unchangedCount = 0;
      this.currentFps = config.streamActiveFps;
      this.lastHash = hash;

      this.emit('frame', buffer);
    } catch (err) {
      this.emit('error', err);
    }
  }
}
