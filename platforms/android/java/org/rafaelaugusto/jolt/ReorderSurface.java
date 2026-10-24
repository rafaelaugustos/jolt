package org.rafaelaugusto.jolt;

import android.content.Context;
import android.graphics.Rect;
import android.view.MotionEvent;

/** Capture input above recycled cells without replacing any Core touch listener. */
public final class ReorderSurface extends org.nativescript.widgets.GridLayout {
    private ReorderSession session;
    public ReorderSurface(Context context) { super(context); }
    void setSession(ReorderSession value) { session = value; }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        ReorderSession current = session;
        if (current != null) {
            Rect rect = new Rect(); current.list.getDrawingRect(rect);
            offsetDescendantRectToMyCoords(current.list, rect);
            MotionEvent local = MotionEvent.obtain(event); local.offsetLocation(-rect.left, -rect.top);
            current.onTouch(current.list, local); local.recycle();
        }
        return super.dispatchTouchEvent(event) || current != null;
    }
    @Override public boolean onInterceptTouchEvent(MotionEvent event) {
        return session != null && session.isActive() || super.onInterceptTouchEvent(event);
    }
    @Override public boolean onTouchEvent(MotionEvent event) { return session != null || super.onTouchEvent(event); }
    @Override protected void onDetachedFromWindow() { if (session != null) session.cancel(); super.onDetachedFromWindow(); }
}
