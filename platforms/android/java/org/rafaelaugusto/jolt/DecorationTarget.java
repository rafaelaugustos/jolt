package org.rafaelaugusto.jolt;

import android.animation.StateListAnimator;
import android.graphics.drawable.Drawable;
import android.graphics.drawable.ColorDrawable;
import android.view.View;
import java.lang.ref.WeakReference;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.util.WeakHashMap;

/** ObjectAnimator's float target. No JavaScript enters the native frame loop. */
public final class DecorationTarget {
    private static final String BORDER = "org.nativescript.widgets.BorderDrawable";
    private static final Field[][] FIELDS = fields();
    private static final Constructor<?> CONSTRUCTOR = constructor();
    private static final WeakHashMap<View, BackgroundLease> BACKGROUNDS = new WeakHashMap<>();
    private static final WeakHashMap<View, Lease> LEASES = new WeakHashMap<>();
    private final WeakReference<View> view;
    private final int property;
    private final int borderColor;
    private float value;
    private boolean acquired;

    // 0 = uniform radius, 1 = uniform width, 2 = elevation, 3 = translationZ.
    public DecorationTarget(View view, int property, float value, int borderColor) {
        this.view = new WeakReference<>(view);
        this.property = property;
        this.value = value;
        this.borderColor = borderColor;
    }
    private static Field[][] fields() {
        try {
            Class<?> type = Class.forName(BORDER);
            String[][] names = {
                {"borderTopLeftRadius", "borderTopRightRadius", "borderBottomRightRadius", "borderBottomLeftRadius"},
                {"borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth"}
            };
            Field[][] result = new Field[2][4];
            for (int i = 0; i < 2; i++) for (int j = 0; j < 4; j++) {
                result[i][j] = type.getDeclaredField(names[i][j]);
                result[i][j].setAccessible(true);
            }
            return result;
        } catch (ReflectiveOperationException | SecurityException exception) { return null; }
    }
    private static Constructor<?> constructor() {
        try { return Class.forName(BORDER).getConstructor(float.class); }
        catch (ReflectiveOperationException | SecurityException exception) { return null; }
    }
    public boolean isSupported() {
        View nativeView = view.get();
        if (nativeView == null) return false;
        if (property >= 2) return true;
        Drawable drawable = ColorTarget.background(nativeView);
        return FIELDS != null && ((drawable != null && drawable.getClass().getName().equals(BORDER)) ||
            ((drawable == null || drawable.getClass() == ColorDrawable.class) && CONSTRUCTOR != null && ColorTarget.FIELDS != null));
    }
    public float getValue() { return value; }
    public void setValue(float next) {
        View nativeView = view.get();
        if (nativeView == null) return;
        value = next;
        if (property >= 2) suspendStateAnimator(nativeView);
        if (property == 2) { nativeView.setElevation(next); return; }
        if (property == 3) { nativeView.setTranslationZ(next); return; }
        ensureBackground(nativeView);
        Drawable drawable = ColorTarget.background(nativeView);
        if (drawable == null || !drawable.getClass().getName().equals(BORDER) || FIELDS == null) return;
        try {
            // Core rebuilds the paths from these fields in draw() and getOutline().
            // Keep its bitmap, gradient, color and all other state on the same drawable.
            for (Field field : FIELDS[property]) field.setFloat(drawable, next);
            drawable.invalidateSelf();
            nativeView.invalidateOutline();
        } catch (IllegalAccessException exception) { /* Keep Core's final model. */ }
    }
    public void acquire() {
        View nativeView = view.get();
        if (nativeView == null || acquired) return;
        acquired = true;
        if (property < 2) {
            BackgroundLease lease = BACKGROUNDS.get(nativeView);
            if (lease == null) { lease = new BackgroundLease(); BACKGROUNDS.put(nativeView, lease); }
            lease.count++;
            ensureBackground(nativeView);
            return;
        }
        Lease lease = LEASES.get(nativeView);
        if (lease == null) {
            lease = new Lease(nativeView.getStateListAnimator());
            LEASES.put(nativeView, lease);
            nativeView.setStateListAnimator(null);
        }
        lease.count++;
        suspendStateAnimator(nativeView);
    }
    public void release() {
        View nativeView = view.get();
        if (!acquired || nativeView == null) return;
        acquired = false;
        if (property < 2) {
            BackgroundLease lease = BACKGROUNDS.get(nativeView);
            if (lease != null && --lease.count == 0) {
                BACKGROUNDS.remove(nativeView);
                if (lease.drawable != null && nativeView.getBackground() == lease.drawable) nativeView.setBackground(lease.original);
            }
            return;
        }
        suspendStateAnimator(nativeView);
        Lease lease = LEASES.get(nativeView);
        if (lease != null && --lease.count == 0) {
            LEASES.remove(nativeView);
            if (nativeView.getStateListAnimator() == null) {
                float elevation = nativeView.getElevation(), z = nativeView.getTranslationZ();
                nativeView.setStateListAnimator(lease.animator);
                if (lease.animator != null) lease.animator.jumpToCurrentState();
                nativeView.setElevation(elevation);
                nativeView.setTranslationZ(z);
            }
        }
    }
    private void ensureBackground(View nativeView) {
        BackgroundLease lease = BACKGROUNDS.get(nativeView);
        Drawable original = nativeView.getBackground();
        if (lease == null || (original != null && original.getClass() != ColorDrawable.class) || CONSTRUCTOR == null || ColorTarget.FIELDS == null) return;
        try {
            Drawable drawable = (Drawable) CONSTRUCTOR.newInstance(nativeView.getResources().getDisplayMetrics().density);
            ColorTarget.FIELDS[0].setInt(drawable, original == null ? 0 : ((ColorDrawable) original).getColor());
            for (int i = 1; i < ColorTarget.FIELDS.length; i++) ColorTarget.FIELDS[i].setInt(drawable, borderColor);
            lease.original = original;
            lease.drawable = drawable;
            nativeView.setBackground(drawable);
        } catch (ReflectiveOperationException exception) { /* Unsupported Core. */ }
    }
    private static final class BackgroundLease {
        Drawable original, drawable;
        int count;
    }
    private static void suspendStateAnimator(View view) {
        Lease lease = LEASES.get(view);
        StateListAnimator current = view.getStateListAnimator();
        if (lease != null && current != null) {
            // A Core model write may have installed an updated state animator.
            lease.animator = current;
            view.setStateListAnimator(null);
        }
    }
    private static final class Lease {
        StateListAnimator animator;
        int count;
        Lease(StateListAnimator animator) { this.animator = animator; }
    }
}
