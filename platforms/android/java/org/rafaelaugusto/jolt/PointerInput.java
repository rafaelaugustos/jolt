package org.rafaelaugusto.jolt;

import android.app.Activity;
import android.content.Context;
import android.graphics.Matrix;
import android.graphics.Rect;
import android.hardware.input.InputManager;
import android.view.*;
import android.view.accessibility.AccessibilityEvent;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import java.util.List;
import java.util.WeakHashMap;

/** Observes window input and delegates every event. Does not replace target listeners. */
public final class PointerInput {
    public interface Listener { void onPoint(double x, double y, double width, double height, boolean active); }
    private static final WeakHashMap<Window, Hub> hubs = new WeakHashMap<>();
    private final WeakReference<View> target;
    private Listener listener;
    private Hub hub;
    private boolean active;
    private int device = -1;
    private float lastX, lastY;
    public PointerInput(Activity activity, View target, Listener listener) {
        Window window = activity.getWindow();
        Hub current = hubs.get(window);
        if (current == null || window.getCallback() != current) {
            current = new Hub(window); hubs.put(window, current); window.setCallback(current);
        }
        this.target = new WeakReference<>(target); this.listener = listener; this.hub = current;
        current.inputs.add(this);
        current.watch();
    }
    private void reset() {
        if (active && listener != null) listener.onPoint(0, 0, 0, 0, false);
        active = false;
        device = -1;
    }
    private void observe(MotionEvent event) {
        if (listener == null) return;
        int tool = event.getToolType(0), action = event.getActionMasked();
        if (tool != MotionEvent.TOOL_TYPE_MOUSE && tool != MotionEvent.TOOL_TYPE_STYLUS) { reset(); return; }
        if (action == MotionEvent.ACTION_HOVER_EXIT || action == MotionEvent.ACTION_CANCEL || (tool == MotionEvent.TOOL_TYPE_STYLUS && action != MotionEvent.ACTION_HOVER_MOVE && action != MotionEvent.ACTION_HOVER_ENTER)) { reset(); return; }
        device = event.getDeviceId();
        lastX = event.getX(); lastY = event.getY();
        sample(lastX, lastY);
    }
    public void refresh() { if (active) sample(lastX, lastY); }
    private void sample(float x, float y) {
        View view = target.get();
        Window window = hub == null ? null : hub.window.get();
        if (view == null || window == null || !view.isShown() || !view.isEnabled() || view.getWindowToken() == null) { reset(); return; }
        View decor = window.getDecorView(), current = view;
        Matrix forward = new Matrix();
        while (current != decor) {
            forward.postConcat(current.getMatrix());
            forward.postTranslate(current.getLeft(), current.getTop());
            if (!(current.getParent() instanceof View)) { reset(); return; }
            current = (View)current.getParent();
            forward.postTranslate(-current.getScrollX(), -current.getScrollY());
        }
        Matrix inverse = new Matrix();
        if (!forward.invert(inverse)) { reset(); return; }
        float[] point = {x, y}; inverse.mapPoints(point);
        Rect visible = new Rect();
        if (view.getWidth() <= 0 || view.getHeight() <= 0 || !view.getGlobalVisibleRect(visible) || !visible.contains((int)x, (int)y) || point[0] < 0 || point[1] < 0 || point[0] > view.getWidth() || point[1] > view.getHeight()) { reset(); return; }
        double density = view.getResources().getDisplayMetrics().density;
        active = true;
        listener.onPoint((point[0] - view.getWidth()/2.0)/density, (point[1] - view.getHeight()/2.0)/density, view.getWidth()/density, view.getHeight()/density, true);
    }
    public void dispose() {
        listener = null; active = false; target.clear();
        Hub previous = hub; hub = null;
        if (previous == null) return;
        previous.inputs.remove(this);
        if (previous.inputs.isEmpty()) {
            previous.release();
            Window window = previous.window.get();
            if (window != null) {
                if (window.getCallback() == previous) window.setCallback(previous.delegate);
                if (hubs.get(window) == previous) hubs.remove(window);
            }
        }
    }
    private static final class Hub implements Window.Callback, InputManager.InputDeviceListener {
        final WeakReference<Window> window;
        final Window.Callback delegate;
        final List<PointerInput> inputs = new ArrayList<>();
        private InputManager devices;
        Hub(Window window) { this.window = new WeakReference<>(window); this.delegate = window.getCallback(); }
        void watch() {
            Window current = window.get();
            if (devices != null || inputs.isEmpty() || current == null) return;
            devices = (InputManager)current.getContext().getSystemService(Context.INPUT_SERVICE);
            if (devices != null) devices.registerInputDeviceListener(this, null);
        }
        void release() {
            if (devices != null) devices.unregisterInputDeviceListener(this);
            devices = null;
        }
        private void lost(int id) { for (PointerInput input : new ArrayList<>(inputs)) if (input.device == id) input.reset(); }
        public void onInputDeviceAdded(int id) {}
        public void onInputDeviceRemoved(int id) { lost(id); }
        public void onInputDeviceChanged(int id) { if (InputDevice.getDevice(id) == null) lost(id); }
        void observe(MotionEvent event) {
            for (PointerInput input : new ArrayList<>(inputs)) {
                try { input.observe(event); }
                catch (RuntimeException error) { android.util.Log.e("JoltPointerInput", "Observer failed", error); }
            }
        }
        public boolean dispatchGenericMotionEvent(MotionEvent event) { observe(event); return delegate.dispatchGenericMotionEvent(event); }
        public boolean dispatchTouchEvent(MotionEvent event) { observe(event); return delegate.dispatchTouchEvent(event); }
        public boolean dispatchKeyEvent(KeyEvent event) { return delegate.dispatchKeyEvent(event); }
        public boolean dispatchKeyShortcutEvent(KeyEvent event) { return delegate.dispatchKeyShortcutEvent(event); }
        public boolean dispatchTrackballEvent(MotionEvent event) { return delegate.dispatchTrackballEvent(event); }
        public boolean dispatchPopulateAccessibilityEvent(AccessibilityEvent event) { return delegate.dispatchPopulateAccessibilityEvent(event); }
        public View onCreatePanelView(int id) { return delegate.onCreatePanelView(id); }
        public boolean onCreatePanelMenu(int id, Menu menu) { return delegate.onCreatePanelMenu(id, menu); }
        public boolean onPreparePanel(int id, View view, Menu menu) { return delegate.onPreparePanel(id, view, menu); }
        public boolean onMenuOpened(int id, Menu menu) { return delegate.onMenuOpened(id, menu); }
        public boolean onMenuItemSelected(int id, MenuItem item) { return delegate.onMenuItemSelected(id, item); }
        public void onWindowAttributesChanged(WindowManager.LayoutParams params) { delegate.onWindowAttributesChanged(params); }
        public void onContentChanged() { delegate.onContentChanged(); }
        public void onWindowFocusChanged(boolean focus) { if (!focus) for (PointerInput input : new ArrayList<>(inputs)) input.reset(); delegate.onWindowFocusChanged(focus); }
        public void onAttachedToWindow() { watch(); delegate.onAttachedToWindow(); }
        public void onDetachedFromWindow() { release(); for (PointerInput input : new ArrayList<>(inputs)) input.reset(); delegate.onDetachedFromWindow(); }
        public void onPanelClosed(int id, Menu menu) { delegate.onPanelClosed(id, menu); }
        public boolean onSearchRequested() { return delegate.onSearchRequested(); }
        public boolean onSearchRequested(SearchEvent event) { return delegate.onSearchRequested(event); }
        public ActionMode onWindowStartingActionMode(ActionMode.Callback callback) { return delegate.onWindowStartingActionMode(callback); }
        public ActionMode onWindowStartingActionMode(ActionMode.Callback callback, int type) { return delegate.onWindowStartingActionMode(callback, type); }
        public void onActionModeStarted(ActionMode mode) { delegate.onActionModeStarted(mode); }
        public void onActionModeFinished(ActionMode mode) { delegate.onActionModeFinished(mode); }
        public void onProvideKeyboardShortcuts(List<KeyboardShortcutGroup> data, Menu menu, int device) { delegate.onProvideKeyboardShortcuts(data, menu, device); }
        public void onPointerCaptureChanged(boolean capture) { for (PointerInput input : new ArrayList<>(inputs)) input.reset(); delegate.onPointerCaptureChanged(capture); }
    }
}
