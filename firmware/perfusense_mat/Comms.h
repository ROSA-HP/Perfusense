// Comms.h - how the ESP32 SENDS readings to the server and RECEIVES commands back.
//
// The conversation (all over plain HTTP):
//   ESP32 -> server : POST /api/telemetry/<bed>/frame   body = 64 bytes (one per cell)
//                     header x-device-key = the shared secret
//   server -> ESP32 : the reply to that same POST, JSON, for example
//                     {"bedId":"bed-07","peakMmHg":42.4,"peakZone":"SACRAL","alerts":0,"commands":["ack"]}
//   Commands the server can send:
//     "ack"  = a nurse confirmed a turn in the web app: clear the local alarm and timers
//     "tare" = learn a new empty-mat baseline (the mat must be empty)
#pragma once
#include <stdint.h>
#include <string.h>

struct CommsStats {
  uint32_t sent;      // frames accepted by the server
  uint32_t failed;    // frames that failed
  int      lastCode;  // last HTTP status (202 = accepted, negative = no connection)
};

void commsBegin();                              // starts the network task (runs next to the scanner)
void commsPublishFrame(const uint8_t* bytes);   // hand over the newest frame (MAT_CELLS bytes)
bool commsTakeAck();                            // true ONCE after the server sent "ack"
bool commsTakeTare();                           // true ONCE after the server sent "tare"
CommsStats commsStats();

// Looks inside the "commands":[...] list of the server's JSON reply.
// Kept here as a plain function (no Arduino calls) so it can be tested on a computer.
inline void parseServerCommands(const char* body, bool* ack, bool* tare) {
  *ack = false;
  *tare = false;
  if (!body) return;
  const char* key = strstr(body, "\"commands\"");
  if (!key) return;
  const char* open = strchr(key, '[');
  if (!open) return;
  const char* close = strchr(open, ']');
  if (!close) return;
  const char* a = strstr(open, "\"ack\"");
  const char* t = strstr(open, "\"tare\"");
  *ack = (a != nullptr && a < close);
  *tare = (t != nullptr && t < close);
}
