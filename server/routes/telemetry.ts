import express, { Router } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { config } from '../config';
import { ApiError, asyncHandler, parse } from '../lib/errors';
import { ingestFrame } from '../services/ingest';
import { hub } from '../services/hub';

export const telemetryRouter = Router();

function checkDeviceKey(provided: unknown) {
  const a = Buffer.from(String(provided ?? ''));
  const b = Buffer.from(config.deviceKey);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new ApiError(401, 'Missing or wrong x-device-key');
}

// The exact length is checked against the bed's mat in ingestFrame (422 when it differs).
const jsonFrame = z.object({
  cells: z.array(z.number()).min(1).max(1024),
  ts: z.string().datetime().optional(), // optional device timestamp (ISO); also used to replay data
});

/**
 * POST /api/telemetry/:bedId/frame   header: x-device-key
 *   JSON:   { "cells": [100 numbers 0..255], "ts": "2026-10-15T10:00:00Z" }
 *   or raw: Content-Type: application/octet-stream with exactly 100 bytes (one per mat cell)
 */
telemetryRouter.post(
  '/:bedId/frame',
  express.raw({ type: 'application/octet-stream', limit: '2kb' }),
  asyncHandler(async (req, res) => {
    checkDeviceKey(req.headers['x-device-key']);
    let cells: number[];
    let at = new Date();
    const format = Buffer.isBuffer(req.body) ? 'raw' : 'json';
    if (Buffer.isBuffer(req.body)) {
      cells = Array.from(req.body);
    } else {
      const body = parse(jsonFrame, req.body);
      cells = body.cells;
      if (body.ts) at = new Date(body.ts);
    }
    res.status(202).json(await ingestFrame(req.params.bedId, cells, at, format));
  }),
);

// Server-sent events: the browser opens this once and receives frame/bed/alert events live.
export const streamRouter = Router();
streamRouter.get('/', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n');
  res.write(`event: hello\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  hub.add(res);
  const beat = setInterval(() => res.write(': keep-alive\n\n'), 25_000);
  req.on('close', () => {
    clearInterval(beat);
    hub.remove(res);
  });
});
