# CLAUDE.md

Guidance for Claude Code working in this repository.

## Project in one paragraph

PerfuSense is an ISEF research prototype: a 10×10 (100-cell) Velostat pressure mat under a bedridden patient, read by an ESP32, which times how long each body area stays loaded and alerts caregivers to turn the patient before a pressure ulcer forms. This repo holds the **React dashboard** (`src/`) and the **Express + MongoDB backend** (`server/`). The ESP32 firmware (still 8×8) is in `firmware/`; the AI model is not built yet. Full background, numbers and design rationale: `PERFUSENSE_GUIDE.md`.

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
- `README.md`: outdated (says 64-channel, old colour table).

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

**Connecting the UI to the API:** `vite.config.ts` only proxies `/api` when `API_URL` is set; otherwise it serves a standalone fallback and the UI shows mock data.

```bash
API_URL=http://localhost:4000 npm run dev                   # bash
$env:API_URL="http://localhost:4000"; npm run dev           # Windows PowerShell
```

Alternatively set `VITE_API_URL=http://localhost:4000` in `.env` (client calls the API directly; `CORS_ORIGIN` must include the UI origin).

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
- `services/beds.ts`: turn, snooze, defer, off-bed, zone resets, posture timeline.
- `services/hub.ts`: server-sent events (`hello`, `frame`, `bed`, `alert`, `broadcast`).
- `lib/settings.ts`: all tunable values with Zod validation and defaults. `lib/zones.ts`: cell → body-zone mapping. `data/cellLayout.ts`: zone name of each of the 100 cells.
- `models.ts`: Bed, MatState, AuditLog, BedEvent, HardwareLog, Broadcast, Setting. Grids are stored **flat** (100 numbers) and returned as 2-D arrays.

### Front end (`src/`)

- `App.tsx` is the state hub. Monitored bed is hard-coded as `bed-07`. Falls back to `data/mockData.ts` when the API is down (15 s health heartbeat).
- `api/client.ts`: typed REST calls and `connectLive()` (EventSource). Add new endpoints here, not with raw `fetch` in views.
- Views: `LiveHeatmapView`, `TurnScheduleView`, `BedRosterView`, `PeakAlertsView`, `SensorHardwareView`. Shared types in `types.ts`. Heatmap colours in `utils/heatmapColors.ts`.

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

1. **64-cell frames crash ingest (500).** Mat state has 100 cells; a 64-value frame gives `NaN` loads and the save fails. 6 of 22 tests fail for this reason (they still send 64-cell frames) at commit `9c98459`. Fix: reject a frame whose length differs from the mat's cell count with 422, and update the tests to 100-cell frames.
2. **Firmware is still 8×8** (`firmware/perfusense_mat/`). A 10×10 version needs 10 row pins and mux S0–S3 (proposed pin map in `PERFUSENSE_GUIDE.md` §5.4). Keep `Processing` free of Arduino calls so its host tests still run.
3. **Threshold scales disagree:** UI legend 15 / 32 / 55 mmHg vs server `levelMmHg` [10, 25, 40], cell bands 30 / 50, critical 65. Unify through settings.
4. **Mock AI output looks real:** `LiveHeatmapView` shows "CONFIDENCE: 94.2%". Label as SAMPLE DATA or hide until a model exists.
5. Countdowns are computed server-side; the roster only refreshes on `bed` events or reload. Consider polling `/api/beds` every 30–60 s.
6. Cleanup: unused `@google/genai` and `GEMINI_API_KEY`; outdated `README.md`.

## Not built yet

AI service (Python/TensorFlow Transformer, planned as a separate FastAPI service fed 30 frames at 1 Hz), authentication and HTTPS, pager/EHR integration, `/calibrate` and `/impedance-sweep` (return 501), per-cell calibration to real mmHg.
