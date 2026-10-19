package org.rafaelaugusto.jolt;

import android.animation.ValueAnimator;
import android.graphics.RectF;
import android.view.*;
import android.widget.ImageView;

/** Focal zoom, bounds, pan and dismissal; no pointer/frame callback crosses to JS. */
public final class PhotoZoom implements View.OnTouchListener, View.OnLayoutChangeListener {
    public interface Listener {
        void onDismiss(float x,float y,float scale,float velocity,float progress);
        void onSettled(float x,float y,float scale);
    }
    private final ImageView image;
    private final View viewport,backdrop,chrome;
    private final Listener listener;
    private final View.OnTouchListener previousTouch,previousImageTouch;
    private final ScaleGestureDetector pinch;
    private final GestureDetector taps;
    private final float minimum,maximum,doubleTap,density,slop;
    private final float bitmapWidth,bitmapHeight;
    private final boolean dismiss,originalClickable,originalImageClickable,originalClip,originalClipPadding;
    private final float originalScaleX,originalScaleY,originalX,originalY,backdropAlpha,chromeAlpha;
    private final RectF content=new RectF();
    private float anchorX,anchorY,width,height,x,y,scale,progress;
    private float lastX,lastY,downX,downY,lastFocusX,lastFocusY,vx,vy;
    private float rawPanX,rawPanY,pinchFloor;
    private int pointer=-1,mode; // 0 undecided, 1 pan, 2 dismiss, 3 handed to parent
    private boolean disposed,pending,reduced,active=true;
    private VelocityTracker velocity;
    private ValueAnimator animation;

