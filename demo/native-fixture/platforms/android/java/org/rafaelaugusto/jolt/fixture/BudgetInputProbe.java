package org.rafaelaugusto.jolt.fixture;

import android.app.Activity;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import androidx.appcompat.view.WindowCallbackWrapper;
import org.json.JSONArray;
import org.json.JSONObject;

/** Demo-only native input recorder. Delegates every event to the original callback. */
public final class BudgetInputProbe extends WindowCallbackWrapper {
    private final double[][] rows = new double[4096][5];
    private final Window window;
    private View surface;
    private final int delayMs;
    private int count, overflow;
    private boolean tracking, delayed, stopped;
    private double workMs;
    private float downX, downY;
    private final int[] location = new int[2];
    public BudgetInputProbe(Activity activity, View surface, int delayMs) {
        super(activity.getWindow().getCallback());
        if (delayMs != 0 && delayMs != 40) throw new IllegalArgumentException("Unsupported diagnostic delay");
        this.window = activity.getWindow(); this.surface = surface; this.delayMs = delayMs;
        window.setCallback(this);
    }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        double begin = System.nanoTime() / 1e6;
        if (!stopped) {
            int action = event.getActionMasked();
            if (action == MotionEvent.ACTION_DOWN) {
                downX = event.getRawX(); downY = event.getRawY();
                surface.getLocationOnScreen(location);
                tracking = event.getRawX() >= location[0] && event.getRawX() < location[0] + surface.getWidth()
                    && event.getRawY() >= location[1] && event.getRawY() < location[1] + surface.getHeight();
                delayed = false;
            }
            if (tracking) {
                if (count < rows.length) {
                    double[] row = rows[count++];
                    row[0] = event.getEventTime(); row[1] = begin; row[2] = action;
                    row[3] = event.getRawX(); row[4] = event.getRawY();
                } else overflow++;
                if (delayMs > 0 && action == MotionEvent.ACTION_MOVE && !delayed
                        && (event.getRawX() != downX || event.getRawY() != downY)) {
                    delayed = true; android.os.SystemClock.sleep(delayMs);
                }
                if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) tracking = false;
            }
        }
        workMs += System.nanoTime() / 1e6 - begin;
        return super.dispatchTouchEvent(event);
    }
    public void cancel() {
        if (stopped) return;
        stopped = true;
        if (window.getCallback() == this) window.setCallback(getWrapped());
        surface = null;
    }
    public String finish() {
        cancel();
        try {
            JSONArray samples = new JSONArray();
            for (int i = 0; i < count; i++) samples.put(new JSONArray(rows[i]));
            return new JSONObject().put("columns", new JSONArray(new String[]{"eventMs", "dispatchMs", "action", "x", "y"}))
                .put("events", samples).put("overflow", overflow).put("workMs", workMs)
                .put("delayMs", delayMs).put("clock", "uptime-ms").toString();
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}
