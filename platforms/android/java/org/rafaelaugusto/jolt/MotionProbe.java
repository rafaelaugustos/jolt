package org.rafaelaugusto.jolt;

import android.os.SystemClock;
import android.view.Choreographer;
import android.view.View;
import java.lang.ref.WeakReference;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;

/** Optional development sampling. No callback crosses into JavaScript per frame. */
public final class MotionProbe implements Choreographer.FrameCallback {
    private static int activeCount;
    private final WeakReference<View> view;
    private final double[][] rows;
    private final double density, interval;
    private int head, count, dropped, samples;
    private double last = Double.NEGATIVE_INFINITY, sampleCPU, drainCPU;
    private boolean active = true;

    public static MotionProbe start(View view, int capacity, double hertz) {
        return new MotionProbe(view, capacity, hertz);
    }
    public static int activeCount() { return activeCount; }
    private MotionProbe(View target, int capacity, double hertz) {
        view = new WeakReference<>(target);
        rows = new double[Math.max(8, Math.min(600, capacity))][9];
        density = target.getResources().getDisplayMetrics().density;
        interval = 1000 / Math.max(1, Math.min(120, hertz));
        activeCount++; Choreographer.getInstance().postFrameCallback(this);
    }
    @Override public void doFrame(long frameTimeNanos) {
        if (!active) return;
        View target = view.get();
        if (target == null || !target.isAttachedToWindow()) { dispose(); return; }
        long begin = System.nanoTime();
        double now = SystemClock.uptimeMillis();
        if (now - last >= interval - 0.5) {
            last = now;
            int slot;
            if (count == rows.length) { slot = head; head = (head + 1) % rows.length; dropped++; }
            else { slot = (head + count) % rows.length; count++; }
            double[] r = rows[slot];
            r[0] = now; r[1] = target.getTranslationX()/density; r[2] = target.getTranslationY()/density;
            r[3] = target.getScaleX(); r[4] = target.getScaleY(); r[5] = target.getRotation();
            r[6] = target.getRotationX(); r[7] = target.getRotationY(); r[8] = target.getAlpha();
            samples++; sampleCPU += (System.nanoTime()-begin)/1e6;
        }
        Choreographer.getInstance().postFrameCallback(this);
    }
    public String drain() {
        long begin = System.nanoTime();
        try {
            JSONArray out = new JSONArray();
            for (int i=0;i<count;i++) {
                JSONArray row = new JSONArray();
                for(double value:rows[(head+i)%rows.length]) row.put(Double.isFinite(value)?value:JSONObject.NULL);
                out.put(row);
            }
            head=0; count=0;
            JSONObject result=new JSONObject(); result.put("rows",out); result.put("dropped",dropped);
            result.put("samples",samples); result.put("sampleCpuMs",sampleCPU); result.put("drainCpuMs",drainCPU); result.put("active",active);
            String json=result.toString(); drainCPU+=(System.nanoTime()-begin)/1e6; return json;
        } catch(JSONException error) { throw new IllegalStateException(error); }
    }
    public void dispose() {
        if (!active) return;
        active=false; activeCount--; Choreographer.getInstance().removeFrameCallback(this); view.clear();
    }
}
