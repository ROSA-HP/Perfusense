# PRD and Build Spec: Smart Pressure Mat (working name: FLIP)

Version 1.1 | Status: prototype specification | Audience: an AI coding model and the human team

**What changed in 1.1:** the AI section now uses the real PmatData file layout, sensor sizes, value ranges and sampling rate, and explains how to fit that data to our 8x8 mat (crop to the mat's physical size, area averaging, per-window normalisation, 1 Hz feeding, and teacher-student distillation). Appendix D was rewritten with working conversion, preparation, training, distillation and serving code. The server now feeds the AI at 1 Hz.

---

## 0. How an AI model should use this document

You are helping build a research prototype. Read the whole document first, then build in the order in section 14.

Rules you must follow:

1. **Do not invent clinical values.** Every value marked `PLACEHOLDER` (pressure thresholds, exposure limits, scaling constants) must stay configurable and clearly marked. Never present them as medically validated.
2. **Do not invent data.** Any number shown in a UI that is not from a real device must be labelled "SAMPLE DATA".
3. **Keep the interfaces exactly as written** in sections 6 and 7 (MQTT topics, payload formats, REST routes, WebSocket messages). Firmware, backend, frontend and AI service are built separately and must agree.
4. **This is not a medical device.** Do not add diagnostic claims, and do not word anything as clinical advice.
5. If something is unclear or missing, list your assumption at the top of your answer and continue. Do not stop to ask unless a rule above would be broken.
6. Prefer simple, readable code with comments. No unnecessary frameworks.

Everything you need is in this file: specification (sections 1 to 15) and starter code (Appendices A to E).

---

## 1. Product summary

A thin, low-cost sensor mat that lies under a bedridden patient. It measures where pressure is applied, tracks how long each area has been loaded, and alerts caregivers when an area has been loaded for too long, so they can reposition the patient before a pressure ulcer (bedsore) forms.

Key ideas:

- **Hardware:** a DIY piezoresistive matrix (Velostat or an equivalent pressure-sensitive conductive sheet between copper-tape rows and columns), scanned by an ESP32.
- **On-device logic:** the ESP32 computes pressure x time per zone and raises a local alarm, so the alarm works even without Wi-Fi.
- **Cloud/server logic:** a Node.js server stores history in MongoDB and streams live data to a React dashboard. A Python service runs a transformer model that recognises the patient's lying position.
- **Name:** "FLIP" is a working name, from "time to flip the patient". It can be changed.

### Problem context (for the product pitch, sourced figures only)

- A meta-analysis of about 2.5 million hospitalised adults found a pooled pressure-injury prevalence of 12.8%, with 8.4% acquired in hospital.
- In ICUs in the Eastern Mediterranean region the pooled prevalence was 16.6%.
- Global Burden of Disease data record 37,033 deaths from pressure ulcers worldwide in 2021. This probably undercounts.
- Pressure-relieving mattresses cost roughly 1,000 to 4,000 pounds in UK trials, and commercial pressure-mapping mats are also expensive.
- No source was found for "how many countries can afford a fix". Do not state such a number.

---

## 2. Goals, non-goals, success criteria

### Goals (v1 prototype)

- G1. Build an 8x8 sensor mat that detects where pressure is and roughly how hard.
- G2. Read it at about 2 frames per second on an ESP32.
- G3. Track pressure x time for 16 zones and raise a local alarm (buzzer + LED) at a configurable limit.
- G4. Stream data to a server and show it live on a web dashboard (heatmap, zone timers, alerts, history).
- G5. Classify the lying position (supine / left / right, plus a rule-based empty check) with a transformer model trained in TensorFlow, and measure honestly how well a small 8x8 mat can do it.
- G6. Measure and report the mat's real accuracy (drift, crosstalk, repeatability).

### Non-goals (v1)

- No claim of preventing or diagnosing pressure ulcers.
- No full-body 3D digital twin (the mat covers only the sacrum region).
- No on-device transformer (too heavy for an ESP32).
- No predicting time-to-ischemia (needs labelled clinical outcomes that do not exist yet).
- No use on real patients. See section 11.

### Success criteria (TARGETS, not measured results)

These are proposed targets for the first prototype. They have not been measured. Bench testing confirms or revises each one.

| Metric | Target |
|---|---|
| Reading drift under constant load over 4 hours | under 10% |
| Crosstalk (response of neighbouring cells to a single pressed cell) | under 10% of the pressed cell's reading |
| Repeatability on the same load | within +/-10% |
| Error in locating a load | under 1 cell |
| Frame rate | 1 to 2 frames per second |
| Component cost | about 50 USD (estimate, not checked against current prices) |
| Posture classification accuracy | to be measured on a held-out set of different people |

---

## 3. Users and scenarios

- **Caregiver (nurse, family carer):** wants a clear "turn now" signal and a one-tap way to confirm the patient was turned.
- **Supervisor:** wants history (when alerts happened, when the patient was turned).
- **Team (students/engineers):** wants raw frames and logs for calibration and model training.

Main scenario: the patient lies on the mat. Pressure builds under the sacrum. The zone timer for that area passes the limit. The buzzer sounds, the dashboard shows "FLIP TIME", the caregiver turns the patient and taps "Done, turned". The timers for that zone reset.

---

## 4. System architecture

```
 [Velostat matrix 8x8]
        |  (rows driven by GPIO, columns read through 1 analog multiplexer)
 [ESP32 firmware]  --MQTT-->  [Mosquitto broker]  -->  [Node.js server] --WebSocket--> [React dashboard]
   |  local alarm                                          |  MongoDB (history)              |  REST: history, ack
   |  buzzer + LED + button                                |  every ~5 s: window of frames   |
                                                           +--HTTP--> [Python AI service (TensorFlow transformer)]
```

Data flow, in order:

1. The ESP32 scans the matrix twice a second, subtracts a baseline, smooths, and computes zone signals.
2. It publishes the frame (one byte per cell) and, every 10 s, a JSON summary of zone exposure. Alerts are published immediately.
3. The server subscribes, broadcasts to dashboards over WebSocket, and stores sampled data in MongoDB.
4. The server keeps a ring buffer of the last 30 frames per device and periodically calls the AI service for the lying position.
5. The dashboard shows live data. "Done, turned" calls `POST /api/devices/:id/ack`, which publishes `ack` on the device's command topic. The ESP32 clears its alerts.

---

## 5. Hardware specification (8x8 prototype)

### 5.1 Why 8x8 and one multiplexer

A CD74HC4067 connects its common pin to one of 16 channels at a time. A matrix scan needs one row powered and one column read. For 8 rows and 8 columns, the 8 rows are driven directly by 8 ESP32 pins, and one multiplexer reads the 8 columns.

### 5.2 Bill of materials

| Item | Qty | Notes |
|---|---|---|
| Pressure-sensitive conductive sheet (Velostat/Linqstat or equivalent) | enough for about 10 x 10 cm | A listing found was 10 x 5 cm per sheet, thickness unspecified. Test resistance on arrival. Black ESD bags are a cheap alternative to test. |
| Copper tape, conductive adhesive, 5 mm | 1 roll | Check the adhesive is conductive. |
| Flexible plastic sheets (PET/acetate, 0.1 to 0.2 mm) | 2 | Base and cover. |
| ESP32 dev board, **ESP32-WROOM-32 type** (not WROVER) | 1 | GPIO 16 and 17 are used by PSRAM on WROVER boards. |
| CD74HC4067 breakout | 1 | 16-channel analog multiplexer. |
| Resistor 10 k ohm | 1 | Pull-down on the read line. Test 1k to 22k later. |
| Capacitor 0.1 uF | 1 | Across the read line to ground. |
| Active buzzer (3.3 V or 5 V with transistor), LED + 330 ohm resistor, push button | 1 each | Local alarm and acknowledge. |
| Thin wires, soldering iron, Kapton or strong tape | | Prefer FFC or a connector over soldering wires directly to copper tape. |

### 5.3 Fabrication

Target pitch: about 1.2 cm between row/column centres, 5 mm tape, so the active area is about 9.6 x 9.6 cm (8 x 1.2 cm).

1. **Row layer:** on sheet 1, stick 8 parallel copper strips, evenly spaced, each leaving a tab outside the active area for connection.
2. **Column layer:** on sheet 2, stick 8 parallel strips. When assembled they must run at 90 degrees to the row strips.
3. **Sensing layer:** cut the Velostat to cover the active area. Two options to compare in phase 1: (a) one continuous piece, (b) separate strips per row to reduce current leaking sideways.
4. **Assemble:** row sheet (copper up), Velostat, column sheet (copper down). Each crossing is one cell (64 cells). Fix only the edges. Do not tape over the sensing area.
5. **Cover:** optional thin foam (about 1 to 2 mm) on top to spread load and protect the copper.
6. **Connect:** short, strain-relieved connections from each strip tab to a connector.

Bench checks after assembly:
- Unpressed resistance between each row and column is high (not shorted).
- Resistance between adjacent rows (and adjacent columns) shows no short.
- Pressing one cell changes only that cell clearly. Note neighbours' response for the crosstalk measurement.

### 5.4 Wiring (8x8)

| Function | ESP32 pin |
|---|---|
| Row 0 to Row 7 | GPIO 13, 16, 17, 18, 19, 21, 22, 23 |
| Multiplexer S0, S1, S2 | GPIO 25, 26, 27 |
| Multiplexer S3 | tied to GND (8 channels need only 3 select lines) |
| Multiplexer SIG | GPIO 34 (ADC1, input only), plus 10 k ohm to GND and 0.1 uF to GND |
| Multiplexer VCC | 3.3 V |
| Multiplexer GND and EN | GND |
| Multiplexer channels C0 to C7 | column strips 0 to 7 |
| Buzzer | GPIO 32 |
| LED (through resistor) | GPIO 33 |
| Acknowledge button to GND | GPIO 14 (internal pull-up) |

Pins deliberately avoided: GPIO 0, 2, 5, 12, 15 (strapping pins, affect boot) and 6 to 11 (flash).

Electrical behaviour: the selected row pin is driven high (3.3 V) and the other row pins are set as inputs (high impedance). The selected column goes through the multiplexer to GPIO 34. The Velostat cell and the 10 k resistor form a voltage divider: more pressure, lower Velostat resistance, higher voltage on GPIO 34.

### 5.5 Scaling to 16x16 (later)

Use two multiplexers (one drives rows, one reads columns) as in the original design, with S0 to S3 pins on safe GPIOs, and a bigger sensing sheet. Crosstalk and drift must be re-measured. The software below is written with a configurable grid size `N`.

---

## 6. Firmware specification (ESP32)

Language: C++ (Arduino framework). Library: PubSubClient. Full starter code: Appendix A.

### 6.1 Behaviour

1. At start-up (mat **empty**), capture a baseline: average of 20 scans.
2. Every 500 ms: scan all cells (each cell is the average of 8 ADC readings after a short settling delay), subtract the baseline, apply a dead-band, smooth with an exponential moving average.
3. Compute the mean signal of each 2x2 block of cells (16 zones).
4. For each zone: if the signal is above `ZONE_LOAD_MV`, exposure time increases by the elapsed time. Otherwise it decreases at `RECOVERY_FACTOR` times that speed, down to zero.
5. If exposure reaches `EXPOSURE_LIMIT_S`, raise an alert once: LED and buzzer blink at 1 Hz, and publish an alert message.
6. Button press, or an `ack` message, clears alerted zones and resets their exposure.
7. If the whole mat has been empty for 60 s, slowly move the baseline toward the current reading (drift correction). Do this only when empty.
8. Network problems must never stop scanning or the local alarm.

### 6.2 Parameters (all in one config block, all editable)

| Name | Default | Meaning |
|---|---|---|
| `N` | 8 | Grid size |
| `ZONE` | 2 | Zone block size (cells) |
| `SETTLE_US` / `ROW_SETTLE_US` | 80 / 160 | Settling delays |
| `SAMPLES` | 8 | ADC readings averaged per cell |
| `FRAME_PERIOD_MS` | 500 | Scan interval |
| `ALPHA` | 0.30 | Smoothing factor |
| `DEADBAND_MV` | 20 | Ignore smaller signals |
| `ZONE_LOAD_MV` | 300 | PLACEHOLDER, set from calibration |
| `EXPOSURE_LIMIT_S` | 60 | PLACEHOLDER, 60 s is for bench tests only. A real limit must be set with clinical staff. |
| `RECOVERY_FACTOR` | 2.0 | PLACEHOLDER |
| `FULL_SCALE_MV` | 1500 | PLACEHOLDER, signal that maps to byte value 255 |

Work in millivolts. Converting to mmHg needs a per-cell calibration curve that does not exist yet.

---

## 7. Interfaces (the contract)

### 7.1 MQTT topics (device id `mat01` in examples)

| Topic | Direction | Payload | Rate |
|---|---|---|---|
| `pressuremat/mat01/frame` | device to server | `N*N` raw bytes, row-major. Byte = min(255, signal_mV * 255 / FULL_SCALE_MV) | every 500 ms |
| `pressuremat/mat01/zones` | device to server | JSON `{"uptime_s":123,"limit_s":60,"n":8,"exposure_s":[16 integers]}` | every 10 s |
| `pressuremat/mat01/alert` | device to server | text `zone=<row>,<col> exposure_s=<int>` (zone indices are 0 to 3) | on alert |
| `pressuremat/mat01/cmd` | server to device | text `ack` | on demand |

Use anonymous device IDs, never patient names.

### 7.2 WebSocket messages (server to dashboard), JSON

- `{"type":"frame","deviceId":"mat01","n":8,"cells":[64 integers 0..255]}`
- `{"type":"zones","deviceId":"mat01","limit_s":60,"exposure_s":[16 integers],"ts":"ISO date"}`
- `{"type":"alert","deviceId":"mat01","zone":[r,c],"exposure_s":61,"ts":"ISO date"}`
- `{"type":"posture","deviceId":"mat01","label":"supine","probs":{"empty":0.01,"supine":0.9,"left":0.05,"right":0.04},"ts":"ISO date"}`

### 7.3 REST API

| Route | Description |
|---|---|
| `GET /api/health` | `{ "ok": true }` |
| `GET /api/devices/:id/zones?limit=100` | Latest zone snapshots, newest first |
| `GET /api/devices/:id/alerts?limit=50` | Latest alerts, newest first |
| `GET /api/devices/:id/postures?hours=8` | Posture events in the last N hours, oldest first |
| `POST /api/devices/:id/ack` | Publishes `ack` to the device, marks open alerts acknowledged, returns `{ "ok": true }` |

### 7.4 MongoDB collections

- `zones`: `{ deviceId, ts, limitS, exposureS: [Number] }`, index `{deviceId, ts}`.
- `alerts`: `{ deviceId, ts, zone: [Number], exposureS, ackedAt }`.
- `postures`: `{ deviceId, ts, label, probs }`.
- `frames`: `{ deviceId, ts, cells: Buffer }`, one of every 10 frames saved, expires after 30 days.

---

## 8. Frontend specification and design system

Stack: React 18, Vite, plain CSS with variables. Starter code: Appendix C. The look follows the design canvas ("Dashboard UI System").

### 8.1 Style: neo-brutalist "sticker pack", playful but clear

- 3 to 4 px dark outlines, hard offset shadows (no blur), flat colours, no gradients.
- Status stickers and some cards tilted 1 to 3 degrees. Pill-shaped buttons.
- Big, tightly tracked bold headlines. Small monospace caps labels.
- No emoji, no stock photos.

### 8.2 Design tokens

| Token | Value | Use |
|---|---|---|
| `--cream` | `#F7F3E3` | Page background |
| `--teal` | `#58A4B0` | Cards, calm states, primary buttons |
| `--green` | `#004643` | Emphasis, alert cards, stickers (cream text) |
| `--plum` | `#210124` | Text, outlines, shadows, hot spots, ticker bar |
| Display font | Space Grotesk 700, letter-spacing -1 to -3 px | Headlines |
| Body font | Space Grotesk 400/500, 17 to 20 px | Body |
| Label font | Space Mono 700, 13 to 15 px, caps | Labels, timers |
| Outline | 3 to 4 px solid plum | Cards, buttons |
| Shadow | `8px 8px 0 plum` (cards), `5px 5px 0 plum` (buttons/stickers) | Depth |

Rules: touch targets at least 44 px, text contrast at least 4.5:1, status never relies on colour alone (always text labels), layout wraps cleanly down to phone width.

### 8.3 Screens and components

**Dashboard (fluid, about 1440 px):**

1. Ticker bar (plum background, cream mono text).
2. Header: logo "FLIP." with a green period, pill nav (Live, History, Zones, Settings), bed ID chip, status sticker.
3. Live heatmap card: 8x8 grid on a plum background. Levels: 0 = cream, 1 = teal, 2 = green, 3 = plum (hot spot). Legend and an "AI guess" position card (from the `posture` message).
4. Zone timers card: one row per zone with label, time, and a bar showing exposure as a share of the limit. Bar colour: under 50% teal, 50% to 80% green, 80% and over plum with a "NEAR ITS LIMIT" tag.
5. Alert card (deep green, tilted -1 degree), shown only when an alert is open: "FLIP TIME.", the zone, buttons "Done, turned" and "Snooze 5 min". Snooze hides the card locally for 5 minutes.
6. Timeline card: last 8 hours of positions as a segmented bar with text labels.

**Phone view:** same data in one column (alert card, mini heatmap, two buttons, bottom tab bar). Implement by making the dashboard responsive, not as a separate app.

Zone labels in v1 are grid labels (A1 to D4). Naming zones by body part (sacrum, heels) is a later feature that needs a known mat placement.

When running on real data, remove all "SAMPLE DATA" labels. Keep them if any demo data is shown.

---

## 9. AI specification

Starter code: Appendix D (Python, TensorFlow/Keras, FastAPI).

### 9.1 Task

Classify the patient's lying position from a short window of pressure frames.

- Input: `T` frames (default 30, sampled at 1 Hz, so a 30-second window) of `N x N` (default 8x8), each window scaled to 0..1 by its own 99th percentile.
- Output classes (default): `supine`, `left`, `right`. The public dataset has no empty-mat class, so `empty` is a rule in the service (no cell above a small threshold).
- Not a goal in v1: predicting ulcer risk or time to ischemia.

### 9.2 Model: small transformer encoder

1. Flatten each frame to `N*N` values, linear projection to `d_model` (64).
2. Add a learned positional embedding over time.
3. 2 encoder blocks: layer norm, multi-head self-attention (4 heads), residual, layer norm, feed-forward (128, GELU), residual.
4. Layer norm, global average pooling over time, dropout, dense softmax.

It runs on a server or gateway, not on the ESP32. The ESP32 keeps the rule-based pressure x time alarm.

### 9.3 The public dataset (facts from the dataset page)

PmatData, from the Quality of Life Technology (QoLT) Laboratory at the University of Texas at Dallas, hosted on PhysioNet.

| | Experiment I | Experiment II |
|---|---|---|
| Participants | 13 adults | 8 adults |
| States | 8 standard postures + 9 additional states (17 position files) | 29 states of 3 standard postures |
| Mat | Vista Medical FSA SoftFlex 2048 | Vista Medical BodiTrak BT3510 |
| Grid | 32 x 64 | 27 x 64 |
| Raw value range | 0 to 1000 | 0 to 500 |
| Sampling rate | 1 Hz | 1 Hz |
| One file contains | about 120 frames (about 2 minutes). Each row is one frame of 2048 values (the 32x64 mat flattened) | one frame: the average of about 20 frames. 64 rows x 27 columns |
| Mattress | not stated | sponge and air-alternating, recorded separately |

Files are tab-delimited text, in folders named after the experiment and the subject. In Experiment I the files are named after the position number (1 to 17). `experiment-info.docx` describes the subjects and postures with diagrams, and each experiment folder has `subject-info-*.csv` files.

Contributors: Maziyar Baran Pouyan, Javad Birjandtalab, Mehrdad Heydarzadeh, Sarah Ostadabbas, Rasoul Yousefi, Masoud Farshbaf, Mehrdad Nourani (faculty advisor), and Matthew Pompeo, MD (clinical consultant). Cite the dataset and its paper as the dataset page instructs, and check the licence before use.

Rough size: Experiment I is at most about 26,000 frames (13 people x 17 files x about 120 frames).

### 9.4 Where the dataset does not match our mat (read before training)

| Property | Our mat | Public dataset | What we do about it |
|---|---|---|---|
| Grid | 8 x 8 | 32 x 64 and 27 x 64 | Resample by **area averaging**. Never drop rows or columns. |
| Field of view | about 9.6 cm square (8 cells x about 1.2 cm, planned) | a large mat that covers the body | Crop a patch of the same **physical** size. This needs the dataset mat's sensor spacing, which the dataset summary does not give. Take it from the mat's datasheet or `experiment-info.docx`. |
| Values | 0 to 255 bytes, relative and uncalibrated | 0 to 1000 and 0 to 500 | Scale every window by its own 99th percentile (`normalise_window`), in training **and** serving. |
| Rate | 2 frames per second on the wire | 1 Hz | The server sub-samples to 1 Hz (`FRAME_STRIDE = 2`). 30 frames = 30 seconds. |
| Sensor | DIY Velostat matrix | commercial mats | A domain gap remains. Only recordings from our own mat can close it. |
| Classes | needs supine, left, right (and empty) | no empty-mat class | `empty` is a rule in the service. |
| Dynamics | we care about position changes | static postures held for about 2 minutes. Experiment II is a single averaged frame | The public data has little temporal information, so a transformer may not beat a no-attention baseline on it. Compare against the baseline. |
| Labels | posture names | position numbers only | Map position numbers to postures using `experiment-info.docx` (`position_map_*.json`). Never guess the mapping. |
| People | | 13 and 8 | Cross-validate by person. Expect wide uncertainty. Report fold-by-fold. |

### 9.5 Fitting the data to our 8x8 mat

"Distillation" is used in two senses, and both are part of the plan:

1. **Spatial fitting.** Make the public data look like what our mat would see. `prepare.py` builds three views of every window from the same frames, so they stay aligned:
   - `Xs`, the **student** view: an 8x8 patch with the physical size of our mat, centred on the window's centre of pressure with a random shift of up to 1 cell (to imitate placement error).
   - `Xf`: the whole mat averaged to 8x8, for comparison only. It does not match what our mat sees.
   - `Xt`, the **teacher** view: the whole mat averaged to 16x32.
2. **Knowledge distillation.** A teacher transformer sees the whole mat (`Xt`). A student transformer sees only the 8x8 patch (`Xs`), the same kind of input our real mat produces. The student is trained on the true labels and on the teacher's softened probabilities. Distillation cannot add information that is not in the patch. It can regularise a small model, so it must be compared against a plain student.

Steps, with the scripts in Appendix D:

1. `convert_pmd.py`: read the tab-delimited files into one `.npz`. Run once with `--write-template`, fill `position_map_exp1.json` (and `_exp2.json`) from `experiment-info.docx`, then convert. Use `null` for positions that are not supine, left or right.
2. `inspect_frame.py`: look at the pictures. Check the orientation (is the long axis head to foot, and does Experiment II need the same orientation as Experiment I?), and check that "supine" files look like a person on their back. The code assumes each Experiment I row reshapes to 32 x 64 and that Experiment II's 64 x 27 table must be transposed to 27 x 64. Confirm both by eye.
3. `prepare.py`: build windows of 30 frames, three views, per-window normalisation. Needs `--pitch-cm-exp1`.
4. `train.py`: cross-validation by person, for the baseline and the transformer, on `Xs`, `Xf` and `Xt`.
5. `distill.py`: teacher on `Xt`, student on `Xs`, cross-validated by person. The teacher is trained only on each fold's training people.
6. Choose the model, train it on everything with `--out model`, and let `serve.py` load `model.keras`.

### 9.6 Experiments to run and report

| | Question | Compare |
|---|---|---|
| A | Does temporal attention help? | baseline vs transformer on `Xs` |
| B | What does a small field of view cost? | `Xs` (patch) vs `Xf` (whole mat at 8x8) vs `Xt` (teacher) |
| C | Does distillation help? | plain student vs distilled student |
| D | Does the static Experiment II data help? | Experiment I only vs I + II |
| E | Does any of this work on our mat? | evaluate on recordings from our own mat (the only result that matters for the product) |

Honest expectations: a patch about 10 cm wide under the sacrum may not separate supine from side-lying reliably. The numbers will tell. If they are poor, the options are a larger mat, several mats, or a smaller claim (for example "where is the load" instead of "which position"). Never report cross-validated accuracy on public data as the accuracy of our mat.

### 9.7 Service

`POST /predict` with `{"frames": [[N*N floats] x T], "n": 8}` (values are byte / 255, frames sampled at 1 Hz) returns `{"label": "...", "probs": {...}}`. The window must contain exactly the `T` frames the model was trained with. If no cell exceeds the empty threshold, the service returns `empty` without running the model. Otherwise it applies the same per-window normalisation used in training.

---

## 10. Testing and calibration plan

### 10.1 Bench tests (phase 1, on the 8x8 mat)

| Test | Procedure | Record |
|---|---|---|
| Sensor material check | Between two copper strips, press with a finger while measuring resistance with a multimeter | Resistance with no pressure, light pressure, firm pressure |
| Crosstalk | Press a single cell with a fixed weight. Read all cells | Neighbour response as a percentage of the pressed cell |
| Repeatability | Apply the same weight to the same cell 10 times | Spread of readings |
| Linearity / calibration | Known weights (for example 0, 100, 200, 500, 1000 g) on a small flat pad of known area | Signal vs weight per cell, saved as a table |
| Drift | Constant load for 4 to 8 hours, logging temperature and humidity if available | Percentage change over time |
| Location accuracy | Place a small load at known cells | Reported cell vs true cell |
| Speed | Measure scan time | Frames per second |

### 10.2 Phantom stage

Replace rigid weights with a soft-tissue-like phantom (silicone or gel layer over a bone-like base). Compare the pressure map with a commercial reference mat if one can be borrowed.

### 10.3 Software tests

- Firmware: simulated frames (hard-coded arrays) check baseline, dead-band, zone logic, alert and ack.
- Server: publish fake MQTT frames and check WebSocket output and database writes.
- Frontend: render with a mock WebSocket stream.
- AI: unit-test shapes, then check accuracy on held-out people.

### 10.4 Definition of done for v1

All success criteria in section 2 are measured and reported (met or not), the dashboard works end to end with the real mat, and a short test report lists every measured number with the date and setup.

---

## 11. Ethics, safety, privacy, regulation

- **No use on real patients** without approval from the relevant research ethics committee. Describe the work as staged validation: bench, then phantom, then healthy volunteers at minimal risk with informed written consent and anonymous data, then (in future) clinical study with a clinical partner.
- **Electrical safety:** 3.3 V logic and very low current, but the mat must be fully insulated from skin and fluids. Power from a battery or a certified adapter.
- **Fluids:** sweat and urine damage copper and Velostat. Use a wipeable, fluid-resistant cover and sealed edges.
- **Privacy:** anonymous device IDs, TLS on all connections before real use, authentication on the API, a clear data-retention and deletion policy, minimal data stored.
- **Regulation:** if ever used clinically it would be a medical device. Check the Egyptian Drug Authority and, if relevant, FDA/CE requirements, plus risk management for medical devices. Label the prototype "research prototype, not for clinical decisions".
- **Alarm limits** must be set with clinical staff.

---

## 12. Milestones

| Phase | Deliverable | Rough time |
|---|---|---|
| 1 | 8x8 mat, scan code, crosstalk and calibration measurements | 2 to 3 weeks |
| 2 | Firmware with zones, alarm, MQTT | 2 weeks |
| 3 | Server + MongoDB + dashboard (live heatmap, timers, alerts) | 3 weeks |
| 4 | Drift test (4 to 8 hours), compensation, report | 2 to 3 weeks |
| 5 | Posture model on public data, then own data | 4 weeks |
| 6 | Phantom tests and ethics submission | 3 weeks |
| 7 | Volunteer study (only with approval) | depends on approval |

Times are rough guesses and depend on parts and approvals.

---

## 13. Risks

| Risk | Mitigation |
|---|---|
| Strong crosstalk between cells | Cut Velostat into strips, then a zero-potential read circuit (op-amp plus shift register) |
| Large drift or creep in the sensing material | Measure it, model it, re-zero only when empty, log temperature and humidity |
| Material from "generic" sellers behaves differently | Test every batch, buy extra, do not mix batches in one mat |
| Solder joints on copper tape fail | Use connectors or FFC, add strain relief |
| Public data comes from different sensors | Mix in own data, evaluate on held-out people |
| Model too heavy for the ESP32 | Run it on the server or a gateway (decided) |
| Ethics approval delays | Start with bench and phantom work |

---

## 14. Repository layout, build order, run instructions

```
flip/
  firmware/pressure_mat/pressure_mat.ino        (Appendix A)
  server/                                        (Appendix B)
    package.json  server.js  .env.example
  web/                                           (Appendix C)
    package.json  vite.config.js  index.html
    src/main.jsx  src/App.jsx  src/useLive.js  src/styles.css
    src/components/Heatmap.jsx ZoneTimers.jsx AlertCard.jsx Timeline.jsx
  ai/                                            (Appendix D)
    requirements.txt  model.py  data.py  convert_pmd.py  inspect_frame.py
    prepare.py  train.py  distill.py  serve.py
    position_map_exp1.json  position_map_exp2.json   (you fill these from experiment-info.docx)
  infra/                                         (Appendix E)
    docker-compose.yml  mosquitto.conf
```

Build order:

1. Infra: start Mosquitto and MongoDB (Appendix E).
2. Server: run it and publish fake frames with `mosquitto_pub` to test.
3. Web: run the dashboard against the server.
4. Firmware: flash the ESP32 and watch real data arrive.
5. AI: prepare data, train, then start the service and set `AI_URL` in the server.

Run (development):

```bash
# 1. infra
cd infra && docker compose up -d

# 2. server
cd ../server && cp .env.example .env && npm install && npm start

# 3. web
cd ../web && npm install && npm run dev

# 5. ai (optional until a model is trained)
cd ../ai && pip install -r requirements.txt
python convert_pmd.py --root /path/to/pmd --write-template      # then fill the position_map files
python convert_pmd.py --root /path/to/pmd --out pmd.npz --exp2
python inspect_frame.py --npz pmd.npz                           # look at inspect.png
python prepare.py --npz pmd.npz --out win.npz --pitch-cm-exp1 <cm> --pitch-cm-exp2 <cm>
python train.py --input win.npz --x Xs --arch baseline          # experiment A, baseline
python train.py --input win.npz --x Xs --arch transformer       # experiment A, transformer
python train.py --input win.npz --x Xf --arch transformer       # experiment B
python distill.py --input win.npz                               # experiment C
python train.py --input win.npz --x Xs --out model              # or: python distill.py --out model
uvicorn serve:app --port 8000
```

Test the server without hardware:

```bash
# 64 bytes of fake frame data (a hot spot of 200 near the middle)
python3 -c "import sys; sys.stdout.buffer.write(bytes([200 if i in (27,28,35,36) else 0 for i in range(64)]))" | mosquitto_pub -h localhost -t pressuremat/mat01/frame -s
mosquitto_pub -h localhost -t pressuremat/mat01/zones -m '{"uptime_s":10,"limit_s":60,"n":8,"exposure_s":[0,0,0,0,0,48,0,0,0,0,0,0,0,0,0,0]}'
mosquitto_pub -h localhost -t pressuremat/mat01/alert -m 'zone=1,1 exposure_s=61'
```

---

## 15. Open questions (decide with the team)

1. Which sensing material will the final mat use (Velostat sheet, other film, or conductive fabric)?
2. What exposure limit and load threshold will the clinical advisor approve? (Currently PLACEHOLDER.)
3. Where will the mat be placed (sacrum only, or other areas), so zones can be named by body part?
4. Which volunteers and which ethics committee?
5. Battery or mains power, and will an enclosure be 3D printed?
6. Is the product name FLIP final?

---

## Appendix A: Firmware (`firmware/pressure_mat/pressure_mat.ino`)

Libraries: PubSubClient (Nick O'Leary). Board: ESP32 Arduino core 2.x or 3.x, board type "ESP32 Dev Module" (WROOM).

```cpp
#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ------------------------------------------------------------ CONFIG ---
const char*    WIFI_SSID = "YOUR_WIFI";
const char*    WIFI_PASS = "YOUR_PASSWORD";
const char*    MQTT_HOST = "192.168.1.10";
const uint16_t MQTT_PORT = 1883;
const char*    DEVICE_ID = "mat01";            // anonymous ID, never a patient name

// Geometry
constexpr uint8_t N    = 8;                    // 8 x 8 cells
constexpr uint8_t ZONE = 2;                    // zone = 2 x 2 cells
constexpr uint8_t ZN   = N / ZONE;             // 4 x 4 = 16 zones

// Pins (strapping pins 0,2,5,12,15 and flash pins 6..11 are avoided)
const uint8_t ROW_PINS[N] = {13, 16, 17, 18, 19, 21, 22, 23};
const uint8_t MUX_S[3]    = {25, 26, 27};      // CD74HC4067 S0..S2, S3 tied to GND
const uint8_t ADC_PIN     = 34;                // mux SIG, 10k to GND, 0.1uF to GND
const uint8_t BUZZER_PIN  = 32;
const uint8_t LED_PIN     = 33;
const uint8_t ACK_PIN     = 14;

// Scanning
constexpr uint16_t SETTLE_US       = 80;
constexpr uint16_t ROW_SETTLE_US   = 160;
constexpr uint8_t  SAMPLES         = 8;
constexpr uint32_t FRAME_PERIOD_MS = 500;

// Signal processing (signal = millivolts above the empty-mat baseline)
constexpr float    ALPHA       = 0.30f;
constexpr uint16_t DEADBAND_MV = 20;

// Pressure x time logic. PLACEHOLDER values: set from calibration and clinical advice.
constexpr float ZONE_LOAD_MV     = 300.0f;
constexpr float EXPOSURE_LIMIT_S = 60.0f;      // 60 s is for bench tests only
constexpr float RECOVERY_FACTOR  = 2.0f;

// Empty-mat auto re-zero
constexpr float EMPTY_TOTAL_MV = 200.0f;
constexpr float EMPTY_HOLD_S   = 60.0f;

// Publishing
constexpr float    FULL_SCALE_MV   = 1500.0f;  // PLACEHOLDER: signal that maps to 255
constexpr uint32_t ZONES_PERIOD_MS = 10000;

#define DEBUG_DUMP 1

// ------------------------------------------------------------- STATE ---
uint16_t baselineMv[N][N];
uint16_t rawMv[N][N];
float    filt[N][N];
float    zoneSignal[ZN][ZN];
float    exposureS[ZN][ZN];
bool     alerted[ZN][ZN];

float    emptyForS = 0;
uint32_t lastFrameMs = 0, lastZonesMs = 0, lastNetTryMs = 0, lastAckMs = 0;

WiFiClient   wifi;
PubSubClient mqtt(wifi);
char topicFrame[48], topicZones[48], topicAlert[48], topicCmd[48];

// ---------------------------------------------------------- SCANNING ---
static inline void selectColumn(uint8_t c) {
  for (uint8_t i = 0; i < 3; i++) digitalWrite(MUX_S[i], (c >> i) & 1);
}

void scanFrame() {
  for (uint8_t r = 0; r < N; r++) {
    pinMode(ROW_PINS[r], OUTPUT);
    digitalWrite(ROW_PINS[r], HIGH);            // 3.3 V on this row only
    delayMicroseconds(ROW_SETTLE_US);
    for (uint8_t c = 0; c < N; c++) {
      selectColumn(c);
      delayMicroseconds(SETTLE_US);
      uint32_t acc = 0;
      for (uint8_t s = 0; s < SAMPLES; s++) acc += analogReadMilliVolts(ADC_PIN);
      rawMv[r][c] = acc / SAMPLES;
    }
    pinMode(ROW_PINS[r], INPUT);                // back to high impedance
  }
}

void captureBaseline(uint8_t frames) {
  static uint32_t acc[N][N];
  memset(acc, 0, sizeof(acc));
  for (uint8_t f = 0; f < frames; f++) {
    scanFrame();
    for (uint8_t r = 0; r < N; r++)
      for (uint8_t c = 0; c < N; c++) acc[r][c] += rawMv[r][c];
  }
  for (uint8_t r = 0; r < N; r++)
    for (uint8_t c = 0; c < N; c++) baselineMv[r][c] = acc[r][c] / frames;
  memset(filt, 0, sizeof(filt));
}

// ---------------------------------------------------- SIGNAL / LOGIC ---
void processFrame() {
  for (uint8_t r = 0; r < N; r++)
    for (uint8_t c = 0; c < N; c++) {
      int d = (int)rawMv[r][c] - (int)baselineMv[r][c];
      if (d < (int)DEADBAND_MV) d = 0;
      filt[r][c] = ALPHA * d + (1.0f - ALPHA) * filt[r][c];
    }
  for (uint8_t zr = 0; zr < ZN; zr++)
    for (uint8_t zc = 0; zc < ZN; zc++) {
      float sum = 0;
      for (uint8_t r = 0; r < ZONE; r++)
        for (uint8_t c = 0; c < ZONE; c++) sum += filt[zr * ZONE + r][zc * ZONE + c];
      zoneSignal[zr][zc] = sum / (ZONE * ZONE);
    }
}

void raiseAlert(uint8_t zr, uint8_t zc) {
  alerted[zr][zc] = true;
  char msg[64];
  snprintf(msg, sizeof(msg), "zone=%u,%u exposure_s=%d", zr, zc, (int)exposureS[zr][zc]);
  Serial.println(msg);
  if (mqtt.connected()) mqtt.publish(topicAlert, msg);
}

void updateExposure(float dtS) {
  float total = 0;
  for (uint8_t zr = 0; zr < ZN; zr++)
    for (uint8_t zc = 0; zc < ZN; zc++) {
      total += zoneSignal[zr][zc];
      if (zoneSignal[zr][zc] >= ZONE_LOAD_MV) {
        exposureS[zr][zc] += dtS;
      } else {
        exposureS[zr][zc] -= dtS * RECOVERY_FACTOR;
        if (exposureS[zr][zc] < 0) { exposureS[zr][zc] = 0; alerted[zr][zc] = false; }
      }
      if (exposureS[zr][zc] >= EXPOSURE_LIMIT_S && !alerted[zr][zc]) raiseAlert(zr, zc);
    }

  // Drift correction, only while the mat is empty
  if (total < EMPTY_TOTAL_MV) {
    emptyForS += dtS;
    if (emptyForS >= EMPTY_HOLD_S)
      for (uint8_t r = 0; r < N; r++)
        for (uint8_t c = 0; c < N; c++)
          baselineMv[r][c] += ((int)rawMv[r][c] - (int)baselineMv[r][c]) / 16;
  } else {
    emptyForS = 0;
  }
}

bool anyAlert() {
  for (uint8_t zr = 0; zr < ZN; zr++)
    for (uint8_t zc = 0; zc < ZN; zc++)
      if (alerted[zr][zc]) return true;
  return false;
}

// Patient was repositioned: clear alerted zones.
void ackAlerts() {
  for (uint8_t zr = 0; zr < ZN; zr++)
    for (uint8_t zc = 0; zc < ZN; zc++)
      if (alerted[zr][zc]) { exposureS[zr][zc] = 0; alerted[zr][zc] = false; }
}

void handleAckButton() {
  if (digitalRead(ACK_PIN) == LOW && millis() - lastAckMs > 300) {
    lastAckMs = millis();
    ackAlerts();
  }
}

void driveAlarm() {
  bool on = anyAlert() && ((millis() / 500) % 2 == 0);
  digitalWrite(LED_PIN, on);
  digitalWrite(BUZZER_PIN, on);                 // active buzzer
}

// ----------------------------------------------------------- NETWORK ---
void onMessage(char* topic, byte* payload, unsigned int len) {
  if (len == 3 && memcmp(payload, "ack", 3) == 0) ackAlerts();
}

void maintainNetwork() {
  if (WiFi.status() != WL_CONNECTED) {
    if (millis() - lastNetTryMs > 5000) { lastNetTryMs = millis(); WiFi.begin(WIFI_SSID, WIFI_PASS); }
    return;
  }
  if (!mqtt.connected()) {
    if (millis() - lastNetTryMs > 5000) {
      lastNetTryMs = millis();
      if (mqtt.connect(DEVICE_ID)) mqtt.subscribe(topicCmd);
    }
    return;
  }
  mqtt.loop();
}

void publishFrame() {
  uint8_t payload[N * N];
  for (uint8_t r = 0; r < N; r++)
    for (uint8_t c = 0; c < N; c++) {
      float v = filt[r][c] * 255.0f / FULL_SCALE_MV;
      payload[r * N + c] = (uint8_t)fminf(255.0f, fmaxf(0.0f, v));
    }
  mqtt.publish(topicFrame, payload, sizeof(payload), false);
}

void publishZones() {
  char buf[400];
  int n = snprintf(buf, sizeof(buf), "{\"uptime_s\":%lu,\"limit_s\":%d,\"n\":%u,\"exposure_s\":[",
                   millis() / 1000UL, (int)EXPOSURE_LIMIT_S, N);
  for (uint8_t zr = 0; zr < ZN; zr++)
    for (uint8_t zc = 0; zc < ZN; zc++)
      n += snprintf(buf + n, sizeof(buf) - n, "%s%d", (zr || zc) ? "," : "", (int)exposureS[zr][zc]);
  snprintf(buf + n, sizeof(buf) - n, "]}");
  mqtt.publish(topicZones, buf);
}

void dumpGrid() {
  for (uint8_t r = 0; r < N; r++)
    for (uint8_t c = 0; c < N; c++) { Serial.print((int)filt[r][c]); Serial.print(c < N - 1 ? "," : "\n"); }
  Serial.println("---");
}

// ------------------------------------------------------ SETUP / LOOP ---
void setup() {
  Serial.begin(115200);
  for (uint8_t i = 0; i < 3; i++) pinMode(MUX_S[i], OUTPUT);
  for (uint8_t r = 0; r < N; r++) pinMode(ROW_PINS[r], INPUT);   // high impedance until scanned
  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(ACK_PIN, INPUT_PULLUP);

  analogReadResolution(12);
  analogSetPinAttenuation(ADC_PIN, ADC_11db);

  snprintf(topicFrame, sizeof(topicFrame), "pressuremat/%s/frame", DEVICE_ID);
  snprintf(topicZones, sizeof(topicZones), "pressuremat/%s/zones", DEVICE_ID);
  snprintf(topicAlert, sizeof(topicAlert), "pressuremat/%s/alert", DEVICE_ID);
  snprintf(topicCmd,   sizeof(topicCmd),   "pressuremat/%s/cmd",   DEVICE_ID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
  mqtt.setBufferSize(512);

  Serial.println("Keep the mat EMPTY: capturing baseline...");
  delay(2000);
  captureBaseline(20);
  Serial.println("Baseline done.");
  lastFrameMs = millis();
}

void loop() {
  maintainNetwork();
  handleAckButton();
  driveAlarm();

  uint32_t now = millis();
  if (now - lastFrameMs < FRAME_PERIOD_MS) return;
  float dtS = (now - lastFrameMs) / 1000.0f;
  lastFrameMs = now;

  scanFrame();
  processFrame();
  updateExposure(dtS);

  if (mqtt.connected()) {
    publishFrame();
    if (now - lastZonesMs >= ZONES_PERIOD_MS) { lastZonesMs = now; publishZones(); }
  }
#if DEBUG_DUMP
  dumpGrid();
#endif
}
```

---

## Appendix B: Server (`server/`)

`package.json`

```json
{
  "name": "flip-server",
  "version": "1.0.0",
  "type": "module",
  "scripts": { "start": "node server.js" },
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "mongoose": "^8.5.0",
    "mqtt": "^5.10.0",
    "ws": "^8.18.0"
  }
}
```

`.env.example`

```
PORT=4000
MQTT_URL=mqtt://localhost:1883
MONGO_URL=mongodb://localhost:27017/flip
GRID_N=8
# Leave empty to disable posture prediction
AI_URL=
```

`server.js` (needs Node 18 or newer for the built-in `fetch`)

```js
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import { WebSocketServer } from 'ws';
import mqtt from 'mqtt';
import mongoose from 'mongoose';

const PORT = Number(process.env.PORT || 4000);
const MQTT_URL = process.env.MQTT_URL || 'mqtt://localhost:1883';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/flip';
const AI_URL = process.env.AI_URL || '';
const N = Number(process.env.GRID_N || 8);
const WINDOW = 30;        // frames sent to the AI model (30 frames at 1 Hz = 30 seconds)
const FRAME_STRIDE = 2;   // the mat sends 2 frames/s; the AI window uses 1 frame/s, like the dataset
const SAVE_EVERY = 10;    // store 1 of every 10 frames
const PREDICT_EVERY = 10; // call the AI every 10 frames (about 5 s)

// ------------------------------------------------------------ database ---
const zoneSchema = new mongoose.Schema({ deviceId: String, ts: Date, limitS: Number, exposureS: [Number] });
zoneSchema.index({ deviceId: 1, ts: -1 });
const alertSchema = new mongoose.Schema({ deviceId: String, ts: Date, zone: [Number], exposureS: Number, ackedAt: Date });
alertSchema.index({ deviceId: 1, ts: -1 });
const postureSchema = new mongoose.Schema({ deviceId: String, ts: Date, label: String, probs: Object });
postureSchema.index({ deviceId: 1, ts: -1 });
const frameSchema = new mongoose.Schema({ deviceId: String, ts: Date, cells: Buffer });
frameSchema.index({ ts: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // keep 30 days

const Zone = mongoose.model('Zone', zoneSchema);
const Alert = mongoose.model('Alert', alertSchema);
const Posture = mongoose.model('Posture', postureSchema);
const Frame = mongoose.model('Frame', frameSchema);

await mongoose.connect(MONGO_URL);
console.log('MongoDB connected');

// ----------------------------------------------------------- websocket ---
const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function broadcast(msg) {
  const text = JSON.stringify(msg);
  for (const client of wss.clients) if (client.readyState === 1) client.send(text);
}

// ---------------------------------------------------------------- mqtt ---
const rings = new Map();   // deviceId -> array of recent frames (each an array of N*N numbers)
const counters = new Map();

const client = mqtt.connect(MQTT_URL);
client.on('connect', () => {
  console.log('MQTT connected');
  client.subscribe(['pressuremat/+/frame', 'pressuremat/+/zones', 'pressuremat/+/alert']);
});
client.on('error', (e) => console.error('MQTT error', e.message));

client.on('message', async (topic, payload) => {
  const [, deviceId, kind] = topic.split('/');
  try {
    if (kind === 'frame') await onFrame(deviceId, payload);
    else if (kind === 'zones') await onZones(deviceId, payload);
    else if (kind === 'alert') await onAlert(deviceId, payload);
  } catch (e) {
    console.error('handler error', topic, e.message);
  }
});

async function onFrame(deviceId, payload) {
  if (payload.length !== N * N) return; // ignore frames of the wrong size
  const cells = Array.from(payload);
  broadcast({ type: 'frame', deviceId, n: N, cells });

  const count = (counters.get(deviceId) || 0) + 1;
  counters.set(deviceId, count);

  const ring = rings.get(deviceId) || [];
  if (count % FRAME_STRIDE === 0) {
    ring.push(cells);
    if (ring.length > WINDOW) ring.shift();
    rings.set(deviceId, ring);
  }
  if (count % SAVE_EVERY === 0) await Frame.create({ deviceId, ts: new Date(), cells: Buffer.from(payload) });
  if (AI_URL && ring.length === WINDOW && count % PREDICT_EVERY === 0) predict(deviceId, ring);
}

async function onZones(deviceId, payload) {
  const data = JSON.parse(payload.toString());
  const ts = new Date();
  await Zone.create({ deviceId, ts, limitS: data.limit_s, exposureS: data.exposure_s });
  broadcast({ type: 'zones', deviceId, limit_s: data.limit_s, exposure_s: data.exposure_s, ts });
}

async function onAlert(deviceId, payload) {
  // payload text: "zone=r,c exposure_s=N"
  const m = /zone=(\d+),(\d+) exposure_s=(\d+)/.exec(payload.toString());
  if (!m) return;
  const zone = [Number(m[1]), Number(m[2])];
  const exposureS = Number(m[3]);
  const ts = new Date();
  await Alert.create({ deviceId, ts, zone, exposureS });
  broadcast({ type: 'alert', deviceId, zone, exposure_s: exposureS, ts });
}

async function predict(deviceId, ring) {
  try {
    const res = await fetch(`${AI_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n: N, frames: ring.map((f) => f.map((v) => v / 255)) }),
    });
    if (!res.ok) return;
    const { label, probs } = await res.json();
    const ts = new Date();
    await Posture.create({ deviceId, ts, label, probs });
    broadcast({ type: 'posture', deviceId, label, probs, ts });
  } catch (e) {
    console.error('AI call failed', e.message);
  }
}

