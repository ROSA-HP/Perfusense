import { Router } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { Broadcast } from '../models';
import { asyncHandler, parse } from '../lib/errors';
import { getSettings, updateSettings } from '../lib/settings';
import { hub } from '../services/hub';

export const wardRouter = Router();

wardRouter.get('/health', (_req, res) => {
  const state = mongoose.connection.readyState; // 1 = connected
  res.status(state === 1 ? 200 : 503).json({ ok: state === 1, db: state === 1 ? 'connected' : 'not connected', streams: hub.size() });
});

// Thresholds, protocol cadence, zone limits and telemetry tuning in one document.
wardRouter.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json(await getSettings());
  }),
);

// Send only what changed, for example { "thresholds": { "criticalMmHg": 70 } }.
wardRouter.put(
  '/settings',
  asyncHandler(async (req, res) => {
    res.json(await updateSettings(req.body));
  }),
);

// Records a ward-wide rotation notice. It does not page anyone: pager/Vocera integration
// is not built.
wardRouter.post(
  '/broadcasts',
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ pod: z.string().min(1).max(40), message: z.string().min(1).max(300), sentBy: z.string().max(120).default('') }),
      req.body,
    );
    const doc = await Broadcast.create({ ...body, at: new Date() });
    hub.broadcast('broadcast', doc.toJSON());
    res.status(201).json(doc);
  }),
);

wardRouter.get(
  '/broadcasts',
  asyncHandler(async (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 20, 200);
    res.json(await Broadcast.find().sort({ at: -1 }).limit(limit));
  }),
);
