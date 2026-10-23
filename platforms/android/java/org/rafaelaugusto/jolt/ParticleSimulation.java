package org.rafaelaugusto.jolt;

/** Bounded, allocation-free particle state. Units are DIPs, seconds and degrees.
 * Android supplies elapsed wall time; the same engine runs in deterministic JVM tests. */
public final class ParticleSimulation {
    public static final int MAX_PARTICLES = 10000;
    public final int shape, source;
    public final float size;
    private final int[] palette;
    private final double rate, lifetime, duration;
    private final float velocity, velocityRange, angle, spread, gravity, spin, spinRange;
    private final boolean fade;
    private double[] births;
    private float[] xs, ys, vxs, vys, rotations, spins;
    private int[] colors;
    private int live, peak;
    private long scheduled, emitted, skipped;
    private long random;
    private double time;

    public ParticleSimulation(int[] palette, int shape, int source, double rate,
            double lifetimeMs, float size, float velocity, float velocityRange,
            float angle, float spread, float gravity, float spin, float spinRange,
            boolean fade, double durationMs, long seed) {
        if (palette == null || palette.length == 0 || palette.length > 32 || shape < 0 || shape > 2 || source < 0 || source > 2)
            throw new IllegalArgumentException("Invalid particle colors, shape or source");
        if (!finite(rate) || rate <= 0 || rate > 50000 || !finite(lifetimeMs) || lifetimeMs < 1 || lifetimeMs > 60000
                || !finite(durationMs) || (durationMs != -1 && (durationMs < 1 || durationMs > Integer.MAX_VALUE - lifetimeMs - 50))
                || !finite(size) || size < 1 || size > 128 || !finite(velocity) || velocity < 0 || velocity > 10000
                || !finite(velocityRange) || velocityRange < 0 || velocityRange > 10000
                || !finite(angle) || Math.abs(angle) > 360 || !finite(spread) || spread < 0 || spread > 360
                || !finite(gravity) || Math.abs(gravity) > 10000 || !finite(spin) || Math.abs(spin) > 3600
                || !finite(spinRange) || spinRange < 0 || spinRange > 3600)
            throw new IllegalArgumentException("Invalid particle settings");
        this.palette = palette.clone();
        this.shape = shape; this.source = source; this.rate = rate;
        lifetime = lifetimeMs / 1000; duration = durationMs < 0 ? Double.POSITIVE_INFINITY : durationMs / 1000;
        this.size = size; this.velocity = velocity; this.velocityRange = velocityRange;
        this.angle = angle; this.spread = spread; this.gravity = gravity;
        this.spin = spin; this.spinRange = spinRange; this.fade = fade;
        random = seed == 0 ? 1 : seed;
        double population = rate * Math.min(lifetime, duration);
        if (population > MAX_PARTICLES + 0.000001) throw new IllegalArgumentException("Particle population exceeds 10000");
        int capacity = Math.max(1, Math.min(MAX_PARTICLES, (int)Math.ceil(population)));
        births = new double[capacity]; xs = new float[capacity]; ys = new float[capacity];
        vxs = new float[capacity]; vys = new float[capacity]; rotations = new float[capacity];
        spins = new float[capacity]; colors = new int[capacity];
    }

    private static boolean finite(double value) { return !Double.isNaN(value) && !Double.isInfinite(value); }
    private float unit() {
        // xorshift64*: deterministic internal seed, never part of the public JS contract.
        random ^= random >>> 12; random ^= random << 25; random ^= random >>> 27;
        return ((random * 2685821657736338717L) >>> 40) / 16777216f;
    }
    private float variation(float range) { return (unit() * 2 - 1) * range; }

    /** Advance directly to the current time, skipping already-dead births after a stall.
     * No backlog of expired particles and no integration steps proportional to missed frames. */
    public void advance(double elapsedSeconds, float width, float height) {
        if (births == null || !finite(elapsedSeconds)) return;
        time = Math.max(time, Math.max(0, elapsedSeconds));
        for (int i = live - 1; i >= 0; i--) {
            if (time - births[i] >= lifetime - 0.000000001) {
                int last = --live;
                births[i] = births[last]; xs[i] = xs[last]; ys[i] = ys[last];
                vxs[i] = vxs[last]; vys[i] = vys[last]; rotations[i] = rotations[last];
                spins[i] = spins[last]; colors[i] = colors[last];
            }
        }
        long until = (long)Math.floor(Math.min(time, duration) * rate + 0.0000001);
        long dead = Math.min(until, (long)Math.floor(Math.max(0, time - lifetime) * rate + 0.0000001));
        if (dead > scheduled) { skipped += dead - scheduled; scheduled = dead; }
        // scheduled is monotonic; at most capacity particles can be alive in this interval.
        while (scheduled < until) {
            long index = ++scheduled;
            if (live >= births.length) { skipped++; continue; }
            int i = live++;
            births[i] = index / rate;
            xs[i] = source == 0 ? width * .5f : unit() * width;
            ys[i] = source == 1 ? 0 : source == 2 ? height : height * .5f;
            double direction = Math.toRadians(angle + variation(spread * .5f));
            float speed = velocity + variation(velocityRange);
            vxs[i] = (float)Math.cos(direction) * speed;
            vys[i] = (float)Math.sin(direction) * speed;
            rotations[i] = shape == 1 ? unit() * 360 : 0;
            spins[i] = spin + variation(spinRange);
            colors[i] = palette[(int)((index - 1) % palette.length)];
            emitted++;
        }
        peak = Math.max(peak, live);
    }

    public float x(int i) { return xs[i] + vxs[i] * (float)(time - births[i]); }
    public float y(int i) { float age = (float)(time - births[i]); return ys[i] + vys[i] * age + gravity * age * age * .5f; }
    public float rotation(int i) { return rotations[i] + spins[i] * (float)(time - births[i]); }
    public int color(int i) {
        int color = colors[i];
        if (!fade) return color;
        int alpha = Math.round((color >>> 24) * (float)Math.max(0, 1 - (time - births[i]) / lifetime));
        return (color & 0x00ffffff) | (alpha << 24);
    }
    public boolean finished() { return time >= duration + lifetime || (time >= duration && live == 0); }
    public int live() { return live; }
    public int peak() { return peak; }
    public int capacity() { return births == null ? 0 : births.length; }
    public long emitted() { return emitted; }
    public long skipped() { return skipped; }
    public double time() { return time; }
    public void clear() {
        live = 0;
        births = null; xs = ys = vxs = vys = rotations = spins = null; colors = null;
    }
}
