package org.rafaelaugusto.jolt;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.view.MotionEvent;

/** Keeps Core's layout and listeners; intercepts only an accepted top-edge pull. */
public final class ScrollHeaderSurface extends org.nativescript.widgets.GridLayout {
    private ScrollHeader owner;
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
    public ScrollHeaderSurface(Context context) { super(context); }
    void attach(ScrollHeader value) {
        if (owner != null && owner != value) throw new IllegalStateException("A refresh surface already has an owner");
        owner = value;
    }
    void detach(ScrollHeader value) { if (owner == value) { owner = null; invalidate(); } }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        ScrollHeader current = owner;
        if (current != null) current.beforeTouch(event);
        boolean handled = super.dispatchTouchEvent(event);
        if (current != null) current.afterTouch(event);
        return handled;
    }
    @Override public boolean onInterceptTouchEvent(MotionEvent event) {
        return owner != null && owner.intercepts() || super.onInterceptTouchEvent(event);
    }
    @Override public boolean onTouchEvent(MotionEvent event) {
        return owner != null && owner.intercepts() || super.onTouchEvent(event);
    }
    @Override protected void dispatchDraw(Canvas canvas) {
        super.dispatchDraw(canvas);
        if (owner != null) owner.drawRefresh(canvas, paint, getWidth());
    }
    @Override protected void onDetachedFromWindow() {
        if (owner != null) owner.cancelPull();
        super.onDetachedFromWindow();
    }
}
