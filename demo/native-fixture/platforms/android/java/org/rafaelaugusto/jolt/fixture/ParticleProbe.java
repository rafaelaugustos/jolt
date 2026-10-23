package org.rafaelaugusto.jolt.fixture;

import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;

/** Test-only native raster readback; no Jolt dependency and no per-frame callbacks. */
public final class ParticleProbe {
    private ParticleProbe() { }
    public static int[] pixels(Drawable drawable, int width, int height) {
        Bitmap bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888);
        try {
            drawable.draw(new Canvas(bitmap));
            int[] pixels = new int[width * height];
            bitmap.getPixels(pixels, 0, width, 0, 0, width, height);
            int count = 0, left = width, top = height, right = -1, bottom = -1;
            for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) {
                if ((pixels[y * width + x] >>> 24) < 16) continue;
                count++; left = Math.min(left, x); top = Math.min(top, y);
                right = Math.max(right, x); bottom = Math.max(bottom, y);
            }
            return new int[] { count, left, top, right, bottom, pixels[(height / 2) * width + width / 2] };
        } finally { bitmap.recycle(); }
    }
}
