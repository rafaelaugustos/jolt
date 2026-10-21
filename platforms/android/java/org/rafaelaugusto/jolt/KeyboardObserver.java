package org.rafaelaugusto.jolt;

import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowInsets;
import android.view.WindowInsetsAnimation;
import android.view.animation.Interpolator;
import java.util.List;

/** Reports how much of a window the keyboard covers, and how it gets there. Moves nothing. */
public final class KeyboardObserver extends WindowInsetsAnimation.Callback
        implements ViewTreeObserver.OnGlobalLayoutListener {
    public interface Listener {
        void onChange(int height, long duration, float[] curve);
    }

    private static final int SAMPLES = 32;

    private final View root;
    private final Listener listener;
    private int height;
    private boolean animating;

    public KeyboardObserver(View root, Listener listener) {
        super(DISPATCH_MODE_CONTINUE_ON_SUBTREE);
        this.root = root;
        this.listener = listener;
    }

    public void attach() {
        height = covered();
        root.setWindowInsetsAnimationCallback(this);
        root.getViewTreeObserver().addOnGlobalLayoutListener(this);
    }

    public void detach() {
        root.setWindowInsetsAnimationCallback(null);
        root.getViewTreeObserver().removeOnGlobalLayoutListener(this);
    }

    public int height() {
        return height;
    }

    private int covered() {
        WindowInsets insets = root.getRootWindowInsets();
        return insets == null ? 0 : insets.getInsets(WindowInsets.Type.ime()).bottom;
    }

    private static boolean keyboard(WindowInsetsAnimation animation) {
        return (animation.getTypeMask() & WindowInsets.Type.ime()) != 0;
    }

    private static float[] sample(Interpolator interpolator) {
        if (interpolator == null) return null;
        float[] curve = new float[SAMPLES + 1];
        for (int i = 0; i <= SAMPLES; i++) curve[i] = interpolator.getInterpolation(i / (float) SAMPLES);
        return curve;
    }

    private void report(int next, long duration, float[] curve) {
        if (next == height) return;
        height = next;
        listener.onChange(next, duration, curve);
    }

    @Override
    public void onPrepare(WindowInsetsAnimation animation) {
        // The layout for the end state comes before onStart; let onStart report it with its timing.
        if (keyboard(animation)) animating = true;
    }

    @Override
    public WindowInsetsAnimation.Bounds onStart(WindowInsetsAnimation animation, WindowInsetsAnimation.Bounds bounds) {
        if (!keyboard(animation)) return bounds;
        // The end state is already in the root insets when the animation starts.
        report(covered(), animation.getDurationMillis(), sample(animation.getInterpolator()));
        return bounds;
    }

    @Override
    public WindowInsets onProgress(WindowInsets insets, List<WindowInsetsAnimation> running) {
        return insets;
    }

    @Override
    public void onEnd(WindowInsetsAnimation animation) {
        if (!keyboard(animation)) return;
        animating = false;
        report(covered(), 0, null);
    }

    @Override
    public void onGlobalLayout() {
        if (!animating) report(covered(), 0, null);
    }
}
