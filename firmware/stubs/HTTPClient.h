#pragma once
#include "Arduino.h"
class HTTPClient { public: bool begin(const char*); bool begin(String); void addHeader(const char*, const char*);
  int POST(uint8_t*, size_t); int GET(); String getString(); void end(); void setReuse(bool);
  void setTimeout(uint16_t); void setConnectTimeout(int32_t); };
