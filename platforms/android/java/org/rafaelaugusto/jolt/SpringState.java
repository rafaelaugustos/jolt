package org.rafaelaugusto.jolt;

/** Exact constant-target solution, matching JoltSpringState.h. No per-step allocation. */
public final class SpringState {
    public double position, velocity;

    public SpringState(double position, double velocity) {
        this.position = position;
        this.velocity = velocity;
    }

    public void advance(double target, double stiffness, double damping, double mass, double seconds) {
        if (seconds <= 0) return;
        double x = position - target;
        double w = Math.sqrt(stiffness / mass);
        double z = damping / (2 * Math.sqrt(stiffness * mass));
        double next, speed;
        if (Math.abs(z - 1) < 1e-6) {
            double b = velocity + w * x, e = Math.exp(-w * seconds);
            next = e * (x + b * seconds);
            speed = e * (b - w * (x + b * seconds));
        } else if (z < 1) {
            double a = z * w, d = w * Math.sqrt(1 - z * z);
            double b = (velocity + a * x) / d;
            double c = Math.cos(d * seconds), s = Math.sin(d * seconds), e = Math.exp(-a * seconds);
            next = e * (x * c + b * s);
            speed = e * ((-a * x + b * d) * c + (-a * b - x * d) * s);
        } else {
            double q = Math.sqrt(z * z - 1);
            double r1 = -w / (z + q), r2 = -w * (z + q);
            double c1 = (velocity - r2 * x) / (r1 - r2), c2 = x - c1;
            double e1 = Math.exp(r1 * seconds), e2 = Math.exp(r2 * seconds);
            next = c1 * e1 + c2 * e2;
            speed = c1 * r1 * e1 + c2 * r2 * e2;
        }
        position = target + next;
        velocity = speed;
    }
}
