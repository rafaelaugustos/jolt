package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.Canvas;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PathMeasure;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.drawable.Drawable;
import android.view.animation.LinearInterpolator;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Owned vector surface. JS submits geometry/curves once; all drawing and playback stays native. */
public final class ShapeLayer extends Drawable {
    private static int live, active;
    public static int liveCount(){return live;}
    public static int activeCount(){return active;}
    private final Paint fill=new Paint(Paint.ANTI_ALIAS_FLAG), stroke=new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path path=new Path(), trimmed=new Path();
    private final PathMeasure measure=new PathMeasure();
    private final float[] box=new float[4];
    private String commands="";
    // start/end fractions followed by normalized path coordinates.
    private float[] current=new float[0], from, to, times, samples;
    private float length;
    private double duration, delay, repeats;
    private boolean reverse, disposed;
    private ValueAnimator animator;
    public ShapeLayer(String options){
        try {
            JSONObject o=new JSONObject(options);JSONArray b=o.getJSONArray("viewBox");
            for(int i=0;i<4;i++)box[i]=(float)b.getDouble(i);
            fill.setColor((int)o.getLong("fill"));fill.setStyle(Paint.Style.FILL);
            stroke.setColor((int)o.getLong("stroke"));stroke.setStyle(Paint.Style.STROKE);stroke.setStrokeWidth((float)o.getDouble("width"));
            stroke.setStrokeCap(Paint.Cap.valueOf(o.getString("cap").toUpperCase(java.util.Locale.ROOT)));
            stroke.setStrokeJoin(Paint.Join.valueOf(o.getString("join").toUpperCase(java.util.Locale.ROOT)));
            path.setFillType(o.getString("rule").equals("evenodd")?Path.FillType.EVEN_ODD:Path.FillType.WINDING);
        }catch(JSONException e){throw new IllegalArgumentException(e);}
        live++;
    }
    public void paint(String commands,float[] points,float start,float end){
        if(disposed)return;cancel();this.commands=commands;current=new float[points.length+2];current[0]=start;current[1]=end;System.arraycopy(points,0,current,2,points.length);rebuild();invalidateSelf();
    }
    public float[] values(){return current.clone();}
    public float[] geometryBounds(){RectF b=new RectF();path.computeBounds(b,false);return new float[]{b.left,b.top,b.width(),b.height()};}
    public boolean isPlaying(){return animator!=null;}
    public void play(String commands,float[] from,float[] to,float[] times,float[] samples,double duration,double delay,int repeats,boolean reverse){
        if(disposed)return;cancel();
        this.commands=commands;this.from=from;this.to=to;this.times=times;this.samples=samples;
        this.duration=duration;this.delay=delay;this.repeats=repeats;this.reverse=reverse;
        current=from.clone();rebuild();apply(0);
        active++;clock(0);
    }
    /** A resume rebuilds the clock: Android moves a seeked start time by the paused duration on the frame after resume(). */
    public void control(double time,boolean paused){
        if(animator==null)return;
        long at=Math.max(0,(long)time);
        if(paused){animator.setCurrentPlayTime(at);animator.pause();}
        else if(animator.isPaused())clock(at);
        else animator.setCurrentPlayTime(at);
        apply(time);
    }
    private void clock(long at){
        ValueAnimator old=animator;
        if(old!=null){old.removeAllUpdateListeners();old.removeAllListeners();old.cancel();}
        final ValueAnimator a=ValueAnimator.ofFloat(0f,1f);
        a.setDuration(repeats<0?60000:Math.max(1,(long)Math.ceil(delay+duration*(repeats+1))));
        a.setRepeatCount(repeats<0?ValueAnimator.INFINITE:0);a.setInterpolator(new LinearInterpolator());
        a.addUpdateListener(v->apply(v.getCurrentPlayTime()));
        a.addListener(new AnimatorListenerAdapter(){@Override public void onAnimationEnd(Animator ended){if(animator==a){animator=null;active--;}}});
        animator=a;
        if(at>0)a.setCurrentPlayTime(at);
        a.start();
    }
    private void apply(double elapsed){
        double t=Math.max(0,elapsed-delay), fraction;
        if(repeats>=0&&t>=duration*(repeats+1))fraction=reverse&&((int)repeats%2==1)?0:1;
        else {long cycle=(long)(t/duration);fraction=t/duration-cycle;if(reverse&&(cycle%2==1))fraction=1-fraction;}
        int low=0,high=times.length-1;
        while(high-low>1){int mid=(low+high)/2;if(times[mid]<=fraction)low=mid;else high=mid;}
        double span=times[high]-times[low], mix=span>0?Math.max(0,Math.min(1,(fraction-times[low])/span)):1;
        double progress=samples[low]+(samples[high]-samples[low])*mix;
        boolean changed=false;
        for(int i=0;i<current.length;i++){
            float v=(float)(from[i]+(to[i]-from[i])*progress);
            if(i<2)v=Math.max(0,Math.min(1,v));else if(v!=current[i])changed=true;
            current[i]=v;
        }
        if(changed)rebuild();invalidateSelf();
    }
    private void rebuild(){
        path.rewind();int i=2;
        for(int c=0;c<commands.length();c++)switch(commands.charAt(c)){
            case 'M':path.moveTo(current[i],current[i+1]);i+=2;break;
            case 'L':path.lineTo(current[i],current[i+1]);i+=2;break;
            case 'C':path.cubicTo(current[i],current[i+1],current[i+2],current[i+3],current[i+4],current[i+5]);i+=6;break;
            case 'Q':path.quadTo(current[i],current[i+1],current[i+2],current[i+3]);i+=4;break;
            case 'Z':path.close();break;
        }
        measure.setPath(path,false);length=measure.getLength();
    }
    @Override public void draw(Canvas canvas){
        Rect b=getBounds();if(disposed||current.length<4||b.width()<=0||b.height()<=0)return;
        float scale=Math.min(b.width()/box[2],b.height()/box[3]);
        int save=canvas.save();canvas.clipRect(b);
        canvas.translate(b.exactCenterX()-box[2]*scale/2,b.exactCenterY()-box[3]*scale/2);canvas.scale(scale,scale);canvas.translate(-box[0],-box[1]);
        canvas.drawPath(path,fill);
        if(stroke.getStrokeWidth()>0&&current[1]>current[0]){
            if(current[0]<=0&&current[1]>=1)canvas.drawPath(path,stroke);
            else{trimmed.rewind();measure.getSegment(length*current[0],length*current[1],trimmed,true);canvas.drawPath(trimmed,stroke);}
        }
        canvas.restoreToCount(save);
    }
    public void cancel(){
        ValueAnimator a=animator;animator=null;
        if(a!=null){active--;a.removeAllUpdateListeners();a.removeAllListeners();a.cancel();}
        from=to=times=samples=null;
    }
    public void dispose(){if(disposed)return;cancel();disposed=true;live--;path.rewind();trimmed.rewind();current=new float[0];setCallback(null);}
    @Override public void setAlpha(int alpha){fill.setAlpha(alpha);stroke.setAlpha(alpha);invalidateSelf();}
    @Override public void setColorFilter(ColorFilter filter){fill.setColorFilter(filter);stroke.setColorFilter(filter);invalidateSelf();}
    @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
}
