import { WebSocketServer, type WebSocket } from 'ws';
import type { Server } from 'node:http';
import { FrameCapture } from './frame-capture.js';
import { config } from '../config.js';

/**
 * WebSocket hub that broadcasts live simulator frames to all connected clients.
 */
export class WebSocketHub {
  private wss: WebSocketServer;
  private capture: FrameCapture | null = null;
  private clients = new Set<WebSocket>();
  private lastFrame: Buffer | null = null;
  private lastUdid: string | null = null;

  constructor(httpServer: Server) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/stream' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

      // Auto-restart capture if it was stopped (all previous clients disconnected)
      if (!this.capture && this.lastUdid) {
        this.startStreaming(this.lastUdid);
      }

      // Send the latest frame immediately so new clients don't see a blank screen
      if (this.lastFrame && ws.readyState === ws.OPEN) {
        ws.send(this.lastFrame);
      }

      ws.on('close', () => {
        this.clients.delete(ws);
        // Stop capture if no clients
        if (this.clients.size === 0 && this.capture) {
          this.capture.stop();
          this.capture = null;
        }
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });

      // Send a ping every 30s to keep connection alive
      const pingInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
          ws.ping();
        } else {
          clearInterval(pingInterval);
        }
      }, 30_000);
    });
  }

  /**
   * Start streaming frames for a device.
   */
  startStreaming(udid: string): void {
    if (this.capture) {
      this.capture.stop();
    }

    this.lastUdid = udid;
    this.capture = new FrameCapture(udid);

    this.capture.on('frame', (buffer: Buffer) => {
      this.lastFrame = buffer;
      for (const client of this.clients) {
        // Backpressure: skip frame if client buffer is too full
        if (client.readyState === client.OPEN && client.bufferedAmount < config.wsBackpressureLimit) {
          client.send(buffer);
        }
      }
    });

    this.capture.on('error', (err: Error) => {
      console.error('[monocle] Frame capture error:', err.message);
    });

    this.capture.start();
  }

  /**
   * Notify that the screen likely changed (e.g. after a tap/swipe).
   * Resets the frame capture to active mode so it immediately detects the change.
   */
  notifyChange(): void {
    if (this.capture) {
      this.capture.resetToActive();
    }
  }

  /**
   * Stop streaming.
   */
  stopStreaming(): void {
    if (this.capture) {
      this.capture.stop();
      this.capture = null;
    }
  }

  /**
   * Get current client count.
   */
  getClientCount(): number {
    return this.clients.size;
  }
}
