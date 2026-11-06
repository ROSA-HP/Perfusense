# PerfuSense: Complete Project Guide

**Status snapshot: 2 November 2026, repository commit `56ae7b4`** (github.com/ROSA-HP/Perfusense).
Team: Sadin Hossam, Fares Hassan. Category: ISEF, Biomedical Engineering.

This file collects everything about the project in one place: the idea, the hardware, the firmware, the server, the web app, the AI model, the design system, the results, the plans, and what is still inconsistent. It replaces the older `Perfusense.md` (PRD v1.1) and `PLAN.md` as the current description. Those two files describe an earlier 8×8 + MQTT design and are kept only for history.

> **Research prototype. Not a medical device.** Every alarm threshold in the software is a placeholder until the mat is calibrated and clinical staff set the limits. PerfuSense has not been tested on patients.

---

## Contents

1. What PerfuSense is
2. The problem (sourced numbers)
3. Existing solutions and the gap
4. How the whole system works
5. Hardware: the 10×10 mat
6. ESP32 firmware
7. Server (Express + MongoDB)
8. Web dashboard (React)
9. AI model (Transformer) and datasets
10. Design system
11. Results and validation plan
12. Current status: done, partial, not started
13. Known issues and inconsistencies (fix list)
14. Future goals
15. Presenting the project (talking points and judge Q&A)
16. Deliverables made so far
17. Glossary
18. References

---

## 1. What PerfuSense is

A thin, low-cost pressure-sensing mat that lies under a bedridden patient. It:

1. **Senses** where the pressure is, with a 10×10 grid (100 cells) of pressure-sensitive Velostat.
2. **Decides** how long each body area has been loaded (a pressure × time index), on the ESP32 itself.
3. **Alerts** the caregiver with a local buzzer and LED, and on a live web dashboard ("FLIP TIME").
4. **Confirms**: when a nurse marks the patient as turned, the timers reset and the alert clears.

One-sentence pitch: *a low-cost mat that never forgets a patient, and tells a nurse exactly where and when to turn.*

