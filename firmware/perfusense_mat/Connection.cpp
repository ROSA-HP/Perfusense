// Connection.cpp - Wi-Fi and server reachability. Nothing here ever blocks the alarm for long.
#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include "config.h"
#include "Connection.h"

static uint32_t lastTryMs = 0;
static bool wasConnected = false;
static volatile bool serverOk = false;

static void startWifi() {
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastTryMs = millis();
}

void connectionBegin() {
  WiFi.mode(WIFI_STA);
  WiFi.persistent(false);          // do not wear out flash by saving the password every time
  WiFi.setAutoReconnect(true);
  startWifi();
}

void connectionLoop() {
  const bool now = (WiFi.status() == WL_CONNECTED);
  if (now && !wasConnected) {
    Serial.print("Wi-Fi connected, IP ");
    Serial.println(WiFi.localIP());
  } else if (!now && wasConnected) {
    Serial.println("Wi-Fi lost. The scan and the local alarm keep working.");
    serverOk = false;
  }
  wasConnected = now;
  // Still not connected after a while: restart the connection attempt.
  if (!now && millis() - lastTryMs > WIFI_RETRY_MS) {
    Serial.println("Retrying Wi-Fi...");
    startWifi();
  }
}

bool connectionWaitForWifi(uint32_t ms) {
  const uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < ms) delay(100);
  connectionLoop();
  return WiFi.status() == WL_CONNECTED;
}

bool connectionPingServer() {
  if (WiFi.status() != WL_CONNECTED) return false;
  HTTPClient http;
  http.setConnectTimeout(HTTP_CONNECT_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  if (!http.begin(String(SERVER_URL) + "/api/health")) return false;
  const int code = http.GET();
  http.end();
  serverOk = (code == 200);
  return serverOk;
}

bool wifiIsConnected() { return WiFi.status() == WL_CONNECTED; }
bool serverIsOk() { return serverOk && wifiIsConnected(); }
void connectionReportServer(bool ok) { serverOk = ok; }
int wifiSignalDbm() { return WiFi.RSSI(); }
