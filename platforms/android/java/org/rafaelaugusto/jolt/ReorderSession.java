package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.view.Choreographer;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewConfiguration;
import android.view.ViewGroup;
import android.widget.ImageView;
import android.widget.ListView;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Set;
import java.util.WeakHashMap;

/** Core ListView input, snapshot, recycling and edge autoscroll stay on the UI thread. */
public final class ReorderSession implements View.OnTouchListener, Choreographer.FrameCallback, View.OnLayoutChangeListener, View.OnAttachStateChangeListener {
    public interface Listener { void onState(int state, int index, int toIndex); }
    private static final class Cell {
        final float translation, alpha;
        final int index;
        final SpringState spring = new SpringState(0, 0);
        Cell(View view, int index) { this.translation = view.getTranslationY(); this.alpha = view.getAlpha(); this.index = index; }
    }
    final ListView list;
    private final ReorderSurface surface;
    private final Listener listener;
    private final WeakHashMap<View, Cell> cells = new WeakHashMap<>();
    private final Set<View> handles = Collections.newSetFromMap(new WeakHashMap<View, Boolean>());
    private final float density, edgeSize, edgeSpeed, slop;
    private final long longPress;
    private final boolean handlesOnly;
    private final Runnable activate = () -> begin();
    private boolean enabled = true, disposed, active, settling, pending, reduced;
    private int from, target, count, generation, width, height;
    private float downX, downY, pointerX, pointerY, grabOffset, rowHeight, remainder;
    private long previousTime;
    private ImageView overlay;
    private Bitmap bitmap;
    private ValueAnimator drop;