// ----------------------------------------------------------------- rest ---
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/devices/:id/zones', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 1000);
  res.json(await Zone.find({ deviceId: req.params.id }).sort({ ts: -1 }).limit(limit));
});

app.get('/api/devices/:id/alerts', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 50), 500);
  res.json(await Alert.find({ deviceId: req.params.id }).sort({ ts: -1 }).limit(limit));
});

app.get('/api/devices/:id/postures', async (req, res) => {
  const hours = Math.min(Number(req.query.hours || 8), 72);
  const since = new Date(Date.now() - hours * 3600 * 1000);
  res.json(await Posture.find({ deviceId: req.params.id, ts: { $gte: since } }).sort({ ts: 1 }));
});

app.post('/api/devices/:id/ack', async (req, res) => {
  client.publish(`pressuremat/${req.params.id}/cmd`, 'ack');
  await Alert.updateMany({ deviceId: req.params.id, ackedAt: null }, { ackedAt: new Date() });
  res.json({ ok: true });
});

server.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
```

Security note: this development server has no authentication. Before any real use add authentication, TLS (for MQTT, WebSocket and HTTP), and rate limiting.

---

## Appendix C: Web dashboard (`web/`)

`package.json`

```json
{
  "name": "flip-web",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": { "dev": "vite", "build": "vite build", "preview": "vite preview" },
  "dependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" },
  "devDependencies": { "@vitejs/plugin-react": "^4.3.1", "vite": "^5.4.0" }
}
```

`vite.config.js`

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({ plugins: [react()] });
```

