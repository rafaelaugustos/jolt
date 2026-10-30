package org.rafaelaugusto.jolt.fixture;

import android.os.Build;
import android.os.Debug;
import android.os.PowerManager;
import android.os.Process;
import android.view.Choreographer;
import android.view.View;
import org.json.JSONArray;
import org.json.JSONObject;

/** Demo-only fixed-capacity native callback recorder. It never invokes JavaScript. */
public final class BudgetProbe implements Choreographer.FrameCallback {
    private static final int CAPACITY = 4096;
    private final double[][] frames = new double[CAPACITY][6];
    private int count, overflow;
    private View target;
    private final JSONObject before;
    private boolean stopped;
    private String result;
    private double sampledPeakBytes, lastMemoryMs, probeWorkMs;
    private int memorySamples = 1;

    private static JSONObject resourceObject(View view) {
        try {
            Debug.MemoryInfo memory = new Debug.MemoryInfo();
            Debug.getMemoryInfo(memory);
            PowerManager power = (PowerManager)view.getContext().getSystemService(android.content.Context.POWER_SERVICE);
            return new JSONObject().put("timeMs", System.nanoTime() / 1e6)
                .put("cpuMs", Process.getElapsedCpuTime())
                .put("memoryBytes", memory.getTotalPss() * 1024L)
                .put("memoryMetric", "total-pss")
                .put("thermalState", Build.VERSION.SDK_INT >= 29 ? power.getCurrentThermalStatus() : JSONObject.NULL)
                .put("lowPowerMode", power.isPowerSaveMode());
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    public static String resources(View view) { return resourceObject(view).toString(); }
    public static String environment(View view) {
        try {
            boolean emulator = Build.FINGERPRINT.startsWith("generic") || Build.FINGERPRINT.contains("emulator")
                || Build.MODEL.contains("sdk_gphone") || Build.MODEL.contains("Emulator")
                || Build.HARDWARE.contains("goldfish") || Build.HARDWARE.contains("ranchu");
            return new JSONObject().put("physical", !emulator).put("model", Build.MANUFACTURER + " " + Build.MODEL)
                .put("os", Build.VERSION.RELEASE).put("osBuild", Build.FINGERPRINT)
                .put("maximumRefreshHz", view.getDisplay().getRefreshRate())
                .put("animatorScale", android.provider.Settings.Global.getFloat(view.getContext().getContentResolver(), "animator_duration_scale", 1))
                .put("resources", resourceObject(view)).toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    public BudgetProbe(View target) {
        this.target = target;
        before = resourceObject(target);
        sampledPeakBytes = before.optDouble("memoryBytes");
        lastMemoryMs = before.optDouble("timeMs");
        Choreographer.getInstance().postFrameCallback(this);
    }
    @Override public void doFrame(long timestamp) {
        if (stopped) return;
        double begin = System.nanoTime() / 1e6;
        if (count < CAPACITY) {
            double[] row = frames[count++];
            row[0] = System.nanoTime() / 1e6; row[1] = timestamp / 1e6;
            row[2] = row[1] + 1000.0 / target.getDisplay().getRefreshRate();
            row[3] = target.getTranslationX() / target.getResources().getDisplayMetrics().density;
            row[4] = target.getScaleX();
            row[5] = target.getTranslationY() / target.getResources().getDisplayMetrics().density;
        } else overflow++;
        if (begin - lastMemoryMs >= 500) {
            sampledPeakBytes = Math.max(sampledPeakBytes, resourceObject(target).optDouble("memoryBytes"));
            lastMemoryMs = begin; memorySamples++;
        }
        probeWorkMs += System.nanoTime() / 1e6 - begin;
        Choreographer.getInstance().postFrameCallback(this);
    }
    public String finish() {
        if (result != null) return result;
        stopped = true;
        Choreographer.getInstance().removeFrameCallback(this);
        JSONObject after = resourceObject(target);
        try {
            JSONArray rows = new JSONArray();
            for (int i = 0; i < count; i++) rows.put(new JSONArray(frames[i]));
            result = new JSONObject().put("before", before).put("after", after)
                .put("frameMetric", "choreographer-opportunities-not-presented-frames")
                .put("columns", new JSONArray(new String[]{"callbackMs", "timestampMs", "targetMs", "xDip", "scaleX", "yDip"}))
                .put("frames", rows).put("overflow", overflow)
                .put("sampledPeakMemoryBytes", Math.max(sampledPeakBytes, after.optDouble("memoryBytes")))
                .put("memorySamples", memorySamples + 1).put("probeWorkMs", probeWorkMs).toString();
            target = null;
            return result;
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
    public void cancel() {
        stopped = true; Choreographer.getInstance().removeFrameCallback(this); target = null;
    }
}
