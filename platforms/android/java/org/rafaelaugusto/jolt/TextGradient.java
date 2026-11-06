package org.rafaelaugusto.jolt;

import android.animation.ValueAnimator;
import android.content.res.ColorStateList;
import android.graphics.*;
import android.graphics.drawable.Drawable;
import android.text.Layout;
import android.text.TextPaint;
import android.view.animation.LinearInterpolator;
import android.widget.TextView;
import org.json.*;

/** Glyph texture changes only with text/layout; native animation moves a shader over that texture. */
public final class TextGradient extends Drawable {
    private final TextView view;
    private final Paint fill = new Paint(Paint.ANTI_ALIAS_FLAG), light = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Matrix matrix = new Matrix();
    private final int[] colors;
    private final float[] stops;
    private final float angle, bandWidth;
    private final int sheen;
    private ColorStateList original;
    private Shader originalShader, band;
    private Bitmap mask;
    private Layout lastLayout;
    private String lastText;
    private float textSize, spacing;
    private int typeface, width, height, paddingX, paddingY;
    private ValueAnimator animator;
    private float[] times, samples;
    private double duration, delay;
    private int repeats;
    private boolean reverse, disposed, visible;
    private static int live;
    public static int liveCount() { return live; }

    public TextGradient(TextView view, String options) {
        this.view = view;
        try {
            JSONObject o = new JSONObject(options);
            JSONArray c = o.getJSONArray("colors"), s = o.getJSONArray("stops");
            colors = new int[c.length()]; stops = new float[c.length()];
            for (int i = 0; i < colors.length; i++) { colors[i] = (int)c.getLong(i); stops[i] = (float)s.getDouble(i); }
            angle = (float)o.getDouble("angle"); bandWidth = (float)o.getDouble("width"); sheen = (int)o.getLong("sheen");
        } catch (JSONException error) { throw new IllegalArgumentException(error); }
        original = view.getTextColors(); originalShader = view.getPaint().getShader();
        refresh();
        view.getOverlay().add(this); live++;
    }
    public int maskBytes() { return mask == null ? 0 : mask.getAllocationByteCount(); }
    public void refresh() {
        if (disposed || view.getWidth() <= 0 || view.getHeight() <= 0 || view.getLayout() == null) return;
        if (view.getCurrentTextColor() != Color.TRANSPARENT) original = view.getTextColors();
        Layout layout = view.getLayout(); TextPaint text = view.getPaint();
        int w = view.getWidth(), h = view.getHeight();
        int px = view.getTotalPaddingLeft() - view.getScrollX(), py = view.getTotalPaddingTop() - view.getScrollY();
        String string = view.getText().toString();
        int font = text.getTypeface() == null ? 0 : text.getTypeface().hashCode();
        if (mask != null && layout == lastLayout && string.equals(lastText) && w == width && h == height &&
            textSize == text.getTextSize() && spacing == text.getLetterSpacing() && typeface == font && paddingX == px && paddingY == py) {
            view.setTextColor(Color.TRANSPARENT); return;
        }
        if ((long)w * h > 4194304L) throw new IllegalArgumentException("Gradient text exceeds the glyph texture budget.");
        Bitmap next = Bitmap.createBitmap(w, h, Bitmap.Config.ALPHA_8);
        Canvas canvas = new Canvas(next);
        canvas.translate(px, py);
        int color = text.getColor(); Shader shader = text.getShader();
        try { text.setColor(Color.WHITE); text.setShader(null); layout.draw(canvas); }
        catch (RuntimeException error) { next.recycle(); throw error; }
        finally { text.setColor(color); text.setShader(shader); }
        if (mask != null) mask.recycle();
        mask = next; width = w; height = h; lastLayout = layout; lastText = string;
        textSize = text.getTextSize(); spacing = text.getLetterSpacing(); typeface = font; paddingX = px; paddingY = py;
        float dx = (float)Math.cos(Math.toRadians(angle)) * w / 2, dy = (float)Math.sin(Math.toRadians(angle)) * h / 2;
        fill.setShader(new LinearGradient(w/2f-dx,h/2f-dy,w/2f+dx,h/2f+dy,colors,stops,Shader.TileMode.CLAMP));
        band = new LinearGradient(0,0,Math.max(1,w*bandWidth),0,new int[]{sheen & 0xffffff,sheen,sheen & 0xffffff},new float[]{0,.5f,1},Shader.TileMode.CLAMP);
        light.setShader(band);
        setBounds(0,0,w,h); view.setTextColor(Color.TRANSPARENT);
        if (animator != null) apply(animator.getCurrentPlayTime());
        invalidateSelf();
    }
    public void play(float[] times, float[] samples, double duration, double delay, int repeats, boolean reverse) {
        stop(); this.times = times; this.samples = samples; this.duration = duration; this.delay = delay; this.repeats = repeats; this.reverse = reverse;
        if (disposed || duration <= 0) return;
        visible = true; clock(0);
    }
    private void clock(long at) {
        if (animator != null) { animator.removeAllUpdateListeners(); animator.cancel(); }
        ValueAnimator next = ValueAnimator.ofFloat(0,1);
        next.setDuration(repeats < 0 ? 60000 : Math.max(1,(long)Math.ceil(delay+duration*(repeats+1))));
        next.setRepeatCount(repeats < 0 ? ValueAnimator.INFINITE : 0);
        next.setInterpolator(new LinearInterpolator());
        next.addUpdateListener(value -> apply(value.getCurrentPlayTime()));
        animator = next;
        if (at > 0) next.setCurrentPlayTime(at);
        next.start(); apply(at);
    }
    private void apply(double elapsed) {
        if (band == null || times == null) return;
        double t = Math.max(0,elapsed-delay), f;
        if (repeats >= 0 && t >= duration*(repeats+1)) f = reverse && repeats%2==1 ? 0 : 1;
        else { long cycle = (long)(t/duration); f = t/duration-cycle; if (reverse && cycle%2==1) f = 1-f; }
        int low = 0, high = times.length-1;
        while (high-low > 1) { int mid = (low+high)/2; if (times[mid] <= f) low=mid; else high=mid; }
        double span = times[high]-times[low], mix = span > 0 ? Math.max(0,Math.min(1,(f-times[low])/span)) : 1;
        double value = samples[low]+(samples[high]-samples[low])*mix;
        matrix.setTranslate((float)(value*width*(1+bandWidth)-width*bandWidth),0);
        band.setLocalMatrix(matrix); invalidateSelf();
    }
    public void control(double time, boolean paused) {
        if (animator == null) return;
        long at = Math.max(0,(long)time);
        if (paused) { animator.setCurrentPlayTime(at); animator.pause(); }
        else if (animator.isPaused()) clock(at);
        else animator.setCurrentPlayTime(at);
        apply(time);
    }
    public void stop() {
        if (animator != null) { animator.removeAllUpdateListeners(); animator.cancel(); animator = null; }
        times = samples = null; visible = false; invalidateSelf();
    }
    public void dispose() {
        if (disposed) return;
        stop(); disposed = true; view.getOverlay().remove(this);
        if (view.getCurrentTextColor() == Color.TRANSPARENT) view.setTextColor(original);
        if (view.getPaint().getShader() == originalShader) view.getPaint().setShader(originalShader);
        if (mask != null) { mask.recycle(); mask = null; }
        lastLayout = null; lastText = null; band = null; fill.setShader(null); light.setShader(null); live--;
    }
    @Override public void draw(Canvas canvas) {
        if (disposed || mask == null) return;
        canvas.drawBitmap(mask,0,0,fill);
        if (visible) canvas.drawBitmap(mask,0,0,light);
    }
    @Override public void setAlpha(int alpha) { fill.setAlpha(alpha); light.setAlpha(alpha); invalidateSelf(); }
    @Override public void setColorFilter(ColorFilter filter) { fill.setColorFilter(filter); light.setColorFilter(filter); invalidateSelf(); }
    @Override public int getOpacity() { return PixelFormat.TRANSLUCENT; }
}