`index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>FLIP</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

`src/main.jsx`

```jsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

createRoot(document.getElementById('root')).render(<App />);
```

`src/useLive.js`

```js
import { useEffect, useState } from 'react';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export function useLive(deviceId) {
  const [online, setOnline] = useState(false);
  const [frame, setFrame] = useState(null);     // { n, cells }
  const [zones, setZones] = useState(null);     // { limit_s, exposure_s }
  const [alerts, setAlerts] = useState([]);     // open alerts, newest first
  const [posture, setPosture] = useState(null); // { label, probs }

  useEffect(() => {
    let ws;
    let timer;
    let closed = false;

    const connect = () => {
      ws = new WebSocket(WS_URL);
      ws.onopen = () => setOnline(true);
      ws.onclose = () => {
        setOnline(false);
        if (!closed) timer = setTimeout(connect, 2000);
      };
      ws.onmessage = (e) => {
        const m = JSON.parse(e.data);
        if (m.deviceId !== deviceId) return;
        if (m.type === 'frame') setFrame({ n: m.n, cells: m.cells });
        else if (m.type === 'zones') setZones({ limit_s: m.limit_s, exposure_s: m.exposure_s });
        else if (m.type === 'alert') setAlerts((a) => [{ zone: m.zone, exposure_s: m.exposure_s, ts: m.ts }, ...a]);
        else if (m.type === 'posture') setPosture({ label: m.label, probs: m.probs });
      };
    };
    connect();

    return () => {
      closed = true;
      clearTimeout(timer);
      if (ws) ws.close();
    };
  }, [deviceId]);

  const ack = async () => {
    await fetch(`${API_URL}/api/devices/${deviceId}/ack`, { method: 'POST' });
    setAlerts([]);
  };

  return { online, frame, zones, alerts, posture, ack };
}

