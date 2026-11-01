#!/bin/bash
# Checks that run on a normal computer (no ESP32 needed). Needs g++.
set -e
cd "$(dirname "$0")"
echo "== 1. logic tests (Processing + command parser)"
g++ -std=gnu++11 -Wall -Wextra -Wpedantic -Iperfusense_mat -o test/test_processing test/test_processing.cpp perfusense_mat/Processing.cpp
./test/test_processing
echo "== 2. type-check the hardware files against stand-in Arduino headers"
for std in gnu++11 gnu++17; do
  for f in Scanner Connection Comms Processing; do
    g++ -std=$std -fsyntax-only -Wall -Wextra -Istubs -Iperfusense_mat perfusense_mat/$f.cpp
  done
  g++ -std=$std -fsyntax-only -Wall -Wextra -Istubs -Iperfusense_mat -include Arduino.h -x c++ perfusense_mat/perfusense_mat.ino
done
echo "all checks passed"
