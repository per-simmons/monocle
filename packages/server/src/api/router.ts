import express from 'express';
import { devicesRouter } from './devices.js';
import { sessionsRouter } from './sessions.js';
import { toolsRouter } from './tools.js';

export interface RouterContext {
  getDeviceUdid: () => Promise<string>;
  tap: (udid: string, x: number, y: number) => Promise<void>;
  swipe: (udid: string, startX: number, startY: number, endX: number, endY: number, duration: number) => Promise<void>;
  onInteraction?: () => void;
}

/**
 * Create the Express REST API.
 * Mounted at the root of the HTTP server alongside the WebSocket hub.
 */
export function createApiRouter(routerCtx?: RouterContext): express.Express {
  const app = express();

  // CORS for dashboard
  app.use((_req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (_req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // Interactive tap/swipe for dashboard simulator view
  if (routerCtx) {
    app.post('/api/tap', async (req, res) => {
      try {
        const { x, y } = req.body;
        if (typeof x !== 'number' || typeof y !== 'number') {
          res.status(400).json({ error: 'x and y are required numbers (logical points)' });
          return;
        }
        const udid = await routerCtx.getDeviceUdid();
        await routerCtx.tap(udid, x, y);
        routerCtx.onInteraction?.();
        res.json({ status: 'ok', x, y });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    });

    app.post('/api/swipe', async (req, res) => {
      try {
        const { startX, startY, endX, endY, duration } = req.body;
        const udid = await routerCtx.getDeviceUdid();
        await routerCtx.swipe(udid, startX, startY, endX, endY, duration || 0.5);
        routerCtx.onInteraction?.();
        res.json({ status: 'ok' });
      } catch (err) {
        res.status(500).json({ error: (err as Error).message });
      }
    });
  }

  // REST routes
  app.use('/api/devices', devicesRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/tools', toolsRouter);

  return app;
}