export { API_URL };
```

`src/App.jsx`

```jsx
import React from 'react';
import { useLive } from './useLive.js';
import Heatmap from './components/Heatmap.jsx';
import ZoneTimers from './components/ZoneTimers.jsx';
import AlertCard from './components/AlertCard.jsx';
import Timeline from './components/Timeline.jsx';

const DEVICE_ID = 'mat01';

export default function App() {
  const { online, frame, zones, alerts, posture, ack } = useLive(DEVICE_ID);
  const status = alerts.length > 0 ? 'FLIP TIME' : online ? 'ALL CHILL' : 'OFFLINE';

  return (
    <div className="page">
      <div className="ticker">BED 07 // LIVE // FLIP EARLY // STAY CHILL // BED 07 // LIVE // FLIP EARLY // STAY CHILL // BED 07</div>

      <header className="header">
        <div>
          <div className="logo">FLIP<span>.</span></div>
          <div className="mono small">pressure mat // working name</div>
        </div>
        <nav className="nav">
          <a href="#" className="pill active">Live</a>
          <a href="#" className="pill">History</a>
          <a href="#" className="pill">Zones</a>
          <a href="#" className="pill">Settings</a>
        </nav>
        <div className="header-right">
          <div className="chip mono">BED 07 / ID {DEVICE_ID.toUpperCase()}</div>
          <div className="sticker tilt-left">{status}</div>
        </div>
      </header>

      <main className="main">
        <div className="row">
          <section className="card grow3">
            <h2>LIVE HEATMAP</h2>
            <Heatmap frame={frame} posture={posture} />
          </section>
          <section className="card card-teal grow2">
            <h2>ZONE TIMERS</h2>
            <ZoneTimers zones={zones} />
          </section>
        </div>
        <div className="row">
          <AlertCard alerts={alerts} onAck={ack} />
          <section className="card grow2">
            <h2>LAST 8 HOURS</h2>
            <Timeline deviceId={DEVICE_ID} />
          </section>
        </div>
      </main>
    </div>
  );
}
```

`src/components/Heatmap.jsx`

```jsx
import React from 'react';