    public PhotoZoom(ImageView image,View viewport,float bitmapWidth,float bitmapHeight,float minimum,float maximum,float doubleTap,
                     boolean dismiss,boolean reduced,View backdrop,View chrome,
                     View.OnTouchListener previousTouch,View.OnTouchListener previousImageTouch,Listener listener) {
        this.image=image;this.viewport=viewport;this.minimum=minimum;this.maximum=maximum;
        this.bitmapWidth=bitmapWidth;this.bitmapHeight=bitmapHeight;
        this.doubleTap=doubleTap;this.dismiss=dismiss;this.reduced=reduced;
        this.backdrop=backdrop;this.chrome=chrome;this.previousTouch=previousTouch;this.listener=listener;
        this.previousImageTouch=previousImageTouch;
        density=image.getResources().getDisplayMetrics().density;
        slop=ViewConfiguration.get(image.getContext()).getScaledTouchSlop();
        originalScaleX=image.getScaleX();originalScaleY=image.getScaleY();
        originalX=image.getTranslationX();originalY=image.getTranslationY();
        originalClickable=viewport.isClickable();
        originalImageClickable=image.isClickable();
        originalClip=!(viewport instanceof ViewGroup)||((ViewGroup)viewport).getClipChildren();
        originalClipPadding=!(viewport instanceof ViewGroup)||((ViewGroup)viewport).getClipToPadding();
        backdropAlpha=backdrop==null?1:backdrop.getAlpha();chromeAlpha=chrome==null?1:chrome.getAlpha();
        scale=minimum;
        pinch=new ScaleGestureDetector(image.getContext(),new ScaleGestureDetector.SimpleOnScaleGestureListener(){
            @Override public boolean onScaleBegin(ScaleGestureDetector detector){
                if(pending || disposed) return false;
                cancelAnimation();mode=1;pinchFloor=Math.min(minimum,scale);
                lastFocusX=detector.getFocusX();lastFocusY=detector.getFocusY();
                disallow(true);return true;
            }
            @Override public boolean onScale(ScaleGestureDetector detector){
                float next=clamp(scale*detector.getScaleFactor(),pinchFloor,maximum);
                float fx=detector.getFocusX(),fy=detector.getFocusY();
                x=fx-anchorX-(lastFocusX-anchorX-x)*next/scale;
                y=fy-anchorY-(lastFocusY-anchorY-y)*next/scale;
                scale=next;lastFocusX=fx;lastFocusY=fy;
                progress=clamp((minimum-scale)/(minimum*.15f),0,1);
                rebasePan();
                apply();return true;
            }
        });
        taps=new GestureDetector(image.getContext(),new GestureDetector.SimpleOnGestureListener(){
            @Override public boolean onDown(MotionEvent e){return true;}
            @Override public boolean onDoubleTap(MotionEvent e){
                if(!pending) zoom(scale>minimum+.01f?minimum:Math.min(maximum,doubleTap),e.getX(),e.getY(),true);
                return true;
            }
            @Override public boolean onSingleTapConfirmed(MotionEvent e){viewport.performClick();return true;}
        });
        viewport.setClickable(true);viewport.setOnTouchListener(this);
        image.setClickable(true);image.setOnTouchListener((v,event)->{
            MotionEvent local=MotionEvent.obtain(event);
            local.transform(image.getMatrix());
            local.offsetLocation(image.getLeft()-viewport.getScrollX(),image.getTop()-viewport.getScrollY());
            boolean consumed=onTouch(viewport,local);local.recycle();return consumed;
        });
        if(viewport instanceof ViewGroup){((ViewGroup)viewport).setClipChildren(true);((ViewGroup)viewport).setClipToPadding(true);}
        viewport.addOnLayoutChangeListener(this);image.addOnLayoutChangeListener(this);
        measure();apply();
    }
    public float getX(){return x/density;}
    public float getY(){return y/density;}
    public float getScale(){return scale;}
    public float getDismissProgress(){return progress;}
    public boolean isDismissPending(){return pending;}
    public void setReduced(boolean value){reduced=value;if(value){if(pending)reset(false);else settle(false);}}
    public void setActive(boolean value){active=value;if(!value){cancelAnimation();endTouch();pending=false;settle(false);}}
    public void zoom(float value,float focusX,float focusY,boolean animated){
        if(disposed || pending) return;
        cancelAnimation();
        float next=clamp(value,minimum,maximum);
        float tx=focusX-anchorX-(focusX-anchorX-x)*next/scale;
        float ty=focusY-anchorY-(focusY-anchorY-y)*next/scale;
        float[] bounds=bounds(next);
        spring(clamp(tx,bounds[0],bounds[1]),clamp(ty,bounds[2],bounds[3]),next,0,0,animated,false);
    }
    public void reset(boolean animated){
        if(disposed)return;
        pending=false;mode=0;float[] b=bounds(minimum);
        spring(clamp(0,b[0],b[1]),clamp(0,b[2],b[3]),minimum,0,0,animated,false);
    }
    public void requestDismiss(){
        if(disposed || pending || !dismiss)return;
        // Programmatic close normalizes zoom before emitting one route intent.
        float[] b=bounds(minimum);
        spring(clamp(0,b[0],b[1]),clamp(0,b[2],b[3]),minimum,0,0,true,true);
    }
    public void stop(){
        if(disposed)return;
        disposed=true;cancelAnimation();endTouch();
        viewport.setOnTouchListener(previousTouch);viewport.setClickable(originalClickable);
        image.setOnTouchListener(previousImageTouch);image.setClickable(originalImageClickable);
        if(viewport instanceof ViewGroup){((ViewGroup)viewport).setClipChildren(originalClip);((ViewGroup)viewport).setClipToPadding(originalClipPadding);}
        viewport.removeOnLayoutChangeListener(this);image.removeOnLayoutChangeListener(this);
        image.setScaleX(originalScaleX);image.setScaleY(originalScaleY);
        image.setTranslationX(originalX);image.setTranslationY(originalY);
        if(backdrop!=null)backdrop.setAlpha(backdropAlpha);if(chrome!=null)chrome.setAlpha(chromeAlpha);
    }
    private void measure(){
        width=viewport.getWidth();height=viewport.getHeight();
        float iw=image.getWidth(),ih=image.getHeight();
        float left=image.getPaddingLeft(),top=image.getPaddingTop();
        float cw=iw-left-image.getPaddingRight(),ch=ih-top-image.getPaddingBottom();
        float dw=Math.max(1,bitmapWidth),dh=Math.max(1,bitmapHeight);
        ImageView.ScaleType fit=image.getScaleType();
        float factor=fit==ImageView.ScaleType.CENTER_CROP?Math.max(cw/dw,ch/dh):Math.min(cw/dw,ch/dh);
        if(fit==ImageView.ScaleType.FIT_XY){dw=cw;dh=ch;}
        else if(fit!=ImageView.ScaleType.CENTER && fit!=ImageView.ScaleType.MATRIX){dw*=factor;dh*=factor;}
        anchorX=image.getLeft()+image.getPivotX()+originalX;
        anchorY=image.getTop()+image.getPivotY()+originalY;
        // ImageView clips the raster before its outer transform is applied.
        float ox=left+(fit==ImageView.ScaleType.MATRIX?0:(cw-dw)/2),oy=top+(fit==ImageView.ScaleType.MATRIX?0:(ch-dh)/2);
        content.set((Math.max(left,ox)-image.getPivotX())*originalScaleX,
                    (Math.max(top,oy)-image.getPivotY())*originalScaleY,
                    (Math.min(left+cw,ox+dw)-image.getPivotX())*originalScaleX,
                    (Math.min(top+ch,oy+dh)-image.getPivotY())*originalScaleY);
    }
    private float[] bounds(float s){
        float loX=width-anchorX-content.right*s,hiX=-anchorX-content.left*s;
        float loY=height-anchorY-content.bottom*s,hiY=-anchorY-content.top*s;
        if(loX>hiX)loX=hiX=(loX+hiX)/2;
        if(loY>hiY)loY=hiY=(loY+hiY)/2;
        return new float[]{loX,hiX,loY,hiY};
    }
    private void apply(){
        image.setScaleX(originalScaleX*scale);image.setScaleY(originalScaleY*scale);
        image.setTranslationX(originalX+x);image.setTranslationY(originalY+y);
        if(backdrop!=null)backdrop.setAlpha(backdropAlpha*(1-progress));
        if(chrome!=null)chrome.setAlpha(chromeAlpha*(1-progress));
    }
    private void settle(boolean animated){
        if(disposed)return;
        float s=clamp(scale,minimum,maximum),b[]=bounds(s);
        float tx=clamp(x,b[0],b[1]),ty=clamp(y,b[2],b[3]);
        if(mode==2){s=minimum;b=bounds(s);tx=clamp(0,b[0],b[1]);ty=clamp(0,b[2],b[3]);}
        else {tx=clamp(tx+vx*.12f,b[0],b[1]);ty=clamp(ty+vy*.12f,b[2],b[3]);}
        spring(tx,ty,s,vx,vy,animated,false);
    }
    private void cancelAnimation(){if(animation!=null){animation.cancel();animation=null;}}
    private void spring(float tx,float ty,float targetScale,float velocityX,float velocityY,boolean animated,boolean close){
        cancelAnimation();
        final float sx=x,sy=y,ss=scale,sp=progress;
        if(!animated || reduced){x=tx;y=ty;scale=targetScale;progress=0;apply();if(close)emitDismiss(0);else listener.onSettled(x/density,y/density,scale);return;}
        animation=ValueAnimator.ofFloat(0,1);animation.setDuration(550);
        animation.setInterpolator(new android.view.animation.LinearInterpolator());
        animation.addUpdateListener(a->{
            float fraction=(float)a.getAnimatedValue(),t=fraction*.55f;
            float decay=(float)Math.exp(-16*t);
            x=tx+((sx-tx)+(velocityX+16*(sx-tx))*t)*decay;
            y=ty+((sy-ty)+(velocityY+16*(sy-ty))*t)*decay;
            scale=targetScale+(ss-targetScale)*(1+16*t)*decay;
            progress=sp*(1+16*t)*decay;
            if(fraction>=1){x=tx;y=ty;scale=targetScale;progress=0;}
            apply();
            if(fraction>=1){animation=null;if(close)emitDismiss(0);else listener.onSettled(x/density,y/density,scale);}
        });animation.start();
    }
    private void emitDismiss(float velocityY){
        if(pending || disposed)return;
        pending=true;listener.onDismiss(x/density,y/density,scale,velocityY/density,progress);
    }
    private void disallow(boolean value){if(viewport.getParent()!=null)viewport.getParent().requestDisallowInterceptTouchEvent(value);}
    private void endTouch(){pointer=-1;if(velocity!=null){velocity.recycle();velocity=null;}disallow(false);}
    @Override public boolean onTouch(View view,MotionEvent event){
        if(disposed || !active || pending)return false;
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN){
            cancelAnimation();mode=0;vx=vy=0;
            pointer=event.getPointerId(0);lastX=downX=event.getX();lastY=downY=event.getY();
            rebasePan();
            if(velocity!=null)velocity.recycle();velocity=VelocityTracker.obtain();disallow(true);
        }
        if(velocity!=null)velocity.addMovement(event);
        pinch.onTouchEvent(event);taps.onTouchEvent(event);
        int index=event.findPointerIndex(pointer);
        if(action==MotionEvent.ACTION_MOVE && !pinch.isInProgress() && event.getPointerCount()==1 && index>=0){
            float px=event.getX(index),py=event.getY(index),totalX=px-downX,totalY=py-downY;
            if(mode==0 && Math.hypot(totalX,totalY)>slop){
                if(scale<=minimum+.001f){
                    if(dismiss && Math.abs(totalY)>Math.abs(totalX)*1.2f)mode=2;
                    else {mode=3;disallow(false);return false;}
                }else mode=1;
            }
            if(mode==1){
                float[] b=bounds(scale);
                rawPanX+=px-lastX;rawPanY+=py-lastY;
                x=rubber(rawPanX,b[0],b[1],width);y=rubber(rawPanY,b[2],b[3],height);
            }else if(mode==2){
                x+= (px-lastX)*.4f;y+=py-lastY;
                progress=clamp(Math.abs(y)/Math.max(height*.5f,1),0,1);
                scale=minimum*(1-progress*.15f);
            }
            lastX=px;lastY=py;apply();
        }
        if(action==MotionEvent.ACTION_POINTER_UP){
            int next=event.getActionIndex()==0?1:0;
            if(next<event.getPointerCount()){pointer=event.getPointerId(next);lastX=downX=event.getX(next);lastY=downY=event.getY(next);rebasePan();}
        }
        if(action==MotionEvent.ACTION_UP || action==MotionEvent.ACTION_CANCEL){
            if(velocity!=null){velocity.computeCurrentVelocity(1000);vx=velocity.getXVelocity(pointer);vy=velocity.getYVelocity(pointer);}
            boolean commit=action==MotionEvent.ACTION_UP && mode==2 && (progress>.35f || (Math.abs(vy)>1000*density && y*vy>0));
            boolean wasAnimation=animation!=null;
            endTouch();
            if(commit)emitDismiss(vy);
            else if(mode!=3 && !wasAnimation)settle(true);
        }
        return mode!=3;
    }
    @Override public void onLayoutChange(View v,int l,int t,int r,int b,int ol,int ot,int or,int ob){
        if(disposed || (l==ol&&t==ot&&r==or&&b==ob))return;
        cancelAnimation();pending=false;measure();vx=vy=0;mode=0;settle(false);
    }
    private static float clamp(float v,float lo,float hi){return Math.max(lo,Math.min(hi,v));}
    private void rebasePan(){float[] b=bounds(scale);rawPanX=unrubber(x,b[0],b[1],width);rawPanY=unrubber(y,b[2],b[3],height);}
    private static float unrubber(float v,float lo,float hi,float dimension){
        float edge=clamp(v,lo,hi),d=v-edge,size=Math.max(1,dimension);
        return edge+d/(.55f*Math.max(.001f,1-Math.abs(d)/size));
    }
    private static float rubber(float value,float lo,float hi,float dimension){
        float edge=clamp(value,lo,hi),d=value-edge;
        return edge+Math.signum(d)*dimension*(1-1/(Math.abs(d)*.55f/Math.max(1,dimension)+1));
    }
}
