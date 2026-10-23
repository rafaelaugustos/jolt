package org.rafaelaugusto.jolt;

/** Independent deterministic checks of the production simulation; no Android SDK or JS mocks. */
public final class ParticleSimulationTest {
    private static int checks;
    private static void check(boolean value, String message) {
        checks++;
        if (!value) throw new AssertionError(message);
    }
    private static void near(double actual, double expected, double error, String message) {
        check(Math.abs(actual - expected) <= error, message + ": " + actual + " vs " + expected);
    }
    private static ParticleSimulation make(double rate, double life, double duration, int source) {
        return new ParticleSimulation(new int[] { 0x80ff0000, 0xff00ff00 }, 1, source,
                rate, life, 8, 60, 0, 90, 0, 20, 180, 0, true, duration, 42);
    }
    public static void main(String[] args) {
        ParticleSimulation burst = make(400, 2200, 200, 0);
        burst.advance(.1, 200, 100);
        check(burst.live() == 40 && burst.emitted() == 40, "Half confetti count");
        burst.advance(.2, 200, 100);
        check(burst.live() == 80 && burst.capacity() == 80, "Exact scheduled burst and bounded storage");
        burst.advance(2.399, 200, 100);
        check(burst.live() == 1 && !burst.finished(), "Last particle keeps its lifetime");
        burst.advance(2.4, 200, 100);
        check(burst.live() == 0 && burst.finished(), "Native expiry deadline");
        burst.clear(); burst.clear();
        check(burst.capacity() == 0, "Buffers released idempotently");

        ParticleSimulation physics = make(4, 2000, -1, 0);
        physics.advance(.25, 200, 100);
        float initialRotation = physics.rotation(0);
        physics.advance(.75, 200, 100);
        near(physics.x(0), 100, .0001, "Angle convention x");
        near(physics.y(0), 82.5, .0001, "Velocity and gravity in DIP/s and DIP/s^2");
        near(physics.rotation(0) - initialRotation, 90, .0001, "Spin degrees/s");
        check((physics.color(0) >>> 24) == 96, "Fade preserves source alpha");
        physics.advance(.5, 200, 100);
        near(physics.y(0), 82.5, .0001, "Clock cannot rewind");

        ParticleSimulation fractional = make(2.5, 1000, 1500, 0);
        for (int i = 0; i <= 150; i++) fractional.advance(i / 100d, 1, 1);
        check(fractional.emitted() == 3 && fractional.peak() <= 3, "Fractional emission count");
        fractional.advance(2.5, 1, 1);
        check(fractional.finished(), "Fractional deadline terminates");

        for (int source = 0; source < 3; source++) {
            ParticleSimulation a = make(10, 2000, -1, source), b = make(10, 2000, -1, source);
            a.advance(.1, 200, 100); b.advance(.1, 200, 100);
            near(a.x(0), b.x(0), 0, "Repeatable internal randomness");
            near(a.y(0), source == 1 ? 0 : source == 2 ? 100 : 50, .0001, "Source placement");
            check(a.x(0) >= 0 && a.x(0) <= 200, "Horizontal line bounds");
            a.advance(.2, 400, 300);
            near(a.y(1), source == 1 ? 0 : source == 2 ? 300 : 150, .0001, "Resize affects new births");
        }

        ParticleSimulation stress = make(10000, 1000, -1, 0);
        for (int i = 0; i <= 120; i++) stress.advance(i / 60d, 220, 100);
        check(stress.peak() == 10000 && stress.capacity() == 10000, "Stress bounded at 10000");
        check(stress.skipped() == 0, "Normal pacing does not drop scheduled births");
        stress.advance(600, 220, 100);
        check(stress.live() == 10000, "Long UI stall has bounded catch-up work");
        check(stress.skipped() > 5000000, "Expired births skipped, no backlog");
        stress.clear();
        stress.advance(601, 220, 100);
        check(stress.live() == 0 && stress.capacity() == 0, "Disposed simulation stays disposed");

        ParticleSimulation stalledBurst = make(400, 2200, 200, 0);
        stalledBurst.advance(20, 200, 100);
        check(stalledBurst.live() == 0 && stalledBurst.finished(), "Blocked finite burst cannot restart late");
        check(stalledBurst.emitted() == 0 && stalledBurst.skipped() == 80, "No burst backlog");

        for (int shape = 0; shape < 3; shape++) {
            ParticleSimulation varied = new ParticleSimulation(new int[] { 0x80ff0000 }, shape, 0,
                    100, 1000, 12, 0, 200, -90, 360, -100, 0, 360, false, -1, 123);
            varied.advance(.5, 200, 100);
            check(varied.live() == 50 && varied.shape == shape, "All shapes retain bounded state");
            for (int i = 0; i < varied.live(); i++) {
                check(Float.isFinite(varied.x(i)) && Float.isFinite(varied.y(i)), "Finite varied physics");
                check(varied.color(i) == 0x80ff0000, "fadeOut false preserves alpha");
            }
        }
        boolean invalid = false;
        try { make(10000, 2000, -1, 0); } catch (IllegalArgumentException expected) { invalid = true; }
        check(invalid, "Native boundary validates allocation bound");
        invalid = false;
        try { make(Double.NaN, 1000, -1, 0); } catch (IllegalArgumentException expected) { invalid = true; }
        check(invalid, "Native boundary rejects nonfinite inputs");
        System.out.println("PASS ParticleSimulation: " + checks + " deterministic assertions");
    }
}
