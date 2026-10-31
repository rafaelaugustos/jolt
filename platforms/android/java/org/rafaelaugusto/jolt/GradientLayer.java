package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.LinearGradient;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.RadialGradient;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.SweepGradient;
import android.view.animation.LinearInterpolator;

/** Paints a linear, radial or conic gradient and plays sampled frames. All frame updates stay in native code. */
public final class GradientLayer extends android.graphics.drawable.Drawable {
    public interface Listener {
        void onEnd(boolean finished);
    }

    // 0 = linear, 1 = radial, 2 = conic.
    private final int type;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF area = new RectF();
    private final Matrix matrix = new Matrix();
    private int[] colors = new int[0];
    private float[] stops = new float[0];
    // angle, x, y, radius
    private final float[] geometry = new float[4];
    private float corner;
    private long duration, delay;
    private int repeat;
    private boolean reverse;
    private ValueAnimator animator;
    private Listener listener;

    private float[] times;
    private int[] frameColors;
    private float[] frameStops;
    private float[] frameGeometry;

    public GradientLayer(int type) {
        this.type = type;
    }

    public void setCorner(float radius) {
        corner = radius;
        invalidateSelf();
    }

    public void paint(int[] colors, float[] stops, float angle, float x, float y, float radius) {
        cancel();
        this.colors = colors;
        this.stops = stops;
        geometry[0] = angle;
        geometry[1] = x;
        geometry[2] = y;
        geometry[3] = radius;
        invalidateSelf();
    }

    /** Frames are flattened: `colors.length / times.length` colors and stops per frame, four geometry values per frame. */
    public void play(float[] times, int[] colors, float[] stops, float[] geometry, long duration, long delay, int repeat, boolean reverse, Listener listener) {
        cancel();
        this.times = times;
        frameColors = colors;
        frameStops = stops;
        frameGeometry = geometry;
        this.duration = duration;
        this.delay = delay;
        this.repeat = repeat;
        this.reverse = reverse;
        this.listener = listener;
        int count = colors.length / times.length;
        this.colors = new int[count];
        this.stops = new float[count];
        apply(0);
        clock(0);
    }

    /** Rejoin the source position. Binding windows include delays in their frames. */
    public void control(long elapsed, boolean paused) {
        if (animator == null) return;
        if (paused) {
            animator.setCurrentPlayTime(Math.max(0, elapsed - delay));
            animator.pause();
        } else if (animator.isPaused()) clock(Math.max(0, elapsed));
        else animator.setCurrentPlayTime(Math.max(0, elapsed - delay));
    }

    /** A resume rebuilds the animator: Android moves a seeked start time by the paused duration on the frame after resume(). */
    private void clock(long elapsed) {
        ValueAnimator old = animator;
        if (old != null) {
            old.removeAllUpdateListeners();
            old.removeAllListeners();
            old.cancel();
        }
        final ValueAnimator animation = ValueAnimator.ofFloat(0f, 1f);
        animation.setDuration(Math.max(duration, 1));
        animation.setStartDelay(Math.max(0, delay - elapsed));
        animation.setInterpolator(new LinearInterpolator());
        if (repeat != 0) {
            animation.setRepeatCount(repeat < 0 ? ValueAnimator.INFINITE : repeat);
            animation.setRepeatMode(reverse ? ValueAnimator.REVERSE : ValueAnimator.RESTART);
        }
        animation.addUpdateListener(new ValueAnimator.AnimatorUpdateListener() {
            @Override
            public void onAnimationUpdate(ValueAnimator updated) {
                apply(updated.getAnimatedFraction());
                invalidateSelf();
            }
        });
        animation.addListener(new AnimatorListenerAdapter() {
            private boolean cancelled;

            @Override
            public void onAnimationCancel(Animator ended) {
                cancelled = true;
            }

            @Override
            public void onAnimationEnd(Animator ended) {
                if (animator != animation) return;
                animator = null;
                Listener done = GradientLayer.this.listener;
                GradientLayer.this.listener = null;
                if (done != null) done.onEnd(!cancelled);
            }
        });
        animator = animation;
        if (elapsed > delay) animation.setCurrentPlayTime(elapsed - delay);
        animation.start();
    }

