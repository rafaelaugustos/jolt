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

/** Image-only GPU effects. All animation and pointer samples stay in Java. */
public final class ImageEffect {
    public interface Listener { void onEnd(boolean completed, float progress); }
    private static final String SHADER =
        "uniform shader source; uniform shader destination; uniform float2 size;" +
        "uniform float2 origin; uniform float2 displacement; uniform float progress;" +
        "uniform float amplitude; uniform float radius; uniform float seed; uniform float mode;" +
        "half4 main(float2 p) { float2 uv=p/size; float2 q=p;" +
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
    private final float amplitude, radius;
    private final long duration;
    private final Drawable original;
    private final Bitmap originalBitmap;
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
    private String failureReason="";
    private final Path contentClip=new Path();

    public ImageEffect(ImageView view, Bitmap from, Bitmap to, float[] geometry, int mode, float x, float y,
                       float amplitude, float radius, long duration, float seed,
                       View.OnTouchListener previousTouch, Listener listener) {
        this.view=view; this.listener=listener; this.mode=mode;
        this.amplitude=amplitude; this.radius=radius; this.duration=duration;
        this.x=x; this.y=y; this.previousTouch=previousTouch;
        original=view.getDrawable(); originalScale=view.getScaleType();
        originalBitmap=from;
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
            placeholder=view.getDrawable();
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

    public boolean isSupported() { return drawable!=null && !disposed; }
    public String getFailureReason() { return failureReason; }
    public float getProgress() { return progress; }
    public long getFrames() { return frames; }
    public long getLongestFrameNanos() { return longestFrame; }
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
                else listener.onEnd(true,progress);
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
            long now=System.nanoTime(); if(lastFrame!=0 && animator!=null && !paused) longestFrame=Math.max(longestFrame,now-lastFrame);
            lastFrame=now; frames++;
            canvas.drawPath(contentClip,paint);
        }
        @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
        @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
        @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
    }
}
