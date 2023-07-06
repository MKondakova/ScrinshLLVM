#ifndef SCRINSH_IO_UTIL
#define SCRINSH_IO_UTIL

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

int readInteger(char* varString);

double readFractional(char* varString);

void printInteger(int a);

void printFractional(double a);

#endif /* SCRINSH_IO_UTIL */
