package org.rafaelaugusto.jolt.fixture;

/** Example plugin property: filled fraction, drawn by Android's Canvas. */
public final class RevealView extends android.view.View {
    private double reveal;
    private final android.graphics.Paint paint = new android.graphics.Paint();
    public RevealView(android.content.Context context) {
        super(context);
        paint.setColor(0xff14b8a6);
    }
    public double getReveal() { return reveal; }
    public void setReveal(double value) { reveal = value; invalidate(); }
    @Override protected void onDraw(android.graphics.Canvas canvas) {
        canvas.drawRect(0, 0, (float)(getWidth() * Math.max(0, Math.min(1, reveal))), getHeight(), paint);
    }
}
