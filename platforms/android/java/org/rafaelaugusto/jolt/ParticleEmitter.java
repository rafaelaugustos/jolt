package org.rafaelaugusto.jolt;

import android.database.ContentObserver;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Choreographer;
import android.view.View;
import android.view.ViewParent;

/** A visual-only ViewOverlay drawable: all integration, deadlines and drawing stay in Java. */
public final class ParticleEmitter extends Drawable implements Choreographer.FrameCallback, View.OnAttachStateChangeListener {
    public interface Listener { void onEnd(); }
    private static int activeCount;
    private View target, host;
    private final boolean overlay;
    private final float density;
    private final ParticleSimulation simulation;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Choreographer choreographer = Choreographer.getInstance();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final float[] point = new float[2];
    private final int[] location = new int[2];
    private final long[] intervals = new long[512];
    private final ContentObserver scaleObserver = new ContentObserver(handler) {
        @Override public void onChange(boolean selfChange) { if (disabled()) stop(); }
    };
    private Listener listener;
    private boolean started, stopped, observing;
    private long began, lastFrame, frames, draws, workNanos, drawNanos;
    private float originX, originY, corner;
    private final Runnable expire = new Runnable() { @Override public void run() { stop(); } };
    private final long deadline;

    public ParticleEmitter(View target, boolean overlay, int[] colors, int shape, int source,
            double rate, double lifetimeMs, float size, float velocity, float velocityRange,
            float angle, float spread, float gravity, float spin, float spinRange,
            boolean fade, double durationMs, Listener listener) {
        this.target = target; this.host = overlay ? target.getRootView() : target; this.overlay = overlay;
        this.listener = listener;
        density = target.getResources().getDisplayMetrics().density;
        simulation = new ParticleSimulation(colors, shape, source, rate, lifetimeMs, size,
                velocity, velocityRange, angle, spread, gravity, spin, spinRange, fade, durationMs, System.nanoTime());
        deadline = durationMs < 0 ? -1 : (long)Math.ceil(durationMs + lifetimeMs);
    }

    private boolean disabled() {
        return target != null && Settings.Global.getFloat(target.getContext().getContentResolver(),
                Settings.Global.ANIMATOR_DURATION_SCALE, 1) == 0;
    }
    private boolean valid() {
        return target != null && target.isAttachedToWindow() && target.getWindowVisibility() == View.VISIBLE
                && target.isShown() && target.getWidth() > 0 && target.getHeight() > 0
                && host.getWindowToken() != null && host.getWindowToken() == target.getWindowToken()
                && (!overlay || host == target.getRootView());
    }
    public void start() {
        if (started || stopped) return;
        if (!valid() || disabled()) { stop(); return; }
        started = true; activeCount++;
        began = SystemClock.uptimeMillis();
        if (overlay) {
            // Convert the center through transforms and parent scrolling into root-overlay coordinates.
            point[0] = target.getWidth() * .5f; point[1] = target.getHeight() * .5f;
            View current = target;
            while (current != host) {
                current.getMatrix().mapPoints(point);
                point[0] += current.getLeft(); point[1] += current.getTop();
                ViewParent parent = current.getParent();
                if (!(parent instanceof View)) { stop(); return; }
                current = (View)parent;
                point[0] -= current.getScrollX(); point[1] -= current.getScrollY();
            }
            originX = point[0]; originY = point[1];
        }
        target.addOnAttachStateChangeListener(this);
        target.getContext().getContentResolver().registerContentObserver(
                Settings.Global.getUriFor(Settings.Global.ANIMATOR_DURATION_SCALE), false, scaleObserver);
        observing = true;
        setBounds(0, 0, host.getWidth(), host.getHeight());
        host.getOverlay().add(this);
        if (deadline >= 0) handler.postDelayed(expire, deadline);
        choreographer.postFrameCallback(this);
    }

