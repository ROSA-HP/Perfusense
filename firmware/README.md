# Perfusense mat: ESP32 firmware (10 x 10)

Open `perfusense_mat/perfusense_mat.ino` in the Arduino IDE (all the other files open as tabs).
Board: **ESP32 Dev Module** (use an ESP32-WROOM-32, not WROVER). No extra libraries needed.

## Set up
1. Edit **`config.h`**: `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL` (the LAN IP of the computer running the server), `BED_ID` (must exist in the database, the demo has `bed-07`) and `DEVICE_KEY` (must equal `DEVICE_KEY` in the server's `.env`).
2. Wire it as below (also in `config.h`).
3. Start the server (`npm run server`), upload the sketch, open the Serial Monitor at 115200.
4. **Keep the mat empty** while it says "learning baseline".

## Wiring (10 x 10, not yet tested on a board)

| Function | GPIO |
|---|---|
| Rows R0-R9 | 13, 16, 17, 18, 19, 21, 22, 23, 4, 14 |
| Mux S0, S1, S2, S3 | 25, 26, 27, 32 |
| Mux EN | GND |
| Mux C0-C9 | columns 0-9 (C10-C15 unused) |
| Mux SIG | 34, plus 10 kΩ to GND and a capacitor to GND (see below) |
| Buzzer | 33 |
| LED | 2 (on-board LED on most DevKitC boards) |
| Button to GND | 35, **plus an external 10 kΩ pull-up to 3.3 V** (GPIO 35 has no internal pull-up) |

**Capacitor on SIG:** 10 kΩ with 0.1 µF is an RC time of 1 ms, but the scan waits only 80 µs (`SETTLE_US`) after switching columns. Most of the previous cell's voltage is then still on the capacitor, which shows up as crosstalk along each row. Use about 10 nF (RC 0.1 ms), or raise `SETTLE_US`, and re-measure crosstalk.

The server refuses frames whose size differs from its mat (100 cells). If the Serial Monitor says "Server refused the frame", `MAT_N` does not match.

## The tabs
| Tab | Job |
|---|---|
| `config.h` | every setting and pin |
| `Scanner` | reads the 10x10 mat |
| `Processing` | baseline, smoothing, 25 zones (2x2 cells), pressure x time, alarm, drift correction |
| `Connection` | Wi-Fi and server reachability |
| `Comms` | sends frames, receives commands (runs in its own task) |
| `perfusense_mat.ino` | connects the pieces |

## Checks on a computer (no ESP32)
`./run_checks.sh` (needs g++) runs the logic tests and type-checks every file against stand-in Arduino headers. This does not replace testing on the board.

## Notes
- All thresholds in `config.h` are placeholders until you calibrate the mat. The exposure limit is 60 s for bench tests only; a real limit must be set with clinical staff.
- Keep `ZONE_LOAD_MV` and the server's `loadedMmHg` consistent (300 mV is about 20 mmHg with the server's default scale).
- Research prototype. Not a medical device.
