package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.*;
import android.graphics.drawable.*;
import android.os.Build;
import android.view.MotionEvent;
import android.view.View;
import android.widget.ImageView;
import org.json.*;
import java.lang.ref.WeakReference;
import java.util.ArrayList;
import android.view.ViewTreeObserver;

/** Image-only GPU effects. All animation and pointer samples stay in Java. */
public final class ImageEffect {
    public interface Listener { void onEnd(boolean completed, float progress); }
    private static final String SHADER =
        "uniform shader source; uniform shader destination; uniform float2 size;" +
        "uniform float2 origin; uniform float2 displacement; uniform float progress;" +
        "uniform float amplitude; uniform float radius; uniform float seed; uniform float mode;" +
        "uniform float4 shapes[24]; uniform float shapeCount; uniform float blend;" +
        "float distanceToShape(float2 p,float4 shape,float radius,float kind) {" +
        "float2 halfSize=kind>.5?float2(radius*min(size.x,size.y)):shape.zw*size*.5;" +
        "float r=kind>.5?halfSize.x:min(radius*min(size.x,size.y),min(halfSize.x,halfSize.y));" +
        "float2 q=abs(p-shape.xy*size)-halfSize+r; return length(max(q,0.))+min(max(q.x,q.y),0.)-r;}" +
        "half4 main(float2 p) { float2 uv=p/size; float2 q=p;" +
        "if(mode>2.5){float d=1e9;for(int i=0;i<8;i++){if(float(i)>=shapeCount)break;" +
        "float4 shape=mix(shapes[i*3],shapes[i*3+1],progress),meta=shapes[i*3+2];" +
        "float next=distanceToShape(p,shape,mix(meta.x,meta.y,progress),meta.z);" +
        "float h=blend>0.?max(blend-abs(d-next),0.)/blend:0.;d=min(d,next)-h*h*blend*.25;}" +
        "return source.eval(p)*(1.-smoothstep(-.75,.75,d));}" +
        "if(mode<1.5){ float2 v=p-origin; float d=length(v);" +
        "float edge=clamp(min(min(p.x,size.x-p.x),min(p.y,size.y-p.y))/max(amplitude*2.,1.),0.,1.);" +
        "if(mode<.5){float wave=d-progress*length(size);" +
        "float a=sin(wave/max(radius*.12,1.))*exp(-pow(wave/max(radius,1.),2.))*amplitude*sin(progress*3.14159265);" +
        "q-=v/max(d,1.)*a*edge;}else{q-=displacement*exp(-d*d/max(radius*radius,1.))*edge;}" +
        "return source.eval(clamp(q,float2(.5),size-float2(.5)));}" +
        "if(progress<=0.)return source.eval(p); if(progress>=1.)return destination.eval(p);" +
        "float n=fract(sin(dot(floor(p/3.),float2(12.9898,78.233))+seed)*43758.5453);" +
        "float a=smoothstep(n-.08,n+.08,progress*1.16-.08);" +
        "return mix(source.eval(p),destination.eval(p),a);}";

    private final ImageView view;
    private final Listener listener;
    private final int mode;
    private float amplitude, radius;
    private final long duration;
    private final Drawable original;
    private final Bitmap originalBitmap;
    private final Bitmap destinationBitmap;
    private float[] geometry;
    private boolean suspended;
    private long nativeParameterWrites, resizeCount, peakTextureBytes;
    private final ArrayList<LiveSpring.Binding> inputBindings=new ArrayList<>();
    private final ArrayList<ScrollBinding> scrollBindings=new ArrayList<>();
    private final ImageView.ScaleType originalScale;
    private final View.OnTouchListener previousTouch;
    private final boolean originalClickable;
    private Bitmap source, destination, placeholderBitmap;
    private RuntimeShader shader;
    private EffectDrawable drawable;
    private Drawable placeholder;
    private ValueAnimator animator;
    private boolean disposed, paused, suppressEnd, attached;
    private float progress, goal = 1, x, y, dx, dy;
    private int pointer = -1;
    private float startX, startY, rawX, rawY;
    private long frames, lastFrame, longestFrame;
    // Bounded native draw-callback samples; no bridge call or allocation per frame.
    private final long[] frameIntervals = new long[512];
    private int frameIntervalCount, frameIntervalCursor;
    private String failureReason="";
    private final Path contentClip=new Path();

