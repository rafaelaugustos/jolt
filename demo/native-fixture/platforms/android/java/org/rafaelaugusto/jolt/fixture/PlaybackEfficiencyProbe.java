package org.rafaelaugusto.jolt.fixture;

import android.animation.ObjectAnimator;
import android.animation.ValueAnimator;
import android.os.Debug;
import android.util.Property;
import android.view.View;
import android.view.animation.LinearInterpolator;
import java.lang.reflect.Method;
import org.json.JSONArray;
import org.json.JSONObject;

/** Demo-only comparison. Reflection is resolved before all measurement windows. */
public final class PlaybackEfficiencyProbe {
    private static final LinearInterpolator LINEAR = new LinearInterpolator();
    private final Method legacy, compact;
    private ObjectAnimator[] retained;

    public PlaybackEfficiencyProbe() {
        try {
            Class<?> factory = Class.forName("org.rafaelaugusto.jolt.KeyframeFactory");
            Class<?>[] signature = { View.class, Property.class, double[].class, double[].class, double.class };
            legacy = factory.getMethod("create", signature);
            compact = factory.getMethod("createCompact", signature);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    private ObjectAnimator make(boolean packed, View view, Property<View, Float> property,
            double[] times, double[] values, double unit) throws Exception {
        ObjectAnimator animator = (ObjectAnimator)(packed ? compact : legacy)
            .invoke(null, view, property, times, values, unit);
        if (!packed) animator.setInterpolator(LINEAR);
        animator.setDuration(1000);
        return animator;
    }

    private static double[][] curve(int points) {
        double[][] data = new double[2][points];
        for (int i = 0; i < points; i++) {
            double t = (double)i / (points - 1);
            data[0][i] = t * t; // Uneven offsets exercise the actual sampled representation.
            data[1][i] = 0.17 + Math.sin(t * Math.PI * 4) * 0.7;
        }
        return data;
    }

    @SuppressWarnings("unchecked")
    public String verify(View view) {
        Property<View, Float>[] properties = new Property[] { View.TRANSLATION_X,
            View.TRANSLATION_Y, View.SCALE_X, View.SCALE_Y, View.ROTATION,
            View.ROTATION_X, View.ROTATION_Y, View.ALPHA };
        int comparisons = 0;
        try {
            for (Property<View, Float> property : properties) {
                float original = property.get(view);
                try {
                    for (int points : new int[] {2, 3, 41, 241, 601}) {
                        double[][] data = curve(points);
                        for (double unit : new double[] {1, 2.625, 3}) {
                            ObjectAnimator a = make(false, view, property, data[0], data[1], unit);
                            ObjectAnimator b = make(true, view, property, data[0], data[1], unit);
                            a.setRepeatCount(1); b.setRepeatCount(1);
                            a.setRepeatMode(ValueAnimator.REVERSE); b.setRepeatMode(ValueAnimator.REVERSE);
                            // Forward and reverse playback, then a backwards seek.
                            for (int step = 0; step <= 2001; step++) {
                                int time = step == 2001 ? 137 : step;
                                a.setCurrentPlayTime(time);
                                float expected = property.get(view);
                                b.setCurrentPlayTime(time);
                                float actual = property.get(view);
                                if (actual != expected || Float.isNaN(actual))
                                    throw new AssertionError(property.getName() + ": " + points +
                                        " points, unit " + unit + ", time " + time + ": " + actual + " != " + expected);
                                comparisons++;
                            }
                            a.cancel(); b.cancel();
                        }
                    }
                    // Fallback when two distinct doubles round to the same float knot.
                    double[] times = {0, 0.5, 0.500000001, 1};
                    double[] values = {0, 0.7, 0.1, 1};
                    ObjectAnimator a = make(false, view, property, times, values, 1);
                    ObjectAnimator b = make(true, view, property, times, values, 1);
                    for (int time : new int[] {0, 499, 500, 501, 1000}) {
                        a.setCurrentPlayTime(time); float expected = property.get(view);
                        b.setCurrentPlayTime(time); float actual = property.get(view);
                        if (actual != expected) throw new AssertionError("Collapsed float offsets differ");
                        comparisons++;
                    }
                    a.cancel(); b.cancel();
                } finally { property.set(view, original); }
            }
            return new JSONObject().put("comparisons", comparisons).put("exact", true).toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    public String measure(View view, int points, int count, boolean packed) {
        if (retained != null) throw new IllegalStateException("Release the previous batch first");
        try {
            double[][] data = curve(points);
            retained = new ObjectAnimator[count];
            long cpu = Debug.threadCpuTimeNanos(), time = System.nanoTime();
            for (int i = 0; i < count; i++)
                retained[i] = make(packed, view, View.TRANSLATION_X, data[0], data[1], 1);
            double setupMs = (System.nanoTime() - time) / 1e6;
            double setupCpuMs = (Debug.threadCpuTimeNanos() - cpu) / 1e6;
            // Initialize native properties outside the evaluation window.
            for (ObjectAnimator animator : retained) animator.setCurrentPlayTime(0);
            cpu = Debug.threadCpuTimeNanos(); time = System.nanoTime();
            for (int frame = 0; frame < 120; frame++) {
                int at = (frame * 37) % 1001;
                for (ObjectAnimator animator : retained) animator.setCurrentPlayTime(at);
            }
            double evaluationMs = (System.nanoTime() - time) / 1e6;
            double evaluationCpuMs = (Debug.threadCpuTimeNanos() - cpu) / 1e6;
            return new JSONObject().put("compact", packed).put("points", points).put("count", count)
                .put("setupMs", setupMs).put("setupCpuMs", setupCpuMs)
                .put("evaluationMs", evaluationMs).put("evaluationCpuMs", evaluationCpuMs)
                .put("evaluations", count * 120).toString();
        } catch (Exception e) { release(); throw new IllegalStateException(e); }
    }

    public void release() {
        if (retained == null) return;
        for (ObjectAnimator animator : retained) if (animator != null) {
            animator.cancel();
            animator.removeAllListeners();
            animator.setTarget(null);
        }
        retained = null;
    }

    /** Explicitly outside CPU/frame measurements. GC is requested, not guaranteed. */
    public static String memoryDetails() {
        try {
            android.os.Debug.MemoryInfo info = new android.os.Debug.MemoryInfo();
            android.os.Debug.getMemoryInfo(info);
            Runtime vm = Runtime.getRuntime();
            JSONObject result = new JSONObject()
                .put("javaUsedBytes", vm.totalMemory() - vm.freeMemory())
                .put("nativeAllocatedBytes", Debug.getNativeHeapAllocatedSize())
                .put("pssKiB", info.getTotalPss());
            JSONObject categories = new JSONObject();
            for (java.util.Map.Entry<String, String> entry : info.getMemoryStats().entrySet()) {
                categories.put(entry.getKey(), entry.getValue());
            }
            result.put("categoriesKiB", categories);
            result.put("gcCount", android.os.Debug.getRuntimeStat("art.gc.gc-count"));
            result.put("gcAllocatedBytes", android.os.Debug.getRuntimeStat("art.gc.bytes-allocated"));
            result.put("gcFreedBytes", android.os.Debug.getRuntimeStat("art.gc.bytes-freed"));
            return result.toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }

    public static String memory() {
        Runtime vm = Runtime.getRuntime();
        Debug.MemoryInfo memory = new Debug.MemoryInfo();
        Debug.getMemoryInfo(memory);
        try {
            return new JSONObject().put("javaUsedBytes", vm.totalMemory() - vm.freeMemory())
                .put("nativeAllocatedBytes", Debug.getNativeHeapAllocatedSize())
                .put("pssKiB", memory.getTotalPss()).toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
