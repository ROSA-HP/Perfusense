// Processing.cpp - the logic we designed, step by step.
#include <string.h>
#include "Processing.h"

Processing::Processing() {
  memset(base_, 0, sizeof(base_));
  memset(baseSum_, 0, sizeof(baseSum_));
  memset(filt_, 0, sizeof(filt_));
  memset(zone_, 0, sizeof(zone_));
  memset(exposure_, 0, sizeof(exposure_));
  memset(alerted_, 0, sizeof(alerted_));
  baseCount_ = 0;
  newAlerts_ = 0;
  emptyForS_ = 0;
}

// ---- Step 1: learn what "empty" looks like. Average several scans of the empty mat. ----
void Processing::baselineBegin() {
  memset(baseSum_, 0, sizeof(baseSum_));
  baseCount_ = 0;
}

void Processing::baselineAdd(const uint16_t* mv) {
  for (uint8_t i = 0; i < MAT_CELLS; i++) baseSum_[i] += mv[i];
  baseCount_++;
}

void Processing::baselineEnd() {
  if (baseCount_ == 0) return;                 // nothing was added: keep the old baseline
  for (uint8_t i = 0; i < MAT_CELLS; i++) base_[i] = (uint16_t)(baseSum_[i] / baseCount_);
  memset(filt_, 0, sizeof(filt_));             // start from "no load"
  emptyForS_ = 0;
}

// ---- Steps 2 to 6: run for every scan ----
void Processing::update(const uint16_t* mv, float dtS) {
  // Step 2: signal = reading minus the empty-mat baseline.
  // Step 3: dead-band. Anything below DEADBAND_MV is noise, so it becomes 0.
  // Step 4: smoothing (exponential moving average) so the picture does not flicker.
  for (uint8_t i = 0; i < MAT_CELLS; i++) {
    int d = (int)mv[i] - (int)base_[i];
    if (d < (int)DEADBAND_MV) d = 0;
    filt_[i] = ALPHA * d + (1.0f - ALPHA) * filt_[i];
  }

  float total = 0;
  for (uint8_t zr = 0; zr < ZONES_PER_SIDE; zr++) {
    for (uint8_t zc = 0; zc < ZONES_PER_SIDE; zc++) {
      const uint8_t z = zr * ZONES_PER_SIDE + zc;

      // Step 5: a zone's signal is the average of its 2x2 cells.
      float sum = 0;
      for (uint8_t r = 0; r < ZONE_SIZE; r++)
        for (uint8_t c = 0; c < ZONE_SIZE; c++)
          sum += filt_[(zr * ZONE_SIZE + r) * MAT_N + (zc * ZONE_SIZE + c)];
      zone_[z] = sum / (ZONE_SIZE * ZONE_SIZE);
      total += zone_[z];

      // Step 6: pressure x time. Loaded zones collect exposure seconds; unloaded zones
      // lose them faster than they collect them (so brief relief is not a full reset).
      if (zone_[z] >= ZONE_LOAD_MV) {
        exposure_[z] += dtS;
      } else {
        exposure_[z] -= dtS * RECOVERY_FACTOR;
        if (exposure_[z] <= 0) {
          exposure_[z] = 0;
          alerted_[z] = false;                 // fully recovered: can alert again later
        }
      }

      // Raise the alert once when the limit is reached.
      if (exposure_[z] >= EXPOSURE_LIMIT_S && !alerted_[z]) {
        alerted_[z] = true;
        newAlerts_ |= (uint16_t)(1u << z);
      }
    }
  }

  // Step 7: drift correction. Sensors slowly wander. While the mat has been EMPTY for a
  // while, nudge the baseline toward the current reading. Never done while someone is on it.
  if (total < EMPTY_TOTAL_MV) {
    emptyForS_ += dtS;
    if (emptyForS_ >= EMPTY_HOLD_S) {
      for (uint8_t i = 0; i < MAT_CELLS; i++) {
        const int diff = (int)mv[i] - (int)base_[i];
        int step = diff / 16;                       // move 1/16 of the way each scan...
        if (step == 0 && diff != 0) step = (diff > 0) ? 1 : -1;   // ...but never stall short of the target
        base_[i] = (uint16_t)((int)base_[i] + step);
      }
    }
  } else {
    emptyForS_ = 0;
  }
}

bool Processing::alarmActive() const {
  for (uint8_t z = 0; z < ZONES; z++)
    if (alerted_[z]) return true;
  return false;
}

uint16_t Processing::takeNewAlerts() {
  const uint16_t a = newAlerts_;
  newAlerts_ = 0;
  return a;
}

void Processing::acknowledge() {
  for (uint8_t z = 0; z < ZONES; z++) {
    exposure_[z] = 0;
    alerted_[z] = false;
  }
  newAlerts_ = 0;
}

// What goes to the server: one byte per cell. 0 = no signal, 255 = FULL_SCALE_MV or more.
void Processing::frameBytes(uint8_t* out) const {
  for (uint8_t i = 0; i < MAT_CELLS; i++) {
    float v = filt_[i] * 255.0f / FULL_SCALE_MV;
    if (v < 0) v = 0;
    if (v > 255) v = 255;
    out[i] = (uint8_t)(v + 0.5f);
  }
}
