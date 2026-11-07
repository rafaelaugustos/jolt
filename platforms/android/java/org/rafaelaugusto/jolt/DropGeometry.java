package org.rafaelaugusto.jolt;

import android.graphics.Matrix;
import android.graphics.Rect;
import android.graphics.RectF;
import android.view.View;

/** Full visual AABB in root-view DIPs; never retains a native target. */
public final class DropGeometry {
    private final Matrix matrix = new Matrix();
    private final RectF rect = new RectF();
    private final Rect visible = new Rect();
    private final float[] result = new float[4];
    public float[] bounds(View view) {
        if (view == null || !view.isShown() || !view.isEnabled() || view.getWindowToken() == null ||
            view.getWidth() <= 0 || view.getHeight() <= 0 || !view.getGlobalVisibleRect(visible)) return null;
        matrix.reset();
        View root = view.getRootView(), current = view;
        while (current != root) {
            matrix.postConcat(current.getMatrix());
            matrix.postTranslate(current.getLeft(), current.getTop());
            if (!(current.getParent() instanceof View)) return null;
            current = (View)current.getParent();
            matrix.postTranslate(-current.getScrollX(), -current.getScrollY());
        }
        rect.set(0, 0, view.getWidth(), view.getHeight());
        matrix.mapRect(rect);
        float density = view.getResources().getDisplayMetrics().density;
        result[0] = rect.left/density; result[1] = rect.top/density;
        result[2] = rect.width()/density; result[3] = rect.height()/density;
        return result;
    }
}
