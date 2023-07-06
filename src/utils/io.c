#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <math.h>

int readInteger(char* varString) {
    int a = 0;
    sscanf(varString, "%d", &a);
    return a;
}

double readFractional(char* varString) {
    double a = 0;
    sscanf(varString, "%lf", &a);
    return a;
}

//bool readFlag(char* varString) {
//    bool a;
//    sscanf(varString, "%d", &a);
//    return a;
//}

void printInteger(int a) {
    printf("%d", a);
}

void printFractional(double a) {
    printf("%lf", a);
}

//void printFlag(bool a) {
//    printf("%d", a);
//}