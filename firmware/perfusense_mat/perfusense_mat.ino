// ============================================================================
//  Perfusense mat - ESP32 firmware (main file)
//
//  This file only connects the pieces. Each piece has its own tab:
//    config.h       all settings and pins
//    Scanner        reads the 8x8 mat
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
static uint32_t lastAckPressMs = 0;

// Learn the empty-mat baseline. The mat MUST be empty while this runs (about 1 second).
static void learnBaseline() {
  proc.baselineBegin();
  for (uint8_t i = 0; i < BASELINE_FRAMES; i++) {
    scannerReadFrame(mv);
    proc.baselineAdd(mv);
    delay(10);
  }
  proc.baselineEnd();
}

// Blink the LED and buzzer once per second while any zone is over its limit.
// This works with no Wi-Fi and no server: it only needs the scan.
static void driveAlarm() {
  const bool on = proc.alarmActive() && ((millis() / 500) % 2 == 0);
  digitalWrite(LED_PIN, on);
  digitalWrite(BUZZER_PIN, on);
}

// The caregiver turned the patient and pressed the button.
static void handleButton() {
  if (digitalRead(ACK_PIN) == LOW && millis() - lastAckPressMs > 300) {
    lastAckPressMs = millis();
    proc.acknowledge();
    Serial.println("Button: alarms cleared");
  }
}

void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nPerfusense mat starting");

  pinMode(BUZZER_PIN, OUTPUT);
  pinMode(LED_PIN, OUTPUT);
  pinMode(ACK_PIN, INPUT_PULLUP);
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
  lastFrameMs = millis();
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
  const uint16_t newAlerts = proc.takeNewAlerts();
  if (newAlerts) {
    Serial.printf("ALERT: zone mask 0x%04X reached the time limit\n", newAlerts);
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
        Serial.print((int)proc.cellSignal(r * MAT_N + c));
        Serial.print(c < MAT_N - 1 ? "," : "\n");
      }
    }
    Serial.println("---");
  }
#endif
}
