package org.rafaelaugusto.jolt;

import android.graphics.Rect;
import android.view.View;
import android.view.ViewTreeObserver;
import android.view.WindowInsets;

/** Before Android 11: how much of the window the keyboard covers, read from the visible frame on each layout. */
public final class KeyboardFrame implements ViewTreeObserver.OnGlobalLayoutListener {
    public interface Listener {
        void onChange(int height);
    }

    private final View root;
    private final Listener listener;
    private int height;

    public KeyboardFrame(View root, Listener listener) {
        this.root = root;
        this.listener = listener;
    }

    public void attach() {
        height = covered(root);
        root.getViewTreeObserver().addOnGlobalLayoutListener(this);
    }

    public void detach() {
        root.getViewTreeObserver().removeOnGlobalLayoutListener(this);
    }

    public int height() {
        return height;
    }

    /** Pixels of the window below the visible frame, when that is more than the navigation bar. */
    static int covered(View root) {
        Rect frame = new Rect();
        root.getWindowVisibleDisplayFrame(frame);
        int below = root.getHeight() - frame.bottom;
        WindowInsets insets = root.getRootWindowInsets();
        int bars = insets == null ? 0 : insets.getStableInsetBottom();
        return below > bars ? below : 0;
    }

    @Override
    public void onGlobalLayout() {
        int next = covered(root);
        if (next == height) return;
        height = next;
        listener.onChange(next);
    }
}
