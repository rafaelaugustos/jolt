package org.rafaelaugusto.jolt;

import android.animation.Keyframe;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.animation.TimeInterpolator;
import android.util.Property;
import android.view.View;
import android.view.animation.LinearInterpolator;

/** Builds a numeric track without creating a JavaScript proxy for every keyframe. */
public final class KeyframeFactory {
    private KeyframeFactory() {}

    public static ObjectAnimator create(View view, Property<View, Float> property,
            double[] times, double[] values, double unit) {
        if (times.length != values.length || values.length < 2) {
            throw new IllegalArgumentException("A track needs matching times and at least two values");
        }
        Keyframe[] frames = new Keyframe[values.length];
        for (int i = 0; i < values.length; i++) {
            // Scale in double precision before the same float conversion as Keyframe.ofFloat.
            frames[i] = Keyframe.ofFloat((float) times[i], (float) (values[i] * unit));
        }
        return ObjectAnimator.ofPropertyValuesHolder(view,
            PropertyValuesHolder.ofKeyframe(property, frames));
    }

    /**
     * Keep sampled tracks in primitive arrays. The animator's two values (0, 1)
     * pass the interpolator's result straight to the original native property.
     * This interpolator returns a property value, not normalized progress: callers
     * must preserve it. Playback timing, repeat/reverse and seeking remain native.
     */
    public static ObjectAnimator createCompact(View view, Property<View, Float> property,
            double[] times, double[] values, double unit) {
        if (times.length != values.length || values.length < 2) {
            throw new IllegalArgumentException("A track needs matching times and at least two values");
        }
        // Two-point tracks already have the smallest useful native representation.
        if (values.length == 2) return linear(view, property, times, values, unit);
        float[] offsets = new float[times.length];
        float[] samples = new float[values.length];
        for (int i = 0; i < times.length; i++) {
            offsets[i] = (float) times[i];
            samples[i] = (float) (values[i] * unit);
            // Preserve the old Android behavior for unusual tracks, including
            // distinct double offsets that collapse to the same native float.
            if (Float.isNaN(samples[i]) || Float.isInfinite(samples[i]) ||
                    Float.isNaN(offsets[i]) || Float.isInfinite(offsets[i]) ||
                    (i > 0 && offsets[i] <= offsets[i - 1])) {
                return linear(view, property, times, values, unit);
            }
        }
        if (offsets[0] != 0f || offsets[offsets.length - 1] != 1f) {
            return linear(view, property, times, values, unit);
        }
        ObjectAnimator animator = ObjectAnimator.ofFloat(view, property, 0f, 1f);
        animator.setInterpolator(new SampledInterpolator(offsets, samples));
        return animator;
    }

    private static ObjectAnimator linear(View view, Property<View, Float> property,
            double[] times, double[] values, double unit) {
        ObjectAnimator animator = create(view, property, times, values, unit);
        animator.setInterpolator(new LinearInterpolator());
        return animator;
    }

    private static final class SampledInterpolator implements TimeInterpolator {
        private final float[] times;
        private final float[] values;

        SampledInterpolator(float[] times, float[] values) {
            this.times = times;
            this.values = values;
        }

        @Override public float getInterpolation(float fraction) {
            int right = 1;
            if (fraction >= 1f) right = times.length - 1;
            else if (fraction > 0f) {
                // Upper bound also handles exact knots and backwards seeks.
                int high = times.length - 1;
                while (right < high) {
                    int mid = (right + high) >>> 1;
                    if (times[mid] > fraction) high = mid;
                    else right = mid + 1;
                }
            }
            int left = right - 1;
            float progress = (fraction - times[left]) / (times[right] - times[left]);
            return values[left] + progress * (values[right] - values[left]);
        }
    }
}
