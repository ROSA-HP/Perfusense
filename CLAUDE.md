# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project in one paragraph

PerfuSense is an ISEF research prototype: a 10×10 (100-cell) Velostat pressure mat under a bedridden patient, read by an ESP32, which times how long each body area stays loaded and alerts caregivers to turn the patient before a pressure ulcer forms. This repo holds the **React dashboard** (`src/`) and the **Express + MongoDB backend** (`server/`). The ESP32 firmware (10×10, not yet run on a board) is in `firmware/`; the posture model and its FastAPI service are in `ai/` but are not connected to the server, and have never been tested on our own mat. Full background, numbers and design rationale: `PERFUSENSE_GUIDE.md`.

## Hard rules

1. **Not a medical device.** No diagnostic or clinical-benefit claims in code, UI text or docs.
2. **Never invent clinical values.** Thresholds, limits, cadences and `mmHgPerByte` are placeholders: keep them in `server/lib/settings.ts` (configurable, validated), never hard-code new ones elsewhere.
3. **Never invent data.** Any number in the UI that does not come from a real device or the API must be labelled `SAMPLE DATA`.
4. **Keep the device contract stable** (section "Contracts"). Firmware is built separately and depends on it.
5. Ask before deleting files, rewriting history, or changing the database schema in a breaking way.

## Which docs to trust

- `PERFUSENSE_GUIDE.md`: current description (10×10, HTTP).
- `server/README.md`: backend details (some 8×8 wording is outdated).
- `Perfusense.md` (PRD v1.1) and `PLAN.md`: **historical**. They describe an 8×8 mat with MQTT, `server.js` and a `web/` folder that do not exist. Use them only for the AI-pipeline code in PRD Appendix D, and change its input size to 10×10.
- `README.md`: short overview and run instructions (current).
- `docs/TEAM_PLAN.md`: who does what next.
- `docs/AI_TRAINING_REPORT.md` and `ai/README.md`: the posture model, its data, code and measured results.

## Commands

```bash
npm install                 # add --legacy-peer-deps if npm reports peer conflicts
cp .env.example .env        # set MONGODB_URI, DEVICE_KEY; SIMULATE=true for fake telemetry

npm run dev                 # web UI on :3000 (mock data unless API_URL is set, see below)
npm run server              # API on :4000 (tsx watch)
npm run dev:all             # both together
npm run seed                # reset the database to demo data

npm run lint                # front-end type check (tsc --noEmit)
npm run lint:server         # server type check (strict)
npm run test:server         # integration tests; need a running MongoDB
bash firmware/run_checks.sh # firmware logic tests + type checks; need g++
npm run build               # production build of the UI
```

**Connecting the UI to the API:** `vite.config.ts` always proxies `/api` to `API_URL` (default `http://localhost:4000`). When the API is down the proxy answers 503 and the UI switches to SAMPLE DATA mode (orange banner) until `/api/health` answers again. Alternatively set `VITE_API_URL=http://localhost:4000` in `.env` (client calls the API directly; `CORS_ORIGIN` must include the UI origin).

MongoDB: local install or `docker run -d -p 27017:27017 mongo:7`. Tests use `perfusense_test` on localhost (override with `MONGODB_TEST_URI`) and drop it afterwards. The team develops on Windows.

## Architecture

```
ESP32 --POST /api/telemetry/:bedId/frame (100 bytes, 2/s)--> Express (server/) --> MongoDB
                                                                 |
                                                                 +--SSE /api/stream--> React (src/)
React --REST /api/...--> Express  (turns, snooze, zone resets, settings, tare)
```

### Backend (`server/`)

- `index.ts` connects MongoDB, seeds an empty DB, starts the app, starts the simulator if `SIMULATE=true`.
- `app.ts` mounts routers under `/api`: `beds`, `audit-logs`, `mats`, `telemetry` + `stream`, and `ward` (health, settings, broadcasts).
- `services/ingest.ts`: per-frame pipeline (validate → tare baseline → mmHg → levels → cell status → peak → six body-zone timers → alerts → save → broadcast).
- `services/derive.ts`: bed `status`, `statusLabel`, `countdown` are **computed on each request, never stored**. Do not add stored status fields.
- `services/beds.ts`: turn, snooze, defer, off-bed, zone resets, posture timeline, pressure history (`PressureSample`: one per bed per minute, kept 7 days).
- Tare: a mat sending raw bytes (ESP32) relearns its own baseline, so the server clears its own; JSON sources get a server baseline. Never subtract both.
- `services/hub.ts`: server-sent events (`hello`, `frame`, `bed`, `alert`, `broadcast`).
- `lib/settings.ts`: all tunable values with Zod validation and defaults. `lib/zones.ts`: cell → body-zone mapping. `data/cellLayout.ts`: zone name of each of the 100 cells.
- `models.ts`: Bed, MatState, AuditLog, BedEvent, HardwareLog, Broadcast, Setting. Grids are stored **flat** (100 numbers) and returned as 2-D arrays.

