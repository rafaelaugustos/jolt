package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.view.animation.LinearInterpolator;

/** Native sampled compound-property playback. No JS animation-update listener. */
public final class PropertyPlayer {
    public interface Listener { void onEnd(boolean completed); }
    private PropertySink sink;
    private Listener listener;
    private final double[] times, values, finalValue;
    private final double duration, delay;
    private final int repeats, dimensions;
    private final boolean reverse;
    private ValueAnimator animator;
    private boolean suppressed, stopped, counted;
    private long frames;
    private static int active;

    public PropertyPlayer(PropertySink sink, double[] times, double[] values, double[] finalValue,
                          double duration, double delay, double repeat, boolean reverse, Listener listener) {
        if (!sink.isCompiled() || times.length<2 || values.length!=times.length*sink.getDimensions())
            throw new IllegalArgumentException("Expected compiled sink and matching keyframes");
        this.sink=sink; this.times=times.clone(); this.values=values.clone(); this.finalValue=finalValue.clone();
        this.duration=Math.max(1,duration); this.delay=delay; this.repeats=repeat<0?-1:(int)repeat;
        this.reverse=reverse; this.listener=listener; this.dimensions=sink.getDimensions();
        control(0,false);
    }
    public static int activeCount() { return active; }
    public long getFrames() { return frames; }
    private void count(boolean running) {
        if(counted==running) return;
        counted=running; active+=running?1:-1;
    }
    private void apply(double progress) {
        if(stopped) return;
        if(!sink.isAlive()) { end(false); return; }
        int low=0, high=times.length-1;
        while(low+1<high) { int mid=(low+high)/2; if(times[mid]<=progress) low=mid; else high=mid; }
        double span=times[high]-times[low], t=span>0?Math.max(0,Math.min(1,(progress-times[low])/span)):1;
        double[] result=new double[dimensions];
        for(int i=0;i<dimensions;i++) result[i]=values[low*dimensions+i]+(values[high*dimensions+i]-values[low*dimensions+i])*t;
        write(result);
    }
    private void write(double[] value) {
        try { if(sink!=null && sink.isAlive()) { sink.write(value); frames++; } else end(false); }
        catch(RuntimeException e) { android.util.Log.e("Jolt","Native property write failed",e); end(false); }
    }
    private void end(boolean completed) {
        count(false);
        if(listener!=null && !stopped) listener.onEnd(completed);
        if(!completed) cancel();
    }
    public void control(double time, boolean paused) {
        if(stopped) return;
        suppressed=true;
        if(animator!=null) { animator.removeAllUpdateListeners(); animator.removeAllListeners(); animator.cancel(); }
        animator=ValueAnimator.ofFloat(0,1);
        animator.setInterpolator(new LinearInterpolator()); animator.setDuration((long)duration);
        animator.setStartDelay((long)Math.max(0,delay-time)); animator.setRepeatCount(repeats);
        animator.setRepeatMode(reverse?ValueAnimator.REVERSE:ValueAnimator.RESTART);
        animator.addUpdateListener(value -> { if(!suppressed) apply(((Number)value.getAnimatedValue()).doubleValue()); });
        animator.addListener(new AnimatorListenerAdapter() {
            @Override public void onAnimationEnd(Animator animation) {
                if(!suppressed && !stopped) { write(finalValue); end(true); }
            }
        });
        animator.start();
        if(paused) animator.pause();
        if(time>=delay) animator.setCurrentPlayTime((long)Math.max(0,time-delay));
        suppressed=false;
        double local=Math.max(0,time-delay), iteration=Math.floor(local/duration), progress=(local%duration)/duration;
        if(reverse && iteration%2>=1) progress=1-progress;
        if(repeats>=0 && time>=delay+duration*(repeats+1)) write(finalValue); else apply(progress);
        count(!paused && !stopped && (repeats<0 || time<delay+duration*(repeats+1)));
    }
    public void cancel() {
        if(stopped) return;
        stopped=true; listener=null; count(false);
        if(animator!=null) { animator.removeAllUpdateListeners(); animator.removeAllListeners(); animator.cancel(); animator=null; }
        sink=null;
    }
}
