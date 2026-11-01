// Host-side tests for the firmware logic (no ESP32 needed).
#include <cstdio>
#include <cstring>
#include <cmath>
#include "../perfusense_mat/Processing.h"
#include "../perfusense_mat/Comms.h"   // for parseServerCommands

static int failures = 0, checks = 0;
#define CHECK(cond, msg) do { checks++; if (!(cond)) { failures++; printf("FAIL: %s  (line %d)\n", msg, __LINE__); } } while (0)

static void fill(uint16_t* mv, uint16_t v) { for (int i = 0; i < MAT_CELLS; i++) mv[i] = v; }
// press the 2x2 zone with index z (0..15) at value v
static void pressZone(uint16_t* mv, int z, uint16_t v) {
  int zr = z / ZONES_PER_SIDE, zc = z % ZONES_PER_SIDE;
  for (int r = 0; r < ZONE_SIZE; r++) for (int c = 0; c < ZONE_SIZE; c++)
    mv[(zr * ZONE_SIZE + r) * MAT_N + zc * ZONE_SIZE + c] = v;
}
static void learn(Processing& p, uint16_t level) {
  uint16_t mv[MAT_CELLS]; fill(mv, level);
  p.baselineBegin(); for (int i = 0; i < BASELINE_FRAMES; i++) p.baselineAdd(mv); p.baselineEnd();
}
static void run(Processing& p, const uint16_t* mv, int frames, float dt) { for (int i = 0; i < frames; i++) p.update(mv, dt); }

