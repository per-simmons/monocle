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

  constructor(httpServer: Server) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/stream' });

    this.wss.on('connection', (ws) => {
      this.clients.add(ws);

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

    this.capture = new FrameCapture(udid);

    this.capture.on('frame', (buffer: Buffer) => {
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
