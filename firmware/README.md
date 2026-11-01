# Perfusense mat: ESP32 firmware

Open `perfusense_mat/perfusense_mat.ino` in the Arduino IDE (all the other files open as tabs).
Board: **ESP32 Dev Module** (use an ESP32-WROOM-32, not WROVER). No extra libraries needed.

## Set up
1. Edit **`config.h`**: `WIFI_SSID`, `WIFI_PASSWORD`, `SERVER_URL` (the LAN IP of the computer running the server), `BED_ID` (must exist in the database, the demo has `bed-07`) and `DEVICE_KEY` (must equal `DEVICE_KEY` in the server's `.env`).
2. Wire it as in the table in `config.h` (rows on GPIO 13,16,17,18,19,21,22,23; multiplexer S0-S2 on 25,26,27 with S3 to GND; multiplexer SIG to GPIO 34 with 10 kΩ and 0.1 µF to GND; buzzer 32; LED 33; button 14 to GND).
3. Start the server (`npm run server`), upload the sketch, open the Serial Monitor at 115200.
4. **Keep the mat empty** while it says "learning baseline".

## The tabs
| Tab | Job |
|---|---|
| `config.h` | every setting and pin |
| `Scanner` | reads the 8x8 mat |
| `Processing` | baseline, smoothing, zones, pressure x time, alarm, drift correction |
| `Connection` | Wi-Fi and server reachability |
| `Comms` | sends frames, receives commands (runs in its own task) |
| `perfusense_mat.ino` | connects the pieces |

## Checks on a computer (no ESP32)
`./run_checks.sh` runs 41 logic tests and type-checks every file against stand-in Arduino headers. This does not replace testing on the board.

## Notes
- All thresholds in `config.h` are placeholders until you calibrate the mat. The exposure limit is 60 s for bench tests only; a real limit must be set with clinical staff.
- Keep `ZONE_LOAD_MV` and the server's `loadedMmHg` consistent (300 mV is about 20 mmHg with the server's default scale).
- Research prototype. Not a medical device.