// Thresholds on the 0..255 byte value. PLACEHOLDER: tune after calibration.
const LEVELS = [20, 80, 170];
const COLORS = ['var(--cream)', 'var(--teal)', 'var(--green)', 'var(--plum)'];

function level(v) {
  if (v < LEVELS[0]) return 0;
  if (v < LEVELS[1]) return 1;
  if (v < LEVELS[2]) return 2;
  return 3;
}

export default function Heatmap({ frame, posture }) {
  const n = frame ? frame.n : 8;
  const cells = frame ? frame.cells : new Array(n * n).fill(0);
  return (
    <div className="heat-wrap">
      <div className="heat-grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {cells.map((v, i) => (
          <div key={i} className="heat-cell" style={{ background: COLORS[level(v)] }} />
        ))}
      </div>
      <div className="heat-side">
        <div className="card-mini teal">
          <div className="mono small">POSITION (AI GUESS)</div>
          <div className="big">{posture ? posture.label.toUpperCase() : 'NO DATA'}</div>
        </div>
        <div className="legend">
          <div className="mono small">PRESSURE</div>
          {['None', 'Light', 'Heavy', 'Hot spot'].map((name, i) => (
            <div key={name} className="legend-row">
              <span className="swatch" style={{ background: COLORS[i] }} />
              {name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

`src/components/ZoneTimers.jsx`

```jsx
import React from 'react';

function barColor(pct) {
  if (pct < 0.5) return 'var(--teal)';
  if (pct < 0.8) return 'var(--green)';
  return 'var(--plum)';
}

function fmt(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function ZoneTimers({ zones }) {
  if (!zones) return <p>Waiting for data...</p>;
  const side = Math.round(Math.sqrt(zones.exposure_s.length));
  return (
    <div className="zone-list">
      {zones.exposure_s.map((sec, i) => {
        const pct = Math.min(1, sec / zones.limit_s);
        const label = `${'ABCDEFGH'[Math.floor(i / side)]}${(i % side) + 1}`;
        return (
          <div key={i} className="zone-row">
            <div className="zone-head mono">
              <span>{label}</span>
              <span>{fmt(sec)}</span>
            </div>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${pct * 100}%`, background: barColor(pct) }} />
            </div>
            {pct >= 0.8 && <div className="tag mono">NEAR ITS LIMIT</div>}
          </div>
        );
      })}
      <p className="small">Bars show time as a share of the limit. Limits are set with clinical staff.</p>
    </div>
  );
}
```

`src/components/AlertCard.jsx`

```jsx
import React, { useState } from 'react';