int main() {
  uint16_t mv[MAT_CELLS];

  { // baseline: average of the empty-mat readings, per cell
    Processing p; uint16_t a[MAT_CELLS], b[MAT_CELLS]; fill(a, 100); fill(b, 110);
    p.baselineBegin(); p.baselineAdd(a); p.baselineAdd(b); p.baselineEnd();
    CHECK(p.baseline(0) == 105, "baseline is the average (105)");
    Processing q; q.baselineBegin(); q.baselineEnd();
    CHECK(q.baseline(5) == 0, "empty baseline learn keeps the old baseline");
  }
  { // empty mat gives no signal; dead-band hides small noise
    Processing p; learn(p, 200);
    fill(mv, 200); run(p, mv, 20, 0.5f);
    CHECK(p.cellSignal(10) == 0, "empty mat: no signal");
    fill(mv, 200 + DEADBAND_MV - 1); run(p, mv, 20, 0.5f);
    CHECK(p.cellSignal(10) == 0, "noise below the dead-band is ignored");
    fill(mv, 150); run(p, mv, 20, 0.5f);
    CHECK(p.cellSignal(10) == 0, "readings below baseline never go negative");
  }
  { // smoothing: signal rises gradually and converges
    Processing p; learn(p, 100);
    fill(mv, 100); pressZone(mv, 5, 700);                  // +600 mV on zone 5
    p.update(mv, 0.5f);
    int cell = (1 * ZONE_SIZE) * MAT_N + 1 * ZONE_SIZE;    // top-left cell of zone 5 (row 2, col 2)
    CHECK(fabsf(p.cellSignal(cell) - 0.30f * 600) < 0.01f, "first scan moves 30% toward the target");
    run(p, mv, 40, 0.5f);
    CHECK(p.cellSignal(cell) > 595 && p.cellSignal(cell) <= 600, "signal converges to the pressed value");
    CHECK(p.cellSignal(0) == 0, "unpressed cell stays at 0");
  }
  { // zone mean + pressure x time: exposure grows only for the loaded zone
    Processing p; learn(p, 100);
    fill(mv, 100); pressZone(mv, 5, 700);
    run(p, mv, 40, 0.5f);                                  // 20 s loaded (signal settled by now)
    CHECK(p.zoneSignal(5) > 590, "zone 5 reads the mean of its 4 cells");
    CHECK(p.zoneSignal(0) == 0, "other zones read 0");
    CHECK(p.exposure(5) > 15 && p.exposure(5) <= 20, "loaded zone collects exposure seconds");
    CHECK(p.exposure(0) == 0, "unloaded zone collects none");
    CHECK(!p.alarmActive(), "no alarm before the limit");
  }
  { // a half-loaded zone below the threshold does not count as loaded
    Processing p; learn(p, 100);
    fill(mv, 100);
    mv[(1 * ZONE_SIZE) * MAT_N + 1 * ZONE_SIZE] = 100 + 1000;   // one hot cell of four = mean 250 (< 300)
    run(p, mv, 60, 0.5f);
    CHECK(p.exposure(5) == 0, "one cell alone does not make the zone loaded (mean below threshold)");
  }
  { // alert fires once at the limit, alarm stays on until acknowledged
    Processing p; learn(p, 100);
    fill(mv, 100); pressZone(mv, 5, 700);
    uint16_t seen = 0; int alerts = 0;
    for (int i = 0; i < 400; i++) {                          // 200 s > 60 s limit
      p.update(mv, 0.5f);
      uint16_t n = p.takeNewAlerts(); if (n) { seen |= n; alerts++; }
    }
    CHECK(alerts == 1, "the alert is raised exactly once");
    CHECK(seen == (1u << 5), "the alert names zone 5");
    CHECK(p.alarmActive(), "alarm is on");
    CHECK(p.zoneAlerted(5), "zone 5 is flagged");
    p.acknowledge();
    CHECK(!p.alarmActive() && p.exposure(5) == 0, "acknowledge clears alarm and timers");
    run(p, mv, 10, 0.5f);
    CHECK(!p.alarmActive(), "still loaded but timer restarted: no instant re-alarm");
  }
  { // recovery: relief removes exposure faster than it was collected
    Processing p; learn(p, 100);
    fill(mv, 100); pressZone(mv, 3, 700);
    run(p, mv, 60, 0.5f);                                   // 30 s of load
    float before = p.exposure(3);
    fill(mv, 100); run(p, mv, 20, 0.5f);                    // 10 s of relief
    CHECK(p.exposure(3) < before - 15, "10 s of relief removes about 20 s of exposure");
    run(p, mv, 80, 0.5f);
    CHECK(p.exposure(3) == 0, "exposure never goes below 0");
  }
  { // after recovery a zone can alert again
    Processing p; learn(p, 100);
    fill(mv, 100); pressZone(mv, 2, 700);
    run(p, mv, 300, 0.5f); p.takeNewAlerts();               // alert once
    fill(mv, 100); run(p, mv, 300, 0.5f);                   // long relief: flag clears
    CHECK(!p.zoneAlerted(2), "alert flag clears after full recovery");
    pressZone(mv, 2, 700); run(p, mv, 300, 0.5f);
    CHECK(p.takeNewAlerts() == (1u << 2), "the zone can alert again");
  }
  { // drift correction: only slow drift (under the dead-band) while the mat has been empty a while
    Processing p; learn(p, 100);
    fill(mv, 115);                                          // reading drifted up 15 mV (below the 20 mV dead-band)
    run(p, mv, 100, 0.5f);                                  // 50 s < 60 s hold: no correction yet
    CHECK(p.baseline(0) == 100, "no drift correction before the empty-hold time");
    run(p, mv, 400, 0.5f);
    CHECK(p.baseline(0) == 115, "baseline fully follows small drift once empty long enough");
    CHECK(p.cellSignal(0) == 0, "and the drift never shows as a load");
    // a jump above the dead-band is treated as a real (light) load, not absorbed
    Processing j; learn(j, 100);
    fill(mv, 130); run(j, mv, 400, 0.5f);
    CHECK(j.baseline(0) == 100, "a 30 mV jump is not absorbed as drift");
    CHECK(j.cellSignal(0) > 25, "it shows up as signal instead");
    // a person on the mat: baseline must NOT follow
    Processing q; learn(q, 100);
    fill(mv, 100); pressZone(mv, 5, 700); run(q, mv, 400, 0.5f);
    int cell = (1 * ZONE_SIZE) * MAT_N + 1 * ZONE_SIZE;
    CHECK(q.baseline(cell) == 100, "baseline does not follow a real load");
  }
  { // bytes sent to the server
    Processing p; learn(p, 100);
    fill(mv, 100); pressZone(mv, 5, 700); run(p, mv, 60, 0.5f);
    uint8_t out[MAT_CELLS]; p.frameBytes(out);
    int cell = (1 * ZONE_SIZE) * MAT_N + 1 * ZONE_SIZE;
    CHECK(out[cell] >= 100 && out[cell] <= 102, "600 mV maps to about 102 of 255 (full scale 1500 mV)");
    CHECK(out[0] == 0, "unpressed cell is 0");
    Processing h; learn(h, 100);
    fill(mv, 3000); run(h, mv, 60, 0.5f); h.frameBytes(out);
    CHECK(out[0] == 255, "very high signal clamps at 255");
  }
  { // parsing the server's reply
    bool a, t;
    parseServerCommands("{\"bedId\":\"bed-07\",\"peakMmHg\":12,\"alerts\":0,\"commands\":[]}", &a, &t);
    CHECK(!a && !t, "empty command list");
    parseServerCommands("{\"commands\":[\"ack\"]}", &a, &t);
    CHECK(a && !t, "ack only");
    parseServerCommands("{\"commands\":[\"ack\",\"tare\"],\"x\":1}", &a, &t);
    CHECK(a && t, "ack and tare");
    parseServerCommands("{\"commands\":[\"tare\"]}", &a, &t);
    CHECK(!a && t, "tare only");
    parseServerCommands("{\"peakZone\":\"ack\",\"commands\":[]}", &a, &t);
    CHECK(!a && !t, "the word ack outside the command list is ignored");
    parseServerCommands("{\"error\":\"Unauthorized\"}", &a, &t);
    CHECK(!a && !t, "no commands key");
    parseServerCommands(nullptr, &a, &t);
    CHECK(!a && !t, "null body is safe");
    parseServerCommands("{\"commands\":[\"ack\"", &a, &t);
    CHECK(!a && !t, "truncated reply is safe");
  }

  printf("%d checks, %d failed\n", checks, failures);
  return failures ? 1 : 0;
}
