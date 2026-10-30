package org.rafaelaugusto.jolt;

import android.animation.Keyframe;
import android.animation.ObjectAnimator;
import android.animation.PropertyValuesHolder;
import android.util.Property;
import android.view.View;

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
}