### Front end (`src/`)

- `App.tsx` is the state hub: connection (15 s health check), live stream, roster refresh every 30 s, and the monitored bed (default `bed-07`, changed from the Beds page). When connected the API is the only data source (an empty list stays empty); when it is down the app shows `data/mockData.ts` under a SAMPLE DATA banner.
- `api/client.ts`: typed REST calls and `connectLive()` (EventSource). Add new endpoints here, not with raw `fetch` in views.
- Views: `LiveHeatmapView`, `TurnScheduleView`, `BedRosterView`, `PeakAlertsView`, `SensorHardwareView`. Shared types in `types.ts`. Shared UI pieces (Card, Chip, Button, SampleBadge, HeatCell, PressureLegend, Icon) in `components/ui.tsx`: use them instead of new one-off styles. Heatmap colours in `utils/heatmapColors.ts`: values are always mmHg, band edges come from `settings.telemetry.levelMmHg` via `setPressureScale()`.

## Contracts (do not break without updating the firmware)

- **Frame:** `POST /api/telemetry/:bedId/frame`, header `x-device-key: <DEVICE_KEY>`.
  - Raw body: `Content-Type: application/octet-stream`, exactly 100 bytes, row-major, 0–255.
  - Or JSON: `{ "cells": [100 numbers], "ts": "optional ISO time" }`.
  - Reply `202`: `{ bedId, peakMmHg, peakZone, alerts }`. The reply also carries `"commands": ["ack" | "tare"]` (queued in `MatState.pendingCommands` by `queueDeviceCommand()`: `ack` on a turn or zone reset, `tare` on tare; each delivered once). The firmware parses it.
- **Byte meaning:** firmware byte = smoothed signal above its baseline × 255 / 1500 mV. Server mmHg = byte × `mmHgPerByte` (0.4, placeholder).
- **Body-zone timer names** (UI and server must match): `SACRUM & COCCYX`, `HEELS (CALCANEUS)`, `LEFT TROCHANTER (HIP)`, `SHOULDERS (SCAPULAE)`, `RIGHT TROCHANTER (HIP)`, `ELBOWS & OCCIPUT`.
- Response shapes follow `src/types.ts` (`PatientBed`, `ZoneTimer`, `PiezoCell`, `AuditLogItem`) plus extra fields the UI may ignore.

## Conventions

- TypeScript strict on the server. Validate every request body with Zod via `parse()` from `lib/errors.ts`; wrap async routes in `asyncHandler`; throw `ApiError(status, message)` for client errors.
- Broadcast a `bed` event after any change that affects a bed's view.
- Keep logic out of routes: put it in `services/`.
- Every new endpoint gets an integration test in `server/tests/api.test.ts`.
- Design tokens (UI): Mint Frost `#F1FCF9`, White, Bio-Slate `#EBF6F4`, Parchment `#EDE8DC`, Surgical Teal `#1D635D`, Cyan Glow `#ADEFE7`, Ice Mint `#A3CFC9`, Obsidian Ink `#121C1B`, Slate Charcoal `#3F4947`, Carmine `#8B2635`, Terracotta `#D97757`, Soft Peach `#FE9572`, Sage `#A8C5B5`. Fonts: Space Grotesk, Space Mono. Neo-brutalist: thick ink borders, hard offset shadows, no gradients. Status always has a text label, never colour alone.

## Known issues (priority order)

1. **Nothing has run on real hardware yet.** The firmware is now 10×10 (`firmware/perfusense_mat/`, pin map in `firmware/README.md`) but has not been compiled for or flashed to an ESP32, and its host tests need g++. Keep `Processing` free of Arduino calls so the host tests still run.
2. **Capacitor on the mux SIG line:** 10 kΩ × 0.1 µF = 1 ms RC, but `SETTLE_US` is 80 µs, so the previous cell bleeds into the next (crosstalk). Use about 10 nF or a longer settle, then re-measure crosstalk.
3. **Server integration tests have not been run since the last changes** (no MongoDB on the dev machine). Run `npm run test:server` before relying on them.
4. **No login, no HTTPS:** anyone who can reach the API can read and change data. RN names come from the bed's assigned RN, not from a signed-in user.
5. An existing database keeps the old pressure scale [10, 25, 40] in its stored settings: run `npm run seed` (resets data) or `PUT /api/settings` with `{"telemetry":{"levelMmHg":[15,32,55],"cellWarnMmHg":32,"cellCriticalMmHg":55}}`.

## Not built yet

Connection from Express to the AI service in `ai/` (send the last 30 frames at 1 Hz, store the posture, turn events with a hold time), authentication and HTTPS, pager/EHR integration, `/calibrate` and `/impedance-sweep` (return 501), per-cell calibration to real mmHg.
