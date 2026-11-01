// Minimal stand-ins for the ESP32 Arduino core, ONLY to type-check the sketch on a computer.
#pragma once
#include <stdint.h>
#include <stddef.h>
#include <stdio.h>
#include <string.h>
#include <stdarg.h>
#include <string>
#define INPUT 0
#define OUTPUT 1
#define INPUT_PULLUP 2
#define HIGH 1
#define LOW 0
#define ADC_11db 3
void pinMode(uint8_t, uint8_t); void digitalWrite(uint8_t, uint8_t); int digitalRead(uint8_t);
void analogReadResolution(uint8_t); void analogSetPinAttenuation(uint8_t, int);
uint32_t analogReadMilliVolts(uint8_t);
void delay(uint32_t); void delayMicroseconds(uint32_t); uint32_t millis();
class String { public: String(const char* s = ""): s_(s) {} String operator+(const char* o) const { return String((s_ + o).c_str()); }
  const char* c_str() const { return s_.c_str(); } std::string s_; };
struct IPAddress {};
class HardwareSerial { public: void begin(unsigned long); size_t print(const char*); size_t print(int); size_t print(const IPAddress&);
  size_t println(const char* = ""); size_t println(int); size_t println(const IPAddress&); int printf(const char*, ...) __attribute__((format(printf, 2, 3))); };
extern HardwareSerial Serial;
// FreeRTOS pieces used by Comms.cpp
typedef void* SemaphoreHandle_t; typedef void* TaskHandle_t; typedef int BaseType_t; typedef void (*TaskFunction_t)(void*);
#define pdTRUE 1
#define portMAX_DELAY 0xffffffffu
#define pdMS_TO_TICKS(x) (x)
SemaphoreHandle_t xSemaphoreCreateMutex(); BaseType_t xSemaphoreTake(SemaphoreHandle_t, uint32_t); BaseType_t xSemaphoreGive(SemaphoreHandle_t);
void vTaskDelay(uint32_t);
BaseType_t xTaskCreatePinnedToCore(TaskFunction_t, const char*, uint32_t, void*, int, TaskHandle_t*, int);