    public boolean isPlaying() { return animator != null; }
    public float getCorner() { return corner; }
    public float[] getGeometry() { return geometry.clone(); }
    public float[] getStops() { return stops.clone(); }
    public int[] getColors() { return colors.clone(); }
    public int getSampleCount() { return times == null ? 0 : times.length; }

    public void dispose() {
        cancel();
        colors = new int[0];
        stops = new float[0];
        setCallback(null);
    }

    public void cancel() {
        ValueAnimator running = animator;
        animator = null;
        listener = null;
        if (running != null) {
            running.removeAllUpdateListeners();
            running.removeAllListeners();
            running.cancel();
        }
        times = null;
        frameColors = null;
        frameStops = null;
        frameGeometry = null;
    }

    private void apply(float fraction) {
        int frames = times.length;
        int count = colors.length;
        int i = 0;
        while (i < frames - 2 && fraction > times[i + 1]) i++;
        float span = times[i + 1] - times[i];
        float t = span > 0 ? Math.max(0f, Math.min(1f, (fraction - times[i]) / span)) : 1f;
        for (int c = 0; c < count; c++) {
            colors[c] = lerpColor(frameColors[i * count + c], frameColors[(i + 1) * count + c], t);
            stops[c] = lerp(frameStops[i * count + c], frameStops[(i + 1) * count + c], t);
        }
        for (int g = 0; g < 4; g++) geometry[g] = lerp(frameGeometry[i * 4 + g], frameGeometry[(i + 1) * 4 + g], t);
    }

    private static float lerp(float a, float b, float t) {
        return a + (b - a) * t;
    }

    private static int lerpColor(int a, int b, float t) {
        int alpha = Math.round(lerp((a >>> 24) & 0xff, (b >>> 24) & 0xff, t));
        int red = Math.round(lerp((a >> 16) & 0xff, (b >> 16) & 0xff, t));
        int green = Math.round(lerp((a >> 8) & 0xff, (b >> 8) & 0xff, t));
        int blue = Math.round(lerp(a & 0xff, b & 0xff, t));
        return (alpha << 24) | (red << 16) | (green << 8) | blue;
    }

    @Override
    public void draw(Canvas canvas) {
        Rect bounds = getBounds();
        float width = bounds.width();
        float height = bounds.height();
        if (width <= 0 || height <= 0 || colors.length < 2) return;
        double radians = Math.toRadians(geometry[0]);
        float sin = (float) Math.sin(radians);
        float cos = (float) Math.cos(radians);
        float left = bounds.left;
        float top = bounds.top;
        Shader shader;
        if (type == 0) {
            float half = (Math.abs(width * sin) + Math.abs(height * cos)) / 2f;
            float cx = left + width / 2f;
            float cy = top + height / 2f;
            shader = new LinearGradient(cx - sin * half, cy + cos * half, cx + sin * half, cy - cos * half, colors, stops, Shader.TileMode.CLAMP);
        } else if (type == 1) {
            float radius = Math.max(geometry[3] * Math.min(width, height), 0.01f);
            shader = new RadialGradient(left + geometry[1] * width, top + geometry[2] * height, radius, colors, stops, Shader.TileMode.CLAMP);
        } else {
            float cx = left + geometry[1] * width;
            float cy = top + geometry[2] * height;
            SweepGradient sweep = new SweepGradient(cx, cy, colors, stops);
            // Turned so the first color starts at 12 o'clock and sweeps clockwise, as on iOS and in CSS.
            matrix.setRotate(geometry[0] + 90f, cx, cy);
            sweep.setLocalMatrix(matrix);
            shader = sweep;
        }
        paint.setShader(shader);
        area.set(bounds);
        if (corner > 0) canvas.drawRoundRect(area, corner, corner, paint);
        else canvas.drawRect(area, paint);
    }

    @Override
    public void setAlpha(int alpha) {
        paint.setAlpha(alpha);
        invalidateSelf();
    }

    @Override
    public void setColorFilter(ColorFilter filter) {
        paint.setColorFilter(filter);
        invalidateSelf();
    }

    @Override
    public int getOpacity() {
        return PixelFormat.TRANSLUCENT;
    }
}
