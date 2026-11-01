// Reads one server reply on stdin and prints what the firmware's parser decides.
#include <cstdio>
#include <string>
#include <iostream>
#include <iterator>
#include "../perfusense_mat/Comms.h"
int main() {
  std::string body((std::istreambuf_iterator<char>(std::cin)), std::istreambuf_iterator<char>());
  bool a, t; parseServerCommands(body.c_str(), &a, &t);
  printf("ack=%d tare=%d\n", a, t);
}
