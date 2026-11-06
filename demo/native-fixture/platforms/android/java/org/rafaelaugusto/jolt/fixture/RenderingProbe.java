package org.rafaelaugusto.jolt.fixture;

import android.os.SystemClock;
import android.view.Choreographer;
import android.view.View;
import android.view.ViewGroup;
import java.util.ArrayList;

/** Demo-only renderer: one native frame callback invalidates three real Canvas views. */
public final class RenderingProbe implements Choreographer.FrameCallback {
    private final ArrayList<View> views=new ArrayList<>();
    private boolean active;
    private long frames, began, activeNanos;
    public RenderingProbe(View root) { collect(root); }
    private void collect(View view) {
        if(view instanceof RevealView) views.add(view);
        if(view instanceof ViewGroup) for(int i=0;i<((ViewGroup)view).getChildCount();i++) collect(((ViewGroup)view).getChildAt(i));
    }
    public void setActive(boolean value) {
        if(active==value)return;
        active=value;
        if(active){ began=SystemClock.elapsedRealtimeNanos(); Choreographer.getInstance().postFrameCallback(this); }
        else { activeNanos+=SystemClock.elapsedRealtimeNanos()-began; Choreographer.getInstance().removeFrameCallback(this); }
    }
    public void redraw() { for(View view:views)view.invalidate(); }
    @Override public void doFrame(long time) { if(!active)return; frames++;redraw();Choreographer.getInstance().postFrameCallback(this); }
    public String finish() { setActive(false);views.clear();return "{\"frames\":"+frames+",\"activeMs\":"+activeNanos/1000000.0+"}"; }
}
