package org.rafaelaugusto.jolt;

import android.graphics.Rect;
import android.view.GestureDetector;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.View;
import org.json.JSONObject;
import org.json.JSONException;

/** Native arbitration, pointer rebasing and NestedScrollView consumption. */
public final class GestureSession {
    public interface Listener { void onState(int state, double velocityX, double velocityY); }
    private final GestureSurface surface;
    private final View scroll;
    private final LiveSpring x, y, scale, rotation;
    private final Listener listener;
    private final GestureDetector taps;
    private final double density, threshold, failOffset;
    private final int axis;
    private final boolean pinch, rotate, tapEnabled, doubleEnabled, contactEvents;
    private double minX, maxX, minY, maxY, minScale, maxScale;
    private double downX, downY, lastX, lastY, lastSpan, lastAngle, velocityX, velocityY;
    private boolean enabled = true, disposed, active, rejected, fromScroll, contact, ending;
    private VelocityTracker velocity;

    public GestureSession(GestureSurface surface, View scroll, LiveSpring x, LiveSpring y, LiveSpring scale, LiveSpring rotation, String options, Listener listener) {
        if (scroll != null && !(scroll instanceof androidx.core.view.NestedScrollingChild3))
            throw new IllegalArgumentException("Scroll handoff requires NativeScript's NestedScrollView implementation");
        this.surface = surface; this.scroll = scroll; this.x = x; this.y = y; this.scale = scale; this.rotation = rotation; this.listener = listener;
        density = surface.getResources().getDisplayMetrics().density;
        try {
            JSONObject config = new JSONObject(options);
            axis = config.getInt("axis"); threshold = config.getDouble("threshold"); failOffset = config.getDouble("failOffset");
            pinch = config.getBoolean("pinch"); rotate = config.getBoolean("rotate");
            tapEnabled = config.getBoolean("tap"); doubleEnabled = config.getBoolean("doubleTap");
            contactEvents = config.optBoolean("contactEvents", false);
            minX = config.getDouble("minX"); maxX = config.getDouble("maxX"); minY = config.getDouble("minY"); maxY = config.getDouble("maxY");
            minScale = config.getDouble("minScale"); maxScale = config.getDouble("maxScale");
        } catch (JSONException error) { throw new IllegalArgumentException(error); }
        taps = new GestureDetector(surface.getContext(), new GestureDetector.SimpleOnGestureListener() {
            @Override public boolean onDown(MotionEvent event) { return true; }
            @Override public boolean onSingleTapUp(MotionEvent event) { if (tapEnabled && !doubleEnabled) emit(4); return true; }
            @Override public boolean onSingleTapConfirmed(MotionEvent event) { if (tapEnabled) emit(4); return true; }
            @Override public boolean onDoubleTapEvent(MotionEvent event) { if (event.getActionMasked() == MotionEvent.ACTION_UP) emit(5); return true; }
        });
        if (!doubleEnabled) taps.setOnDoubleTapListener(null);
        surface.setSession(this);
    }
    public static boolean supportsContactEvents() { return true; }
    public boolean isActive() { return active; }
    boolean intercepts() { return enabled && active && !fromScroll; }
    boolean accepts(View target) { return enabled && !disposed && target == scroll; }
    private static double clamp(double value, double min, double max) { return Math.max(min, Math.min(max, value)); }
    private void emit(int state) { if (!disposed && listener != null) listener.onState(state, velocityX, velocityY); }
    private void begin() {
        if (active || !enabled || disposed) return;
        active = true;
        x.holdInput(x.getPosition(), 0); y.holdInput(y.getPosition(), 0);
        scale.holdInput(scale.getPosition(), 0); rotation.holdInput(rotation.getPosition(), 0);
        if (surface.getParent() != null) surface.getParent().requestDisallowInterceptTouchEvent(true);
        emit(1);
    }
    void before(MotionEvent event) {
        if (!enabled || disposed) return;
        if (!surface.isEnabled()) { cancel(); return; }
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN) {
            cancel(); if (disposed || !enabled) return;
            contact = true; rejected = false; velocityX = velocityY = 0;
            velocity = VelocityTracker.obtain();
            fromScroll = false;
            if (scroll != null) {
                Rect bounds = new Rect(); scroll.getDrawingRect(bounds); surface.offsetDescendantRectToMyCoords(scroll, bounds);
                fromScroll = bounds.contains((int)event.getX(), (int)event.getY());
            }
            rebase(event, -1); downX = lastX; downY = lastY;
            if (contactEvents) emit(6);
        }
        if (!contact) return;
        if (velocity != null) {
            MotionEvent raw = MotionEvent.obtain(event);
            raw.offsetLocation(event.getRawX() - event.getX(), event.getRawY() - event.getY());
            velocity.addMovement(raw); raw.recycle();
            if (action == MotionEvent.ACTION_UP) {
                velocity.computeCurrentVelocity(1000);
                velocityX = (axis & 1) != 0 ? velocity.getXVelocity(event.getPointerId(0)) / density : 0;
                velocityY = (axis & 2) != 0 ? velocity.getYVelocity(event.getPointerId(0)) / density : 0;
            }
        }
        if (tapEnabled || doubleEnabled) taps.onTouchEvent(event);
        if (disposed || !enabled) return;
        if (action == MotionEvent.ACTION_POINTER_DOWN || action == MotionEvent.ACTION_POINTER_UP) {
            rebase(event, action == MotionEvent.ACTION_POINTER_UP ? event.getActionIndex() : -1);
            if (!active) { downX = lastX; downY = lastY; }
            if (velocity != null) velocity.clear();
            if (!fromScroll && (pinch || rotate) && event.getPointerCount() >= 2 && action == MotionEvent.ACTION_POINTER_DOWN) begin();
            return;
        }
        if (action != MotionEvent.ACTION_MOVE) return;
        double cx = 0, cy = 0;
        for (int index = 0; index < event.getPointerCount(); index++) { cx += event.getX(index); cy += event.getY(index); }
        cx /= event.getPointerCount() * density; cy /= event.getPointerCount() * density;
        cx += (event.getRawX() - event.getX()) / density; cy += (event.getRawY() - event.getY()) / density;
        if (velocity != null) {
            velocity.computeCurrentVelocity(1000);
            velocityX = (axis & 1) != 0 ? velocity.getXVelocity(event.getPointerId(0)) / density : 0;
            velocityY = (axis & 2) != 0 ? velocity.getYVelocity(event.getPointerId(0)) / density : 0;
        }
        if (!active && !fromScroll && !rejected) {
            double dx = Math.abs(cx - downX), dy = Math.abs(cy - downY);
            if (axis == 1 && dy > failOffset || axis == 2 && dx > failOffset) rejected = true;
            else if (axis != 0 && (axis == 1 ? dx : axis == 2 ? dy : Math.hypot(dx, dy)) >= threshold) begin();
        }
        if (active && !fromScroll && !disposed) {
            if ((axis & 1) != 0) x.holdInput(clamp(x.getPosition() + cx - lastX, minX, maxX), velocityX);
            if ((axis & 2) != 0) y.holdInput(clamp(y.getPosition() + cy - lastY, minY, maxY), velocityY);
            if (event.getPointerCount() >= 2) {
                double dx = event.getX(1) - event.getX(0), dy = event.getY(1) - event.getY(0);
                double span = Math.hypot(dx, dy), angle = Math.atan2(dy, dx);
                if (pinch && lastSpan > 0) scale.holdInput(clamp(scale.getPosition() * span / lastSpan, minScale, maxScale), 0);
                if (rotate && lastSpan > 0) rotation.holdInput(rotation.getPosition() + Math.atan2(Math.sin(angle - lastAngle), Math.cos(angle - lastAngle)) * 180 / Math.PI, 0);
                lastSpan = span; lastAngle = angle;
            }
        }
        lastX = cx; lastY = cy;
    }
    private void rebase(MotionEvent event, int excluding) {
        double cx = 0, cy = 0; int count = 0, a = -1, b = -1;
        for (int index = 0; index < event.getPointerCount(); index++) if (index != excluding) {
            cx += event.getX(index); cy += event.getY(index); count++;
            if (a < 0) a = index; else if (b < 0) b = index;
        }
        if (count > 0) { lastX = (cx / count + event.getRawX() - event.getX()) / density; lastY = (cy / count + event.getRawY() - event.getY()) / density; }
        lastSpan = b < 0 ? 0 : Math.hypot(event.getX(b) - event.getX(a), event.getY(b) - event.getY(a));
        lastAngle = b < 0 ? 0 : Math.atan2(event.getY(b) - event.getY(a), event.getX(b) - event.getX(a));
    }
    void after(MotionEvent event) {
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_UP) finish(false);
        else if (action == MotionEvent.ACTION_CANCEL) finish(true);
    }
    int consume(int pixels, boolean atTop) {
        if (!contact || pixels == 0 || pixels < 0 && !atTop) return 0;
        double before = y.getPosition(), next = clamp(before - pixels / density, minY, maxY);
        int consumed = (int)Math.round((before - next) * density);
        if (consumed == 0) return 0;
        begin();
        if (disposed || !enabled || !active) return 0;
        y.holdInput(before - consumed / density, velocityY);
        return consumed;
    }
    boolean preFling(float vx, float vy) {
        if (!active) return false;
        velocityX = 0; velocityY = -vy / density;
        return y.getPosition() > minY + .01 || vy < 0 && !scroll.canScrollVertically(-1);
    }
    private void finish(boolean cancelled) {
        boolean hadContact = contact;
        contact = false;
        if (velocity != null) { velocity.recycle(); velocity = null; }
        if (!active) { if (hadContact && contactEvents) emit(7); return; }
        active = false;
        x.releaseInput(x.getPosition(), 0); y.releaseInput(y.getPosition(), 0);
        scale.releaseInput(scale.getPosition(), 0); rotation.releaseInput(rotation.getPosition(), 0);
        if (surface.getParent() != null) surface.getParent().requestDisallowInterceptTouchEvent(false);
        ending = !cancelled;
        try { emit(cancelled ? 3 : 2); } finally { ending = false; }
        if (hadContact && contactEvents) emit(7);
    }
    public void cancel() {
        if (active) finish(true);
        else {
            finish(true);
            x.releaseInput(x.getPosition(), 0); y.releaseInput(y.getPosition(), 0);
            scale.releaseInput(scale.getPosition(), 0); rotation.releaseInput(rotation.getPosition(), 0);
        }
    }
    public void setEnabled(boolean value) { enabled = value; if (!value) cancel(); }
    public void settle(double tx, double ty, double ts, double tr, boolean animated) {
        if (disposed) return;
        double vx = ending ? velocityX : x.getVelocity(), vy = ending ? velocityY : y.getVelocity();
        cancel();
        double[] targets = {clamp(tx, minX, maxX), clamp(ty, minY, maxY), clamp(ts, minScale, maxScale), tr};
        LiveSpring[] nodes = {x, y, scale, rotation};
        for (int index = 0; index < nodes.length; index++) {
            if (!animated) nodes[index].holdInput(targets[index], 0);
            nodes[index].releaseInput(targets[index], animated ? index == 0 ? vx : index == 1 ? vy : 0 : 0);
        }
    }
    public void updateBounds(double left, double right, double top, double bottom) { minX = left; maxX = right; minY = top; maxY = bottom; }
    public void dispose() {
        if (disposed) return;
        cancel(); disposed = true; surface.setSession(null);
        MotionEvent cancel = MotionEvent.obtain(0, 0, MotionEvent.ACTION_CANCEL, 0, 0, 0);
        taps.onTouchEvent(cancel); cancel.recycle();
    }
}
