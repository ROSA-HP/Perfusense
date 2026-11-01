// Processing.h - what the ESP32 DOES with the readings.
// This file has no Arduino calls, so the same code can be unit-tested on a normal computer.
#pragma once
#include <stdint.h>
#include "config.h"

class Processing {
 public:
  Processing();

  // --- learning the "empty mat" level (the baseline) ---
  void baselineBegin();
  void baselineAdd(const uint16_t* mv);     // call once per scan of the EMPTY mat
  void baselineEnd();

  // --- one scan -> everything else ---
  // mv = raw millivolts for every cell, dtS = seconds since the previous scan.
  void update(const uint16_t* mv, float dtS);

  // --- alarm ---
  bool     alarmActive() const;             // true while any zone is over its time limit
  uint32_t takeNewAlerts();                 // bit mask of zones (bit z = zone z) that just raised an alert (0 = none)
  void     acknowledge();                   // patient was turned: clear every alarm and timer

  // --- what to send to the server ---
  void frameBytes(uint8_t* out) const;      // MAT_CELLS bytes, 0..255

  // --- read-only views (for display and tests) ---
  float cellSignal(uint16_t i) const { return filt_[i]; }
  float zoneSignal(uint8_t z) const { return zone_[z]; }
  float exposure(uint8_t z) const   { return exposure_[z]; }
  bool  zoneAlerted(uint8_t z) const { return alerted_[z]; }
  uint16_t baseline(uint16_t i) const { return base_[i]; }

 private:
  uint16_t base_[MAT_CELLS];      // empty-mat level per cell
  uint32_t baseSum_[MAT_CELLS];   // running sum while learning the baseline
  uint16_t baseCount_;
  float    filt_[MAT_CELLS];      // smoothed signal above baseline
  float    zone_[ZONES];          // mean signal of each 2x2 zone
  float    exposure_[ZONES];      // seconds each zone has been loaded
  bool     alerted_[ZONES];
  uint32_t newAlerts_;
  float    emptyForS_;
};
