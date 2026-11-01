#pragma once
#include "Arduino.h"
#define WL_CONNECTED 3
#define WIFI_STA 1
class WiFiClass { public: void mode(int); void persistent(bool); void setAutoReconnect(bool); void begin(const char*, const char*);
  void disconnect(); int status(); IPAddress localIP(); int RSSI(); };
extern WiFiClass WiFi;
