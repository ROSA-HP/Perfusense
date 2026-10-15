# FLIP / Perfusense — Work Plan

Derived from the PRD: [Perfusense.md](Perfusense.md) (v1.1). This file is the living task list for the software work. It follows the PRD's build order (section 14) and marks what can be done on this machine versus what needs hardware, Python, or Docker.

**Ground rules from PRD section 0 (apply to every task below):**

1. Never invent clinical values — all `PLACEHOLDER` thresholds stay configurable and clearly marked.
2. Never invent data — any number in a UI that is not from a real device is labelled `SAMPLE DATA`.
3. Interfaces (MQTT topics, WebSocket messages, REST routes) are built exactly as written in PRD sections 6–7.
4. Not a medical device — no diagnostic claims anywhere.
5. Assumptions are listed at the top, not silently baked in.
6. Simple, readable code, no unnecessary frameworks.

---

## 1. Assumptions (environment, checked on this machine)

| # | Assumption / constraint | Consequence for the plan |
|---|---|---|
| A1 | This machine runs **Windows with Node v26 and npm 11**; no `python`, no `docker`, no `mosquitto_pub`, and the folder is **not a git repo** yet. | Infra (Phase 1) and AI (Phase 5) need tooling installed first; fake-device testing uses a Node publisher script instead of `mosquitto_pub`. |
| A2 | No ESP32 / mat hardware attached to this machine. | Firmware is written and its pure logic tested through a host-side simulator; flashing and bench tests happen on the team's bench (Phases 4b, 7). |
| A3 | The PmatData dataset must be downloaded from PhysioNet and its licence checked; `experiment-info.docx` and mat pitch (`--pitch-cm-exp1/2`) are required inputs we do not have yet. | AI scripts can be built and unit-tested with synthetic data now; real training (Phase 5b) starts when the dataset + pitch values arrive. |
| A4 | Docker may be installable later; if not, a local Mosquitto + MongoDB install gives the same ports and interfaces. | The plan has a fallback that does **not** change any interface. |
| A5 | Dev-only: no auth/TLS yet, as the PRD allows for development. | Security hardening is explicitly listed before any real use (Phase 7). |

---

## 2. Milestone map (PRD section 12 → software tasks)

| PRD phase | Software work (this repo) | Hardware / off-machine work | Definition of done |
|---|---|---|---|
| 1 Mat + scan code | Firmware scan/baseline code (T4a) | Build mat, crosstalk + calibration measurements | Raw frames arrive; measurements recorded per PRD 10.1 |
| 2 Firmware zones/alarm/MQTT | T4a, T4b simulator tests | Flash ESP32, buzzer/LED/button check | Local alarm + MQTT topics verified with real mat |
| 3 Server + dashboard | T1 infra, T2 server, T3 web, T6 E2E | — | Dashboard works end to end against fake and real devices |
| 4 Drift test | Firmware drift-correction logic tested in T4b | 4–8 h load test, report | Measured drift number with date/setup |
| 5 Posture model | T5 AI scripts + tests | Record own-mat data (experiment E) | Experiments A–D reported fold-by-fold; model served |
| 6 Phantom + ethics | — | Phantom build, ethics submission | Out of software scope |
| 7 Volunteer study | Security hardening tasks in T7 | Only after approval | — |

---

## 3. Build plan (ordered, with acceptance criteria)

### T0 — Repository scaffold
- [ ] `git init`, initial commit of the PRD (ask before committing anything else).
- [ ] Create the exact tree from PRD section 14: `firmware/pressure_mat/`, `server/`, `web/`, `ai/`, `infra/`, plus `tools/` for test helpers and `docs/` for reports.
- [ ] Add a `.gitignore` (node_modules, `.env`, `*.npz`, `*.keras`, `__pycache__`, generated plots).
- **Acceptance:** directory tree matches section 14; PRD and plan tracked in git.

