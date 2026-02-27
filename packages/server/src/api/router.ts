import express from 'express';
import { devicesRouter } from './devices.js';
import { sessionsRouter } from './sessions.js';
import { toolsRouter } from './tools.js';

/**
 * Create the Express REST API.
 * Mounted at the root of the HTTP server alongside the WebSocket hub.
 */
export function createApiRouter(): express.Express {
  const app = express();

  // CORS for dashboard
  app.use((_req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    next();
  });

  app.use(express.json({ limit: '50mb' }));

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // REST routes
  app.use('/api/devices', devicesRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api/tools', toolsRouter);

  return app;
}