    public ReorderSession(ReorderSurface surface, ListView list, String options, Listener listener) {
        this.surface = surface; this.list = list; this.listener = listener;
        density = list.getResources().getDisplayMetrics().density;
        slop = ViewConfiguration.get(list.getContext()).getScaledTouchSlop();
        try {
            JSONObject config = new JSONObject(options);
            longPress = config.getLong("longPress"); edgeSize = (float)config.getDouble("edgeSize") * density;
            edgeSpeed = (float)config.getDouble("edgeSpeed") * density;
            reduced = config.getBoolean("reducedMotion"); handlesOnly = config.getBoolean("handles");
        } catch (Exception error) { throw new IllegalArgumentException(error); }
        surface.setSession(this); list.addOnLayoutChangeListener(this); list.addOnAttachStateChangeListener(this);
    }
    public boolean isActive() { return active; }
    public void registerHandle(View view) {
        if (!disposed && view != null) {
            handles.add(view);
        }
    }
    private boolean inHandle(float x, float y) {
        if (!handlesOnly) return true;
        Rect rect = new Rect();
        for (View handle : handles) {
            if (handle == null || !handle.isShown()) continue;
            android.view.ViewParent parent = handle.getParent();
            while (parent != null && parent != list) parent = parent.getParent();
            if (parent != list) continue;
            handle.getDrawingRect(rect); list.offsetDescendantRectToMyCoords(handle, rect);
            if (rect.contains((int)x, (int)y)) return true;
        }
        return false;
    }
    @Override public boolean onTouch(View view, MotionEvent event) {
        if (disposed) return false;
        int action = event.getActionMasked();
        if (action == MotionEvent.ACTION_DOWN) {
            cancel();
            downX = pointerX = event.getX(); downY = pointerY = event.getY();
            if (enabled && list.isEnabled() && inHandle(downX, downY) && list.pointToPosition((int)downX, (int)downY) >= 0) {
                pending = true; list.postDelayed(activate, longPress);
            }
        }
        if (event.getPointerCount() > 1) { boolean handled = active; cancel(); return handled; }
        if (action == MotionEvent.ACTION_MOVE) {
            pointerX = event.getX(); pointerY = event.getY();
            if (pending && Math.hypot(pointerX - downX, pointerY - downY) > slop) clearPending();
            if (active && !settling) update(0);
        }
        boolean owned = active;
        if (action == MotionEvent.ACTION_UP) { clearPending(); if (active && !settling) drop(); }
        else if (action == MotionEvent.ACTION_CANCEL) { clearPending(); if (active) finish(false, 0); }
        if (owned) return true;
        return false;
    }
    private void clearPending() { pending = false; list.removeCallbacks(activate); }
    private void emit(int state, int detail) { if (!disposed && listener != null) listener.onState(state, from, detail); }
    private void begin() {
        if (!pending || disposed || !enabled || !list.isAttachedToWindow()) return;
        clearPending();
        int index = list.pointToPosition((int)pointerX, (int)pointerY);
        View cell = list.getChildAt(index - list.getFirstVisiblePosition());
        if (cell == null || index < 0 || cell.getWidth() <= 0 || cell.getHeight() <= 0 || (long)cell.getWidth() * cell.getHeight() > 8000000) return;
        bitmap = Bitmap.createBitmap(cell.getWidth(), cell.getHeight(), Bitmap.Config.ARGB_8888);
        cell.draw(new Canvas(bitmap));
        overlay = new ImageView(list.getContext()); overlay.setImageBitmap(bitmap);
        overlay.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
        overlay.layout(cell.getLeft(), 0, cell.getRight(), cell.getHeight());
        overlay.setTranslationY(cell.getTop()); overlay.setElevation(12 * density);
        list.getOverlay().add(overlay);
        rowHeight = cell.getHeight() + list.getDividerHeight(); grabOffset = pointerY - cell.getTop();
        width = list.getWidth(); height = list.getHeight(); count = list.getCount();
        from = target = index; active = true; settling = false; remainder = 0; generation++;
        // Stop the ListView's pending click/scroll, retaining this pointer stream.
        MotionEvent cancel = MotionEvent.obtain(0, 0, MotionEvent.ACTION_CANCEL, pointerX, pointerY, 0);
        list.onTouchEvent(cancel); cancel.recycle();
        if (surface.getParent() != null) surface.getParent().requestDisallowInterceptTouchEvent(true);
        previousTime = System.nanoTime();
        emit(1, from);
        if (!active || disposed) return;
        update(0); Choreographer.getInstance().postFrameCallback(this);
    }
    @Override public void doFrame(long time) {
        if (!active || settling || disposed) return;
        if (!list.isAttachedToWindow() || count != list.getCount() || width != list.getWidth() || height != list.getHeight()) { finish(false, 1); return; }
        double dt = Math.min(.04, Math.max(0, (time - previousTime) / 1e9)); previousTime = time;
        float edge = Math.min(edgeSize, list.getHeight() / 3f), direction = 0;
        if (pointerY < list.getPaddingTop() + edge) direction = -Math.min(1, (list.getPaddingTop() + edge - pointerY) / edge);
        else if (pointerY > list.getHeight() - list.getPaddingBottom() - edge) direction = Math.min(1, (pointerY - list.getHeight() + list.getPaddingBottom() + edge) / edge);
        float distance = (float)(direction * edgeSpeed * dt) + remainder;
        int pixels = (int)distance; remainder = distance - pixels;
        if (pixels != 0) list.scrollListBy(pixels);
        update(dt);
        if (active) Choreographer.getInstance().postFrameCallback(this);
    }
    private void restore(View view, Cell state) { view.setTranslationY(state.translation); view.setAlpha(state.alpha); }
    private void update(double dt) {
        if (!active || settling) return;
        float top = pointerY - grabOffset;
        overlay.setTranslationY(top);
        int first = list.getFirstVisiblePosition(), visible = list.getChildCount(), destination = from;
        for (int offset = 0; offset < visible; offset++) {
            int index = first + offset; if (index == from) continue;
            View view = list.getChildAt(offset);
            float midpoint = view.getTop() + view.getHeight() / 2f - (index > from ? rowHeight : 0);
            int insertion = index - (index > from ? 1 : 0);
            destination = insertion;
            if (top < midpoint) break;
            destination = insertion + 1;
        }
        target = Math.max(0, Math.min(count - 1, destination));
        for (View view : new ArrayList<>(cells.keySet())) {
            int index = list.getPositionForView(view);
            Cell state = cells.get(view);
            if (index < first || index >= first + visible || index != state.index) { restore(view, state); cells.remove(view); }
        }
        for (int offset = 0; offset < visible; offset++) {
            int index = first + offset; View view = list.getChildAt(offset);
            Cell state = cells.get(view);
            if (state == null) { state = new Cell(view, index); cells.put(view, state); }
            float displacement = index > from && index <= target ? -rowHeight : index < from && index >= target ? rowHeight : 0;
            if (reduced) { state.spring.position = displacement; state.spring.velocity = 0; }
            else state.spring.advance(displacement, 360, 34, 1, dt);
            view.setTranslationY(state.translation + (float)state.spring.position);
            view.setAlpha(index == from ? 0 : state.alpha);
        }
    }
    private void drop() {
        if (!active || settling) return;
        settling = true; Choreographer.getInstance().removeFrameCallback(this);
        View destination = list.getChildAt(target - list.getFirstVisiblePosition());
        float end = destination == null ? overlay.getTranslationY() : target > from ? destination.getBottom() - bitmap.getHeight() : destination.getTop();
        if (reduced) { finish(true, 0); return; }
        final int ticket = generation;
        drop = ValueAnimator.ofFloat(overlay.getTranslationY(), end); drop.setDuration(180);
        drop.addUpdateListener(animation -> { if (overlay != null) overlay.setTranslationY((float)animation.getAnimatedValue()); });
        drop.addListener(new AnimatorListenerAdapter() {
            @Override public void onAnimationEnd(Animator animation) { if (active && generation == ticket) finish(true, 0); }
        });
        drop.start();
    }
    private void finish(boolean commit, int detail) {
        if (!active) return;
        active = false; settling = false; generation++;
        Choreographer.getInstance().removeFrameCallback(this);
        if (drop != null) { ValueAnimator previous = drop; drop = null; previous.cancel(); }
        if (overlay != null) { list.getOverlay().remove(overlay); overlay.setImageDrawable(null); overlay = null; }
        if (bitmap != null) { bitmap.recycle(); bitmap = null; }
        for (View view : new ArrayList<>(cells.keySet())) restore(view, cells.get(view));
        cells.clear();
        if (surface.getParent() != null) surface.getParent().requestDisallowInterceptTouchEvent(false);
        emit(commit ? 2 : 3, commit ? target : detail);
    }
    public void cancel() { clearPending(); finish(false, 0); }
    public void setEnabled(boolean value) { enabled = value; if (!value) cancel(); }
    public void setReducedMotion(boolean value) { reduced = value; }
    @Override public void onLayoutChange(View view, int l, int t, int r, int b, int ol, int ot, int or, int ob) {
        if (active && (r - l != width || b - t != height)) finish(false, 1);
    }
    @Override public void onViewDetachedFromWindow(View view) { cancel(); }
    @Override public void onViewAttachedToWindow(View view) {}
    public void dispose() {
        if (disposed) return;
        cancel(); disposed = true; surface.setSession(null);
        list.removeOnLayoutChangeListener(this); list.removeOnAttachStateChangeListener(this);
        handles.clear();
    }
}
