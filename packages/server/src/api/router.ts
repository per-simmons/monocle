import express from 'express';
import { devicesRouter } from './devices.js';
import { sessionsRouter } from './sessions.js';

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

  app.use(express.json());

  // Health check
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // REST routes
  app.use('/api/devices', devicesRouter);
  app.use('/api/sessions', sessionsRouter);

  return app;
}
