package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.RenderEffect;
import android.graphics.Shader;
import android.os.Build;
import android.view.View;
import android.view.animation.LinearInterpolator;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Owns the content view's RenderEffect slot. No capture, bitmap allocation or JS frame listener. */
public final class BlurEffect {
    private static int live,active;
    public static int liveCount(){return live;}
    public static int activeCount(){return active;}
    private View view;
    private final boolean supported;
    private final double radius,density;
    private double amount,applied,duration,delay,repeats;
    private double[] times,values;
    private boolean reverse,disposed;
    private int frames;
    private ValueAnimator animator;
    public BlurEffect(View view,double radius){
        this.view=view;this.radius=radius;density=view.getResources().getDisplayMetrics().density;
        supported=Build.VERSION.SDK_INT>=31 && view.isHardwareAccelerated();live++;
    }
    // Keep API 31 references out of the fallback execution path.
    private static class Api31 {
        static void apply(View view,float radius){view.setRenderEffect(radius>0?RenderEffect.createBlurEffect(radius,radius,Shader.TileMode.CLAMP):null);}
    }
    private void apply(double value){
        amount=Math.max(0,Math.min(1,value));
        if(supported){Api31.apply(view,(float)(radius*density*amount));applied=amount;}
        frames++;
    }
    public void paint(double value){if(disposed)return;cancel();apply(value);}
    private static double[] array(JSONArray array)throws JSONException{
        double[] result=new double[array.length()];for(int i=0;i<result.length;i++)result[i]=array.getDouble(i);return result;
    }
    public void play(String program){
        if(disposed)return;cancel();
        try{
            JSONObject p=new JSONObject(program);times=array(p.getJSONArray("times"));values=array(p.getJSONArray("values"));
            duration=p.getDouble("duration");delay=p.getDouble("delay");repeats=p.getDouble("repeat");reverse=p.getBoolean("reverse");
        }catch(JSONException e){throw new IllegalArgumentException("Invalid blur program",e);}
        if(!supported){apply(values[values.length-1]);return;}
        advance(0);
        active++;clock(0);
    }
    private void clock(long at){
        ValueAnimator old=animator;
        if(old!=null){old.removeAllUpdateListeners();old.removeAllListeners();old.cancel();}
        final ValueAnimator a=ValueAnimator.ofFloat(0f,1f);
        a.setDuration(repeats<0?60000:Math.max(1,(long)Math.ceil(delay+duration*(repeats+1))));
        a.setRepeatCount(repeats<0?ValueAnimator.INFINITE:0);a.setInterpolator(new LinearInterpolator());
        a.addUpdateListener(v->advance(v.getCurrentPlayTime()));
        a.addListener(new AnimatorListenerAdapter(){@Override public void onAnimationEnd(Animator ended){if(animator==a){animator=null;active--;}}});
        animator=a;
        if(at>0)a.setCurrentPlayTime(at);
        a.start();
    }
    private void advance(double elapsed){
        double t=Math.max(0,elapsed-delay),fraction;
        if(duration<=0)fraction=elapsed<delay?0:(reverse&&repeats>=0&&((long)repeats%2==1)?0:1);
        else if(repeats>=0&&t>=duration*(repeats+1))fraction=reverse&&((long)repeats%2==1)?0:1;
        else {double cycles=t/duration;long cycle=(long)cycles;fraction=cycles-cycle;if(reverse&&cycle%2==1)fraction=1-fraction;}
        int low=0,high=times.length-1;
        while(high-low>1){int mid=(low+high)/2;if(times[mid]<=fraction)low=mid;else high=mid;}
        double span=times[high]-times[low],mix=span>0?Math.max(0,Math.min(1,(fraction-times[low])/span)):1;
        apply(values[low]+(values[high]-values[low])*mix);
    }
    /** A resume rebuilds the clock: Android moves a seeked start time by the paused duration on the frame after resume(). */
    public void control(double time,boolean paused){
        if(animator==null)return;
        long at=Math.max(0,(long)time);
        if(paused){animator.setCurrentPlayTime(at);animator.pause();}
        else if(animator.isPaused())clock(at);
        else animator.setCurrentPlayTime(at);
        advance(time);
    }
    public void resize(){} // RenderEffect automatically follows the view's render node bounds.
    public String snapshot(){
        try{return new JSONObject().put("backend",supported?"android-render-effect":"none").put("amount",amount).put("appliedAmount",applied).put("attached",!disposed)
            .put("nativeAnimations",animator==null?0:1).put("frames",frames).put("width",view==null?0:view.getWidth()/density).put("height",view==null?0:view.getHeight()/density).toString();
        }catch(JSONException e){throw new IllegalStateException(e);}
    }
    private void cancel(){
        ValueAnimator a=animator;animator=null;
        if(a!=null){active--;a.removeAllUpdateListeners();a.removeAllListeners();a.cancel();}
        times=values=null;
    }
    public void dispose(){
        if(disposed)return;cancel();disposed=true;live--;
        if(supported)Api31.apply(view,0);applied=0;view=null;
    }
}
