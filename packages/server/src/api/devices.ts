import { Router } from 'express';
import * as simctl from '../bridges/simctl.js';

const router = Router();

/**
 * GET /api/devices — List all available simulators.
 */
router.get('/', async (_req, res) => {
  try {
    const devices = await simctl.listDevices();
    res.json({ devices });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * GET /api/devices/booted — Get the currently booted device.
 */
router.get('/booted', async (_req, res) => {
  try {
    const device = await simctl.getBootedDevice();
    if (!device) {
      res.status(404).json({ error: 'No booted simulator found' });
      return;
    }
    res.json({ device });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export { router as devicesRouter };