    public ImageEffect(ImageView view, Bitmap from, Bitmap to, float[] geometry, int mode, float x, float y,
                       float amplitude, float radius, long duration, float seed,
                       View.OnTouchListener previousTouch, Listener listener) {
        this.view=view; this.listener=listener; this.mode=mode;
        this.amplitude=amplitude; this.radius=radius; this.duration=duration;
        this.x=x; this.y=y; this.previousTouch=previousTouch;
        original=view.getDrawable(); originalScale=view.getScaleType();
        originalBitmap=from;destinationBitmap=to;this.geometry=geometry.clone();
        originalClickable=view.isClickable();
        if(Build.VERSION.SDK_INT<33 || !view.isHardwareAccelerated() || from==null || original==null || original instanceof Animatable) {
            failureReason="Requires API 33, hardware rendering and a static drawable ("+(original==null?"null":original.getClass().getName())+")";
            return;
        }
        int w=view.getWidth(), h=view.getHeight();
        if(w<=0 || h<=0 || (long)w*h>4194304L) {failureReason="Image surface exceeds the pixel budget";return;}
        try {
            float left=view.getPaddingLeft(),top=view.getPaddingTop(),right=view.getPaddingRight(),bottom=view.getPaddingBottom();
            float[] radii={
                Math.max(0,geometry[2]-left),Math.max(0,geometry[2]-top),
                Math.max(0,geometry[3]-right),Math.max(0,geometry[3]-top),
                Math.max(0,geometry[4]-right),Math.max(0,geometry[4]-bottom),
                Math.max(0,geometry[5]-left),Math.max(0,geometry[5]-bottom)
            };
            contentClip.addRoundRect(new RectF(left,top,w-right,h-bottom),radii,Path.Direction.CW);
            source=raster(from,geometry[0],w,h);
            if(mode==2) {
                if(to==null) { releaseBitmaps(); return; }
                destination=raster(to,geometry[1],w,h);
            }
            shader=new RuntimeShader(SHADER);
            shader.setInputShader("source",new BitmapShader(source,Shader.TileMode.CLAMP,Shader.TileMode.CLAMP));
            shader.setInputShader("destination",new BitmapShader(destination==null?source:destination,Shader.TileMode.CLAMP,Shader.TileMode.CLAMP));
            shader.setFloatUniform("size",w,h); shader.setFloatUniform("mode",mode);
            shader.setFloatUniform("amplitude",amplitude); shader.setFloatUniform("radius",radius);
            shader.setFloatUniform("seed",seed);
            shader.setFloatUniform("shapes",new float[96]);shader.setFloatUniform("shapeCount",0);shader.setFloatUniform("blend",0);
            drawable=new EffectDrawable(w,h);
            drawable.setBounds(0,0,w,h);
            update();
            // NativeScript's ImageView rasterizes custom drawables on a software
            // canvas. An overlay keeps RuntimeShader on the hardware canvas.
            view.getOverlay().add(drawable);
            attached=true;
            // NativeScript's onDraw clips the canvas to its bitmap's mapped
            // rectangle, including overlays. A full-content transparent alpha
            // bitmap keeps that clip open in every stretch/rotation mode.
            // Clearing the drawable leaves its cached bitmap shader invalid.
            int pw=Math.max(1,w-view.getPaddingLeft()-view.getPaddingRight());
            int ph=Math.max(1,h-view.getPaddingTop()-view.getPaddingBottom());
            float angle=Math.abs(geometry[0]%180);
            if(angle>45 && angle<135){int swap=pw;pw=ph;ph=swap;}
            placeholderBitmap=Bitmap.createBitmap(pw,ph,Bitmap.Config.ALPHA_8);
            view.setImageBitmap(placeholderBitmap);
            placeholder=view.getDrawable();peakTextureBytes=getTextureBytes();
            if(mode==1) {
                view.setClickable(true);
                view.setOnTouchListener(this::touch);
            }
        } catch (RuntimeException | OutOfMemoryError error) {
            failureReason=error.toString();
            if(attached) restore(true);
            releaseBitmaps(); shader=null; drawable=null;
        }
    }

