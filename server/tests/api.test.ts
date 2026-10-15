// Integration tests. They need a MongoDB. By default they use a throw-away database
// called "perfusense_test" on localhost (override with MONGODB_TEST_URI).
// Run: npm run test:server
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { after, before, test } from 'node:test';
import mongoose from 'mongoose';
import { createApp } from '../app';
import { config } from '../config';
import { seedDatabase } from '../seed';

const TEST_URI = process.env.MONGODB_TEST_URI || 'mongodb://127.0.0.1:27017/perfusense_test';
let server: Server;
let base = '';
const KEY = { 'x-device-key': config.deviceKey };

async function api(path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
  let body = init.body;
  if (init.json !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(init.json);
  }
  const res = await fetch(base + path, { ...init, headers, body });
  const text = await res.text();
  let data: any = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* not JSON (csv etc.) */
  }
  return { status: res.status, data, res };
}

// A frame with the sacral cells (36 and 37) pressed hard.
function sacralFrame(value = 200): number[] {
  const f = Array(64).fill(0);
  f[35] = value;
  f[36] = value;
  return f;
}

before(async () => {
  await mongoose.connect(TEST_URI);
  await seedDatabase({ reset: true });
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as any).port}/api`;
});

after(async () => {
  server.closeAllConnections();
  server.close();
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test('health reports a connected database', async () => {
  const r = await api('/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.ok, true);
});

test('beds: list has the UI shape and derived statuses', async () => {
  const r = await api('/beds');
  assert.equal(r.status, 200);
  assert.equal(r.data.length, 9);
  const b = r.data.find((x: any) => x.id === 'bed-101');
  for (const k of ['id', 'bedNumber', 'patientName', 'bradenRisk', 'status', 'statusLabel', 'countdown', 'sensorMini', 'assignedRn', 'lastTurnTime']) {
    assert.ok(k in b, `missing field ${k}`);
  }
  assert.equal(b.sensorMini.length, 8);
  const by = (id: string) => r.data.find((x: any) => x.id === id);
  assert.equal(by('bed-101').status, 'due_now');
  assert.equal(by('bed-101').countdown, '00:00');
  assert.equal(by('bed-104').status, 'overdue');
  assert.match(by('bed-104').statusLabel, /^\+5M OVERDUE$/);
  assert.equal(by('bed-103').status, 'ambulating');
  assert.equal(by('bed-106').status, 'pre_alert');
  assert.equal(by('bed-108').status, 'elevated');
  assert.equal(by('bed-102').status, 'stable');
});

test('beds: filters', async () => {
  const overdue = await api('/beds?status=overdue');
  assert.deepEqual(overdue.data.map((b: any) => b.id), ['bed-104']);
  const q = await api('/beds?q=eleanor');
  assert.deepEqual(q.data.map((b: any) => b.id), ['bed-101']);
  const risk = await api('/beds?risk=Severe');
  assert.ok(risk.data.every((b: any) => b.bradenRisk === 'Severe'));
});

test('beds: unknown id is 404', async () => {
  assert.equal((await api('/beds/nope')).status, 404);
});

test('telemetry: auth and validation', async () => {
  const noKey = await api('/telemetry/bed-102/frame', { method: 'POST', json: { cells: sacralFrame() } });
  assert.equal(noKey.status, 401);
  const short = await api('/telemetry/bed-102/frame', { method: 'POST', headers: KEY, json: { cells: [1, 2, 3] } });
  assert.equal(short.status, 400);
  const range = await api('/telemetry/bed-102/frame', { method: 'POST', headers: KEY, json: { cells: Array(64).fill(300) } });
  assert.equal(range.status, 422);
  const unknown = await api('/telemetry/ghost/frame', { method: 'POST', headers: KEY, json: { cells: sacralFrame() } });
  assert.equal(unknown.status, 404);
  const badRaw = await api('/telemetry/bed-102/frame', {
    method: 'POST',
    headers: { ...KEY, 'content-type': 'application/octet-stream' },
    body: new Uint8Array(10),
  });
  assert.equal(badRaw.status, 422);
});

test('telemetry: a raw 64-byte frame updates the matrix, peak and creates an alert', async () => {
  const r = await api('/telemetry/bed-102/frame', {
    method: 'POST',
    headers: { ...KEY, 'content-type': 'application/octet-stream' },
    body: new Uint8Array(sacralFrame(200)),
  });
  assert.equal(r.status, 202);
  assert.equal(r.data.peakZone, 'SACRAL');

  const m = (await api('/beds/bed-102/matrix')).data;
  assert.equal(m.matrix[4][3], 3); // cell 36 = row 4, column 3
  assert.equal(m.matrix[0][0], 0);
  assert.equal(m.peakMmHg, 80); // 200 bytes x 0.4 placeholder scale
  assert.equal(m.fresh, true);

  const bed = (await api('/beds/bed-102')).data;
  assert.equal(bed.matFresh, true);
  assert.equal(bed.peakPressure, 80);
  assert.equal(bed.pressureLabel, 'SACRUM LOAD');

  const alerts = (await api('/audit-logs?bedId=bed-102&status=ACTIVE')).data;
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].zoneCategory, 'Sacrum');
  assert.equal(alerts[0].status, 'ACTIVE');
});

test('telemetry: zone timers grow while loaded and recover when unloaded', async () => {
  const now = Date.now();
  const send = (offsetMs: number, cells: number[]) =>
    api('/telemetry/bed-106/frame', { method: 'POST', headers: KEY, json: { cells, ts: new Date(now + offsetMs).toISOString() } });
  await send(-120_000, sacralFrame());
  await send(-60_000, sacralFrame());
  await send(0, sacralFrame());
  let timers = (await api('/beds/bed-106/zone-timers')).data;
  assert.equal(timers.find((t: any) => t.name === 'SACRUM & COCCYX').elapsedMin, 2);
  assert.equal(timers.find((t: any) => t.name === 'SACRUM & COCCYX').limitMin, 120);

  await send(60_000, Array(64).fill(0)); // one minute unloaded removes two minutes (recoveryFactor 2)
  timers = (await api('/beds/bed-106/zone-timers')).data;
  assert.equal(timers.find((t: any) => t.name === 'SACRUM & COCCYX').elapsedMin, 0);
});

test('turns: confirm a turn schedules the next one and resolves alerts', async () => {
  const r = await api('/beds/bed-102/turns', { method: 'POST', json: { posture: 'RIGHT LATERAL 30°', note: 'Dressing dry' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.resolvedAlerts, 1);
  assert.equal(r.data.bed.posture, 'RIGHT LATERAL 30°');
  assert.equal(r.data.bed.isOverdue, false);
  assert.equal(r.data.bed.countdown, '2h 0m');
  assert.equal(r.data.log.zoneLocus, 'OFFLOADED');
  assert.match(r.data.log.actionTaken, /Dressing dry/);

  const active = (await api('/audit-logs?bedId=bed-102&status=ACTIVE')).data;
  assert.equal(active.length, 0);
  const events = (await api('/beds/bed-102/events?kind=turn')).data;
  assert.equal(events.length, 1);
  const timers = (await api('/beds/bed-102/zone-timers')).data;
  assert.ok(timers.every((t: any) => t.elapsedMin === 0));
});

test('turns: overdue bed returns to normal after a turn', async () => {
  const r = await api('/beds/bed-104/turns', { method: 'POST', json: { posture: 'LEFT LATERAL 30°' } });
  assert.equal(r.data.bed.status, 'optimal'); // Braden High, not low
  assert.match(r.data.log.actionTaken, /No note recorded/);
});

test('turns: skin checks are enforced when provided', async () => {
  const bad = await api('/beds/bed-105/turns', { method: 'POST', json: { posture: 'SUPINE 15°', skinChecks: [true, false, true, true] } });
  assert.equal(bad.status, 422);
  const ok = await api('/beds/bed-105/turns', { method: 'POST', json: { posture: 'SUPINE 15°', skinChecks: [true, true, true, true] } });
  assert.equal(ok.status, 201);
  const empty = await api('/beds/bed-105/turns', { method: 'POST', json: {} });
  assert.equal(empty.status, 400);
});

test('snooze and defer move the due time', async () => {
  const s = await api('/beds/bed-101/snooze', { method: 'POST', json: { minutes: 5 } });
  assert.equal(s.data.snoozed, true);
  assert.equal(s.data.status, 'pre_alert');

  const before = (await api('/beds/bed-108')).data.nextTurnDueAt;
  const d = await api('/beds/bed-108/defer', { method: 'POST', json: { minutes: 10, reason: 'Bedside assessment' } });
  const diff = new Date(d.data.nextTurnDueAt).getTime() - new Date(before).getTime();
  assert.equal(Math.round(diff / 60000), 10);
});

test('off-bed toggles ambulating', async () => {
  const off = await api('/beds/bed-107/off-bed', { method: 'POST', json: { offBed: true } });
  assert.equal(off.data.status, 'ambulating');
  const back = await api('/beds/bed-107/off-bed', { method: 'POST', json: { offBed: false } });
  assert.notEqual(back.data.status, 'ambulating');
});

test('settings: read, patch and validate', async () => {
  const s = (await api('/settings')).data;
  assert.equal(s.thresholds.criticalMmHg, 65);
  assert.equal(s.protocol.cadenceMin, 120);

  const patched = await api('/settings', { method: 'PUT', json: { thresholds: { criticalMmHg: 70 }, protocol: { cadenceMin: 90 } } });
  assert.equal(patched.status, 200);
  assert.equal(patched.data.thresholds.criticalMmHg, 70);
  assert.equal(patched.data.thresholds.warnMmHg, 45); // untouched
  assert.equal((await api('/settings')).data.protocol.cadenceMin, 90);

  assert.equal((await api('/settings', { method: 'PUT', json: { thresholds: { warnMmHg: 90 } } })).status, 422);
  assert.equal((await api('/settings', { method: 'PUT', json: { thresholds: { criticalMmHg: 'high' } } })).status, 400);
  await api('/settings', { method: 'PUT', json: { thresholds: { criticalMmHg: 65 }, protocol: { cadenceMin: 120 } } });
});

test('audit logs: shape, filters, paging, csv, acknowledge', async () => {
  const all = (await api('/audit-logs')).data;
  assert.ok(Array.isArray(all) && all.length >= 6);
  assert.equal(typeof all[0].timestamp, 'string');
  assert.ok(all[0].at);

  const heels = (await api('/audit-logs?site=heels')).data;
  assert.ok(heels.length >= 1 && heels.every((l: any) => l.zoneCategory === 'Heels'));
  const berg = (await api('/audit-logs?q=berg')).data;
  // The search also matches RN names and bed/patient ids (like the UI), e.g. "Solberg".
  assert.ok(berg.some((l: any) => l.patientName === 'H. Berg'));
  assert.ok(berg.every((l: any) => /berg/i.test(`${l.patientName} ${l.bedUnit} ${l.attendingRn} ${l.patientId}`)));
  const zone = (await api('/audit-logs?zone=Occiput')).data;
  assert.ok(zone.length >= 1);

  const page = (await api('/audit-logs?page=1&pageSize=2')).data;
  assert.equal(page.items.length, 2);
  assert.ok(page.total >= 6 && page.pages >= 3);

  const csv = await api('/audit-logs/export.csv');
  assert.match(csv.res.headers.get('content-type') ?? '', /text\/csv/);
  assert.match(csv.data as string, /^Timestamp,Bed,PatientId/);

  const ack = await api('/audit-logs/log-1/acknowledge', { method: 'POST', json: { rn: 'RN K. Nygård' } });
  assert.equal(ack.status, 200);
  assert.equal(ack.data.acknowledgedBy, 'RN K. Nygård');
  const gap = new Date(ack.data.reAlertAt).getTime() - new Date(ack.data.acknowledgedAt).getTime();
  assert.equal(Math.round(gap / 60000), 15);
  assert.equal((await api('/audit-logs/nope/acknowledge', { method: 'POST', json: { rn: 'x' } })).status, 404);
});

test('mats: tare is real, self-test uses data, unfinished features say 501', async () => {
  // No frames yet for bed-103: tare must refuse.
  assert.equal((await api('/mats/bed-103/tare', { method: 'POST' })).status, 409);

  const st = await api('/mats/bed-103/self-test', { method: 'POST' });
  assert.equal(st.data.pass, false); // stale stream

  // bed-107 gets a frame with a constant offset, then tare removes it.
  const offset = Array(64).fill(30);
  await api('/telemetry/bed-107/frame', { method: 'POST', headers: KEY, json: { cells: offset } });
  assert.equal((await api('/mats/bed-107')).data.peakMmHg, 12); // 30 x 0.4 before tare
  assert.equal((await api('/mats/bed-107/tare', { method: 'POST' })).status, 200);
  await api('/telemetry/bed-107/frame', { method: 'POST', headers: KEY, json: { cells: offset } });
  assert.equal((await api('/mats/bed-107')).data.peakMmHg, 0);

  const cells = (await api('/mats/bed-107/cells')).data;
  assert.equal(cells.length, 64);
  assert.equal((await api('/mats/bed-107/cells/PZ-01/zero', { method: 'POST' })).status, 200);
  assert.equal((await api('/mats/bed-107/cells/PZ-99/zero', { method: 'POST' })).status, 404);

  const logs = (await api('/mats/bed-107/logs')).data;
  assert.ok(logs.some((l: any) => /Tare applied/.test(l.message)));

  assert.equal((await api('/mats/bed-107/calibrate', { method: 'POST' })).status, 501);
  assert.equal((await api('/mats/bed-107/cells/PZ-01/impedance-sweep', { method: 'POST' })).status, 501);
});

test('stream: browsers receive hello and live frame events', async () => {
  const ctrl = new AbortController();
  const res = await fetch(base + '/stream', { signal: ctrl.signal });
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') ?? '', /text\/event-stream/);
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let seen = '';
  const readUntil = async (needle: string) => {
    const deadline = Date.now() + 4000;
    while (!seen.includes(needle) && Date.now() < deadline) {
      const { value, done } = await reader.read();
      if (done) break;
      seen += dec.decode(value);
    }
    assert.ok(seen.includes(needle), `did not receive "${needle}"; got: ${seen}`);
  };
  await readUntil('event: hello');
  await api('/telemetry/bed-105/frame', { method: 'POST', headers: KEY, json: { cells: sacralFrame(100) } });
  await readUntil('event: frame');
  ctrl.abort();
});

test('beds: create, duplicate, patch, delete', async () => {
  const body = {
    id: 'bed-900',
    bedNumber: 'BED 900',
    patientName: 'Test Patient',
    patientId: '#T-1',
    pod: 'POD 9',
    bradenScore: 14,
    bradenRisk: 'Moderate',
  };
  const created = await api('/beds', { method: 'POST', json: body });
  assert.equal(created.status, 201);
  assert.equal(created.data.status, 'optimal');
  assert.equal((await api('/beds', { method: 'POST', json: body })).status, 409);
  assert.equal((await api('/beds', { method: 'POST', json: { ...body, id: 'Bad Id' } })).status, 400);

  const patched = await api('/beds/bed-900', { method: 'PATCH', json: { assignedRn: 'RN T. Test' } });
  assert.equal(patched.data.assignedRn, 'RN T. Test');
  assert.equal((await api('/beds/bed-900', { method: 'DELETE' })).status, 204);
  assert.equal((await api('/beds/bed-900')).status, 404);
});

test('broadcasts are stored', async () => {
  const r = await api('/broadcasts', { method: 'POST', json: { pod: 'POD-3', message: 'Rotate beds now', sentBy: 'RN K.' } });
  assert.equal(r.status, 201);
  const list = (await api('/broadcasts')).data;
  assert.equal(list[0].message, 'Rotate beds now');
});

test('unknown routes and bad JSON', async () => {
  assert.equal((await api('/nothing-here')).status, 404);
  const bad = await fetch(base + '/settings', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: '{oops' });
  assert.equal(bad.status, 400);
});

test('zones: reset one zone and all zones (Zones page buttons)', async () => {
  const before = (await api('/beds/bed-07/zone-timers')).data;
  assert.equal(before.length, 6);
  const sacrum = before.find((t: any) => t.name === 'SACRUM & COCCYX');
  assert.equal(sacrum.elapsedMin, 112);
  assert.equal(sacrum.isNearLimit, true);
  assert.equal(before.find((t: any) => t.name === 'LEFT TROCHANTER (HIP)').isElevated, true);

  const one = await api(`/beds/bed-07/zones/${encodeURIComponent('Sacrum & Coccyx')}/reset`, { method: 'POST', json: { rn: 'RN K. Nygård' } });
  assert.equal(one.status, 200);
  assert.equal(one.data.zone, 'SACRUM & COCCYX');
  assert.equal(one.data.resolvedAlerts, 1); // seeded ACTIVE sacrum alert
  const after = (await api('/beds/bed-07/zone-timers')).data;
  assert.equal(after.find((t: any) => t.name === 'SACRUM & COCCYX').elapsedMin, 0);
  assert.equal(after.find((t: any) => t.name === 'HEELS (CALCANEUS)').elapsedMin, 42); // untouched

  assert.equal((await api('/beds/bed-07/zones/NOPE/reset', { method: 'POST', json: {} })).status, 404);
  const all = await api('/beds/bed-07/zones/reset-all', { method: 'POST', json: {} });
  assert.equal(all.status, 200);
  assert.ok((await api('/beds/bed-07/zone-timers')).data.every((t: any) => t.elapsedMin === 0));
});

test('posture timeline: built from logged turns', async () => {
  const r = await api('/beds/bed-07/posture-timeline?hours=8');
  assert.equal(r.status, 200);
  assert.equal(r.data.segments.length, 4);
  assert.deepEqual(r.data.segments.map((s: any) => s.group), ['BACK', 'LEFT', 'BACK', 'RIGHT']);
  const total = Object.values(r.data.totalsMin as Record<string, number>).reduce((a, b) => a + b, 0);
  assert.ok(total >= 435 && total <= 445); // first turn was about 440 minutes ago
  assert.equal(r.data.totalsMin.LEFT, 120);
  // A bed with no history reports its current posture for the whole window.
  const flat = await api('/beds/bed-105/posture-timeline?hours=2');
  assert.equal(flat.data.segments.length >= 1, true);
});

test('cells: status bands follow the sensor-map legend (30 / 50 mmHg)', async () => {
  // 100 bytes = 40 mmHg (warn), 140 bytes = 56 mmHg (critical), 50 bytes = 20 mmHg (nominal)
  const f = Array(64).fill(0);
  f[0] = 50;
  f[1] = 100;
  f[2] = 140;
  await api('/telemetry/bed-108/frame', { method: 'POST', headers: KEY, json: { cells: f } });
  const cells = (await api('/mats/bed-108/cells')).data;
  assert.equal(cells[0].status, 'nominal');
  assert.equal(cells[1].status, 'warn');
  assert.equal(cells[2].status, 'critical');
  assert.equal(cells[2].load, 56);
});
