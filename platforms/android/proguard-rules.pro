-keep class org.rafaelaugusto.jolt.ColorTarget { *; }
-keep class org.nativescript.widgets.BorderDrawable { *; }
-keepnames class org.nativescript.widgets.BoxShadowDrawable
-keepclassmembers class org.nativescript.widgets.BoxShadowDrawable {
    public android.graphics.drawable.Drawable getWrappedDrawable();
}
-keep class org.rafaelaugusto.jolt.DecorationTarget { *; }
