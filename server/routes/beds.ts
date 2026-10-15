import { Router } from 'express';
import { z } from 'zod';
import { Bed, BedEvent, MatState } from '../models';
import { ApiError, asyncHandler, parse } from '../lib/errors';
import { getSettings } from '../lib/settings';
import { chunk8 } from '../lib/zones';
import { emptyMatrix, isFresh, zoneTimerView } from '../services/derive';
import {
  applyTurn,
  deferTurn,
  postureTimeline,
  resetAllZones,
  resetZone,
  findBedOr404,
  getBedView,
  listBedViews,
  setOffBed,
  snoozeBed,
} from '../services/beds';

export const bedsRouter = Router();

const bedFields = z.object({
  age: z.number().int().min(0).max(130).optional(),
  bedNumber: z.string().min(1).max(40),
  patientName: z.string().min(1).max(120),
  patientId: z.string().min(1).max(80),
  pod: z.string().min(1).max(40),
  bradenScore: z.number().int().min(6).max(23),
  bradenRisk: z.enum(['Severe', 'High', 'Moderate', 'Low']),
  assignedRn: z.string().max(120).default(''),
  deviceId: z.string().max(60).default(''),
  posture: z.string().max(60).default('UNKNOWN'),
});
const createBed = bedFields.extend({ id: z.string().regex(/^[a-z0-9-]{2,40}$/) });
const patchBed = bedFields.partial();

const turnBody = z.object({
  posture: z.string().min(1).max(60),
  note: z.string().max(500).optional(),
  rn: z.string().max(120).optional(),
  skinChecks: z.array(z.boolean()).max(12).optional(),
});

// GET /api/beds?pod=POD 4&risk=High&status=overdue&q=eleanor
bedsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter: Record<string, unknown> = {};
    if (typeof req.query.pod === 'string') filter.pod = req.query.pod;
    if (typeof req.query.risk === 'string') filter.bradenRisk = req.query.risk;
    let beds = await listBedViews(filter);
    if (typeof req.query.status === 'string') beds = beds.filter((b) => b.status === req.query.status);
    if (typeof req.query.q === 'string' && req.query.q.trim()) {
      const q = req.query.q.toLowerCase();
      beds = beds.filter((b) =>
        [b.patientName, b.bedNumber, b.patientId, b.assignedRn].some((v) => v.toLowerCase().includes(q)),
      );
    }
    res.json(beds);
  }),
);

bedsRouter.post(
  '/',
  asyncHandler(async (req, res) => {
    const body = parse(createBed, req.body);
    if (await Bed.exists({ id: body.id })) throw new ApiError(409, `Bed "${body.id}" already exists`);
    const settings = await getSettings();
    await Bed.create({
      ...body,
      nextTurnDueAt: new Date(Date.now() + settings.protocol.cadenceMin * 60000),
    });
    res.status(201).json(await getBedView(body.id));
  }),
);

bedsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const [bed, mat, settings] = await Promise.all([
      getBedView(req.params.id),
      MatState.findOne({ bedId: req.params.id }).lean(),
      getSettings(),
    ]);
    const timers = (mat?.zoneTimers ?? []).map((t: any) => zoneTimerView(t, settings));
    res.json({ ...bed, zoneTimers: timers });
  }),
);

bedsRouter.patch(
  '/:id',
  asyncHandler(async (req, res) => {
    const body = parse(patchBed, req.body);
    const bed = await findBedOr404(req.params.id);
    bed.set(body);
    await bed.save();
    res.json(await getBedView(req.params.id));
  }),
);

bedsRouter.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    const bed = await findBedOr404(req.params.id);
    await bed.deleteOne();
    await MatState.deleteOne({ bedId: req.params.id });
    res.status(204).end();
  }),
);

bedsRouter.get(
  '/:id/zone-timers',
  asyncHandler(async (req, res) => {
    await findBedOr404(req.params.id);
    const [mat, settings] = await Promise.all([MatState.findOne({ bedId: req.params.id }).lean(), getSettings()]);
    res.json((mat?.zoneTimers ?? []).map((t: any) => zoneTimerView(t, settings)));
  }),
);

bedsRouter.get(
  '/:id/matrix',
  asyncHandler(async (req, res) => {
    await findBedOr404(req.params.id);
    const [mat, settings] = await Promise.all([MatState.findOne({ bedId: req.params.id }).lean(), getSettings()]);
    res.json({
      matrix: mat?.matrix?.length === 64 ? chunk8([...mat.matrix]) : emptyMatrix(),
      peakMmHg: mat?.peakMmHg ?? 0,
      peakZone: mat?.peakZone ?? '',
      lastFrameAt: mat?.lastFrameAt ?? null,
      fresh: isFresh(mat?.lastFrameAt, settings, new Date()),
    });
  }),
);

bedsRouter.post(
  '/:id/turns',
  asyncHandler(async (req, res) => {
    res.status(201).json(await applyTurn(req.params.id, parse(turnBody, req.body)));
  }),
);

bedsRouter.post(
  '/:id/snooze',
  asyncHandler(async (req, res) => {
    const { minutes } = parse(z.object({ minutes: z.number().min(1).max(60).default(5) }), req.body ?? {});
    res.json(await snoozeBed(req.params.id, minutes));
  }),
);

bedsRouter.post(
  '/:id/defer',
  asyncHandler(async (req, res) => {
    const { minutes, reason } = parse(
      z.object({ minutes: z.number().min(1).max(120).default(10), reason: z.string().max(200).optional() }),
      req.body ?? {},
    );
    res.json(await deferTurn(req.params.id, minutes, reason));
  }),
);

bedsRouter.post(
  '/:id/off-bed',
  asyncHandler(async (req, res) => {
    const { offBed } = parse(z.object({ offBed: z.boolean() }), req.body);
    res.json(await setOffBed(req.params.id, offBed));
  }),
);

bedsRouter.get(
  '/:id/events',
  asyncHandler(async (req, res) => {
    await findBedOr404(req.params.id);
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    const filter: Record<string, unknown> = { bedId: req.params.id };
    if (typeof req.query.kind === 'string') filter.kind = req.query.kind;
    res.json(await BedEvent.find(filter).sort({ at: -1 }).limit(limit));
  }),
);

// Per-zone and all-zone timer resets (the buttons on the Zones page).
bedsRouter.post(
  '/:id/zones/reset-all',
  asyncHandler(async (req, res) => {
    const { rn } = parse(z.object({ rn: z.string().max(120).optional() }), req.body ?? {});
    res.json(await resetAllZones(req.params.id, rn));
  }),
);

bedsRouter.post(
  '/:id/zones/:zone/reset',
  asyncHandler(async (req, res) => {
    const { rn } = parse(z.object({ rn: z.string().max(120).optional() }), req.body ?? {});
    res.json(await resetZone(req.params.id, req.params.zone, rn));
  }),
);

// The 8-hour BACK / LEFT / RIGHT chronology on the Live page.
bedsRouter.get(
  '/:id/posture-timeline',
  asyncHandler(async (req, res) => {
    const hours = Math.min(72, Math.max(1, Number(req.query.hours) || 8));
    res.json(await postureTimeline(req.params.id, hours));
  }),
);