export default function AlertCard({ alerts, onAck }) {
  const [snoozeUntil, setSnoozeUntil] = useState(0);
  if (alerts.length === 0 || Date.now() < snoozeUntil) return null;
  const a = alerts[0];
  const label = `${'ABCDEFGH'[a.zone[0]]}${a.zone[1] + 1}`;
  return (
    <section className="card card-green grow1 tilt-left-small">
      <div className="alert-title">FLIP TIME.</div>
      <p>
        Zone {label} has carried weight for {a.exposure_s} s. Turn the patient and confirm below.
      </p>
      <div className="btn-row">
        <button className="btn primary" onClick={onAck}>Done, turned</button>
        <button className="btn secondary" onClick={() => setSnoozeUntil(Date.now() + 5 * 60 * 1000)}>
          Snooze 5 min
        </button>
      </div>
    </section>
  );
}
```

`src/components/Timeline.jsx`

```jsx
import React, { useEffect, useState } from 'react';
import { API_URL } from '../useLive.js';

const COLORS = { supine: ['var(--teal)', 'var(--plum)'], left: ['var(--green)', 'var(--cream)'], right: ['var(--plum)', 'var(--cream)'], empty: ['var(--cream)', 'var(--plum)'] };

export default function Timeline({ deviceId }) {
  const [segments, setSegments] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/devices/${deviceId}/postures?hours=8`);
        const events = await res.json();
        const segs = [];
        for (let i = 0; i < events.length; i++) {
          const start = new Date(events[i].ts).getTime();
          const end = i + 1 < events.length ? new Date(events[i + 1].ts).getTime() : Date.now();
          const last = segs[segs.length - 1];
          if (last && last.label === events[i].label) last.dur += end - start;
          else segs.push({ label: events[i].label, dur: end - start });
        }
        if (!cancelled) setSegments(segs);
      } catch (e) {
        /* offline: keep the old segments */
      }
    };
    load();
    const t = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(t); };
  }, [deviceId]);

  if (segments.length === 0) return <p>No position data yet.</p>;
  return (
    <>
      <div className="track">
        {segments.map((s, i) => {
          const [bg, fg] = COLORS[s.label] || COLORS.empty;
          return (
            <div key={i} className="track-seg mono" style={{ flex: `${s.dur} 1 0`, background: bg, color: fg }}>
              {s.label.toUpperCase()}
            </div>
          );
        })}
      </div>
      <div className="track-ticks mono small"><span>8 H AGO</span><span>4 H AGO</span><span>NOW</span></div>
    </>
  );
}
```

`src/styles.css`

```css
:root {
  --cream: #F7F3E3;
  --teal: #58A4B0;
  --green: #004643;
  --plum: #210124;
  --font: 'Space Grotesk', system-ui, sans-serif;
  --mono: 'Space Mono', ui-monospace, monospace;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--cream); color: var(--plum); font-family: var(--font); font-size: 18px; }
h2 { margin: 0 0 16px; font-size: 32px; letter-spacing: -1px; }
a { color: var(--plum); text-decoration: none; }
.mono { font-family: var(--mono); font-weight: 700; text-transform: uppercase; }
.small { font-size: 14px; }

.ticker { background: var(--plum); color: var(--cream); padding: 14px 40px; white-space: nowrap; overflow: hidden; font-family: var(--mono); font-weight: 700; font-size: 15px; }
.header { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 24px; padding: 28px 40px; }
.logo { font-size: 64px; font-weight: 700; letter-spacing: -3px; line-height: 1; }
.logo span { color: var(--green); }
.nav { display: flex; flex-wrap: wrap; gap: 12px; }
.pill { font-weight: 700; border: 3px solid var(--plum); border-radius: 999px; padding: 10px 24px; }
.pill.active { background: var(--teal); box-shadow: 5px 5px 0 var(--plum); }
.header-right { display: flex; align-items: center; gap: 16px; }
.chip { border: 3px solid var(--plum); padding: 10px 16px; font-size: 15px; }
.sticker { background: var(--green); color: var(--cream); border: 3px solid var(--plum); padding: 10px 20px; font-weight: 700; box-shadow: 5px 5px 0 var(--plum); }
.tilt-left { transform: rotate(-3deg); }
.tilt-left-small { transform: rotate(-1deg); }

.main { max-width: 1360px; margin: 0 auto; padding: 0 40px 56px; display: flex; flex-direction: column; gap: 32px; }
.row { display: flex; flex-wrap: wrap; gap: 32px; align-items: stretch; }
.card { border: 4px solid var(--plum); box-shadow: 10px 10px 0 var(--plum); padding: 28px; min-width: 0; }
.card-teal { background: var(--teal); }
.card-green { background: var(--green); color: var(--cream); }
.grow1 { flex: 1 1 360px; }
.grow2 { flex: 2 1 380px; }
.grow3 { flex: 3 1 560px; }

.heat-wrap { display: flex; flex-wrap: wrap; gap: 28px; align-items: flex-start; }
.heat-grid { flex: 0 1 460px; min-width: 260px; background: var(--plum); padding: 10px; display: grid; gap: 6px; }
.heat-cell { aspect-ratio: 1 / 1; }
.heat-side { flex: 1 1 200px; display: flex; flex-direction: column; gap: 20px; }
.card-mini { border: 3px solid var(--plum); padding: 16px; }
.card-mini.teal { background: var(--teal); }
.big { font-size: 34px; font-weight: 700; letter-spacing: -1px; }
.legend { display: flex; flex-direction: column; gap: 10px; }
.legend-row { display: flex; align-items: center; gap: 12px; }
.swatch { width: 28px; height: 28px; border: 3px solid var(--plum); }

.zone-list { display: flex; flex-direction: column; gap: 14px; }
.zone-head { display: flex; justify-content: space-between; font-size: 15px; }
.bar { height: 22px; border: 3px solid var(--plum); background: var(--cream); }
.bar-fill { height: 100%; }
.tag { align-self: flex-start; background: var(--plum); color: var(--cream); font-size: 13px; padding: 4px 10px; display: inline-block; margin-top: 6px; }

.alert-title { font-size: 52px; font-weight: 700; letter-spacing: -2px; line-height: 1; margin-bottom: 12px; }
.btn-row { display: flex; flex-wrap: wrap; gap: 14px; margin-top: 16px; }
.btn { font-family: var(--font); font-size: 18px; font-weight: 700; border: 3px solid var(--plum); border-radius: 999px; padding: 14px 28px; min-height: 48px; cursor: pointer; color: var(--plum); }
.btn.primary { background: var(--teal); box-shadow: 5px 5px 0 var(--plum); }
.btn.secondary { background: var(--cream); }
.btn:active { transform: translate(5px, 5px); box-shadow: none; }

.track { display: flex; height: 84px; border: 3px solid var(--plum); }
.track-seg { display: flex; align-items: center; justify-content: center; border-right: 3px solid var(--plum); font-size: 14px; min-width: 0; }
.track-ticks { display: flex; justify-content: space-between; margin-top: 8px; }

@media (max-width: 700px) {
  .header, .main, .ticker { padding-left: 20px; padding-right: 20px; }
  .logo { font-size: 48px; }
}
```

---

## Appendix D: AI service (`ai/`)

Files: `requirements.txt`, `model.py`, `data.py`, `convert_pmd.py`, `inspect_frame.py`, `prepare.py`, `train.py`, `distill.py`, `serve.py`. Section 9 explains why each step exists. Run order is in section 14.

`requirements.txt`

```
tensorflow>=2.16
numpy
matplotlib
fastapi
uvicorn
```

`model.py`

```python
import tensorflow as tf
from tensorflow.keras import layers


@tf.keras.utils.register_keras_serializable(package="flip")
class PositionEmbedding(layers.Layer):
    """Learned positional embedding over the time axis."""

    def __init__(self, length, dim, **kwargs):
        super().__init__(**kwargs)
        self.length = length
        self.dim = dim

    def build(self, input_shape):
        self.pos = self.add_weight(
            name="pos", shape=(self.length, self.dim), initializer="random_normal", trainable=True
        )

    def call(self, x):
        return x + self.pos

    def get_config(self):
        cfg = super().get_config()
        cfg.update({"length": self.length, "dim": self.dim})
        return cfg


def build_model(t=30, h=8, w=8, num_classes=3, d_model=64, heads=4, ff=128, blocks=2, dropout=0.1):
    """Small transformer encoder over a window of t frames of size h x w. Outputs LOGITS."""
    inp = layers.Input(shape=(t, h, w))
    x = layers.Reshape((t, h * w))(inp)
    x = layers.Dense(d_model)(x)
    x = PositionEmbedding(t, d_model)(x)

    for _ in range(blocks):
        a = layers.LayerNormalization()(x)
        a = layers.MultiHeadAttention(num_heads=heads, key_dim=d_model // heads, dropout=dropout)(a, a)
        x = layers.Add()([x, a])
        f = layers.LayerNormalization()(x)
        f = layers.Dense(ff, activation="gelu")(f)
        f = layers.Dropout(dropout)(f)
        f = layers.Dense(d_model)(f)
        x = layers.Add()([x, f])

    x = layers.LayerNormalization()(x)
    x = layers.GlobalAveragePooling1D()(x)
    x = layers.Dropout(dropout)(x)
    out = layers.Dense(num_classes)(x)          # logits, no softmax
    return tf.keras.Model(inp, out)


def build_baseline(t, h, w, num_classes=3):
    """Baseline with no attention: average over time, then a small MLP. Outputs LOGITS.
    If the transformer cannot beat this, temporal attention is not helping."""
    inp = layers.Input(shape=(t, h, w))
    x = layers.Lambda(lambda z: tf.reduce_mean(z, axis=1))(inp)
    x = layers.Flatten()(x)
    x = layers.Dense(64, activation="relu")(x)
    x = layers.Dropout(0.2)(x)
    out = layers.Dense(num_classes)(x)
    return tf.keras.Model(inp, out)
```

`data.py` (shared helpers; the same `normalise_window` is used in training and in serving)

```python
import numpy as np
import tensorflow as tf

# Our mat (planned): 8 x 8 cells at about 1.2 cm pitch, so about 9.6 cm square.
OUR_CELLS = 8
OUR_PITCH_CM = 1.2
OUR_PATCH_CM = OUR_CELLS * OUR_PITCH_CM


def area_resize(frames, h, w):
    """Area-average a stack of frames (T, H, W) to (T, h, w). Never drop rows or columns."""
    x = tf.convert_to_tensor(frames[..., None], dtype=tf.float32)
    return tf.image.resize(x, (h, w), method="area").numpy()[..., 0]


def center_of_mass(frame):
    """(row, col) centre of pressure of one frame, as floats."""
    total = float(frame.sum())
    if total <= 0:
        return frame.shape[0] / 2.0, frame.shape[1] / 2.0
    rr, cc = np.indices(frame.shape)
    return float((rr * frame).sum() / total), float((cc * frame).sum() / total)


def crop_patch(window, pitch_cm, patch_cm, jitter, rng):
    """Cut the part of a large mat that a small mat would see, then average it to 8 x 8.
    window: (T, H, W) raw frames. pitch_cm: sensor spacing of the dataset mat (look it up).
    The patch is centred on the window's centre of pressure, moved by up to +/- jitter cells to
    imitate placement error. ASSUMPTION: the centre of pressure is close to the sacrum/hips for
    a person lying down. Check this visually with inspect_frame.py."""
    t, h, w = window.shape
    cells = int(round(patch_cm / pitch_cm))
    cells = max(2, min(cells, h, w))
    r, c = center_of_mass(window.mean(axis=0))
    r0 = int(round(r - cells / 2)) + int(rng.integers(-jitter, jitter + 1))
    c0 = int(round(c - cells / 2)) + int(rng.integers(-jitter, jitter + 1))
    r0 = int(np.clip(r0, 0, h - cells))
    c0 = int(np.clip(c0, 0, w - cells))
    return area_resize(window[:, r0:r0 + cells, c0:c0 + cells], OUR_CELLS, OUR_CELLS)


def normalise_window(x, eps=1e-6):
    """Scale a whole window to 0..1 by its own 99th percentile.
    This removes the difference between sensors (0..1000, 0..500, or our 0..255 bytes).
    It must be used in BOTH training and serving. Do not use it on an empty mat
    (it would amplify noise): serving checks for 'empty' first."""
    top = float(np.percentile(x, 99))
    return np.clip(x / max(top, eps), 0.0, 1.0).astype("float32")
```

`convert_pmd.py` (reads the real PmatData files into one `.npz`)

```python
"""Convert the PmatData text files into a single .npz.

Dataset facts (from the dataset page):
  Experiment I : tab-delimited text, one folder per subject, files named by position number 1..17.
                 Each file: rows = frames (about 120, 1 Hz), 2048 columns = a 32 x 64 mat. Range 0..1000.
  Experiment II: one folder per subject, 29 position files. Each file is ONE averaged frame
                 (about 20 frames averaged), 64 rows x 27 columns = a 27 x 64 mat. Range 0..500.
                 Collected on both sponge and air-alternating mattresses.

Position numbers do NOT tell us posture. The mapping is in experiment-info.docx, which you must
read. Run with --write-template, fill in position_map_exp1.json (and _exp2.json), then convert.
Use null for positions that are not supine, left or right.

If a file or folder name differs from what is assumed below (for example the file extension),
adjust the glob patterns. Check the real folder layout first.
"""
import argparse
import json
import re
from pathlib import Path

import numpy as np


def digits(s):
    m = re.search(r"\d+", s)
    return int(m.group()) if m else None


def read_table(path):
    return np.atleast_2d(np.loadtxt(path, delimiter="\t", dtype="float32"))


def load_exp1(root, pmap):
    out = []
    for sdir in sorted(Path(root, "experiment-i").glob("S*")):
        subj = digits(sdir.name)
        for f in sorted(sdir.glob("*.txt")):
            label = pmap.get(str(digits(f.stem)))
            if label is None:
                continue
            data = read_table(f)
            if data.shape[1] != 2048:
                print("skip (expected 2048 columns):", f, data.shape)
                continue
            out.append((data.reshape(-1, 32, 64), label, subj, "exp1"))
    return out


def load_exp2(root, pmap):
    base = Path(root, "experiment-ii")
    out = []
    for f in sorted(base.rglob("*.txt")):
        parts = f.relative_to(base).parts
        label = pmap.get(str(digits(f.stem)))
        if label is None:
            continue
        data = read_table(f)
        if data.shape != (64, 27):
            print("skip (expected 64 rows x 27 columns):", f, data.shape)
            continue
        mattress = parts[1] if len(parts) > 2 else "unknown"   # check how air/sponge are stored
        out.append((data.T[None, :, :], label, digits(parts[0]), f"exp2:{mattress}"))  # (1, 27, 64)
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--root", required=True, help="folder that contains experiment-i and experiment-ii")
    p.add_argument("--out", default="pmd.npz")
    p.add_argument("--map1", default="position_map_exp1.json")
    p.add_argument("--map2", default="position_map_exp2.json")
    p.add_argument("--exp2", action="store_true", help="also convert Experiment II")
    p.add_argument("--write-template", action="store_true")
    a = p.parse_args()

    if a.write_template:
        json.dump({str(i): None for i in range(1, 18)}, open(a.map1, "w"), indent=2)
        json.dump({str(i): None for i in range(1, 30)}, open(a.map2, "w"), indent=2)
        print("wrote templates. Fill them from experiment-info.docx, then run again.")
        return

    recs = load_exp1(a.root, json.load(open(a.map1)))
    if a.exp2:
        recs += load_exp2(a.root, json.load(open(a.map2)))
    if not recs:
        raise SystemExit("no recordings converted: check the maps and folder names")

    arrays = {f"f{i}": r[0] for i, r in enumerate(recs)}
    np.savez_compressed(
        a.out,
        labels=np.array([r[1] for r in recs]),
        subjects=np.array([r[2] for r in recs]),
        src=np.array([r[3] for r in recs]),
        **arrays,
    )
    print(f"saved {len(recs)} recordings to {a.out}")


if __name__ == "__main__":
    main()
```

`inspect_frame.py` (look at the data before trusting any orientation)

```python
"""Save pictures of a few frames so a person can check orientation and the position map.
Check: (1) is the long axis head-to-foot? (2) does Experiment II need the same orientation as
Experiment I? (3) does a 'supine' file really look like a person lying on their back?"""
import argparse
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

p = argparse.ArgumentParser()
p.add_argument("--npz", required=True)
p.add_argument("--count", type=int, default=12)
a = p.parse_args()

d = np.load(a.npz)
n = len(d["labels"])
picks = np.linspace(0, n - 1, min(a.count, n)).astype(int)
fig, axes = plt.subplots(3, 4, figsize=(14, 9))
for ax, i in zip(axes.ravel(), picks):
    f = d[f"f{i}"]
    ax.imshow(f.mean(axis=0), cmap="viridis")
    ax.set_title(f"{d['src'][i]} s{d['subjects'][i]} {d['labels'][i]}", fontsize=9)
    ax.axis("off")
plt.tight_layout()
plt.savefig("inspect.png", dpi=120)
print("saved inspect.png")
```

`prepare.py` (builds the three views of every window)

```python
"""Turn recordings into aligned windows with three views:
   Xs  student view: an 8 x 8 patch the size of our mat (what our mat would see)
   Xf  full view: the whole mat averaged to 8 x 8 (for comparison only)
   Xt  teacher view: the whole mat averaged to 16 x 32 (used only for distillation)
Every view of a window comes from the same frames, so they stay aligned.
Dataset frames are 1 Hz, so a window of T=30 frames is 30 seconds. The server must feed the
model at 1 Hz too (see FRAME_STRIDE in the server)."""
import argparse
import numpy as np
from data import area_resize, crop_patch, normalise_window, OUR_PATCH_CM

p = argparse.ArgumentParser()
p.add_argument("--npz", required=True)
p.add_argument("--out", default="win.npz")
p.add_argument("--labels", default="supine,left,right")
p.add_argument("--t", type=int, default=30)
p.add_argument("--stride", type=int, default=10, help="larger stride = fewer windows = less memory")
p.add_argument("--jitter", type=int, default=1, help="patch placement error in cells")
p.add_argument("--pitch-cm-exp1", type=float, required=True,
               help="sensor spacing of the Experiment I mat in cm: take it from its datasheet")
p.add_argument("--pitch-cm-exp2", type=float, default=None, help="same for Experiment II")
a = p.parse_args()

labels = a.labels.split(",")
rng = np.random.default_rng(0)
d = np.load(a.npz)
Xs, Xf, Xt, Y, S, SRC = [], [], [], [], [], []

for i in range(len(d["labels"])):
    name = str(d["labels"][i])
    if name not in labels:
        continue
    frames = d[f"f{i}"]
    src = str(d["src"][i])
    pitch = a.pitch_cm_exp1 if src.startswith("exp1") else a.pitch_cm_exp2
    if pitch is None:
        print("skip (no pitch given for", src, ")")
        continue

    if len(frames) == 1:                      # Experiment II: one averaged frame -> a static window
        windows = [np.repeat(frames, a.t, axis=0)]
    else:
        windows = [frames[s:s + a.t] for s in range(0, len(frames) - a.t + 1, a.stride)]

    for w in windows:
        Xs.append(normalise_window(crop_patch(w, pitch, OUR_PATCH_CM, a.jitter, rng)))
        Xf.append(normalise_window(area_resize(w, 8, 8)))
        Xt.append(normalise_window(area_resize(w, 16, 32)))
        Y.append(labels.index(name))
        S.append(f"{src.split(':')[0]}-{d['subjects'][i]}")
        SRC.append(src)

np.savez_compressed(a.out, Xs=np.array(Xs), Xf=np.array(Xf), Xt=np.array(Xt),
                    y=np.array(Y), subj=np.array(S), src=np.array(SRC), labels=np.array(labels))
print("windows:", len(Y), "per class:", {labels[k]: int(np.sum(np.array(Y) == k)) for k in range(len(labels))})
```

`train.py` (cross-validation by person)

```python
import argparse
import json
import numpy as np
import tensorflow as tf
from model import build_model, build_baseline


def split_by_person(subj, k, seed=0):
    """Folds that never put the same person in train and validation."""
    people = np.unique(subj)
    np.random.default_rng(seed).shuffle(people)
    groups = np.array_split(people, min(k, len(people)))
    return [(np.where(~np.isin(subj, g))[0], np.where(np.isin(subj, g))[0]) for g in groups]


def augment(x, y):
    x = x * tf.random.uniform([], 0.8, 1.2)                 # random scale
    x = x + tf.random.normal(tf.shape(x), stddev=0.02)      # noise
    return tf.clip_by_value(x, 0.0, 1.0), y


def make_ds(X, Y, train):
    ds = tf.data.Dataset.from_tensor_slices((X, Y))
    if train:
        ds = ds.shuffle(2048).map(augment)
    return ds.batch(32)


def build(arch, shape, num_classes, d_model=64):
    t, h, w = shape
    if arch == "transformer":
        return build_model(t, h, w, num_classes, d_model=d_model)
    return build_baseline(t, h, w, num_classes)


def compile_(m):
    m.compile(optimizer=tf.keras.optimizers.Adam(1e-3),
              loss=tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True),
              metrics=["accuracy"])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="win.npz")
    p.add_argument("--x", default="Xs", choices=["Xs", "Xf", "Xt"])
    p.add_argument("--arch", default="transformer", choices=["transformer", "baseline"])
    p.add_argument("--folds", type=int, default=5)
    p.add_argument("--epochs", type=int, default=40)
    p.add_argument("--out", default="", help="if set, also train on everything and save <out>.keras")
    a = p.parse_args()

    d = np.load(a.input)
    X, Y, S, labels = d[a.x], d["y"], d["subj"], list(d["labels"])
    k = len(labels)
    print("windows:", len(Y), "people:", len(np.unique(S)), "shape:", X.shape[1:])

    accs = []
    for n, (tr, va) in enumerate(split_by_person(S, a.folds)):
        m = build(a.arch, X.shape[1:], k)
        compile_(m)
        m.fit(make_ds(X[tr], Y[tr], True), validation_data=make_ds(X[va], Y[va], False),
              epochs=a.epochs, verbose=0,
              callbacks=[tf.keras.callbacks.EarlyStopping(patience=6, restore_best_weights=True)])
        pred = np.argmax(m.predict(X[va], verbose=0), axis=1)
        acc = float(np.mean(pred == Y[va]))
        accs.append(acc)
        print(f"fold {n}: accuracy {acc:.3f} on {len(np.unique(S[va]))} held-out people")
        print(tf.math.confusion_matrix(Y[va], pred, num_classes=k).numpy())
    print(f"{a.arch} on {a.x}: mean accuracy {np.mean(accs):.3f} (std {np.std(accs):.3f}) over {len(accs)} folds")

    if a.out:
        m = build(a.arch, X.shape[1:], k)
        compile_(m)
        m.fit(make_ds(X, Y, True), epochs=max(10, a.epochs // 2), verbose=0)
        m.save(f"{a.out}.keras")
        json.dump(labels, open("labels.json", "w"))
        json.dump({"t": int(X.shape[1]), "n": int(X.shape[2])}, open("meta.json", "w"))
        print(f"saved {a.out}.keras, labels.json, meta.json")


if __name__ == "__main__":
    main()
```

`distill.py` (teacher on the full map, student on the 8 x 8 patch)

```python
"""Knowledge distillation.
Teacher: transformer that sees the whole mat (16 x 32 view). It knows things our small mat cannot see.
Student: transformer that sees only the 8 x 8 patch, the same input our real mat produces.
The student learns from the true labels AND from the teacher's softened probabilities.
The teacher is trained only on the training people of each fold, so there is no leakage.
Distillation cannot add information that is not in the patch. It can regularise the student.
Always compare against the plain student (train.py --x Xs)."""
import argparse
import json
import numpy as np
import tensorflow as tf
from train import split_by_person, augment, make_ds, build, compile_


def train_teacher(Xt, Y, k, epochs):
    m = build("transformer", Xt.shape[1:], k, d_model=128)
    compile_(m)
    m.fit(make_ds(Xt, Y, True), epochs=epochs, verbose=0)
    return m


def train_student(Xs, Y, tlogits, k, epochs, alpha, temp):
    student = build("transformer", Xs.shape[1:], k)
    opt = tf.keras.optimizers.Adam(1e-3)
    ce = tf.keras.losses.SparseCategoricalCrossentropy(from_logits=True)
    kl = tf.keras.losses.KLDivergence()
    ds = tf.data.Dataset.from_tensor_slices((Xs, Y, tlogits)).shuffle(2048).batch(32)
    for _ in range(epochs):
        for xb, yb, tl in ds:
            xb, _ = augment(xb, yb)
            with tf.GradientTape() as tape:
                sl = student(xb, training=True)
                hard = ce(yb, sl)
                soft = kl(tf.nn.softmax(tl / temp), tf.nn.softmax(sl / temp)) * temp * temp
                loss = alpha * hard + (1.0 - alpha) * soft
            grads = tape.gradient(loss, student.trainable_variables)
            opt.apply_gradients(zip(grads, student.trainable_variables))
    return student


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--input", default="win.npz")
    p.add_argument("--folds", type=int, default=5)
    p.add_argument("--epochs", type=int, default=30)
    p.add_argument("--alpha", type=float, default=0.5, help="weight of the true labels")
    p.add_argument("--temp", type=float, default=3.0)
    p.add_argument("--out", default="", help="if set, train on everything and save <out>.keras")
    a = p.parse_args()

    d = np.load(a.input)
    Xs, Xt, Y, S, labels = d["Xs"], d["Xt"], d["y"], d["subj"], list(d["labels"])
    k = len(labels)

    accs = []
    for n, (tr, va) in enumerate(split_by_person(S, a.folds)):
        teacher = train_teacher(Xt[tr], Y[tr], k, a.epochs)
        t_acc = float(np.mean(np.argmax(teacher.predict(Xt[va], verbose=0), axis=1) == Y[va]))
        tl = teacher.predict(Xt[tr], batch_size=64, verbose=0)
        student = train_student(Xs[tr], Y[tr], tl, k, a.epochs, a.alpha, a.temp)
        s_acc = float(np.mean(np.argmax(student.predict(Xs[va], verbose=0), axis=1) == Y[va]))
        accs.append(s_acc)
        print(f"fold {n}: teacher {t_acc:.3f} | distilled student {s_acc:.3f}")
    print(f"distilled student: mean accuracy {np.mean(accs):.3f} (std {np.std(accs):.3f})")

    if a.out:
        teacher = train_teacher(Xt, Y, k, a.epochs)
        student = train_student(Xs, Y, teacher.predict(Xt, batch_size=64, verbose=0), k, a.epochs, a.alpha, a.temp)
        student.save(f"{a.out}.keras")
        json.dump(labels, open("labels.json", "w"))
        json.dump({"t": int(Xs.shape[1]), "n": int(Xs.shape[2])}, open("meta.json", "w"))
        print(f"saved {a.out}.keras (student), labels.json, meta.json")


if __name__ == "__main__":
    main()
```

`serve.py`

```python
import json
import numpy as np
import tensorflow as tf
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from model import PositionEmbedding
from data import normalise_window

EMPTY_MAX = 0.05   # PLACEHOLDER: if no cell exceeds this (0..1 scale of byte/255), call the mat empty

app = FastAPI()
model = tf.keras.models.load_model("model.keras", custom_objects={"PositionEmbedding": PositionEmbedding})
labels = json.load(open("labels.json"))
meta = json.load(open("meta.json"))


class Req(BaseModel):
    frames: list[list[float]]   # T frames at 1 Hz, each a flat list of N*N values (byte / 255)
    n: int = 8


@app.post("/predict")
def predict(r: Req):
    t, n = meta["t"], meta["n"]
    if r.n != n or len(r.frames) != t or any(len(f) != n * n for f in r.frames):
        raise HTTPException(status_code=422, detail=f"expected {t} frames of {n * n} values")
    x = np.array(r.frames, dtype="float32").reshape(1, t, n, n)
    if float(x.max()) < EMPTY_MAX:                      # rule-based: the dataset has no empty class
        return {"label": "empty", "probs": {"empty": 1.0}}
    logits = model.predict(normalise_window(x), verbose=0)[0]
    probs = tf.nn.softmax(logits).numpy()
    i = int(np.argmax(probs))
    return {"label": labels[i], "probs": {l: float(p) for l, p in zip(labels, probs)}}
```

The same `normalise_window` runs in training (inside `prepare.py`) and here, so the mat's 0 to 255 bytes and the dataset's 0 to 1000 and 0 to 500 values end up on the same 0 to 1 scale. This replaces the earlier note about mismatched scaling.

---

## Appendix E: Infrastructure (`infra/`)

`docker-compose.yml`

```yaml
services:
  mosquitto:
    image: eclipse-mosquitto:2
    ports:
      - "1883:1883"
    volumes:
      - ./mosquitto.conf:/mosquitto/config/mosquitto.conf
  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
volumes:
  mongo-data:
```

`mosquitto.conf`

```
listener 1883
allow_anonymous true
```

This configuration is for local development only. For anything shared, turn off anonymous access, add usernames and passwords, and enable TLS.

---

End of document.
