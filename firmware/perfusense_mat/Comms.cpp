// Comms.cpp - sending and receiving.
//
// WHY A SEPARATE TASK: an HTTP request can take a second or more if the server is slow or off.
// If the main loop did it, the alarm would stop blinking and the scan would pause while it
// waited. So the network work runs in its own FreeRTOS task (on the other CPU core) and the
// main loop only hands over the newest frame and picks up commands.
#include <Arduino.h>
#include <HTTPClient.h>
#include <atomic>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/semphr.h"
#include "config.h"
#include "Comms.h"
#include "Connection.h"

static uint8_t frameBuf[MAT_CELLS];
static bool frameFresh = false;
static SemaphoreHandle_t lock;          // protects frameBuf and frameFresh
// Set by the network task, taken by the main loop. Atomic so a command that arrives while the
// main loop is taking the previous one is never lost.
static std::atomic<bool> ackFlag(false);
static std::atomic<bool> tareFlag(false);
static CommsStats stats = {0, 0, 0};

static void netTask(void*) {
  char url[160];
  snprintf(url, sizeof(url), "%s/api/telemetry/%s/frame", SERVER_URL, BED_ID);
  HTTPClient http;
  http.setReuse(true);                              // keep the connection open between frames
  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  uint32_t pauseUntil = 0;
  int lastReportedCode = 1;

  for (;;) {
    vTaskDelay(pdMS_TO_TICKS(50));
    if (!wifiIsConnected() || (int32_t)(millis() - pauseUntil) < 0) continue;

    // Take the newest frame, if there is one we have not sent yet.
    uint8_t local[MAT_CELLS];
    bool have = false;
    if (xSemaphoreTake(lock, pdMS_TO_TICKS(20)) == pdTRUE) {
      if (frameFresh) {
        memcpy(local, frameBuf, MAT_CELLS);
        frameFresh = false;
        have = true;
      }
      xSemaphoreGive(lock);
    }
    if (!have) continue;

    // SEND
    int code = -1;
    if (http.begin(url)) {
      http.addHeader("Content-Type", "application/octet-stream");
      http.addHeader("x-device-key", DEVICE_KEY);
      code = http.POST(local, MAT_CELLS);
    }

    if (code == 202) {
      // RECEIVE: the reply may contain commands for us.
      String body = http.getString();
      bool ack, tare;
      parseServerCommands(body.c_str(), &ack, &tare);
      if (ack) ackFlag = true;
      if (tare) tareFlag = true;
      stats.sent++;
      connectionReportServer(true);
    } else {
      stats.failed++;
      connectionReportServer(false);
      pauseUntil = millis() + RETRY_BACKOFF_MS;     // do not hammer a server that is down
      if (code != lastReportedCode) {               // say why, once per change
        if (code == 401) Serial.println("Server refused the device key (check DEVICE_KEY).");
        else if (code == 404) Serial.println("Server does not know this BED_ID.");
        else if (code == 422) Serial.println("Server refused the frame (MAT_N in config.h must match the mat size on the server).");
        else if (code < 0) Serial.println("Cannot reach the server (check SERVER_URL and that it is running).");
        else Serial.printf("Server replied with HTTP %d\n", code);
      }
    }
    lastReportedCode = code;
    stats.lastCode = code;
    http.end();
  }
}

void commsBegin() {
  lock = xSemaphoreCreateMutex();
  xTaskCreatePinnedToCore(netTask, "net", 8192, nullptr, 1, nullptr, 0);
}

void commsPublishFrame(const uint8_t* bytes) {
  if (xSemaphoreTake(lock, pdMS_TO_TICKS(20)) == pdTRUE) {
    memcpy(frameBuf, bytes, MAT_CELLS);
    frameFresh = true;
    xSemaphoreGive(lock);
  }
}

bool commsTakeAck() { return ackFlag.exchange(false); }

bool commsTakeTare() { return tareFlag.exchange(false); }

CommsStats commsStats() { return stats; }
