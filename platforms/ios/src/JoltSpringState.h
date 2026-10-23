#ifndef JOLT_SPRING_STATE_H
#define JOLT_SPRING_STATE_H
#include <math.h>

/* Exact constant-target solution. Position and velocity survive every retarget. */
typedef struct { double position, velocity; } JoltSpringState;
static inline JoltSpringState JoltSpringAdvance(JoltSpringState state, double target,
        double stiffness, double damping, double mass, double seconds) {
    if (seconds <= 0) return state;
    const double x = state.position - target;
    const double w = sqrt(stiffness / mass);
    const double z = damping / (2 * sqrt(stiffness * mass));
    double next, speed;
    if (fabs(z - 1) < 1e-6) {
        const double b = state.velocity + w * x, e = exp(-w * seconds);
        next = e * (x + b * seconds);
        speed = e * (b - w * (x + b * seconds));
    } else if (z < 1) {
        const double a = z * w, d = w * sqrt(1 - z * z);
        const double b = (state.velocity + a * x) / d;
        const double c = cos(d * seconds), s = sin(d * seconds), e = exp(-a * seconds);
        next = e * (x * c + b * s);
        speed = e * ((-a * x + b * d) * c + (-a * b - x * d) * s);
    } else {
        const double q = sqrt(z * z - 1);
        /* Rationalized slow root avoids catastrophic cancellation at high damping. */
        const double r1 = -w / (z + q), r2 = -w * (z + q);
        const double c1 = (state.velocity - r2 * x) / (r1 - r2), c2 = x - c1;
        const double e1 = exp(r1 * seconds), e2 = exp(r2 * seconds);
        next = c1 * e1 + c2 * e2;
        speed = c1 * r1 * e1 + c2 * r2 * e2;
    }
    return (JoltSpringState){target + next, speed};
}
#endif
