// Scanner.cpp - the ONLY file that touches the mat's pins.
//
// How one cell is read:
//   1. One row pin is driven to 3.3 V (all other rows are left floating = "high impedance").
//   2. The multiplexer connects ONE column to the ADC pin.
//   3. Current flows: row -> pressure-sensitive sheet at that crossing -> column -> 10 kOhm
//      resistor to GND. The sheet and the resistor form a voltage divider.
//   4. More pressure = lower sheet resistance = higher voltage on the ADC pin.
#include <Arduino.h>
#include "config.h"
#include "Scanner.h"

void scannerBegin() {
  for (uint8_t i = 0; i < MUX_SELECT_LINES; i++) pinMode(MUX_S[i], OUTPUT);
  for (uint8_t r = 0; r < MAT_N; r++) pinMode(ROW_PINS[r], INPUT);  // floating until scanned
  analogReadResolution(12);                  // 0..4095
  analogSetPinAttenuation(ADC_PIN, ADC_11db);  // measure up to about 3.1 V
}

static inline void selectColumn(uint8_t c) {
  for (uint8_t i = 0; i < MUX_SELECT_LINES; i++) digitalWrite(MUX_S[i], (c >> i) & 1);
}

void scannerReadFrame(uint16_t* mv) {
  for (uint8_t r = 0; r < MAT_N; r++) {
    pinMode(ROW_PINS[r], OUTPUT);
    digitalWrite(ROW_PINS[r], HIGH);          // power this row only
    delayMicroseconds(ROW_SETTLE_US);
    for (uint8_t c = 0; c < MAT_N; c++) {
      selectColumn(c);
      delayMicroseconds(SETTLE_US);           // let the signal settle after switching
      uint32_t sum = 0;
      for (uint8_t s = 0; s < SAMPLES; s++) sum += analogReadMilliVolts(ADC_PIN);
      mv[r * MAT_N + c] = (uint16_t)(sum / SAMPLES);   // average of several readings = less noise
    }
    pinMode(ROW_PINS[r], INPUT);              // un-power the row again
  }
}