    /** Match NativeScript's bitmap mapping without baking backgrounds/borders
     * into the texture. The stationary inner corner mask is applied at draw time. */
    private Bitmap raster(Bitmap bitmap,float rotation,int width,int height) {
        Bitmap result=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);
        Canvas canvas=new Canvas(result);
        float left=view.getPaddingLeft(),top=view.getPaddingTop();
        float w=width-left-view.getPaddingRight(),h=height-top-view.getPaddingBottom();
        float iw=bitmap.getWidth(),ih=bitmap.getHeight();
        Matrix matrix=new Matrix();matrix.postRotate(rotation,iw/2,ih/2);
        float angle=Math.abs(rotation%180);
        if(angle>45 && angle<135){matrix.postTranslate((ih-iw)/2,(iw-ih)/2);float swap=iw;iw=ih;ih=swap;}
        float sx=w/iw,sy=h/ih;
        RectF visible=new RectF(left,top,left+w,top+h);
        if(originalScale==ImageView.ScaleType.FIT_XY) matrix.postScale(sx,sy);
        else if(originalScale==ImageView.ScaleType.MATRIX) visible.intersect(left,top,left+iw,top+ih);
        else {
            float scale=originalScale==ImageView.ScaleType.CENTER?1:originalScale==ImageView.ScaleType.CENTER_CROP?Math.max(sx,sy):Math.min(sx,sy);
            matrix.postTranslate((w-iw)/2,(h-ih)/2);
            matrix.postScale(scale,scale,w/2,h/2);
            visible.intersect(left+(w-iw*scale)/2,top+(h-ih*scale)/2,left+(w+iw*scale)/2,top+(h+ih*scale)/2);
        }
        matrix.postTranslate(left,top);
        BitmapShader pixels=new BitmapShader(bitmap,Shader.TileMode.CLAMP,Shader.TileMode.CLAMP);
        pixels.setLocalMatrix(matrix);
        Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
        paint.setShader(pixels);paint.setColorFilter(view.getColorFilter());
        canvas.drawRect(visible,paint);
        return result;
    }

    public ImageView targetView() { return view; }
    public long getNativeParameterWrites() { return nativeParameterWrites; }
    public long getResizeCount() { return resizeCount; }
    public long getPeakTextureBytes() { return peakTextureBytes; }
    public void retainBinding(LiveSpring.Binding binding) { inputBindings.add(binding); }
    public void releaseBinding(LiveSpring.Binding binding) { inputBindings.remove(binding); }
    public void setSuspended(boolean value) { suspended=value; }
    public void setParameter(String parameter,double value) {
        if(disposed || suspended || !Double.isFinite(value) || shader==null)return;
        float density=view.getResources().getDisplayMetrics().density;
        float next=(float)value;
        switch(parameter) {
            case "progress":if(mode==1)return;next=Math.max(0,Math.min(1,next));cancelAnimator();if(progress==next)return;progress=next;break;
            case "amplitude":next=Math.max(0,Math.min(64,next))*density;if(amplitude==next)return;amplitude=next;shader.setFloatUniform("amplitude",amplitude);break;
            case "radius":next=Math.max(.001f,next)*density;if(radius==next)return;radius=next;shader.setFloatUniform("radius",radius);break;
            case "originX":next*=density;if(x==next)return;x=next;break;
            case "originY":next*=density;if(y==next)return;y=next;break;
            default:return;
        }
        nativeParameterWrites++;update();
    }
    public void configureMask(String configuration) {
        try {
            JSONObject config=new JSONObject(configuration);JSONArray shapes=config.getJSONArray("shapes");
            float[] data=new float[96];
            for(int i=0;i<shapes.length();i++) {
                JSONObject shape=shapes.getJSONObject(i),a=shape.getJSONObject("from"),b=shape.getJSONObject("to");
                String[] keys={"x","y","width","height"};
                for(int j=0;j<4;j++){data[i*12+j]=(float)a.optDouble(keys[j],0);data[i*12+4+j]=(float)b.optDouble(keys[j],0);}
                data[i*12+8]=(float)a.getDouble("radius");data[i*12+9]=(float)b.getDouble("radius");data[i*12+10]=shape.getString("kind").equals("circle")?1:0;
            }
            shader.setFloatUniform("shapes",data);shader.setFloatUniform("shapeCount",shapes.length());
            shader.setFloatUniform("blend",(float)config.optDouble("blend",16)*view.getResources().getDisplayMetrics().density);update();
        } catch(JSONException error){throw new IllegalArgumentException(error);}
    }
    public boolean resize(float[] nextGeometry) {
        if(disposed || shader==null)return false;
        int w=view.getWidth(),h=view.getHeight();if(w<=0 || h<=0 || (long)w*h>4194304)return false;
        try {
            Bitmap next=raster(originalBitmap,nextGeometry[0],w,h);
            Bitmap dest=mode==2?raster(destinationBitmap,nextGeometry[1],w,h):null;
            int pw=Math.max(1,w-view.getPaddingLeft()-view.getPaddingRight()),ph=Math.max(1,h-view.getPaddingTop()-view.getPaddingBottom());
            float angle=Math.abs(nextGeometry[0]%180);if(angle>45 && angle<135){int swap=pw;pw=ph;ph=swap;}
            Bitmap placeholderNext=Bitmap.createBitmap(pw,ph,Bitmap.Config.ALPHA_8);
            peakTextureBytes=Math.max(peakTextureBytes,getTextureBytes()+next.getAllocationByteCount()+(dest==null?0:dest.getAllocationByteCount())+placeholderNext.getAllocationByteCount());
            shader.setInputShader("source",new BitmapShader(next,Shader.TileMode.CLAMP,Shader.TileMode.CLAMP));
            shader.setInputShader("destination",new BitmapShader(dest==null?next:dest,Shader.TileMode.CLAMP,Shader.TileMode.CLAMP));
            shader.setFloatUniform("size",w,h);source=next;destination=dest;placeholderBitmap=placeholderNext;
            view.setImageBitmap(placeholderNext);placeholder=view.getDrawable();geometry=nextGeometry.clone();
            float left=view.getPaddingLeft(),top=view.getPaddingTop(),right=view.getPaddingRight(),bottom=view.getPaddingBottom();
            float[] radii={Math.max(0,geometry[2]-left),Math.max(0,geometry[2]-top),Math.max(0,geometry[3]-right),Math.max(0,geometry[3]-top),Math.max(0,geometry[4]-right),Math.max(0,geometry[4]-bottom),Math.max(0,geometry[5]-left),Math.max(0,geometry[5]-bottom)};
            contentClip.reset();contentClip.addRoundRect(new RectF(left,top,w-right,h-bottom),radii,Path.Direction.CW);
            drawable.setBounds(0,0,w,h);resizeCount++;update();return true;
        } catch(RuntimeException|OutOfMemoryError error){failureReason=error.toString();return false;}
    }
    /** The native observer is local to this binding and never replaces a scroll listener. */
    public static final class ScrollBinding implements ViewTreeObserver.OnScrollChangedListener {
        private final WeakReference<ImageEffect> effect;
        private final WeakReference<View> scroll;
        private final String parameter;
        private final double start,end,low,high;
        private final boolean horizontal;
        private ViewTreeObserver observer;
        public ScrollBinding(ImageEffect effect,View scroll,String parameter,String configuration) {
            this.effect=new WeakReference<>(effect);this.scroll=new WeakReference<>(scroll);this.parameter=parameter;
            try {JSONObject config=new JSONObject(configuration);JSONArray range=config.getJSONArray("range"),output=config.getJSONArray("output");
                start=range.getDouble(0);end=range.getDouble(1);low=output.getDouble(0);high=output.getDouble(1);horizontal=config.optString("axis").equals("x");
            } catch(JSONException error){throw new IllegalArgumentException(error);}
            observer=scroll.getViewTreeObserver();observer.addOnScrollChangedListener(this);effect.scrollBindings.add(this);onScrollChanged();
        }
        @Override public void onScrollChanged() {
            ImageEffect target=effect.get();View source=scroll.get();if(target==null || source==null)return;
            double offset=(horizontal?source.getScrollX():source.getScrollY())/source.getResources().getDisplayMetrics().density;
            double t=Math.max(0,Math.min(1,(offset-start)/(end-start)));target.setParameter(parameter,low+(high-low)*t);
        }
        public void cancel() {
            if(observer!=null && observer.isAlive())observer.removeOnScrollChangedListener(this);observer=null;
            ImageEffect target=effect.get();if(target!=null)target.scrollBindings.remove(this);effect.clear();scroll.clear();
        }
    }

    public boolean isSupported() { return drawable!=null && !disposed; }
    public String getFailureReason() { return failureReason; }
    public float getProgress() { return progress; }
    public long getFrames() { return frames; }
    public long getLongestFrameNanos() { return longestFrame; }
    public double[] getFrameIntervalsMs() {
        double[] result = new double[frameIntervalCount];
        int start = (frameIntervalCursor - frameIntervalCount + frameIntervals.length) % frameIntervals.length;
        for(int i=0;i<result.length;i++) result[i]=frameIntervals[(start+i)%frameIntervals.length]/1e6;
        return result;
    }
    public long getTextureBytes() { return source==null?0:(long)source.getAllocationByteCount()+(destination==null?0:destination.getAllocationByteCount())+(placeholderBitmap==null?0:placeholderBitmap.getAllocationByteCount()); }
    public boolean isPaused() { return paused; }

    public void play(float destinationProgress) {
        if(disposed || drawable==null || mode==1) return;
        goal=destinationProgress; paused=false;
        animate(progress,goal,Math.max(1,(long)(duration*Math.abs(goal-progress))),false);
    }
    public void pause() {
        paused=true;
        if(animator!=null) animator.pause();
    }
    public void resume() {
        if(disposed) return;
        paused=false;
        lastFrame=0;
        if(animator!=null && animator.isPaused()) animator.resume();
    }
    public void seek(float value) {
        if(disposed || mode==1) return;
        boolean hold=paused;
        cancelAnimator(); progress=value; update();
        if(!hold) play(goal);
    }
    public void finish(float endpoint) {
        if(disposed || mode==1) return;
        cancelAnimator(); progress=endpoint; update();
        listener.onEnd(true,progress);
    }
    public void stop() {
        detach(true);
    }
    public void stopPreservingImage() {
        detach(false);
    }
    private void detach(boolean restoreImage) {
        if(disposed) return;
        disposed=true; cancelAnimator();
        for(LiveSpring.Binding binding:new ArrayList<>(inputBindings))binding.cancel();inputBindings.clear();
        for(ScrollBinding binding:new ArrayList<>(scrollBindings))binding.cancel();scrollBindings.clear();
        restore(restoreImage); shader=null; drawable=null; releaseBitmaps();
    }
    private void restore(boolean restoreImage) {
        if(attached && drawable!=null) view.getOverlay().remove(drawable);
        if(restoreImage && attached && view.getDrawable()==placeholder) {
            // NativeScript caches mBitmap separately from its drawable. Restoring
            // only the drawable leaves the placeholder's geometry behind.
            view.setImageBitmap(originalBitmap);
        }
        if(mode==1 && drawable!=null) {
            view.setOnTouchListener(previousTouch); view.setClickable(originalClickable);
            if(view.getParent()!=null) view.getParent().requestDisallowInterceptTouchEvent(false);
        }
        attached=false;
    }
    private void releaseBitmaps() {
        // Draw commands may still reference them; let Android retire the backing storage safely.
        source=null; destination=null; placeholderBitmap=null;
    }
    private void cancelAnimator() {
        if(animator==null) return;
        suppressEnd=true; animator.cancel(); animator=null; suppressEnd=false;
    }
    private void animate(float from,float to,long milliseconds,boolean settle) {
        cancelAnimator();
        lastFrame=0;
        final float startDx=dx,startDy=dy;
        animator=ValueAnimator.ofFloat(from,to);
        animator.setDuration(milliseconds);
        animator.setInterpolator(new android.view.animation.LinearInterpolator());
        animator.addUpdateListener(a->{
            float value=(float)a.getAnimatedValue();
            if(settle) {float t=value; float decay=(float)(Math.exp(-8*t)*(1-t)); dx=startDx*decay; dy=startDy*decay;}
            else progress=value;
            update();
        });
        animator.addListener(new AnimatorListenerAdapter(){
            @Override public void onAnimationEnd(Animator a){
                if(suppressEnd || disposed) return;
                animator=null;
                if(settle) {dx=dy=0;update();}
                else if(mode!=3) listener.onEnd(true,progress);
            }
        });
        animator.start();
    }
    private boolean touch(View target,MotionEvent event) {
        if(disposed || paused) return false;
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN) {
            cancelAnimator(); pointer=event.getPointerId(0);
            x=startX=event.getX(); y=startY=event.getY(); dx=dy=rawX=rawY=0;
            update(); return true;
        }
        int index=event.findPointerIndex(pointer);
        if(action==MotionEvent.ACTION_MOVE && index>=0) {
            float vx=event.getX(index)-startX,vy=event.getY(index)-startY;
            rawX=vx;rawY=vy;
            float length=(float)Math.hypot(vx,vy);
            float factor=length==0?0:(float)(amplitude*Math.tanh(length/Math.max(amplitude,1))/length);
            dx=vx*factor; dy=vy*factor; update(); return true;
        }
        if(action==MotionEvent.ACTION_POINTER_UP && event.getPointerId(event.getActionIndex())==pointer) {
            int next=event.getActionIndex()==0?1:0;
            if(next<event.getPointerCount()) {
                pointer=event.getPointerId(next); startX=event.getX(next)-rawX;startY=event.getY(next)-rawY;
            }
        }
        if(action==MotionEvent.ACTION_UP || action==MotionEvent.ACTION_CANCEL) {
            pointer=-1; animate(0,1,Math.min(600,duration),true);
            if(action==MotionEvent.ACTION_UP) view.performClick();
        }
        return true;
    }
    private void update() {
        if(shader==null || disposed) return;
        shader.setFloatUniform("origin",x,y);
        shader.setFloatUniform("displacement",dx,dy);
        shader.setFloatUniform("progress",progress);
        if(drawable!=null) drawable.invalidateSelf();
    }
    private final class EffectDrawable extends Drawable {
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        private final int width,height;
        EffectDrawable(int width,int height) {this.width=width;this.height=height;paint.setShader(shader);}
        @Override public int getIntrinsicWidth(){return width;}
        @Override public int getIntrinsicHeight(){return height;}
        @Override public void draw(Canvas canvas){
            long now=System.nanoTime(); if(lastFrame!=0 && animator!=null && !paused) {
                long interval=now-lastFrame; longestFrame=Math.max(longestFrame,interval);
                frameIntervals[frameIntervalCursor]=interval;
                frameIntervalCursor=(frameIntervalCursor+1)%frameIntervals.length;
                frameIntervalCount=Math.min(frameIntervalCount+1,frameIntervals.length);
            }
            lastFrame=now; frames++;
            canvas.drawPath(contentClip,paint);
        }
        @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
        @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
        @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
    }
}
