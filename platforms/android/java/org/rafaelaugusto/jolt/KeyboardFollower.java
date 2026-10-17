package org.rafaelaugusto.jolt;

import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsAnimation;
import java.util.List;

/** Keeps a view above the keyboard while the IME animates. All frame updates stay in native code. */
public final class KeyboardFollower extends WindowInsetsAnimation.Callback {
    public interface Listener {
        void onStart();
        void onSettled(float translation);
    }

    private final View view;
    private final float offset;
    private final Listener listener;
    private float visualBottom;
    private float from;
    private float to;
    private boolean tracking;

    public KeyboardFollower(View view, float offset, Listener listener) {
        super(DISPATCH_MODE_CONTINUE_ON_SUBTREE);
        this.view = view;
        this.offset = offset;
        this.listener = listener;
    }

    public void attach() {
        view.setWindowInsetsAnimationCallback(this);
    }

    public void detach() {
        tracking = false;
        view.setWindowInsetsAnimationCallback(null);
        view.setTranslationY(0);
    }

    private static boolean keyboard(WindowInsetsAnimation animation) {
        return (animation.getTypeMask() & WindowInsets.Type.ime()) != 0;
    }

    private float bottom() {
        int[] location = new int[2];
        view.getLocationInWindow(location);
        return location[1] + view.getHeight();
    }

    @Override
    public void onPrepare(WindowInsetsAnimation animation) {
        if (!keyboard(animation)) return;
        visualBottom = bottom();
        tracking = true;
    }

    @Override
    public WindowInsetsAnimation.Bounds onStart(WindowInsetsAnimation animation, WindowInsetsAnimation.Bounds bounds) {
        if (!keyboard(animation) || !tracking) return bounds;
        listener.onStart();
        // The end state is laid out now; the view may already have moved with the layout.
        float untranslated = bottom() - view.getTranslationY();
        WindowInsets insets = view.getRootWindowInsets();
        int height = insets == null ? 0 : insets.getInsets(WindowInsets.Type.ime()).bottom;
        float top = view.getRootView().getHeight() - height;
        to = -Math.max(0, untranslated + offset - top);
        from = visualBottom - untranslated;
        view.setTranslationY(from);
        return bounds;
    }

    @Override
    public WindowInsets onProgress(WindowInsets insets, List<WindowInsetsAnimation> running) {
        if (!tracking) return insets;
        for (WindowInsetsAnimation animation : running) {
            if (keyboard(animation)) {
                view.setTranslationY(from + (to - from) * animation.getInterpolatedFraction());
                break;
            }
        }
        return insets;
    }

    @Override
    public void onEnd(WindowInsetsAnimation animation) {
        if (!keyboard(animation) || !tracking) return;
        tracking = false;
        view.setTranslationY(to);
        listener.onSettled(to);
    }
}
