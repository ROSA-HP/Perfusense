// ============================================================================
//  config.h  -  EVERY setting in one place. Edit this file, nothing else.
// ============================================================================
#pragma once
#include <stdint.h>

// ---------------------------------------------------------------- 1. NETWORK
#define WIFI_SSID      "YOUR_WIFI_NAME"
#define WIFI_PASSWORD  "YOUR_WIFI_PASSWORD"
// The computer that runs "npm run server". Use its LAN IP address, not "localhost".
#define SERVER_URL     "http://192.168.1.10:4000"
// Must match a bed id in the Perfusense database (the demo has "bed-07").
#define BED_ID         "bed-07"
// Must match DEVICE_KEY in the server's .env file.
#define DEVICE_KEY     "change-me-device-key"

// ------------------------------------------------------- 2. MAT SHAPE AND PINS
// The server checks that every frame has exactly MAT_CELLS bytes (100 for its 10 x 10 mat).
constexpr uint8_t  MAT_N     = 10;                  // 10 x 10 cells
constexpr uint16_t MAT_CELLS = MAT_N * MAT_N;       // 100
constexpr uint8_t  ZONE_SIZE = 2;                   // a zone is 2 x 2 cells
constexpr uint8_t  ZONES_PER_SIDE = MAT_N / ZONE_SIZE;              // 5
constexpr uint8_t  ZONES     = ZONES_PER_SIDE * ZONES_PER_SIDE;     // 25
static_assert(MAT_N % ZONE_SIZE == 0, "MAT_N must split into whole zones");
static_assert(ZONES <= 32, "zone alerts are reported as a 32-bit mask");
static_assert(MAT_N <= 16, "one CD74HC4067 reads at most 16 columns");

// Pins avoid the ESP32 "strapping" pins 0, 5, 12, 15 and the flash pins (6 to 11).
// Use an ESP32-WROOM-32 board: GPIO 16 and 17 are taken by PSRAM on WROVER boards.
// GPIO 14 pulses briefly at boot (harmless for a row). GPIO 2 is a strapping pin but is safe
// for a small LED to GND (it is the on-board LED on most DevKitC boards).
static const uint8_t ROW_PINS[MAT_N] = {13, 16, 17, 18, 19, 21, 22, 23, 4, 14};  // rows R0..R9, driven directly
constexpr uint8_t MUX_SELECT_LINES   = 4;
static const uint8_t MUX_S[MUX_SELECT_LINES] = {25, 26, 27, 32};          // CD74HC4067 S0..S3 (EN to GND)
constexpr uint8_t ADC_PIN    = 34;   // multiplexer SIG. Input-only pin on ADC1, safe with Wi-Fi on.
constexpr uint8_t BUZZER_PIN = 33;   // active buzzer
constexpr uint8_t LED_PIN    = 2;
// Push button to GND. GPIO 35 is input-only and has NO internal pull-up:
// fit an external 10 kOhm resistor from GPIO 35 to 3.3 V.
constexpr uint8_t ACK_PIN    = 35;
constexpr bool    ACK_INTERNAL_PULLUP = false;  // set true only if ACK_PIN supports INPUT_PULLUP
constexpr uint32_t BUTTON_DEBOUNCE_MS = 50;     // the button must read "pressed" this long

// ----------------------------------------------------------------- 3. SCANNING
// The 10 kOhm pull-down and the 0.1 uF capacitor on SIG form an RC filter of 1 ms.
// SETTLE_US must be several RC times, or part of the previous cell's voltage is still on the
// capacitor (ghosting along the scan). 80 us is only enough with about 10 nF (RC = 0.1 ms).
// Measure crosstalk after any change here (PERFUSENSE_GUIDE.md section 11).
constexpr uint16_t SETTLE_US       = 80;    // wait after choosing a column
constexpr uint16_t ROW_SETTLE_US   = 160;   // wait after powering a row
constexpr uint8_t  SAMPLES         = 8;     // ADC readings averaged per cell
constexpr uint32_t FRAME_PERIOD_MS = 500;   // one full scan every 500 ms = 2 frames per second
constexpr uint8_t  BASELINE_FRAMES = 20;    // scans averaged to learn the "empty mat" level

// ------------------------------------------- 4. SIGNAL AND PRESSURE x TIME LOGIC
// Values are in millivolts above the empty-mat baseline.
constexpr float    ALPHA       = 0.30f;     // smoothing: higher = faster but noisier
constexpr uint16_t DEADBAND_MV = 20;        // ignore anything smaller (noise)

// PLACEHOLDERS: set from your calibration, and the exposure limit with clinical staff.
constexpr float ZONE_LOAD_MV     = 300.0f;  // a zone at or above this counts as "loaded" (about 20 mmHg on the server's default scale)
constexpr float EXPOSURE_LIMIT_S = 60.0f;   // 60 s is for bench tests only
constexpr float RECOVERY_FACTOR  = 2.0f;    // 1 s unloaded removes this many seconds of exposure

constexpr float EMPTY_TOTAL_MV = 200.0f;    // all 25 zones together below this = mat is empty
constexpr float EMPTY_HOLD_S   = 60.0f;     // empty for this long = slowly follow drift

// What the server receives: a byte per cell, 255 = this many millivolts. PLACEHOLDER.
constexpr float FULL_SCALE_MV = 1500.0f;

// ------------------------------------------------------------ 5. COMMUNICATION
constexpr uint32_t WIFI_RETRY_MS         = 8000;   // reconnect attempt interval
constexpr uint32_t WIFI_WAIT_AT_START_MS = 10000;  // how long setup waits for Wi-Fi (it never blocks the alarm after that)
constexpr uint32_t HTTP_CONNECT_TIMEOUT_MS = 1000;
constexpr uint32_t HTTP_TIMEOUT_MS         = 1500;
constexpr uint32_t RETRY_BACKOFF_MS        = 3000; // pause after a failed send

#define DEBUG_DUMP 1   // 1 = print the filtered grid on the Serial Monitor
