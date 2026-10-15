package org.rafaelaugusto.jolt;

import android.graphics.PorterDuff;
import android.graphics.drawable.ColorDrawable;
import android.graphics.drawable.Drawable;
import android.view.View;
import android.widget.TextView;
import java.lang.ref.WeakReference;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/** ObjectAnimator target. All frame updates stay in native code. */
public final class ColorTarget {
    private static final String BORDER = "org.nativescript.widgets.BorderDrawable";
    private static final Field[] FIELDS = fields();
    private static final String SHADOW = "org.nativescript.widgets.BoxShadowDrawable";
    private static final Method UNWRAP = unwrapMethod();
    private final WeakReference<View> view;
    private final int property;
    private int color;

    // 0 = background, 1 = uniform border, 2 = text.
    public ColorTarget(View view, int property, int initialColor) {
        this.view = new WeakReference<>(view);
        this.property = property;
        this.color = initialColor;
    }

    private static Field[] fields() {
        try {
            Class<?> type = Class.forName(BORDER);
            String[] names = {"backgroundColor", "borderTopColor", "borderRightColor", "borderBottomColor", "borderLeftColor"};
            Field[] result = new Field[names.length];
            for (int i = 0; i < names.length; i++) {
                result[i] = type.getDeclaredField(names[i]);
                result[i].setAccessible(true);
            }
            return result;
        } catch (ReflectiveOperationException | SecurityException exception) {
            return null;
        }
    }

    private static Method unwrapMethod() {
        try {
            return Class.forName(SHADOW).getMethod("getWrappedDrawable");
        } catch (ReflectiveOperationException exception) {
            return null;
        }
    }

    private Drawable background(View nativeView) {
        Drawable drawable = nativeView.getBackground();
        // Avoid reflective method lookups and exceptions in the frame loop.
        if (drawable != null && drawable.getClass().getName().equals(SHADOW) && UNWRAP != null) {
            try {
                return (Drawable) UNWRAP.invoke(drawable);
            } catch (ReflectiveOperationException exception) {
                return drawable;
            }
        }
        return drawable;
    }

    public boolean isSupported() {
        View nativeView = view.get();
        if (nativeView == null) return false;
        if (property == 2) return nativeView instanceof TextView;
        Drawable drawable = background(nativeView);
        if (drawable == null) return true;
        if (drawable.getClass().getName().equals(SHADOW)) return false;
        return !drawable.getClass().getName().equals(BORDER) || FIELDS != null;
    }

    public int getColor() { return color; }

    public void setColor(int value) {
        View nativeView = view.get();
        if (nativeView == null) return;
        color = value;
        if (property == 2) {
            ((TextView) nativeView).setTextColor(value);
            return;
        }
        // Resolve on every frame: a Core style update may replace the drawable.
        Drawable drawable = background(nativeView);
        if (drawable == null || drawable.getClass().getName().equals(SHADOW)) return;
        if (drawable.getClass().getName().equals(BORDER)) {
            if (FIELDS == null) return;
            try {
                if (property == 0) FIELDS[0].setInt(drawable, value);
                else for (int i = 1; i < FIELDS.length; i++) FIELDS[i].setInt(drawable, value);
                drawable.invalidateSelf();
            } catch (IllegalAccessException exception) {
                // Unsupported Core versions keep the final model color.
            }
        } else if (property == 0) {
            if (drawable instanceof ColorDrawable) ((ColorDrawable) drawable).setColor(value);
            else drawable.setColorFilter(value, PorterDuff.Mode.SRC_IN);
        }
    }
}
