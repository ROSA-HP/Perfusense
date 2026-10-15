# Perfusense backend (Express + MongoDB)

The "E", "M" and "N" of the MERN stack for the Perfusense UI. It stores beds, alerts and mat state, derives the statuses the UI shows, receives telemetry from the 8x8 mat, and streams live updates to the browser.

## Run it

```bash
npm install                  # if npm complains about peer dependencies: npm install --legacy-peer-deps
cp .env.example .env         # then edit MONGODB_URI and DEVICE_KEY
# MongoDB must be running. Quick way:  docker run -d -p 27017:27017 --name mongo mongo:7
npm run dev:all              # web UI on :3000 and API on :4000 together
# or separately:  npm run dev   and   npm run server
```

- The first start with an empty database seeds the UI's demo data (9 beds, 6 audit entries). `npm run seed` resets it.
- `SIMULATE=true` in `.env` feeds fake telemetry for every bed, so the UI is alive without hardware.
- Vite proxies `/api` to the API (see `vite.config.ts`), so the UI can call `/api/...` with no CORS setup. The typed client is in `src/api/client.ts`.
- Health check: `http://localhost:4000/api/health`.

## What it does for each screen

| Screen | Endpoints |
|---|---|
| Roster, Live header | `GET /api/beds`, `GET /api/beds/:id` |
| Live heatmap | `GET /api/beds/:id/matrix` + live stream |
| Flip time / turn modal | `POST /api/beds/:id/turns`, `/snooze`, `/defer` |
| 8-hour chronology | `GET /api/beds/:id/posture-timeline?hours=8` |
| Zones page | `GET /api/beds/:id/zone-timers`, `POST /api/beds/:id/zones/:zone/reset`, `POST /api/beds/:id/zones/reset-all` |
| Protocol / limits modals | `GET` / `PUT /api/settings` |
| Sensor map | `GET /api/mats/:bedId/cells`, `POST /api/mats/:bedId/tare`, `/cells/:cellId/zero`, `/self-test` |
| Alerts, audit export | `GET /api/audit-logs` (filters and paging), `/export.csv`, `POST /api/audit-logs/:id/acknowledge`, `/resolve` |
| Roster management | `POST /api/beds`, `PATCH /api/beds/:id`, `DELETE /api/beds/:id`, `POST /api/beds/:id/off-bed` |
| Turn schedule | `POST /api/broadcasts` (stored only, see limits) |
| Device (ESP32) | `POST /api/telemetry/:bedId/frame` |
| Live updates | `GET /api/stream` (server-sent events: `frame`, `bed`, `alert`, `broadcast`) |

Responses use the UI's own types (`PatientBed`, `ZoneTimer`, `PiezoCell`, `AuditLogItem` from `src/types.ts`), with a few extra fields the UI can ignore.

### How statuses are derived (nothing is stored as a label)

A bed's `status`, `statusLabel` and `countdown` are computed on every request from stored facts (next turn due time, off-bed time, snooze) and live mat data:

1. Off the bed: `ambulating`.
2. Past the due time: `due_now` for the first minute, then `overdue` ("+5M OVERDUE", "+05:14").
3. Within `preAlertMin` of the due time: `pre_alert`.
4. Live peak at or above `elevatedMmHg`: `elevated`.
5. Otherwise `stable` (low Braden risk) or `optimal`.

Mat data older than `staleSec` is treated as offline and the stored fallback values are used.

### Zone timers and alerts

Each frame, every zone with cells counts up while its highest cell is at or above `loadedMmHg`, and counts down `recoveryFactor` times faster while unloaded. An alert (audit log row, `ACTIVE`) is created when a zone passes its time limit or any cell reaches `criticalMmHg`. Confirming a turn resolves open alerts, resets the timers and schedules the next turn.

## Sending data from the mat

```
POST /api/telemetry/bed-07/frame
x-device-key: <DEVICE_KEY from .env>
Content-Type: application/octet-stream        body: exactly 64 bytes (row-major, 0..255)
```
or `Content-Type: application/json` with `{ "cells": [64 numbers], "ts": "optional ISO time" }`.

ESP32 sketch fragment:

```cpp
#include <HTTPClient.h>

void postFrame(const uint8_t* frame64) {          // the same 64 bytes the firmware builds in publishFrame()
  HTTPClient http;
  http.begin("http://192.168.1.10:4000/api/telemetry/bed-07/frame");
  http.addHeader("Content-Type", "application/octet-stream");
  http.addHeader("x-device-key", "change-me-device-key");
  int code = http.POST((uint8_t*)frame64, 64);    // 202 = accepted
  http.end();
}
```

The firmware already subtracts its own empty-mat baseline. The server's "tare" does the same job again, so use one of them (device baseline, or server tare with raw device data).

## Tests

```bash
npm run lint:server     # strict type check of the server code
npm run test:server     # 22 integration tests; needs MongoDB. Uses the throw-away database "perfusense_test"
```
Set `MONGODB_TEST_URI` to use another database. The tests drop their database when they finish.

## Important limits (read before relying on it)

- **Placeholders, not clinical values.** Every threshold in `GET /api/settings` (critical and warn mmHg, dwell, cadence, zone limits, `loadedMmHg`, level bands) is a default for development. Clinical staff must set them. `mmHgPerByte` (0.4) is a placeholder until the mat is calibrated with known weights, so the mmHg numbers are not real pressure yet.
- **No login.** Anyone who can reach the API can read and change data. Before anyone outside your team uses it: add authentication and roles, use HTTPS, restrict CORS, and set a strong `DEVICE_KEY` (the server refuses to start in production with the default).
- **Patient data.** The demo data has patient names. For anything real use IDs only, agree a retention policy, and get ethics approval.
- **Not built yet:** pager/Vocera/EHR delivery (broadcasts and "EHR sync" messages in the UI are stored or stubbed only), mat commands from the server to the device (`/calibrate` and `/impedance-sweep` return 501), per-user accounts, MQTT ingest (HTTP is used instead), elbow cells (the mat has none, so "ELBOWS & OCCIPUT" follows occiput cells).
- One writer per bed: frames for the same bed should come from one device.
- The cell layout (which cell belongs to which zone) is in `server/data/cellLayout.ts` and `server/lib/zones.ts`. Change it there when the physical mat layout is final.
- The 8x8 grids are stored as flat 64-number arrays and returned as 8x8, which keeps them portable across MongoDB-compatible databases.
