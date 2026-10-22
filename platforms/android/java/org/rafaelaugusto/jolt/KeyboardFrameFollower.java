package org.rafaelaugusto.jolt;

import android.view.View;
import android.view.ViewTreeObserver;

/** Before Android 11: catches the view where it was when a keyboard layout moves it, and says where it should end up. */
public final class KeyboardFrameFollower implements ViewTreeObserver.OnGlobalLayoutListener {
    public interface Listener {
        void onMove(float from, float to, int keyboard);
    }

    private final View view;
    private final float offset;
    private final Listener listener;
    private int keyboard;
    private float visualBottom;

    public KeyboardFrameFollower(View view, float offset, Listener listener) {
        this.view = view;
        this.offset = offset;
        this.listener = listener;
    }

    public void attach() {
        keyboard = KeyboardFrame.covered(view.getRootView());
        visualBottom = bottom();
        view.getViewTreeObserver().addOnGlobalLayoutListener(this);
    }

    public void detach() {
        view.getViewTreeObserver().removeOnGlobalLayoutListener(this);
    }

    private float bottom() {
        int[] location = new int[2];
        view.getLocationInWindow(location);
        return location[1] + view.getHeight();
    }

    @Override
    public void onGlobalLayout() {
        int next = KeyboardFrame.covered(view.getRootView());
        if (next == keyboard) {
            visualBottom = bottom();
            return;
        }
        keyboard = next;
        // The layout for the keyboard is done; the view may already have jumped with it.
        float untranslated = bottom() - view.getTranslationY();
        float top = view.getRootView().getHeight() - next;
        float to = next > 0 ? -Math.max(0, untranslated + offset - top) : 0;
        float from = visualBottom - untranslated;
        view.setTranslationY(from);
        visualBottom = untranslated + to;
        listener.onMove(from, to, next);
    }
}
