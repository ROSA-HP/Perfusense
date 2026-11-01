# PerfuSense

A low-cost 10×10 pressure-sensing mat under a bedridden patient, an ESP32 that times how long each body area stays loaded, and a ward dashboard that tells caregivers when and where to turn the patient.

> **Research prototype (ISEF). Not a medical device.** Every threshold is a placeholder until the mat is calibrated and clinical staff set the limits. It has not been tested on patients.

Full background, hardware, numbers and rationale: [PERFUSENSE_GUIDE.md](PERFUSENSE_GUIDE.md). Plan for the team: [docs/TEAM_PLAN.md](docs/TEAM_PLAN.md).

## What is in this repository

| Folder | What |
|---|---|
| `firmware/` | ESP32 sketch for the 10×10 mat (Arduino IDE) and host-side logic tests |
| `server/` | Express + MongoDB API: beds, alerts, zone timers, pressure history, live stream |
| `src/` | React dashboard: Monitor, Beds, Zones, History, Mat |

```
ESP32 --POST /api/telemetry/:bedId/frame (100 bytes, 2/s)--> Express --> MongoDB
   ^                                                           |
   +---- reply: commands "ack" / "tare" ----------------------+--SSE /api/stream--> React
```

## Run it

Needs Node 20+ and MongoDB (local, or `docker run -d -p 27017:27017 mongo:7`).

```bash
npm install                 # add --legacy-peer-deps if npm reports peer conflicts
cp .env.example .env        # set MONGODB_URI and DEVICE_KEY; SIMULATE=true for fake telemetry
npm run dev:all             # web on http://localhost:3000, API on http://localhost:4000
```

Without the API the dashboard still opens and shows **SAMPLE DATA** (clearly labelled).

| Script | Purpose |
|---|---|
| `npm run dev` / `npm run server` | web UI only / API only |
| `npm run seed` | reset the database to the demo beds |
| `npm run lint` / `npm run lint:server` | type checks |
| `npm run test:server` | API integration tests (need MongoDB) |
| `bash firmware/run_checks.sh` | firmware logic tests (need g++) |
| `npm run build` | production build of the UI |

## The mat contract

`POST /api/telemetry/:bedId/frame` with header `x-device-key`, body = exactly 100 bytes (row-major, 0–255) or JSON `{ "cells": [100 numbers] }`. Any other size is refused with 422. The reply carries `"commands": ["ack" | "tare"]` for the mat. Details: [server/README.md](server/README.md) and [firmware/README.md](firmware/README.md).

## Design

Neo-brutalist clinical style: thick ink borders, hard shadows, Space Grotesk / Space Mono, colour tokens in [CLAUDE.md](CLAUDE.md). Status always has a text label, never colour alone. The heatmap colour scale follows the server setting `telemetry.levelMmHg` (default 15 / 32 / 55 mmHg).