Key numbers (from the team's ISEF deck):

| Item | Value |
|---|---|
| Sensing cells | 100 (10×10) |
| Mat size | 30 × 30 cm, placed under the lower back (sacrum) |
| Parts cost | about 1,000 EGP (≈ $20) |
| Dashboard refresh | 1 to 2 frames per second |

---

## 2. The problem (sourced numbers)

Sustained pressure squeezes small blood vessels in the skin. When it lasts long enough, the tissue starves of blood and a pressure ulcer (bedsore, pressure injury) forms. Damage often starts under the skin, before anything is visible. Turning patients usually follows a fixed schedule (often every 2 hours), not measured pressure.

| Figure | Value | Source |
|---|---|---|
| US patients affected per year | 2.5 million | AHRQ [1] |
| US deaths per year as a direct result | 60,000 | AHRQ [1] (some sources quote this as worldwide; cite it as US/AHRQ) |
| US cost per year | $9.1–11.6 billion | AHRQ [1] |
| Cost of one ulcer | $20.9K to $151.7K | AHRQ [1] |
| Worldwide recorded deaths | 16,622 (1990) → 37,033 (2021) | GBD 2021, Zhang 2025 [2]. Probably an undercount, because only deaths coded to the ulcer itself are counted |
| Hospitalised adults with a pressure injury | 12.8% (pooled, about 2.5 million patients) | Li 2020 [3] |
| ICUs, Eastern Mediterranean region | 16.6% | Isfahani 2024 [4] |
| Capillary closing pressure (commonly cited) | about 32 mmHg | Classic physiology literature. Find the original citation before quoting it |

Do not claim a number of "countries that can afford a fix": no source was found for it.

---

## 3. Existing solutions and the gap

| Solution | Measures pressure | Continuous | Zone alerts | Low cost |
|---|---|---|---|---|
| Manual turning | No | No (fixed schedule) | No | Yes |
| Pressure-relieving mattresses | No | No (passive) | No | No |
| Commercial pressure-mapping mats | Yes | Often short tests | Varies | No |
| **PerfuSense** | **Yes** | **Yes** | **Yes** | **Yes** |

Cost comparison (deck figures):

| | Commercial | PerfuSense |
|---|---|---|
| Pressure-mapping system | ≈ $4,000 per bed; vendor example ≈ $80,000 per 20-bed unit [5] | ≈ $20 per mat |
| Cost per sensing point | 5,000 EGP (team's price for one FSR) | ≈ 10 EGP |
| Repeatability | ≈ 2% best case [9] | ±5.8% (team bench result) |
| Resolution | Higher | Lower, coarser grid |

UK trials put pressure-relieving mattresses at roughly £1,000 to £4,000. Those mattresses **treat** but do not **monitor**, so they are not a direct competitor.

**Why lower precision is acceptable:** PerfuSense needs wide coverage, not exact force. Alarms fire when a zone stays above a relative level for too long. Even commercial FSRs vary 5–25% in absolute accuracy [8].

---

## 4. How the whole system works

```
 MAT (10×10 Velostat)  --analog-->  ESP32  --HTTP POST, 100 bytes, 2/s-->  EXPRESS SERVER  --SSE live stream-->  REACT DASHBOARD
                                     |  local alarm                         |  MongoDB history                     |  nurse confirms turn
                                     |  (works with no Wi-Fi)               |  bed status, alerts                  |
                                     <------------- reply: commands ("ack", "tare") <-----------------------------------+
                                                                            |
                                                                            +--(planned)--> AI SERVICE (Python, TensorFlow Transformer)
                                                                                            30-second window → lying position
```

The closed loop: the mat measures, the ESP32 times the load and sounds a local alarm, the server stores and decides, the dashboard shows it, and the nurse's "Done, turned" goes back to the mat as an `ack` command.

---

## 5. Hardware: the 10×10 mat

### 5.1 Parts (deck bill of materials, 1,000 EGP total)

| Part | Cost (EGP) | Notes |
|---|---|---|
| Velostat (Linqstat) sheet | 460 | Pressure-sensitive carbon-loaded film. Pressure lowers its resistance |
| ESP32 dev board (WROOM-32) | 300 | Use WROOM, not WROVER (GPIO 16/17 are taken by PSRAM on WROVER) |
| CD74HC4067 multiplexer | 120 | One 16-channel analog mux, 10 channels used |
| Copper tape (conductive adhesive) | 95 | Rows and columns |
| Insulator / sheets | 25 | PET or acetate base and cover, Kapton edges |
| Small parts | — | 10 kΩ resistor, 0.1 µF capacitor, active buzzer, LED + 330 Ω, push button |

### 5.2 Construction (three layers)

```
 [ optional thin foam, 1–2 mm ]
 [ top PET sheet + 10 copper strips = COLUMNS (copper facing down) ]
 [ Velostat sheet ]
 [ bottom PET sheet + 10 copper strips = ROWS (copper facing up) ]
```

- Strips cross at 90°. Each crossing is one cell: 10 × 10 = 100 cells.
- 30 × 30 cm with 10 strips gives a pitch of about 3 cm.
- Leave a tab on each strip outside the sensing area for wiring. The Velostat must not cover the tabs, or they short.
- Tape the edges only, never over the sensing area. Use a connector or strain relief instead of long soldering on PET.
- Inside a waterproof cover in use (sweat and urine damage copper and Velostat).

Bench checks before wiring: every strip conducts end to end; neighbouring strips do not touch; row-to-column resistance is high unpressed and drops clearly when pressed.

### 5.3 How one cell is read

One row is driven to 3.3 V; the other rows float (set as inputs). The mux connects one column to the ESP32's ADC pin, which has a 10 kΩ resistor and a 0.1 µF capacitor to ground. The Velostat cell and the resistor form a **voltage divider**: more pressure → lower cell resistance → higher voltage.

### 5.4 Wiring

**Current state:** the firmware in `firmware/` now uses this 10×10 pin map. It has not been flashed to a board yet.

**10×10 pin map (in `firmware/perfusense_mat/config.h`, not tested on hardware yet):**

| Function | GPIO |
|---|---|
| Rows R0–R9 | 13, 16, 17, 18, 19, 21, 22, 23, 4, 14 |
| Mux S0, S1, S2, S3 | 25, 26, 27, 32 |
| Mux EN | GND |
| Mux C0–C9 | Columns 0–9 (C10–C15 unused) |
| Mux SIG (read) | GPIO 34 (ADC1), + 10 kΩ to GND, + 0.1 µF to GND |
| Buzzer | 33 |
| LED | 2 (the on-board LED on most DevKitC boards) |
| Button | 35 (input-only, needs an external 10 kΩ pull-up to 3.3 V) |

**Check the SIG capacitor:** 10 kΩ with 0.1 µF is an RC time of 1 ms, but the scan waits only 80 µs after switching columns, so part of the previous cell's voltage is still there (crosstalk along each row). Use about 10 nF, or raise `SETTLE_US`, and re-measure crosstalk.

Why these pins: GPIO 34 is on ADC1, which keeps working while Wi-Fi is on (ADC2 does not). Strapping pins 0, 5, 12, 15 and flash pins 6–11 are avoided. GPIO 2 is a strapping pin but is safe for a small LED output; GPIO 14 pulses briefly at boot, which is harmless for a row driver.

Common mistakes: EN not tied to GND (mux disabled); unused select line floating; no 10 kΩ pull-down (random readings); grounds not shared; loose breadboard wires.

---

## 6. ESP32 firmware

### 6.1 Where it is

The firmware is in the repository at `firmware/perfusense_mat/` (Arduino sketch folder), with host tests in `firmware/test/` (`bash firmware/run_checks.sh`, needs g++). It is written for the **10×10** mat with 25 local zones (2×2 cells each). Section 13 lists the changes needed for 10×10.

Arduino IDE, board "ESP32 Dev Module", no extra libraries. All settings live in `config.h`.

### 6.2 Files (one job each)

| File | Job |
|---|---|
| `config.h` | Wi-Fi, `SERVER_URL`, `BED_ID`, `DEVICE_KEY`, pins, timings, thresholds |
| `Scanner` | Reads the physical mat (rows, mux, ADC) |
| `Processing` | Baseline, dead-band, smoothing, zones, pressure × time, alarm, drift correction. No Arduino calls, so it is unit-tested on a computer |
| `Connection` | Wi-Fi start and reconnect, server health check (`GET /api/health`) |
| `Comms` | Sends frames and reads commands, in its own FreeRTOS task |
| `perfusense_mat.ino` | Wires the pieces together and runs the loop |

### 6.3 Start-up

1. Set up pins and the ADC (12-bit, 11 dB attenuation).
2. Start Wi-Fi, wait up to 10 s, ping the server. With no Wi-Fi it carries on offline and keeps retrying.
3. Start the network task.
4. **Learn the baseline: the mat must be empty.** Average 20 scans per cell.

### 6.4 Every 500 ms (2 frames per second)

| Step | What happens | Why |
|---|---|---|
| 1 Scan | Each cell = average of 8 ADC readings, with settle delays (80 µs after a column change, 160 µs after a row change) | Less noise; the mux needs time to settle |
| 2 Baseline | `signal = reading − baseline` | Every cell reads differently when empty (manufacturing differences). Without this, the empty level counts as pressure |
| 3 Dead-band | Below 20 mV → 0 | Treat small signals as noise |
| 4 Smoothing | `filt = 0.30 × new + 0.70 × filt` (exponential moving average) | Stops the heatmap flickering |
| 5 Zones | 2×2 blocks of cells, zone signal = mean of its cells | One number per body area |
| 6 Pressure × time | Zone ≥ 300 mV → exposure += dt; otherwise exposure −= 2 × dt (floor 0) | Counts loaded seconds; relief removes them twice as fast, so a short break is not a full reset |
| 7 Alarm | Exposure ≥ 60 s → one alert, LED and buzzer blink at 1 Hz until cleared | 60 s is for bench tests only |
| 8 Drift correction | If all zones together are below 200 mV for 60 s, move the baseline 1/16 of the way (at least 1 mV) toward the reading | Velostat creeps with time and temperature. Only done while empty, so a real load is never absorbed |
| 9 Hand-over | Each cell → one byte: `filt × 255 / 1500 mV`, clamped 0–255 | Compact frame for the server |

Worked example: baseline 100 mV, pressed cell 700 mV → signal 600 mV → smoothed value climbs 180, 306, 374 … toward 600 → byte 102 → the server shows 102 × 0.4 = 40.8 mmHg (placeholder scale).

The button, or an `ack` from the server, resets every zone's exposure and clears the alarm. A `tare` from the server re-learns the baseline (mat must be empty).

### 6.5 Communication

- Sends only the **newest** frame: `POST {SERVER_URL}/api/telemetry/{BED_ID}/frame`, body = raw bytes, `Content-Type: application/octet-stream`, header `x-device-key`.
- Keep-alive connection, 1 s connect timeout, 1.5 s reply timeout.
- `202` = accepted. The reply is JSON; the firmware looks inside `"commands":[...]` for `"ack"` and `"tare"`.
- Failure → wait 3 s before retrying, and print the reason once (401 wrong key, 404 unknown bed, negative = cannot reach the server).
- The network task runs on core 0; scanning and the alarm run on core 1, so a slow server never pauses the alarm.

### 6.6 Checks done

- 41 host-side logic tests pass (baseline, dead-band, smoothing, zones, exposure, single alert, recovery, re-alert, drift only when empty, byte scaling, command parsing). They caught one real bug (drift correction stalled short of the target due to integer division), which was fixed.
- Every file type-checks against stand-in Arduino headers (C++11 and C++17).
- End-to-end protocol check against the real server: 202 replies, commands delivered once, 401 and 404 paths, health check.
- **Not checked:** the real board, real analog readings, Wi-Fi behaviour, timings.

### 6.7 Firmware risks

- Booting with a patient on the mat makes the baseline wrong. Possible fix: store the last good baseline in flash.
- During a Wi-Fi outage, frames are dropped, not stored and replayed.
- The device key travels unencrypted on the local network (fine for development only).

---

## 7. Server (Express + MongoDB)

Location: `server/` in the repo. TypeScript run with `tsx`. Express 4, Mongoose 8, Zod for validation.

### 7.1 Structure

| Path | Contents |
|---|---|
| `server/index.ts` | Connects MongoDB, seeds an empty database, starts the app, optional simulator |
| `server/app.ts` | Express app and route mounting under `/api` |
| `server/config.ts` | Environment variables |
| `server/models.ts` | Collections: Bed, MatState, AuditLog, BedEvent, HardwareLog, Broadcast, Setting |
| `server/routes/` | `beds`, `alerts` (audit logs), `mats`, `telemetry` (device + live stream), `ward` (health, settings, broadcasts) |
| `server/services/ingest.ts` | Everything that happens to one frame |
| `server/services/derive.ts` | Bed status, countdown and audit row formatting (computed, not stored) |
| `server/services/beds.ts` | Turn, snooze, defer, off-bed, zone resets, posture timeline |
| `server/services/hub.ts` | Server-sent events to browsers |
| `server/lib/` | Settings (defaults + validation), zone mapping, formatting, errors |
| `server/data/cellLayout.ts` | Body-zone name of each of the 100 cells |
| `server/seed.ts` | Demo data (9 beds, audit logs, BED 07 turn history) |
| `server/simulator.ts` | Fake frames for every bed when `SIMULATE=true` |
| `server/tests/api.test.ts` | Integration tests (need MongoDB) |

### 7.2 Environment (`.env`)

| Variable | Default | Meaning |
|---|---|---|
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/perfusense` | Database |
| `PORT` | 4000 | API port |
| `CORS_ORIGIN` | `http://localhost:3000` | Browser origins allowed to call the API directly |
| `DEVICE_KEY` | `dev-device-key` | Must match the firmware. The server refuses to start in production with the default |
| `WARD_TZ` | `Africa/Cairo` | Time zone for clock texts |
| `SIMULATE` | false | Fake telemetry so the UI is alive without hardware |
| `GEMINI_API_KEY` | — | Leftover from the original template; not used by the code |

### 7.3 What happens to one frame (`ingestFrame`)

1. Validate: each value 0–255; the bed must exist; the frame has exactly one value per mat cell (100), otherwise 422.
2. Subtract the server-side tare baseline (zero unless "tare" was used).
3. Convert: `mmHg = byte × mmHgPerByte` (0.4, placeholder). Heatmap level 0–3 from `levelMmHg` [15, 32, 55] (the one pressure scale, also used by the UI legend).
4. Cell status for the sensor map: warn ≥ 32 mmHg, critical ≥ 55 mmHg (same as the heatmap bands).
5. Peak cell and its zone name.
6. Six body-zone timers: `SACRUM & COCCYX`, `HEELS (CALCANEUS)`, `LEFT TROCHANTER (HIP)`, `SHOULDERS (SCAPULAE)`, `RIGHT TROCHANTER (HIP)`, `ELBOWS & OCCIPUT`. A timer grows while its highest cell is ≥ 20 mmHg (`loadedMmHg`) and shrinks 2× faster otherwise. A gap over 60 s counts as only 1 minute.
7. Alerts: a timer past its limit, or any cell ≥ 65 mmHg. One open alert per bed and body area; later frames update it instead of duplicating it.
8. At most once a minute, store a `PressureSample` (peak, mean loaded pressure; kept 7 days) for the History page.
9. Save to MatState, broadcast a `frame` event, reply `202` with `{bedId, peakMmHg, peakZone, alerts, commands}`.

### 7.4 Bed status (computed on every request, never stored)

| Condition | Status |
|---|---|
| Patient off the bed | AMBULATING |
| Past the due time, first minute | DUE NOW |
| Past the due time after that | OVERDUE ("+5M OVERDUE", countdown "+05:14") |
| Within `preAlertMin` (15) of the due time | PRE-ALERT |
| Live peak ≥ `elevatedMmHg` (30) | ELEVATED |
| Otherwise | STABLE (low Braden risk) or OPTIMAL |

Mat data older than `staleSec` (30 s) is treated as offline and stored fallback values are used.

**Confirming a turn** sets the next due time to now + cadence (120 min default), resets the zone timers, resolves open alerts, writes an "OFFLOADED" audit row and a turn event, and broadcasts the updated bed. Skin checks are enforced only when the request includes them.

### 7.5 API

| Method and route | Purpose |
|---|---|
| `GET /api/health` | Database status |
| `GET /api/beds` (`?pod&risk&status&q`) | Roster |
| `POST /api/beds`, `GET/PATCH/DELETE /api/beds/:id` | Bed CRUD |
| `GET /api/beds/:id/zone-timers`, `/matrix`, `/events`, `/posture-timeline?hours=8` | Live data and history |
| `POST /api/beds/:id/turns` `{posture, note?, rn?, skinChecks?}` | Confirm a turn |
| `POST /api/beds/:id/snooze` `{minutes}`, `/defer` `{minutes, reason}`, `/off-bed` `{offBed}` | Schedule actions |
| `POST /api/beds/:id/zones/:zone/reset`, `/zones/reset-all` | Zones page buttons |
| `GET /api/audit-logs` (`?site&zone&q&status&bedId&page&pageSize`), `/export.csv`, `/:id` | Alerts and audit trail |
| `POST /api/audit-logs/:id/acknowledge` `{rn}`, `/resolve` `{action, rn}` | Alert actions |
| `GET /api/mats/:bedId`, `/cells`, `/logs` | Mat state |
| `POST /api/mats/:bedId/tare`, `/cells/:cellId/zero`, `/self-test`, `/flush` | Mat maintenance |
| `POST /api/mats/:bedId/calibrate`, `/cells/:cellId/impedance-sweep` | Return 501 (need firmware commands) |
| `GET/PUT /api/settings` | Thresholds, protocol, zone limits, telemetry tuning |
| `GET/POST /api/broadcasts` | Ward notices (stored only, no paging) |
| `POST /api/telemetry/:bedId/frame` (header `x-device-key`) | Device frames: raw bytes or JSON `{cells, ts?}` |
| `GET /api/stream` | Server-sent events: `hello`, `frame`, `bed`, `alert`, `broadcast` |

### 7.6 Settings defaults (all placeholders)

| Group | Values |
|---|---|
| thresholds | criticalMmHg 65, warnMmHg 45, maxDwellMin 60, autoPage true |
| protocol | cadenceMin 120, preAlertMin 15, skinEnforce true |
| zoneLimitsMin | sacrum 120, heels 90, hips 120, shoulders 120, elbows & occiput 120 |
| telemetry | mmHgPerByte 0.4, levelMmHg [15, 32, 55], loadedMmHg 20, recoveryFactor 2, nearLimitRatio 0.85, elevatedRatio 0.6, elevatedMmHg 30, staleSec 30, cellWarnMmHg 32, cellCriticalMmHg 55 |

### 7.7 Safety in the code

Device key compared in constant time; all inputs validated with Zod; CSV export blocks spreadsheet formula injection; body size limits. **No login, no HTTPS**: anyone who can reach the API can read and change data. Add both before anyone outside the team uses it.

---

## 8. Web dashboard (React)

Stack: React 19, TypeScript, Vite 8, Tailwind CSS 4, Lucide icons, Motion.

### 8.1 Files

| Path | Contents |
|---|---|
| `src/App.tsx` | State hub: beds, audit logs, 100 cells, zone timers, live matrix, peak, API status. Loads data, opens the live stream, handles actions |
| `src/api/client.ts` | Typed calls for every route and `connectLive()` for the stream |
| `src/views/LiveHeatmapView.tsx` | Live heatmap, posture card, peak, zone timers |
| `src/views/TurnScheduleView.tsx` | Turn schedule |
| `src/views/BedRosterView.tsx` | Ward roster |
| `src/views/PeakAlertsView.tsx` | Zones and alerts |
| `src/views/SensorHardwareView.tsx` | 100-cell sensor map |
| `src/components/` | Header ("API: LIVE"), mobile Sidebar, Modals (turn, protocol, thresholds) |
| `src/utils/heatmapColors.ts` | Smooth colour scale between the four clinical anchors |
| `src/data/mockData.ts` | Offline fallback data |
| `public/presentation.html` | The team's interactive ISEF web presentation |

### 8.2 Data flow

1. On load: check `/api/health`; if the backend is up, load beds, audit logs, cells, zone timers and the matrix for **BED 07** (hard-coded as the monitored bed).
2. Open the live stream: `frame` → heatmap, peak, zone timers; `bed` → roster row; `alert` → audit row + toast.
3. A 15 s heartbeat re-checks health, reconnecting or falling back.
4. **Offline fallback:** with no backend the app runs on mock data, with local optimistic updates, so a demo never goes blank.

### 8.3 Connecting the UI to the backend (important)

The Vite dev server always forwards `/api` to `API_URL` (default `http://localhost:4000`), so `npm run dev:all` shows live data. When the API is not running, the app shows SAMPLE DATA under an orange banner and reconnects by itself. To call the API directly instead, put `VITE_API_URL=http://localhost:4000` in `.env` so the client calls the API directly (the server's `CORS_ORIGIN` already allows `http://localhost:3000`).

### 8.4 Heatmap colour scale (UI legend)

| Level | mmHg | Colour |
|---|---|---|
| None | 0–15 | Mint Frost `#F1FCF9` |
| Light | 16–32 | Ice Mint `#A3CFC9` |
| Heavy | 33–55 | Surgical Teal `#1D635D` |
| Hot spot | > 55 | Carmine Red `#8B2635` |

---

## 9. AI model (Transformer) and datasets

**Status: trained on public data and served by a local FastAPI service in `ai/`; not connected to the server; never tested on our own mat. The measured method and results are in `docs/AI_TRAINING_REPORT.md`, which replaces this section where they differ (the final model is a small last-frames network, 84.7 % balanced accuracy on unseen people on hospital mats; empty is a rule on average pressure).**

### 9.1 Job

Read the last 30 seconds of frames and classify the lying position: **supine, left side, right side**. "Empty mat" is a simple rule (no cell above a small threshold), because the datasets have no empty class. Predicting ulcer risk is not a goal yet: it needs labelled clinical outcomes that do not exist.

### 9.2 Architecture (for the 10×10 mat)

| Step | Shape | What it does |
|---|---|---|
| Input | (30, 10, 10) | 30 frames at 1 Hz, each window scaled 0–1 by its own 99th percentile (removes sensor-type differences) |
| Flatten | (30, 100) | Each frame becomes one token |
| Dense | (30, 64) | Learned projection |
| Positional embedding | (30, 64) | Tells the model which second each frame is from |
| Encoder block × 2 | (30, 64) | LayerNorm → multi-head self-attention (4 heads × 16) → residual; LayerNorm → feed-forward 64→128 (GELU)→64 → residual |
| LayerNorm + average over time | (64) | One summary of the window |
| Dropout + Dense | (3) | One score per posture (softmax at serving time) |

About 76,000 parameters. Too heavy for the ESP32, so it runs on the server; the ESP32 keeps its own rule-based alarm. (The PRD's code uses 8×8 inputs; change `n` to 10.)

Training: cross-entropy, Adam (lr 0.001), random scale and noise augmentation, early stopping. **Cross-validated by person**: the same person never appears in training and testing. Always compare against a no-attention baseline (average over time + small MLP); public data shows people holding still, so attention may not help.

Distillation: a larger teacher (width 128) sees the whole mat; the student sees only the patch our mat would see. Loss = `0.5 × CE + 0.5 × T² × KL(teacher ‖ student)`, temperature 3. It cannot add information the patch lacks, so it is always compared with a plain student.

Live path (planned): the server keeps 1 frame per second, sends the last 30 to a Python FastAPI service, and shows the result on the posture timeline.

### 9.3 Open datasets (verified)

| Dataset | What it contains | Access | Fit for PerfuSense |
|---|---|---|---|
| **PmatData** (PhysioNet) [11] | Exp I: 13 adults, 8 standard postures + 9 extra states, 32×64 mat (Vista Medical FSA SoftFlex 2048), 0–1000, 1 Hz, about 120 frames per file. Exp II: 8 adults, 29 states of 3 postures, 27×64 mat (BodiTrak BT3510), 0–500, one averaged frame per file, sponge and air mattresses | Open, Open Data Commons Attribution 1.0 | Main source. Only one with time sequences (Exp I) |
| **SLP** (Northeastern ACLab) [14] | 109 participants (102 home, 7 hospital), 13,770 + 945 samples, 4 modalities incl. a Tekscan pressure map, 15 poses in each of supine / left / right, 3 cover conditions, 14 labelled joints | Request form for a password, institution email, **non-commercial only** | Large posture-labelled pressure maps; single frames, no time |
| **PressurePose** (Georgia Tech) [15] | 206K synthetic pressure images (184K train / 22K test) with 3D pose and shape, plus 1,051 real pressure images from 20 participants | Harvard Dataverse: synthetic doi 10.7910/DVN/IAPI0X, real doi 10.7910/DVN/KOA4ML. Check the licence there | Pre-training on lots of synthetic data; real set for testing |

How to use them together (plan, not done):

1. Map all labels to **supine / left / right**. Drop other states.
2. Crop each mat to the region our 30 × 30 cm mat would see (needs each dataset's sensor spacing, from its documentation), then area-average to 10×10. Never drop rows or columns.
3. Normalise each window by its own 99th percentile.
4. Pre-train the per-frame part of the model on PressurePose synthetic data, fine-tune on SLP and PmatData, then adapt on recordings from our own mat.
5. Evaluate leave-one-dataset-out and by person. Report accuracy on our own mat separately: public-data accuracy is not our mat's accuracy.

---

## 10. Design system

Neo-brutalist "clinical" style, shared by the web app, poster and deck: thick ink outlines, hard offset shadows (no blur), flat colour blocks, monospace caps labels, pill buttons, slightly tilted stickers.

| Token | Hex | Role |
|---|---|---|
| Mint Frost | `#F1FCF9` | Main background; "none" pressure |
| Pure White | `#FFFFFF` | Cards |
| Bio-Slate | `#EBF6F4` | Secondary surfaces |
| Clinical Parchment | `#EDE8DC` | Notes, team box |
| Surgical Teal | `#1D635D` | Brand primary; "heavy" pressure |
| Cyan Glow | `#ADEFE7` | Brand accent (on dark teal) |
| Ice Mint | `#A3CFC9` | Muted brand; "light" pressure |
| Obsidian Ink | `#121C1B` | Text, borders, shadows |
| Slate Charcoal | `#3F4947` | Muted text |
| Carmine Red | `#8B2635` | Hot spot, DUE NOW, FLIP TIME |
| Terracotta | `#D97757` | Elevated pressure, warning |
| Soft Peach | `#FE9572` | Drift warning |
| Sage Green | `#A8C5B5` | Nominal sensor node |

Fonts: **Space Grotesk** (headlines, body) and **Space Mono** (labels, numbers). Every status has a text label, never colour alone.

The repo's `README.md` still lists an older colour table (`#0D9488` etc.); the table above is the current one.

---

## 11. Results and validation plan

### 11.1 Bench results reported by the team (deck)

| Test | Result | Target | How the team explains it |
|---|---|---|---|
| Crosstalk | 7.5% | < 10% | Velostat leaks current sideways; baseline subtraction and the dead-band keep it down |
| Drift | 8.2% | < 10% | Velostat creeps under constant load; software correction and baseline resets limit it |
| Repeatability | ±5.8% | ±10% | 8 samples per cell, settle delay after each switch, 0.1 µF capacitor |

Record the method for each (load used, number of trials, duration, temperature, which cells) so the numbers can be defended.

### 11.2 Validation roadmap

| Stage | Tests | Status |
|---|---|---|
| 1 Bench | Crosstalk, repeatability, drift over 4–8 h, calibration with known weights (0, 100, 200, 500, 1000 g), location error < 1 cell, 1–2 fps | Results reported for the first three |
| 2 Software | Backend integration tests, firmware logic tests, device → server → command round trip | Done on simulated data; backend tests updated to 100-cell frames |
| 3 AI | Accuracy on held-out people: baseline vs Transformer | Done on public data: `docs/AI_TRAINING_REPORT.md`. Distillation not run. Our own mat not tested |
| 4 Phantom | Soft silicone or gel model; compare with a reference mat if available; fluid-resistant cover | Planned |
| 5 Volunteers | Healthy adults, short sessions, written consent, anonymous IDs | Planned, needs ethics approval. Never on patients in this project |

Success means every target is measured and reported, whether met or not.

---

## 12. Current status

| Area | State |
|---|---|
| Web UI (React) | Reworked: Monitor, Beds, Zones (body map + alerts), History (real pressure history), Mat (self-test); SAMPLE DATA labelled when offline |
| Backend (Express + MongoDB) | Built; 100-cell support; type-checks; tests updated to 100-cell frames (need MongoDB to run) |
| Device commands (`ack`, `tare` in the frame reply) | Merged in `56ae7b4`; its integration test needs MongoDB to run |
| ESP32 firmware | In the repo (`firmware/`); **updated for 10×10** (25 zones, 4 mux lines, fixes); host tests updated but not re-run (no g++); **not run on a board** |
| Physical mat | 10×10, 30 × 30 cm per the deck; bench results reported |
| AI model | Trained on public data; local service works; not connected; not tested on our mat |
| Security (login, HTTPS) | Not started |
| Phantom, ethics, volunteers | Not started |
| ISEF materials | Poster, deck, interactive web presentation, diagrams |

---

## 13. Known issues and inconsistencies (fix list)

### Code

1. ~~64-cell frames crash ingest (HTTP 500).~~ Fixed: a frame whose length differs from the mat's cell count is refused with a clear 422, and the tests send 100-cell frames. The current 8×8 firmware is therefore refused until item 2 is done.
2. ~~Firmware is 8×8.~~ Updated to 10×10 (pin map in section 5.4). Also fixed: 16-bit alert mask that could not hold 25 zones, tare time counted as load time, button acting on level instead of press, a command flag race, Wi-Fi retry fighting auto-reconnect. Still to do: compile, flash and bench-test it.
3. ~~Device-command patch not merged.~~ Merged in `56ae7b4`: a nurse's "Done, turned" now clears the mat's own alarm through the `ack` command.
4. ~~Threshold scales disagree.~~ One scale, 15 / 32 / 55 mmHg, in `telemetry.levelMmHg`; the UI reads it from the API. Critical alert stays 65. All placeholders.
5. **Zone count.** Decided: the firmware uses 25 zones of 2×2 cells. Update the deck, which still says 16.
6. ~~Mock AI output shown as real.~~ Removed; the Monitor shows "AI: NOT TRAINED YET" and the nurse-logged position.
7. ~~`npm run dev:all` shows mock data.~~ Fixed (section 8.3).
8. ~~Leftovers.~~ Gemini dependency and settings removed; README rewritten. Also fixed: tare subtracted the baseline twice for ESP32 mats.
9. `npm install` needs `--legacy-peer-deps` if peer-dependency conflicts appear.

### Presentation materials

10. Deck slide "The Code" shows two multiplexers (`DRIVE_S`, `READ_S`) and MQTT; the real design uses one mux and HTTP.
11. Deck slide 4 says covering 30 × 30 cm costs ≈ 3,000 EGP (100× lower), while other slides say ≈ 1,000 EGP and 310× lower. Use one figure.
12. Older poster and slides mention 8×8 / 64 cells and "~$50"; current figures are 10×10 / 100 cells and ≈ $20.

---

## 14. Future goals

1. **Smart sandwich layer.** Test a compliant layer (closed-cell foam, silicone or spacer fabric) with the Velostat, plus a sealed cover. Goal: less creep, drift and false contacts; judged by 8-hour drift against a plain mat.
2. **A mat that checks the turn.** Confirm a turn really relieved the zone instead of trusting the button; then personalise turn timing from Braden score, posture and measured pressure.
3. **Bigger and smarter.** Modular mats for sacrum, heels and shoulders; a read circuit that cuts crosstalk (zero-potential method); a smaller posture model on the device.
4. **Clinical proof.** Phantom, healthy volunteers, then a pilot with a clinical partner under ethics approval, compared with a commercial mapping mat; with labelled outcomes, move from alerts to risk prediction.
5. **Ward integration.** Login and encryption, pager and hospital-record links, a nurse phone app.

Also keep: per-cell calibration with known weights so the dashboard shows real mmHg.

---

## 15. Presenting the project

Order that works (about 2 minutes): problem (10 s) → **ESP32: baseline and drift** (50 s, the strongest part) → server and dashboard (20 s) → Transformer (20 s) → closing (10 s).

Key talking points:

- **Baseline:** every cell reads differently when empty; we average 20 empty scans and subtract them, so only real pressure is left.
- **Drift:** Velostat slowly changes with time and temperature; the baseline follows it only while the mat has been empty for 60 s, so a patient's real load is never hidden.
- **Offline alarm:** the alarm runs on the ESP32, so it works with no Wi-Fi.
- **Honesty:** the AI is coded but not trained; tests so far are bench and simulated data.

Likely judge questions:

| Question | Answer |
|---|---|
| Why a baseline? | Manufacturing differences make each empty cell read differently; subtracting it isolates real pressure |
| Can drift correction hide a real load? | No: it runs only when the whole mat is nearly empty for 60 s, moves slowly, and only below the dead-band level |
| How accurate is the AI? | Not measured yet. It will be tested on people it never saw, against a simple baseline. Public data comes from other sensors |
| Tested on patients? | No. Research prototype: bench, then phantom, then healthy volunteers after ethics approval |
| Why a Transformer? | It reads the whole time window at once and weighs the important moments; we always compare it with a simple model because still postures may not need it |
| Why is lower precision OK? | We need coverage and relative change over time, not exact force; even commercial FSRs vary 5–25% |

---

## 16. Deliverables made so far

| Item | Form |
|---|---|
| This guide and `CLAUDE.md` | Markdown files |
| PRD v1.1 (8×8, MQTT; historical) | `Perfusense.md` in the repo |
| Backend | In the repo (`server/`) |
| Device commands (`ack`, `tare`) | Merged into `server/` (`56ae7b4`) |
| ESP32 firmware (8×8) | In the repo (`firmware/`) |
| Poster (editable) | `perfusense_poster_editable.pptx` and the web version (claude.ai/artifact/YB1PKB28GpoU1LiKTL14nA) |
| Poster diagrams (system flow, ESP32 pipeline, AI pipeline, validation roadmap) | `perfusense_poster_diagrams.pptx` |
| Earlier slide deck | claude.ai/artifact/3wFz5LrkHKwrSkEY8nfj3U |
| UI design system | claude.ai/artifact/4a2augHEbEANZDzaMik7Na |
| Build checklist | claude.ai/artifact/Sq7U3u24cnZXy9aoNCReSr |
| Team's interactive ISEF presentation | `public/presentation.html` in the repo |

---

## 17. Glossary

| Term | Meaning |
|---|---|
| Velostat / Linqstat | Carbon-loaded plastic film whose resistance drops under pressure |
| FSR | Force-sensing resistor |
| Multiplexer (CD74HC4067) | Switch that connects one of 16 channels to one pin |
| ADC | Analog-to-digital converter: turns a voltage into a number (0–4095 on the ESP32) |
| Baseline | Each cell's reading when the mat is empty |
| Tare | Re-learning the baseline on command |
| Drift / creep | Slow change in reading under constant conditions |
| Crosstalk / ghosting | A pressed cell making its neighbours read pressure too |
| Dead-band | Readings below a small level are treated as zero |
| Pressure × time | Seconds a zone has stayed loaded; drives the alarm |
| Braden score | Nursing scale for pressure-ulcer risk (6–23; lower = higher risk) |
| SSE | Server-sent events: the server pushes live updates to the browser |
| Distillation | Training a small model to imitate a larger one |

---

## 18. References

1. AHRQ. Preventing Pressure Ulcers in Hospitals toolkit; HCUP Statistical Brief #64 (2006).
2. Zhang S, et al. Burden of decubitus ulcers, GBD 2021. Front Public Health 2025;13:1494229.
3. Li Z, Lin F, Thalib L, Chaboyer W. Int J Nurs Stud 2020;105:103546.
4. Isfahani P, et al. Hospital-acquired pressure injuries in ICUs of the Eastern Mediterranean. Patient Saf Surg 2024. doi:10.1186/s13037-023-00383-8
5. Sensor Products Inc. Tactilus Y-Series Patient Movement Monitor brochure.
6. A Novel Elastic Sensor Sheet for Pressure Injury Monitoring. Electronics 2023;12(17):3655.
7. Selzler R. Novel pressure-sensitive mat using proximity sensors. Carleton University thesis.
8. Interlink Electronics. FSR Integration Guide.
9. Interlink Electronics. FSR 406 product highlight, DigiKey.
10. Reswick JB, Rogers JE. Experience at Rancho Los Amigos Hospital with devices and techniques to prevent pressure sores. Bedsore Biomechanics, 1976.
11. Pouyan MB, Birjandtalab J, Heydarzadeh M, Nourani M, Ostadabbas S. A pressure map dataset for posture and subject analytics. IEEE BHI 2017. doi:10.1109/BHI.2017.7897206. Data: physionet.org/content/pmd/1.0.0
12. Pollard T, et al. PhysioNet as a global platform for biomedical research. Nature Health 2026. doi:10.1038/s44360-026-00096-z
13. Hinton G, Vinyals O, Dean J. Distilling the knowledge in a neural network. NIPS 2015 workshop.
14. Liu S, Huang X, Fu N, Li C, Su Z, Ostadabbas S. Simultaneously-collected multimodal lying pose dataset (SLP). arXiv:2008.08735 (2020).
15. Clever HM, Erickson Z, Kapusta A, Turk G, Liu CK, Kemp CC. Bodies at Rest: 3D human pose and shape estimation from a pressure image using synthetic data. CVPR 2020. doi:10.1109/CVPR42600.2020.00625
