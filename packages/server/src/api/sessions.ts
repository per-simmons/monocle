import { Router } from 'express';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { SessionManager } from '../session/manager.js';
import { config } from '../config.js';

const router = Router();

/**
 * GET /api/sessions — List all sessions.
 */
router.get('/', async (_req, res) => {
  try {
    const sessions = await SessionManager.listSessions();
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/sessions/:id — Get session metadata.
 */
router.get('/:id', async (req, res) => {
  try {
    const metaPath = join(config.sessionsDir, req.params.id, 'session.json');
    const raw = await readFile(metaPath, 'utf-8');
    res.json(JSON.parse(raw));
  } catch {
    res.status(404).json({ error: 'Session not found' });
  }
});

/**
 * GET /api/sessions/:id/actions — Get session action log.
 */
router.get('/:id/actions', async (req, res) => {
  try {
    const actionsPath = join(config.sessionsDir, req.params.id, 'actions.jsonl');
    const raw = await readFile(actionsPath, 'utf-8');
    const actions = raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    res.json({ actions });
  } catch {
    res.status(404).json({ error: 'Session not found' });
  }
});

/**
 * GET /api/sessions/:id/screenshots/:filename — Serve a session screenshot.
 */
router.get('/:id/screenshots/:filename', async (req, res) => {
  try {
    const filePath = join(
      config.sessionsDir,
      req.params.id,
      'screenshots',
      req.params.filename
    );
    const buffer = await readFile(filePath);
    res.set('Content-Type', 'image/jpeg');
    res.send(buffer);
  } catch {
    res.status(404).json({ error: 'Screenshot not found' });
  }
});

export { router as sessionsRouter };
