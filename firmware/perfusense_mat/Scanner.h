// Scanner.h - reads the physical mat.
#pragma once
#include <stdint.h>

void scannerBegin();                     // set up pins and the ADC (call once)
void scannerReadFrame(uint16_t* mv);     // fills mv[MAT_CELLS] with millivolts, row by row
