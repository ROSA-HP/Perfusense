import { randomUUID } from 'node:crypto';
import { AuditLog, Bed, BedEvent, MatState } from '../models';
import { ApiError } from '../lib/errors';
import { getSettings } from '../lib/settings';
import { auditItem, bedView, isFresh, type BedView } from './derive';
import { categoryForTimer, ZONE_TIMER_NAMES, postureGroup } from '../lib/zones';
import { hub } from './hub';

export async function findBedOr404(id: string) {
  const bed = await Bed.findOne({ id });
  if (!bed) throw new ApiError(404, `Unknown bed "${id}"`);
  return bed;
}

export async function listBedViews(filter: Record<string, unknown> = {}): Promise<BedView[]> {
  const [beds, settings] = await Promise.all([Bed.find(filter).sort({ bedNumber: 1 }).lean(), getSettings()]);
  const mats = await MatState.find({ bedId: { $in: beds.map((b: any) => b.id) } }).lean();
  const byBed = new Map(mats.map((m: any) => [m.bedId, m]));
  const now = new Date();
  return beds.map((b: any) => bedView(b, byBed.get(b.id) ?? null, settings, now));
}

export async function getBedView(id: string): Promise<BedView> {
  const [bed, settings] = await Promise.all([findBedOr404(id), getSettings()]);
  const mat = await MatState.findOne({ bedId: id }).lean();
  return bedView(bed.toObject(), mat, settings, new Date());
}

async function publish(id: string) {
  hub.broadcast('bed', await getBedView(id));
}

export type TurnInput = { posture: string; note?: string; rn?: string; skinChecks?: boolean[] };

/**
 * Records that the patient was repositioned. It: schedules the next turn, resets the zone
 * timers, resolves open alerts for the bed, and writes an audit row for the repositioning.
 */
export async function applyTurn(id: string, input: TurnInput) {
  const bed = await findBedOr404(id);
  const settings = await getSettings();

  if (input.skinChecks && settings.protocol.skinEnforce && !input.skinChecks.every(Boolean)) {
    throw new ApiError(422, 'Skin checks are enforced: complete every check before logging the turn');
  }

  const now = new Date();
  const rn = input.rn || bed.assignedRn || 'Unassigned';
  const actionTaken = `Repositioned to ${input.posture}. ${input.note?.trim() || 'No note recorded.'}`;

  // Read the sacrum timer before it is reset: that is the dwell we log.
  const mat = await MatState.findOne({ bedId: id });
  const sacrum = mat?.zoneTimers.find((z) => z.name === 'SACRUM & COCCYX');
  const dwellBefore = Math.round(sacrum?.elapsedMin ?? 0);
  const peak = mat && isFresh(mat.lastFrameAt, settings, now) ? mat.peakMmHg : bed.peakPressure;

  bed.posture = input.posture;
  // Without a live reading the old stored peak describes the previous position, so clear it.
  if (!(mat && isFresh(mat.lastFrameAt, settings, now))) bed.peakPressure = 0;
  bed.lastTurnAt = now;
  bed.nextTurnDueAt = new Date(now.getTime() + settings.protocol.cadenceMin * 60000);
  bed.snoozedUntil = null;
  bed.offBedSince = null;
  await bed.save();

  await BedEvent.create({
    bedId: id,
    at: now,
    kind: 'turn',
    posture: input.posture,
    note: input.note,
    rn,
    skinChecks: input.skinChecks,
  });

  if (mat) {
    await MatState.updateOne(
      { bedId: id },
      { $set: { zoneTimers: mat.zoneTimers.map((z) => ({ name: z.name, elapsedMin: 0, limitMin: z.limitMin })) } },
    );
  }

  const resolved = await AuditLog.updateMany(
    { bedId: id, status: 'ACTIVE' },
    { $set: { status: 'RESOLVED', actionTaken, attendingRn: rn } },
  );

  const log = await AuditLog.create({
    id: `log-${randomUUID().slice(0, 8)}`,
    at: now,
    bedId: id,
    bedUnit: `${bed.bedNumber} [${bed.pod}]`,
    patientId: bed.patientId,
    patientName: bed.patientName,
    zoneLocus: 'OFFLOADED',
    zoneCategory: 'Sacrum',
    peakMmHg: Math.round(peak ?? 0),
    dwellMin: dwellBefore,
    actionTaken,
    attendingRn: rn,
    status: 'RESOLVED',
  });

  await publish(id);
  return { bed: await getBedView(id), resolvedAlerts: resolved.modifiedCount, log: auditItem(log.toObject(), now) };
}

export async function snoozeBed(id: string, minutes: number) {
  const bed = await findBedOr404(id);
  const now = new Date();
  bed.snoozedUntil = new Date(now.getTime() + minutes * 60000);
  await bed.save();
  await BedEvent.create({ bedId: id, at: now, kind: 'snooze', minutes, rn: bed.assignedRn });
  await publish(id);
  return getBedView(id);
}

export async function deferTurn(id: string, minutes: number, reason?: string) {
  const bed = await findBedOr404(id);
  const now = new Date();
  const base = bed.nextTurnDueAt && bed.nextTurnDueAt > now ? bed.nextTurnDueAt : now;
  bed.nextTurnDueAt = new Date(base.getTime() + minutes * 60000);
  bed.snoozedUntil = null;
  await bed.save();
  await BedEvent.create({ bedId: id, at: now, kind: 'defer', minutes, reason, rn: bed.assignedRn });
  await publish(id);
  return getBedView(id);
}

