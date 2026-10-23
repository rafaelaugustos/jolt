#include "JoltSpringState.h"
#include <stdio.h>

void jolt_step(double *values, double target, double stiffness, double damping, double mass, double seconds) {
    JoltSpringState next = JoltSpringAdvance((JoltSpringState){values[0], values[1]}, target, stiffness, damping, mass, seconds);
    values[0] = next.position; values[1] = next.velocity;
}

int main(void) {
    JoltSpringState state;
    double target, stiffness, damping, mass, seconds;
    while (scanf("%lf %lf %lf %lf %lf %lf %lf", &state.position, &state.velocity,
                 &target, &stiffness, &damping, &mass, &seconds) == 7) {
        state = JoltSpringAdvance(state, target, stiffness, damping, mass, seconds);
        printf("%.17g %.17g\n", state.position, state.velocity);
    }
    return 0;
}
