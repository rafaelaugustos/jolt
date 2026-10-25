package org.rafaelaugusto.jolt;

import android.os.Build;
import android.os.SystemClock;
import android.view.Choreographer;
import android.view.View;
import androidx.activity.BackEventCompat;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.OnBackPressedDispatcherOwner;
import androidx.activity.ViewTreeOnBackPressedDispatcherOwner;
import androidx.lifecycle.Lifecycle;
import androidx.lifecycle.LifecycleEventObserver;
import androidx.lifecycle.LifecycleOwner;
import org.json.JSONArray;
import org.json.JSONObject;

/** AndroidX owns system input. Progress, presentation and spring settlement never cross JS. */
public final class PredictiveBackSession extends OnBackPressedCallback implements
        Choreographer.FrameCallback, View.OnAttachStateChangeListener, View.OnLayoutChangeListener, LifecycleEventObserver {
    public interface Listener { void onState(int state, double progress, double velocity, int edge); }
    // idle=0, tracking=1, cancelling=2, finishing=3, awaiting commit=4, cancelled=5, completed=6, disposed=7.
    private final View view;
    private final OnBackPressedDispatcherOwner owner;
    private Listener listener;
    private final SpringState spring = new SpringState(0, 0);
    private final double stiffness, damping, mass;
    private final float density, dx, dy, sx, sy, opacity, rotation;
    private final boolean mirror;
    private float baseX, baseY, baseSX, baseSY, baseAlpha, baseRotation;
    private int width, height, rootWidth, rootHeight, edge = -1, phase;
    private boolean captured, connected, disposed, scheduled, reduced, inputEnabled = true, ignorePress;
    private double target, speed = 1;
    private long lastProgressAt, previousFrame, settleAt;
    private static int callbacks, active, progressEvents;

    public static PredictiveBackSession attach(View view, String options, Listener listener) {
        if (Build.VERSION.SDK_INT < 34 || view == null || !view.isAttachedToWindow()) return null;
        OnBackPressedDispatcherOwner owner = ViewTreeOnBackPressedDispatcherOwner.get(view);
        if (owner == null || !owner.getLifecycle().getCurrentState().isAtLeast(Lifecycle.State.STARTED)) return null;
        return new PredictiveBackSession(view, owner, options, listener);
    }
    private PredictiveBackSession(View view, OnBackPressedDispatcherOwner owner, String options, Listener listener) {
        super(false);
        this.view = view; this.owner = owner; this.listener = listener;
        density = view.getResources().getDisplayMetrics().density;
        try {
            JSONObject config = new JSONObject(options), values = config.getJSONObject("values");
            dx = end(values, "x", 0) * density; dy = end(values, "y", 0) * density;
            sx = end(values, "scaleX", end(values, "scale", 1)); sy = end(values, "scaleY", end(values, "scale", 1));
            opacity = end(values, "opacity", 1); rotation = end(values, "rotate", 0);
            stiffness = config.getDouble("stiffness"); damping = config.getDouble("damping"); mass = config.getDouble("mass");
            if (!Float.isFinite(dx) || !Float.isFinite(dy) || !Float.isFinite(sx) || !Float.isFinite(sy) || !Float.isFinite(opacity) || !Float.isFinite(rotation))
                throw new IllegalArgumentException("Predictive back endpoints exceed native float bounds.");
            mirror = config.getBoolean("mirrorX"); reduced = config.getBoolean("reduced"); speed = config.getDouble("timeScale");
            inputEnabled = config.getBoolean("enabled");
        } catch (Exception error) { throw new IllegalArgumentException(error); }
        connected = true; callbacks++;
        owner.getOnBackPressedDispatcher().addCallback(owner, this);
        owner.getLifecycle().addObserver(this);
        view.addOnAttachStateChangeListener(this); view.addOnLayoutChangeListener(this);
        setEnabled(inputEnabled);
    }
    private static float end(JSONObject values, String key, float fallback) throws Exception {
        JSONArray pair = values.optJSONArray(key);
        return pair == null ? fallback : (float)pair.getDouble(1);
    }
    public static int callbackCount() { return callbacks; }
    public static int activeCount() { return active; }
    public static int progressEventCount() { return progressEvents; }
    public double getProgress() { return spring.position; }
    public void setMotion(boolean reduced, double timeScale) {
        this.reduced = reduced; this.speed = timeScale;
        if (reduced && captured) {
            if (phase == 1 || phase == 2) { cancel(); finish(); }
            else if (phase == 3) finish();
            else if (phase == 4) apply();
        }
    }
    public void setInputEnabled(boolean enabled) {
        inputEnabled = enabled;
        if (!enabled && (phase == 1 || phase == 2)) { cancel(); finish(); }
        if (!disposed) setEnabled(enabled);
    }
    private void emit(int state) {
        if (listener != null) listener.onState(state, spring.position, spring.velocity, edge);
    }
    private void capture() {
        if (captured) return;
        captured = true; active++;
        baseX = view.getTranslationX(); baseY = view.getTranslationY();
        baseSX = view.getScaleX(); baseSY = view.getScaleY(); baseAlpha = view.getAlpha(); baseRotation = view.getRotation();
        width = view.getWidth(); height = view.getHeight();
        rootWidth = view.getRootView().getWidth(); rootHeight = view.getRootView().getHeight();
    }
    private void restore() {
        if (!captured) return;
        view.setTranslationX(baseX); view.setTranslationY(baseY);
        view.setScaleX(baseSX); view.setScaleY(baseSY); view.setAlpha(baseAlpha); view.setRotation(baseRotation);
        captured = false; active--;
    }
    @Override public void handleOnBackStarted(BackEventCompat event) {
        if (disposed || !inputEnabled || phase == 3 || phase == 4) return;
        if (phase == 2) { finish(); if (disposed || phase != 0) return; }
        ignorePress = false;
        capture(); phase = 1; edge = event.getSwipeEdge(); spring.position = 0; spring.velocity = 0;
        lastProgressAt = SystemClock.uptimeMillis(); apply(); emit(1);
    }
    @Override public void handleOnBackProgressed(BackEventCompat event) {
        if (disposed || phase != 1 || ignorePress) return;
        progressEvents++;
        long now = SystemClock.uptimeMillis();
        double next = Math.max(0, Math.min(1, event.getProgress()));
        spring.velocity = now > lastProgressAt ? (next - spring.position) * 1000 / (now - lastProgressAt) : spring.velocity;
        lastProgressAt = now; spring.position = next;
        if (!validGeometry()) { cancel(); return; }
        apply();
    }
    @Override public void handleOnBackCancelled() {
        if (disposed) return;
        ignorePress = false;
        if (phase == 1) settle(false);
    }
    @Override public void handleOnBackPressed() {
        if (disposed || !inputEnabled || phase == 3 || phase == 4) return;
        if (ignorePress) { ignorePress = false; return; }
        if (phase == 2) { finish(); if (disposed || phase != 0) return; }
        if (!captured) { capture(); edge = -1; spring.position = 0; spring.velocity = 0; }
        settle(true);
    }
    private void settle(boolean commit) {
        if (disposed || !captured || phase == 4) return;
        if (SystemClock.uptimeMillis() - lastProgressAt > 100) spring.velocity = 0;
        phase = commit ? 3 : 2; target = commit ? 1 : 0;
        settleAt = SystemClock.uptimeMillis(); previousFrame = 0;
        emit(phase);
        if (disposed || !captured || (phase != 2 && phase != 3)) return;
        if (reduced) finish(); else schedule();
    }
    private void apply() {
        double p = reduced ? 0 : Math.max(0, Math.min(1, spring.position));
        float direction = mirror && edge == BackEventCompat.EDGE_RIGHT ? -1 : 1;
        view.setTranslationX(baseX + (float)p * dx * direction); view.setTranslationY(baseY + (float)p * dy);
        view.setScaleX(baseSX * (float)(1 + (sx - 1) * p)); view.setScaleY(baseSY * (float)(1 + (sy - 1) * p));
        view.setAlpha(baseAlpha * (float)(1 + (opacity - 1) * p)); view.setRotation(baseRotation + (float)p * rotation * direction);
    }
    private boolean validGeometry() {
        return view.isAttachedToWindow() && view.getWidth() == width && view.getHeight() == height &&
            view.getRootView().getWidth() == rootWidth && view.getRootView().getHeight() == rootHeight;
    }
    private void schedule() {
        if (scheduled || disposed || (phase != 2 && phase != 3)) return;
        scheduled = true; Choreographer.getInstance().postFrameCallback(this);
    }
    private void unschedule() { Choreographer.getInstance().removeFrameCallback(this); scheduled = false; }
    @Override public void doFrame(long nanos) {
        scheduled = false;
        if (disposed || (phase != 2 && phase != 3)) return;
        if (!validGeometry()) { cancel(); finish(); return; }
        double seconds = previousFrame == 0 ? 1.0 / 60 : Math.max(0, (nanos - previousFrame) / 1e9);
        previousFrame = nanos;
        spring.advance(target, stiffness * speed * speed, damping * speed, mass, seconds);
        if (!Double.isFinite(spring.position) || !Double.isFinite(spring.velocity)) { finish(); return; }
        apply();
        if ((Math.abs(spring.position - target) < .0005 && Math.abs(spring.velocity) < .005) || SystemClock.uptimeMillis() - settleAt >= 1500) finish();
        else schedule();
    }
    private void finish() {
        if (disposed || (phase != 2 && phase != 3)) return;
        unschedule(); boolean commit = phase == 3;
        spring.position = commit ? 1 : 0; spring.velocity = 0; apply();
        if (commit) { phase = 4; emit(4); }
        else { restore(); phase = 0; emit(5); }
    }
    public void completeCommit(boolean accepted) {
        if (disposed || phase != 4) return;
        if (accepted) { restore(); emit(6); dispose(); }
        else if (!view.isAttachedToWindow()) { restore(); emit(5); dispose(); }
        else { phase = 1; settle(false); }
    }
    public void cancel() {
        if (disposed || phase == 4 || phase == 3) return; // Once released, preserve Android's committed decision.
        if (phase == 1) { ignorePress = true; spring.velocity = 0; settle(false); }
    }
    private void disconnect() {
        if (!connected) return;
        connected = false; callbacks--; remove(); owner.getLifecycle().removeObserver(this);
        view.removeOnAttachStateChangeListener(this); view.removeOnLayoutChangeListener(this);
    }
    public void dispose() {
        if (disposed) return;
        disposed = true; unschedule(); restore(); disconnect(); phase = 0; emit(7); listener = null;
    }
    @Override public void onViewDetachedFromWindow(View v) {
        if (phase == 4) { restore(); disconnect(); } else dispose();
    }
    @Override public void onViewAttachedToWindow(View v) { }
    @Override public void onLayoutChange(View v, int l, int t, int r, int b, int ol, int ot, int or, int ob) {
        if (captured && !validGeometry()) { cancel(); finish(); }
    }
    @Override public void onStateChanged(LifecycleOwner source, Lifecycle.Event event) {
        if (event == Lifecycle.Event.ON_DESTROY) dispose();
        else if (event == Lifecycle.Event.ON_STOP && captured && phase != 4) {
            // Lifecycle callbacks unregister input until STARTED; keep the handle reusable on resume.
            phase = 2; ignorePress = true; finish();
        }
    }
}