export async function setOffBed(id: string, offBed: boolean) {
  const bed = await findBedOr404(id);
  bed.offBedSince = offBed ? new Date() : null;
  if (!offBed) {
    // Back in bed: the turn clock starts again from now.
    const settings = await getSettings();
    bed.nextTurnDueAt = new Date(Date.now() + settings.protocol.cadenceMin * 60000);
  }
  await bed.save();
  await publish(id);
  return getBedView(id);
}

function matchZone(name: string): string {
  const wanted = decodeURIComponent(name).trim().toUpperCase();
  const found = ZONE_TIMER_NAMES.find((n) => n === wanted);
  if (!found) throw new ApiError(404, `Unknown zone "${name}". Valid zones: ${ZONE_TIMER_NAMES.join(', ')}`);
  return found;
}

/** Offloaded one zone: its timer goes back to 0 and open alerts for that body area are resolved. */
export async function resetZone(id: string, zoneName: string, rn?: string) {
  const bed = await findBedOr404(id);
  const zone = matchZone(zoneName);
  const settings = await getSettings();
  const mat = await MatState.findOne({ bedId: id });
  const timers = (mat?.zoneTimers ?? []).map((z) => ({
    name: z.name ?? '',
    limitMin: z.limitMin ?? settings.zoneLimitsMin[z.name ?? ''] ?? 120,
    elapsedMin: z.name === zone ? 0 : (z.elapsedMin ?? 0),
  }));
  if (mat) await MatState.updateOne({ bedId: id }, { $set: { zoneTimers: timers } });

  const category = categoryForTimer(zone);
  let resolved = 0;
  if (category) {
    const r = await AuditLog.updateMany(
      { bedId: id, zoneCategory: category, status: 'ACTIVE' },
      { $set: { status: 'RESOLVED', actionTaken: `Zone offloaded (${zone}), timer reset`, attendingRn: rn || bed.assignedRn } },
    );
    resolved = r.modifiedCount;
  }
  await BedEvent.create({ bedId: id, at: new Date(), kind: 'zone-reset', note: zone, rn: rn || bed.assignedRn });
  await publish(id);
  return {
    zone,
    resolvedAlerts: resolved,
    zoneTimers: timers.map((z) => ({ ...z, elapsedMin: Math.round(z.elapsedMin) })),
  };
}

export async function resetAllZones(id: string, rn?: string) {
  const bed = await findBedOr404(id);
  const mat = await MatState.findOne({ bedId: id });
  if (mat) {
    await MatState.updateOne(
      { bedId: id },
      { $set: { zoneTimers: mat.zoneTimers.map((z) => ({ name: z.name, elapsedMin: 0, limitMin: z.limitMin })) } },
    );
  }
  const r = await AuditLog.updateMany(
    { bedId: id, status: 'ACTIVE' },
    { $set: { status: 'RESOLVED', actionTaken: 'All zones offloaded, timers reset', attendingRn: rn || bed.assignedRn } },
  );
  await BedEvent.create({ bedId: id, at: new Date(), kind: 'zone-reset', note: 'ALL', rn: rn || bed.assignedRn });
  await publish(id);
  return { ok: true, resolvedAlerts: r.modifiedCount };
}

/**
 * Body posture over the last N hours, built from the logged turns: each turn sets the posture
 * until the next turn. Time before the first known turn in the window is reported as a gap
 * (coverageStartsAt) instead of being guessed.
 */
export async function postureTimeline(id: string, hours: number) {
  const bed = await findBedOr404(id);
  const now = new Date();
  const start = new Date(now.getTime() - hours * 3600_000);
  const [before, inside] = await Promise.all([
    BedEvent.findOne({ bedId: id, kind: 'turn', at: { $lt: start } }).sort({ at: -1 }).lean(),
    BedEvent.find({ bedId: id, kind: 'turn', at: { $gte: start } }).sort({ at: 1 }).lean(),
  ]);
  const points: { at: Date; posture: string }[] = [];
  if (before) points.push({ at: start, posture: before.posture ?? 'UNKNOWN' });
  for (const e of inside) points.push({ at: new Date(e.at), posture: e.posture ?? 'UNKNOWN' });
  if (points.length === 0 && bed.posture) points.push({ at: start, posture: bed.posture });

  const segments = points.map((p, i) => {
    const end = i + 1 < points.length ? points[i + 1].at : now;
    return {
      posture: p.posture,
      group: postureGroup(p.posture),
      start: p.at.toISOString(),
      end: end.toISOString(),
      minutes: Math.max(0, Math.round((end.getTime() - p.at.getTime()) / 60000)),
    };
  });
  const totalsMin: Record<string, number> = { BACK: 0, LEFT: 0, RIGHT: 0, OTHER: 0 };
  for (const s of segments) totalsMin[s.group] += s.minutes;
  return {
    from: start.toISOString(),
    to: now.toISOString(),
    coverageStartsAt: segments[0]?.start ?? null,
    segments,
    totalsMin,
  };
}
