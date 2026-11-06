package org.rafaelaugusto.jolt.fixture;

/** Example plugin property: filled fraction, drawn by Android's Canvas. */
public final class RevealView extends android.view.View {
    private double reveal;
    private boolean probing;
    private long firstChangeNanos, writes, draws;
    private double probeStart;
    private final android.graphics.Paint paint = new android.graphics.Paint();
    public RevealView(android.content.Context context) {
        super(context);
        paint.setColor(0xff14b8a6);
    }
    public double getReveal() { return reveal; }
    public void setReveal(double value) {
        if (probing) { writes++; if (firstChangeNanos == 0 && Math.abs(value-probeStart)>0.000001) firstChangeNanos=android.os.SystemClock.elapsedRealtimeNanos(); }
        reveal = value; invalidate();
    }
    public void startProbe() { probing=true; firstChangeNanos=writes=draws=0; probeStart=reveal; }
    public String finishProbe() {
        probing=false;
        return "{\"firstChangeMs\":"+(firstChangeNanos/1000000.0)+",\"writes\":"+writes+",\"draws\":"+draws+"}";
    }
    @Override protected void onDraw(android.graphics.Canvas canvas) {
        if(probing) draws++;
        canvas.drawRect(0, 0, (float)(getWidth() * Math.max(0, Math.min(1, reveal))), getHeight(), paint);
    }
}