    /** Layout/identity checks at JS boundaries; moving views otherwise stay in their native overlay. */
    public void refresh(float cornerPixels) {
        corner = Math.max(0, cornerPixels);
        if (!stopped && started && !valid()) stop();
    }
    @Override public void doFrame(long frameTimeNanos) {
        if (stopped) return;
        long workStart = System.nanoTime();
        if (!valid()) { stop(); return; }
        if (lastFrame != 0) intervals[(int)((frames - 1) % intervals.length)] = frameTimeNanos - lastFrame;
        lastFrame = frameTimeNanos; frames++;
        // Deliberately use monotonic wall time: UI stalls cannot extend emission/lifetime deadlines.
        simulation.advance((SystemClock.uptimeMillis() - began) / 1000d,
                overlay ? 0 : target.getWidth() / density, overlay ? 0 : target.getHeight() / density);
        if (simulation.finished()) { stop(); return; }
        if (getBounds().width() != host.getWidth() || getBounds().height() != host.getHeight())
            setBounds(0, 0, host.getWidth(), host.getHeight());
        invalidateSelf();
        workNanos += System.nanoTime() - workStart;
        choreographer.postFrameCallback(this);
    }

    @Override public void draw(Canvas canvas) {
        if (stopped) return;
        long drawStart = System.nanoTime(); draws++;
        int save = canvas.save();
        // The overlay is above this host's content, bounded by the host/window viewport.
        canvas.clipRect(getBounds());
        if (!overlay && corner > 0) {
            // A retained path avoids allocating rounded clips per frame.
            clip.rewind();
            rect.set(getBounds());
            clip.addRoundRect(rect, corner, corner, android.graphics.Path.Direction.CW);
            canvas.clipPath(clip);
        }
        if (overlay) canvas.translate(originX, originY);
        canvas.scale(density, density);
        float size = simulation.size, radius = size * .5f;
        paint.setStyle(simulation.shape == 2 ? Paint.Style.STROKE : Paint.Style.FILL);
        paint.setStrokeWidth(size * (3f / 32));
        for (int i = 0, count = simulation.live(); i < count; i++) {
            paint.setColor(simulation.color(i));
            float x = simulation.x(i), y = simulation.y(i);
            if (simulation.shape == 1) {
                int particleSave = canvas.save();
                canvas.rotate(simulation.rotation(i), x, y);
                canvas.drawRect(x - radius, y - size * (9f / 32), x + radius, y + size * (9f / 32), paint);
                canvas.restoreToCount(particleSave);
            } else canvas.drawCircle(x, y, simulation.shape == 2 ? size * (14f / 32) : radius, paint);
        }
        canvas.restoreToCount(save);
        drawNanos += System.nanoTime() - drawStart;
    }
    private final android.graphics.Path clip = new android.graphics.Path();
    private final android.graphics.RectF rect = new android.graphics.RectF();

    public void stop() {
        if (stopped) return;
        stopped = true;
        choreographer.removeFrameCallback(this);
        handler.removeCallbacks(expire);
        if (observing) target.getContext().getContentResolver().unregisterContentObserver(scaleObserver);
        observing = false;
        if (started) { activeCount--; target.removeOnAttachStateChangeListener(this); host.getOverlay().remove(this); }
        simulation.clear();
        setCallback(null);
        target = host = null;
        Listener done = listener; listener = null;
        if (done != null) done.onEnd();
    }
    @Override public void onViewAttachedToWindow(View view) { }
    @Override public void onViewDetachedFromWindow(View view) { stop(); }
    @Override public void setAlpha(int alpha) { }
    @Override public void setColorFilter(ColorFilter filter) { paint.setColorFilter(filter); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }

    // Native conformance/diagnostics. Reads allocate only when explicitly requested, never per frame.
    public static int getActiveCount() { return activeCount; }
    public boolean isStopped() { return stopped; }
    public int getLiveCount() { return simulation.live(); }
    public int getPeakCount() { return simulation.peak(); }
    public int getCapacity() { return simulation.capacity(); }
    public long getEmittedCount() { return simulation.emitted(); }
    public long getSkippedCount() { return simulation.skipped(); }
    public long getFrameCount() { return frames; }
    public long getDrawCount() { return draws; }
    public long getWorkNanos() { return workNanos; }
    public long getDrawNanos() { return drawNanos; }
    public float getDensity() { return density; }
    public double getTimeSeconds() { return simulation.time(); }
    public boolean isObserving() { return observing; }
    public float[] getOriginInWindow() {
        if (host != null) host.getLocationInWindow(location);
        return new float[] { originX + location[0], originY + location[1] };
    }
    public float[] getParticle(int index) { return new float[] { simulation.x(index), simulation.y(index), simulation.rotation(index), simulation.color(index) }; }
    public long[] getFrameIntervals() {
        int count = (int)Math.min(Math.max(0, frames - 1), intervals.length);
        return java.util.Arrays.copyOf(intervals, count);
    }
}
