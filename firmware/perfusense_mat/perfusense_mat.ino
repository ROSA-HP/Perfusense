// ============================================================================
//  Perfusense mat - ESP32 firmware (main file)
//
//  This file only connects the pieces. Each piece has its own tab:
//    config.h       all settings and pins
//    Scanner        reads the 10x10 mat
//    Processing     baseline, smoothing, zones, pressure x time, alarm  (what the ESP32 DOES)
//    Connection     Wi-Fi and server reachability                        (the LINK)
//    Comms          sending frames, receiving commands                   (the CONVERSATION)
//
//  Needs: Arduino IDE with the ESP32 board package. No extra libraries.
//  Board: "ESP32 Dev Module" (ESP32-WROOM-32).
// ============================================================================
#include "config.h"
#include "Scanner.h"
#include "Processing.h"
#include "Connection.h"
#include "Comms.h"

static Processing proc;
static uint16_t mv[MAT_CELLS];       // raw millivolts of the latest scan
static uint8_t  frame[MAT_CELLS];    // what we send to the server
static uint32_t lastFrameMs = 0;

// Learn the empty-mat baseline. The mat MUST be empty while this runs (about 1 second).
static void learnBaseline() {
  proc.baselineBegin();
  for (uint8_t i = 0; i < BASELINE_FRAMES; i++) {
    scannerReadFrame(mv);
    proc.baselineAdd(mv);
    delay(10);
  }
  proc.baselineEnd();
  // The time spent learning is not load time: start the next scan interval from now,
  // otherwise the next update() would add these seconds to every loaded zone.
  lastFrameMs = millis();
}

// Blink the LED and buzzer once per second while any zone is over its limit.
// This works with no Wi-Fi and no server: it only needs the scan.
static void driveAlarm() {
  const bool on = proc.alarmActive() && ((millis() / 500) % 2 == 0);
  digitalWrite(LED_PIN, on);
  digitalWrite(BUZZER_PIN, on);
}

// The caregiver turned the patient and pressed the button.
// Acts once per press: the button must read "pressed" for BUTTON_DEBOUNCE_MS (contact bounce
// is ignored), and holding it down does not keep clearing alarms.
static void handleButton() {
  static bool stablePressed = false;
  static bool lastRaw = false;
  static uint32_t changedMs = 0;
  const bool raw = (digitalRead(ACK_PIN) == LOW);
  const uint32_t now = millis();
  if (raw != lastRaw) {
    lastRaw = raw;
    changedMs = now;
  }
  if (raw != stablePressed && now - changedMs >= BUTTON_DEBOUNCE_MS) {
    stablePressed = raw;
    if (stablePressed) {
      proc.acknowledge();
      Serial.println("Button: alarms cleared");
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nPerfusense mat starting");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(ACK_PIN, ACK_INTERNAL_PULLUP ? INPUT_PULLUP : INPUT);  // GPIO 35: external pull-up
  scannerBegin();

  connectionBegin();
  if (connectionWaitForWifi(WIFI_WAIT_AT_START_MS)) {
    Serial.println(connectionPingServer() ? "Server reachable." : "Server NOT reachable yet (will keep trying).");
  } else {
    Serial.println("No Wi-Fi yet. Working offline; will keep trying.");
  }
  commsBegin();

  Serial.println("Keep the mat EMPTY: learning baseline...");
  delay(2000);
  learnBaseline();
  Serial.println("Baseline done. Running.");
}

void loop() {
  connectionLoop();
  handleButton();

  // Commands that arrived from the server (the web app).
  if (commsTakeAck()) {
    proc.acknowledge();
    Serial.println("Server: turn confirmed, alarms cleared");
  }
  if (commsTakeTare()) {
    Serial.println("Server: tare requested, learning baseline (mat must be empty)");
    learnBaseline();
  }

  driveAlarm();

  const uint32_t now = millis();
  if (now - lastFrameMs < FRAME_PERIOD_MS) return;
  const float dtS = (now - lastFrameMs) / 1000.0f;
  lastFrameMs = now;

  scannerReadFrame(mv);             // 1. read the mat
  proc.update(mv, dtS);             // 2. process it
  const uint32_t newAlerts = proc.takeNewAlerts();
  if (newAlerts) {
    for (uint8_t z = 0; z < ZONES; z++) {
      if (newAlerts & ((uint32_t)1u << z)) {
        Serial.printf("ALERT: zone %u (row %u, col %u) reached the time limit\n",
                      (unsigned)z, (unsigned)(z / ZONES_PER_SIDE), (unsigned)(z % ZONES_PER_SIDE));
      }
    }
  }
  proc.frameBytes(frame);           // 3. hand it to the network task
  commsPublishFrame(frame);

#if DEBUG_DUMP
  static uint8_t tick = 0;
  if (++tick % 4 == 0) {            // every 2 seconds
    const CommsStats s = commsStats();
    Serial.printf("wifi:%s server:%s sent:%u failed:%u code:%d rssi:%d\n",
                  wifiIsConnected() ? "ok" : "off", serverIsOk() ? "ok" : "off",
                  (unsigned)s.sent, (unsigned)s.failed, s.lastCode, wifiSignalDbm());
    for (uint8_t r = 0; r < MAT_N; r++) {
      for (uint8_t c = 0; c < MAT_N; c++) {
        Serial.print((int)proc.cellSignal((uint16_t)r * MAT_N + c));
        Serial.print(c < MAT_N - 1 ? "," : "\n");
      }
    }
    Serial.println("---");
  }
#endif
}
