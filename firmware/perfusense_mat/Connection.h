// Connection.h - the link to the network and the server.
#pragma once
#include <stdint.h>

void connectionBegin();                      // start Wi-Fi (does not wait)
void connectionLoop();                       // call often: notices drops and reconnects
bool connectionWaitForWifi(uint32_t ms);     // wait up to ms for Wi-Fi (used once at start-up)
bool connectionPingServer();                 // GET /api/health: is the server reachable?

bool wifiIsConnected();
bool serverIsOk();                           // did the last send succeed?
void connectionReportServer(bool ok);        // called by Comms after every send
int  wifiSignalDbm();                        // signal strength, e.g. -60 (closer to 0 = stronger)
