package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.method.TransformationMethod;
import android.text.style.ReplacementSpan;
import android.view.animation.LinearInterpolator;
import android.view.animation.PathInterpolator;
import android.widget.TextView;

/** Rolls the changed positions of a TextView with one native animator. */
public final class NumberRoll {
    public interface Callback {
        void onEnd(boolean finished);
    }

    private static final int MAX_POSITIONS = 256;
    private final TextView view;
    private final CharSequence original;
    private final CharSequence shown;
    private final TransformationMethod method;
    private final DigitSpan[] spans;
    private final int[] starts;
    private final int[] ends;
    private final float[] times;
    private final float[] values;
    private final long duration;
    private final long delay;
    private final long stagger;
    private final long fade;
    private final boolean tabular;
    private final Callback callback;
    private final PathInterpolator ease = new PathInterpolator(0f, 0f, 0.58f, 1f);
    private ValueAnimator animator;
    private CharSequence current;
    private boolean removedMethod;
    private boolean ended;

    // Positions are ordered from the end of the text; each one starts `stagger` after the previous.
    public NumberRoll(TextView view, int[] starts, int[] ends, String[] previous, int direction,
            float[] times, float[] values, long duration, long delay, long stagger, float shift,
            long fade, boolean tabular, Callback callback) {
        this.view = view;
        this.original = view.getText();
        // NativeScript installs a TransformationMethod that rebuilds the displayed text from its
        // own model, discarding spans set from here. Work on what is displayed and remove it while rolling.
        this.method = view.getTransformationMethod();
        CharSequence displayed = method != null && original != null ? method.getTransformation(original, view) : original;
        this.shown = displayed != null ? displayed : "";
        this.starts = starts;
        this.ends = ends;
        this.times = times;
        this.values = values;
        this.duration = duration;
        this.delay = delay;
        this.stagger = stagger;
        this.fade = fade;
        this.tabular = tabular;
        this.callback = callback;
        spans = new DigitSpan[starts.length];
        for (int i = 0; i < starts.length; i++) {
            String old = i < previous.length && previous[i] != null ? previous[i] : "";
            spans[i] = new DigitSpan(old, direction, shift, values.length > 0 ? values[0] : shift);
        }
    }

    public boolean isSupported() {
        if (original == null || starts.length == 0 || starts.length > MAX_POSITIONS) return false;
        if (ends.length != starts.length || times.length < 2 || times.length != values.length) return false;
        int length = shown.length();
        for (int i = 0; i < starts.length; i++) {
            if (starts[i] < 0 || ends[i] > length || starts[i] >= ends[i]) return false;
        }
        return true;
    }

    public void start() {
        if (ended || animator != null) return;
        if (tabular) view.setFontFeatureSettings("tnum");
        SpannableStringBuilder spannable = new SpannableStringBuilder(shown);
        for (int i = 0; i < spans.length; i++) {
            spannable.setSpan(spans[i], starts[i], ends[i], Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        }
        if (method != null) {
            removedMethod = true;
            view.setTransformationMethod(null);
        }
        view.setText(spannable);
        current = view.getText();
        final long total = delay + duration + stagger * (spans.length - 1);
        animator = ValueAnimator.ofFloat(0f, 1f);
        animator.setDuration(Math.max(total, 1));
        animator.setInterpolator(new LinearInterpolator());
        animator.addUpdateListener(animation -> update(animation.getAnimatedFraction() * total));
        animator.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                finish(true);
            }
        });
        animator.start();
    }

    public void cancel() {
        finish(false);
        if (animator != null) animator.cancel();
    }

    private void update(float elapsed) {
        for (int i = 0; i < spans.length; i++) {
            float local = elapsed - delay - stagger * i;
            spans[i].set(sample(local), alpha(local));
        }
        view.invalidate();
    }

    private float sample(float local) {
        if (local <= 0) return values[0];
        if (local >= duration) return values[values.length - 1];
        float t = local / duration;
        int i = 1;
        while (i < times.length - 1 && times[i] < t) i++;
        float span = times[i] - times[i - 1];
        float fraction = span > 0 ? (t - times[i - 1]) / span : 1f;
        return values[i - 1] + (values[i] - values[i - 1]) * fraction;
    }

    private float alpha(float local) {
        if (local <= 0) return 0f;
        if (fade <= 0 || local >= fade) return 1f;
        return ease.getInterpolation(local / fade);
    }

    private void finish(boolean finished) {
        if (ended) return;
        ended = true;
        if (current != null && view.getText() == current) view.setText(original);
        if (removedMethod) view.setTransformationMethod(method);
        callback.onEnd(finished);
    }

    /** Draws the new glyphs sliding in over the old ones sliding out, clipped to the line. */
    static final class DigitSpan extends ReplacementSpan {
        private final String previous;
        private final int direction;
        private final float shift;
        private float offset;
        private float alpha;

        DigitSpan(String previous, int direction, float shift, float offset) {
            this.previous = previous;
            this.direction = direction;
            this.shift = shift;
            this.offset = offset;
        }

        void set(float offset, float alpha) {
            this.offset = offset;
            this.alpha = alpha;
        }

        @Override
        public int getSize(Paint paint, CharSequence text, int start, int end, Paint.FontMetricsInt fm) {
            if (fm != null) paint.getFontMetricsInt(fm);
            return Math.round(Math.max(paint.measureText(text, start, end), paint.measureText(previous)));
        }

        @Override
        public void draw(Canvas canvas, CharSequence text, int start, int end, float x, int top, int y,
                int bottom, Paint paint) {
            int base = paint.getAlpha();
            float width = getSize(paint, text, start, end, null);
            canvas.save();
            canvas.clipRect(x, top, x + width, bottom);
            paint.setAlpha(Math.round(base * alpha));
            canvas.drawText(text, start, end, x, y + direction * offset, paint);
            if (!previous.isEmpty()) {
                paint.setAlpha(Math.round(base * (1f - alpha)));
                canvas.drawText(previous, x, y + direction * (offset - shift), paint);
            }
            paint.setAlpha(base);
            canvas.restore();
        }
    }
}
