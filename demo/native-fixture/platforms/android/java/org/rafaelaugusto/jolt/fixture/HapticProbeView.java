package org.rafaelaugusto.jolt.fixture;

/** Demo-only instrumentation: record native requests, not proof of felt vibration. */
public final class HapticProbeView extends android.view.View {
    private final java.util.ArrayList<org.json.JSONObject> events = new java.util.ArrayList<>();
    private final android.graphics.Paint paint = new android.graphics.Paint(3);
    private long lastRequest;
    private final Runnable clearPulse = () -> invalidate();

    public HapticProbeView(android.content.Context context) {
        super(context);
        setWillNotDraw(false);
    }

    @Override public boolean performHapticFeedback(int effect) {
        long now = android.os.SystemClock.uptimeMillis();
        boolean accepted = super.performHapticFeedback(effect);
        try {
            org.json.JSONObject event = new org.json.JSONObject();
            event.put("at", now);
            event.put("effect", effect);
            event.put("accepted", accepted);
            event.put("xPixels", getTranslationX());
            event.put("yPixels", getTranslationY());
            if (events.size() == 128) events.remove(0);
            events.add(event);
        } catch (org.json.JSONException error) {
            throw new IllegalStateException(error);
        }
        lastRequest = now;
        invalidate();
        removeCallbacks(clearPulse);
        postDelayed(clearPulse, 140);
        return accepted;
    }

    public String getFeedbackEvents() { return new org.json.JSONArray(events).toString(); }
    public void clearFeedbackEvents() { events.clear(); }

    @Override protected void onDraw(android.graphics.Canvas canvas) {
        super.onDraw(canvas);
        if (lastRequest > 0 && android.os.SystemClock.uptimeMillis() - lastRequest < 140) {
            paint.setColor(0xffffffff);
            canvas.drawCircle(getWidth() / 2f, getHeight() / 2f, Math.min(getWidth(), getHeight()) / 3f, paint);
        }
    }

    @Override protected void onDetachedFromWindow() {
        removeCallbacks(clearPulse);
        super.onDetachedFromWindow();
    }
}