### T1 — Infra (`infra/`)
- [ ] Write `docker-compose.yml` and `mosquitto.conf` exactly as in Appendix E.
- [ ] **Blocked on this machine:** no Docker. Either install Docker Desktop, or install Mosquitto + MongoDB natively on Windows (same ports 1883 / 27017, same config).
- [ ] Fallback for local dev only if neither is possible: an in-repo MQTT broker script (e.g. `aedes` over TCP 1883) and an in-memory Mongo stand-in behind the same model calls — **only** as a dev toggle; the real deployment keeps Appendix E unchanged.
- **Acceptance:** MQTT connect round-trip on `localhost:1883` succeeds; Mongo connects on `27017`; `docker compose up -d` (or native equivalent) is documented in the README run block.

### T2 — Server (`server/`)
- [ ] Write `package.json`, `.env.example`, `server.js` from Appendix B (Node 18+, ESM).
- [ ] `npm install && npm start`; confirm `MongoDB connected`, `MQTT connected`, `Server on http://localhost:4000`.
- [ ] Add `tools/fake_mat.mjs`: publishes the same fake frames/zones/alert as the PRD's `mosquitto_pub` examples (64-byte frame with hot spot at 27/28/35/36, zones JSON with one zone at 48 s, `zone=1,1 exposure_s=61` alert), plus a repeatable live-stream mode for dashboard development. Same topics, same payloads — it replaces the missing `mosquitto_pub` binary, it does not change the contract.
- **Acceptance (PRD 7.2 / 7.3 / 10.3):**
  - `GET /api/health` → `{"ok":true}`.
  - Fake frame → WebSocket `{"type":"frame",...}` with 64 ints.
  - Fake zones → WS `zones` message **and** a `zones` collection document.
  - Fake alert → WS `alert` message **and** an `alerts` document.
  - `POST /api/devices/mat01/ack` → `{"ok":true}`, `ack` text published on `pressuremat/mat01/cmd`, open alerts get `ackedAt`.
  - `GET .../zones`, `.../alerts`, `.../postures` return newest-first / oldest-first as specified.
  - Frames of wrong size are ignored; AI call is skipped when `AI_URL` is empty.

### T3 — Web dashboard (`web/`)
- [ ] Write `package.json`, `vite.config.js`, `index.html`, `src/main.jsx`, `src/App.jsx`, `src/useLive.js`, `src/styles.css`, and the four components from Appendix C.
- [ ] Add a visible **`SAMPLE DATA`** chip whenever the view is driven by `tools/fake_mat.mjs` (PRD rule 2 — starter code omits it; decide with the team whether the label keys off a `demo` WS/REST flag so it disappears automatically on real data).
- [ ] `npm run dev`, preview it against the running server + fake publisher.
- **Acceptance (PRD 8):** heatmap renders 4 pressure levels with legend; AI-guess card shows `posture` label or `NO DATA`; zone bars colour at 50 % / 80 % with `NEAR ITS LIMIT`; alert card appears on alert, `Done, turned` acks, `Snooze 5 min` hides it locally for 5 min; timeline renders the last 8 h from `GET .../postures`; layout wraps cleanly to phone width (one column, ≥44 px targets, text labels never colour-only).

### T4 — Firmware (`firmware/pressure_mat/pressure_mat.ino`)
- **T4a (code):** write Appendix A verbatim — config block, baseline capture, scan, EMA + dead-band, 16-zone exposure, local alarm, MQTT publish/subscribe, empty-mat drift correction, non-blocking network maintenance.
- **T4b (test without hardware):**
  - [ ] Port the pure logic (baseline → dead-band → EMA → zone exposure → alert → ack → drift) into a host-side test harness with hard-coded simulated frames (PRD 10.3), asserting: exposure accrues above `ZONE_LOAD_MV`, alert fires exactly once at `EXPOSURE_LIMIT_S`, recovery decays at `RECOVERY_FACTOR`, ack zeroes alerted zones, baseline creeps only after 60 s empty.
  - [ ] If `arduino-cli` can be installed, compile the `.ino` for `esp32:esp32:esp32` as a syntax gate; otherwise the harness + careful review is the check.
- **Acceptance:** all simulator assertions pass; frame payload math (`signal * 255 / FULL_SCALE_MV`, clamped 0..255) verified; config constants untouched (all PLACEHOLDERs stay marked).

