package org.rafaelaugusto.jolt;

import android.content.Context;
import android.view.MotionEvent;
import android.view.View;
import androidx.core.view.NestedScrollingParent3;
import androidx.core.view.NestedScrollingParentHelper;
import androidx.core.view.ViewCompat;

/** A GridLayout dispatch boundary; it does not replace NativeScript's touch listener. */
public final class GestureSurface extends org.nativescript.widgets.GridLayout implements NestedScrollingParent3 {
    private GestureSession session;
    private final NestedScrollingParentHelper nested = new NestedScrollingParentHelper(this);
    public GestureSurface(Context context) { super(context); }
    public void setSession(GestureSession value) { session = value; }
    @Override public boolean dispatchTouchEvent(MotionEvent event) {
        GestureSession current = session;
        if (current != null) current.before(event);
        boolean handled = super.dispatchTouchEvent(event);
        if (current != null) current.after(event);
        return handled || current != null;
    }
    @Override public boolean onInterceptTouchEvent(MotionEvent event) {
        return session != null && session.intercepts() || super.onInterceptTouchEvent(event);
    }
    @Override public boolean onTouchEvent(MotionEvent event) {
        return session != null || super.onTouchEvent(event);
    }
    @Override public boolean onStartNestedScroll(View child, View target, int axes, int type) {
        return session != null && type == ViewCompat.TYPE_TOUCH && (axes & ViewCompat.SCROLL_AXIS_VERTICAL) != 0 && session.accepts(target);
    }
    @Override public void onNestedScrollAccepted(View child, View target, int axes, int type) { nested.onNestedScrollAccepted(child, target, axes, type); }
    @Override public void onStopNestedScroll(View target, int type) { nested.onStopNestedScroll(target, type); }
    @Override public void onNestedPreScroll(View target, int dx, int dy, int[] consumed, int type) {
        if (session != null && type == ViewCompat.TYPE_TOUCH && session.accepts(target)) consumed[1] += session.consume(dy, !target.canScrollVertically(-1));
    }
    @Override public void onNestedScroll(View target, int dx, int dy, int remainingX, int remainingY, int type, int[] consumed) {
        if (session != null && type == ViewCompat.TYPE_TOUCH && session.accepts(target)) consumed[1] += session.consume(remainingY, true);
    }
    @Override public boolean onNestedPreFling(View target, float vx, float vy) { return session != null && session.accepts(target) && session.preFling(vx, vy); }
    @Override public boolean onNestedFling(View target, float vx, float vy, boolean consumed) { return false; }
    @Override public int getNestedScrollAxes() { return nested.getNestedScrollAxes(); }
    @Override public boolean onStartNestedScroll(View child, View target, int axes) { return onStartNestedScroll(child, target, axes, ViewCompat.TYPE_TOUCH); }
    @Override public void onNestedScrollAccepted(View child, View target, int axes) { onNestedScrollAccepted(child, target, axes, ViewCompat.TYPE_TOUCH); }
    @Override public void onStopNestedScroll(View target) { onStopNestedScroll(target, ViewCompat.TYPE_TOUCH); }
    @Override public void onNestedPreScroll(View target, int dx, int dy, int[] consumed) { onNestedPreScroll(target, dx, dy, consumed, ViewCompat.TYPE_TOUCH); }
    @Override public void onNestedScroll(View target, int dx, int dy, int rx, int ry) { onNestedScroll(target, dx, dy, rx, ry, ViewCompat.TYPE_TOUCH); }
    @Override public void onNestedScroll(View target, int dx, int dy, int rx, int ry, int type) { onNestedScroll(target, dx, dy, rx, ry, type, new int[2]); }
    @Override protected void onDetachedFromWindow() {
        if (session != null) session.cancel();
        super.onDetachedFromWindow();
    }
}
