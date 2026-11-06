# PerfuSense team plan

Status on 2 November 2026. Who does what next, in order, and how we know it is done.
Background for everything here: [PERFUSENSE_GUIDE.md](../PERFUSENSE_GUIDE.md). Rules for the code: [CLAUDE.md](../CLAUDE.md).

> Research prototype. Not a medical device. No patient testing in this project.

## Where we are

| Part | State |
|---|---|
| Mat (10×10, 30 × 30 cm) | Built; bench numbers reported (crosstalk 7.5%, drift 8.2%, repeatability ±5.8%) |
| ESP32 firmware | Rewritten for 10×10 and several bugs fixed; **not yet compiled or flashed** |
| Server | Works with 100-cell frames, device commands, pressure history; **tests not re-run since the last changes** |
| Dashboard | Reworked: Monitor, Beds, Zones, History, Mat; SAMPLE DATA when offline |
| AI posture model | Trained on public data (`docs/AI_TRAINING_REPORT.md`); not connected; not tested on our mat |
| Login / HTTPS | Not started |

## The first two weeks (everyone): make the real chain work once

Goal: a person sits on the real mat and the dashboard shows it live, an alert fires, "Done, turned" clears the buzzer.

1. Hardware: rewire to the 10×10 pin map in `firmware/README.md` and change the SIG capacitor to about 10 nF.
2. Firmware: compile, flash, watch the Serial Monitor.
3. Server: run MongoDB and `npm run test:server` until all tests pass.
4. Together: run the end-to-end check below and write down what happened.

**End-to-end check (record date, setup, result):** empty mat → baseline learned → press one cell → it lights up in the right place → hold 60 s → buzzer and dashboard alert → "Done, turned" → buzzer stops within 1 s of the next frame → tare from the Mat page → readings return to zero.

## Roles

Each role has one owner and a buddy who reviews the work. Pick roles by interest; one person can hold two small roles.

### 1. Hardware and bench testing
- Rewire for 10×10 (10 rows, mux S0–S3, button on GPIO 35 with a 10 kΩ pull-up).
- Swap the SIG capacitor (0.1 µF → about 10 nF) and **re-measure crosstalk**. Compare with the old 7.5%.
- Calibration with known weights (0, 100, 200, 500, 1000 g) on 5 cells: plot byte value against pressure. This turns the placeholder `mmHgPerByte` into a measured number.
- 4–8 hour drift test with a constant load, with and without the foam layer.
- Write each test as: aim, setup (photo), method, raw data file, result, date. Put files in `docs/bench/`.

**Done when:** crosstalk, drift, repeatability and the calibration curve are re-measured on the 10×10 mat with the method written down.

### 2. Firmware
- Install g++ (MinGW or WSL) and run `bash firmware/run_checks.sh` until it passes.
- Compile in Arduino IDE (ESP32 Dev Module) and flash.
- Store the last good baseline in flash (ESP32 `Preferences`), so booting with a patient on the mat does not ruin the baseline.
- Add a "calibration mode" over Serial that prints raw millivolts per cell (for role 1).
- Keep `Processing` free of Arduino calls so the host tests keep working.

**Done when:** host tests pass, the board runs for 8 hours without a reset, and the end-to-end check passes.

### 3. Server
- Run `npm run test:server` with MongoDB; fix anything that fails.
- Use the calibration curve from role 1: replace the single `mmHgPerByte` with a per-cell or fitted curve in `server/lib/settings.ts`.
- Add login (one account per nurse) and run behind HTTPS before anyone outside the team uses it.
- "Did the turn work?": after a turn, check that the loaded zone's pressure really dropped in the next minute, and show it on the Monitor.
- Export a recording (frames at 1 Hz) for the AI role.

**Done when:** all tests pass, every new endpoint has a test, and a nurse login exists.

### 4. Dashboard and user experience
- Run a 15-minute usability test with 3 people (teachers, nursing students): give them tasks ("find the most urgent bed", "log a turn", "reset the sacrum zone"), time them, note where they hesitate.
- Fix the top 3 problems found.
- Add an Arabic version of the labels (the ward users are likely Arabic speakers).
- Add a ward wall view: all beds' heatmaps on one screen.
- Check contrast and keyboard use on every page (status must never be shown by colour alone).

**Done when:** the usability notes and fixes are written down in `docs/ux/`.

### 5. AI and data
- Done: PmatData, PoPu and BodyPressureSD converted to 10×10 windows; baseline, last-frames and Transformer compared, split **by person** (`ai/`, `docs/AI_TRAINING_REPORT.md`).
- Record our own mat: each team member lies supine / left / right, 3 minutes each, labelled. This is the only data that can be called "our mat's accuracy".
- The FastAPI service exists (`ai/serve.py`). Still to do: the server sends the last 30 frames at 1 Hz.

**Done when:** a table of accuracy per held-out person, baseline vs Transformer, on public data and on our own recordings.

### 6. Presentation and documentation
- Fix the deck: 25 zones (not 16), one multiplexer and HTTP (not two muxes and MQTT), one cost figure everywhere (about 1,000 EGP / $20), 10×10 / 100 cells everywhere.
- Every number on the poster gets a source or a method (bench test file).
- Keep `PERFUSENSE_GUIDE.md` up to date when a result changes.
- Prepare the judge Q&A (guide section 15) and practise the 2-minute pitch.

**Done when:** a teammate who did not write the deck finds no number without a source.

## Improvements to the overall plan

1. **Measure before claiming.** Calibrate first (role 1), then speak in mmHg. Until then say "relative pressure".
2. **One week of end-to-end before new features.** The parts have been tested separately; the full chain on real hardware has not run yet.
3. **Close the loop.** Checking that a turn really relieved the zone is cheap now (the server stores pressure history) and is a stronger story than the AI.
4. **Keep the AI honest and small.** Baseline first; the Transformer only if it beats the baseline on people it never saw.
5. **Write the method for every number** (load, trials, time, temperature, cells) so the results can be defended.
6. **One source of truth.** The guide holds the facts; the deck and poster copy from it.
7. **Ethics before volunteers.** Phantom tests first; healthy volunteers only with written approval.

## How we work

- Small pull requests with a short description; the role buddy reviews.
- Every change that touches the frame format updates both `firmware/` and `server/` in the same pull request.
- Weekly 20-minute check-in: what was done, what is blocked, next step.