### T5 — AI service (`ai/`)
- **T5a (now, no dataset):**
  - [ ] Prerequisite: install Python 3.10+ and `pip install -r requirements.txt` (tensorflow, numpy, matplotlib, fastapi, uvicorn).
  - [ ] Write all files from Appendix D verbatim: `requirements.txt`, `model.py`, `data.py`, `convert_pmd.py`, `inspect_frame.py`, `prepare.py`, `train.py`, `distill.py`, `serve.py`, plus `position_map_exp1.json` / `position_map_exp2.json` templates.
  - [ ] Unit tests on synthetic data: window shapes `(T,8,8)` for all three views; `normalise_window` maps a 0..1000 and a 0..255 window identically (same 99th-percentile rule); `crop_patch` respects patch size and jitter bounds; `build_model` / `build_baseline` forward-pass shapes; `/predict` rejects wrong `T`/`n` (422) and returns `empty` below `EMPTY_MAX` without touching the model.
- **T5b (blocked on inputs — PhysioNet download, licence check, `experiment-info.docx`, mat pitch):**
  - [ ] `convert_pmd.py --write-template` → fill position maps from `experiment-info.docx` (never guess) → convert to `pmd.npz`.
  - [ ] `inspect_frame.py` → eyeball orientation (long axis head-to-foot; Exp II transpose) and that "supine" files look like backs.
  - [ ] `prepare.py --pitch-cm-exp1 <cm> [--pitch-cm-exp2 <cm>]` → `win.npz`.
  - [ ] Experiments A–D from PRD 9.6 (`train.py` baseline vs transformer on `Xs`; `Xs` vs `Xf` vs `Xt`; `distill.py` vs plain student; Exp I vs I+II), cross-validated **by person**, reported fold-by-fold with mean ± std.
  - [ ] Train final model (`--out model`), run `uvicorn serve:app --port 8000`, set `AI_URL=http://localhost:8000` in `server/.env`.
- **Acceptance:** unit tests green now; later, every experiment table filled with real measured numbers and `serve.py /predict` returning `{label, probs}` consumed by the server → dashboard posture card and timeline. Experiment E (own-mat recordings) is the only result that may be called "our mat's accuracy".

### T6 — End-to-end integration
- [ ] Full chain: `tools/fake_mat` → broker → server → WS → dashboard, then AI service in the loop (`AI_URL` set) → `posture` WS message → heatmap card + timeline.
- [ ] Fault checks: kill the broker (dashboard shows OFFLINE, reconnects), kill the AI service (server logs the failure, everything else keeps working), wrong-size frame (ignored), two devices (`mat01`, `mat02`) — messages filtered by `deviceId` in the dashboard.
- **Acceptance:** PRD 10.3 software tests all demonstrated; a short smoke-test note recorded in `docs/`.

### T7 — Hardware-facing and hardening work (tracked, off-machine)
- [ ] Bench tests per PRD 10.1 (crosstalk, repeatability, linearity, drift, location, speed) → numbers in `docs/bench-report.md` with date + setup.
- [ ] Phase 4 drift test (4–8 h) and compensation review; phantom stage (10.2).
- [ ] Before any real use: MQTT/WebSocket/HTTP auth + TLS, API authentication, rate limiting, data-retention policy (PRD 11).
- [ ] Final v1 definition of done (PRD 10.4): every section-2 success criterion measured and reported, dashboard end-to-end with the real mat.

---

## 4. Suggested execution order for the next working session

1. **T0** scaffold (5 min).
2. **T2** server code + **T1** broker decision (Docker install vs native Mosquitto/Mongo) — these unblock everything testable here.
3. **T3** dashboard against `tools/fake_mat` live stream, previewed in the panel.
4. **T4** firmware + host simulator.
5. **T5a** AI scripts + synthetic tests (needs Python installed).
6. **T6** end-to-end run.
7. **T5b / T7** whenever the dataset, pitch values, and hardware are available.

## 5. Open decisions for the team

1. Infra on this machine: install Docker, or native Mosquitto + Mongo? (Recommend Docker — matches Appendix E exactly.)
2. `SAMPLE DATA` labelling mechanism (manual toggle vs auto-detected demo mode).
3. PRD section 15 open questions (sensing material, exposure limit, mat placement/zone naming, ethics, power/enclosure, final name) — all still open, none block the software phases above.
4. Whether to `git init` and commit the scaffold now.
