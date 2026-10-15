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

const jsonFrame = z.object({
  cells: z.array(z.number()).length(64),
  ts: z.string().datetime().optional(), // optional device timestamp (ISO); also used to replay data
});

/**
 * POST /api/telemetry/:bedId/frame   header: x-device-key
 *   JSON:   { "cells": [64 numbers 0..255], "ts": "2026-10-15T10:00:00Z" }
 *   or raw: Content-Type: application/octet-stream with exactly 64 bytes (what the ESP32 can send cheaply)
 */
telemetryRouter.post(
  '/:bedId/frame',
  express.raw({ type: 'application/octet-stream', limit: '1kb' }),
  asyncHandler(async (req, res) => {
    checkDeviceKey(req.headers['x-device-key']);
    let cells: number[];
    let at = new Date();
    if (Buffer.isBuffer(req.body)) {
      if (req.body.length !== 64) throw new ApiError(422, 'A raw frame must be exactly 64 bytes');
      cells = Array.from(req.body);
    } else {
      const body = parse(jsonFrame, req.body);
      cells = body.cells;
      if (body.ts) at = new Date(body.ts);
    }
    res.status(202).json(await ingestFrame(req.params.bedId, cells, at));
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
