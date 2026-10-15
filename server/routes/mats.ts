import { Router } from 'express';
import { HardwareLog, MatState } from '../models';
import { ApiError, asyncHandler } from '../lib/errors';
import { getSettings } from '../lib/settings';
import { chunk8 } from '../lib/zones';
import { emptyMatrix, isFresh } from '../services/derive';
import { findBedOr404 } from '../services/beds';
import { ensureMatState } from '../services/ingest';

export const matsRouter = Router();

async function log(bedId: string, message: string, level: 'info' | 'warn' | 'error' = 'info') {
  await HardwareLog.create({ bedId, at: new Date(), level, message });
}

async function matOr404(bedId: string) {
  await findBedOr404(bedId);
  return ensureMatState(bedId);
}

// Whole mat: cells, matrix, peak, freshness.
matsRouter.get(
  '/:bedId',
  asyncHandler(async (req, res) => {
    const [mat, settings] = await Promise.all([matOr404(req.params.bedId), getSettings()]);
    res.json({
      bedId: mat.bedId,
      cells: mat.cells,
      matrix: mat.matrix?.length === 64 ? chunk8([...mat.matrix]) : emptyMatrix(),
      peakMmHg: mat.peakMmHg,
      peakZone: mat.peakZone,
      frames: mat.frames,
      lastFrameAt: mat.lastFrameAt,
      fresh: isFresh(mat.lastFrameAt, settings, new Date()),
    });
  }),
);

// Just the 64 piezo cells, in the shape of the UI's PiezoCell type.
matsRouter.get(
  '/:bedId/cells',
  asyncHandler(async (req, res) => {
    const mat = await matOr404(req.params.bedId);
    res.json(mat.cells);
  }),
);

matsRouter.get(
  '/:bedId/logs',
  asyncHandler(async (req, res) => {
    await findBedOr404(req.params.bedId);
    const limit = Math.min(Number(req.query.limit) || 50, 500);
    res.json(await HardwareLog.find({ bedId: req.params.bedId }).sort({ at: -1 }).limit(limit));
  }),
);

// Tare: the current empty-mat reading becomes zero. Do this with nothing on the mat.
// This is real: later frames have this baseline subtracted.
matsRouter.post(
  '/:bedId/tare',
  asyncHandler(async (req, res) => {
    const mat = await matOr404(req.params.bedId);
    const settings = await getSettings();
    if (!isFresh(mat.lastFrameAt, settings, new Date())) {
      throw new ApiError(409, 'No recent frames from this mat. Check the device connection first.');
    }
    // rawLast holds raw bytes; the baseline is the raw reading at tare time.
    await MatState.updateOne({ bedId: mat.bedId }, { $set: { baselineRaw: mat.rawLast } });
    await log(mat.bedId, 'Tare applied: zero plane stored from the latest frame');
    res.json({ ok: true, message: 'Baseline stored. Make sure the mat was empty.' });
  }),
);

// Zero a single cell against its latest raw reading.
matsRouter.post(
  '/:bedId/cells/:cellId/zero',
  asyncHandler(async (req, res) => {
    const mat = await matOr404(req.params.bedId);
    const idx = mat.cells.findIndex((c) => c.id === req.params.cellId);
    if (idx < 0) throw new ApiError(404, `Unknown cell "${req.params.cellId}"`);
    const baseline = [...mat.baselineRaw];
    baseline[idx] = mat.rawLast[idx] ?? 0;
    await MatState.updateOne({ bedId: mat.bedId }, { $set: { baselineRaw: baseline } });
    await log(mat.bedId, `Cell ${req.params.cellId} zeroed`);
    res.json({ ok: true });
  }),
);

// Self-test based on real data: are all 64 cells reporting, is the stream fresh, any stuck cell?
matsRouter.post(
  '/:bedId/self-test',
  asyncHandler(async (req, res) => {
    const mat = await matOr404(req.params.bedId);
    const settings = await getSettings();
    const checks: { name: string; pass: boolean; detail: string }[] = [];

    const fresh = isFresh(mat.lastFrameAt, settings, new Date());
    checks.push({
      name: 'Telemetry stream',
      pass: fresh,
      detail: fresh ? 'Frames arriving' : `No frame in the last ${settings.telemetry.staleSec} s`,
    });
    checks.push({
      name: 'Cell count',
      pass: mat.cells.length === 64 && mat.rawLast.length === 64,
      detail: `${mat.cells.length} cells, ${mat.rawLast.length} readings`,
    });
    const saturated = mat.rawLast.filter((v) => v >= 255).length;
    checks.push({
      name: 'Saturated cells',
      pass: saturated === 0,
      detail: saturated === 0 ? 'None' : `${saturated} cells at maximum (shorted?)`,
    });
    const distinct = new Set(mat.rawLast).size;
    checks.push({
      name: 'Stuck readings',
      pass: !fresh || distinct > 1,
      detail: distinct > 1 ? 'Readings vary across cells' : 'Every cell reports the same value',
    });

    const pass = checks.every((c) => c.pass);
    await log(mat.bedId, `Self-test ${pass ? 'passed' : 'FAILED'}: ${checks.filter((c) => !c.pass).map((c) => c.name).join(', ') || 'all checks ok'}`, pass ? 'info' : 'warn');
    res.json({ pass, checks });
  }),
);

// Reset the stream state (timing only). Stored baseline and timers are kept.
matsRouter.post(
  '/:bedId/flush',
  asyncHandler(async (req, res) => {
    const mat = await matOr404(req.params.bedId);
    await MatState.updateOne({ bedId: mat.bedId }, { $set: { lastFrameAt: null } });
    await log(mat.bedId, 'Stream state reset');
    res.json({ ok: true });
  }),
);

// These need firmware support (commands sent to the device) that does not exist yet.
const notReady = (what: string) =>
  asyncHandler(async (req) => {
    await matOr404(req.params.bedId);
    throw new ApiError(501, `${what} needs device firmware support that is not built yet`);
  });
matsRouter.post('/:bedId/calibrate', notReady('Array calibration'));
matsRouter.post('/:bedId/cells/:cellId/impedance-sweep', notReady('Impedance sweep'));
