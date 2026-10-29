package org.rafaelaugusto.jolt;

import android.app.Activity;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.ColorFilter;
import android.graphics.PixelFormat;
import android.graphics.drawable.Drawable;
import android.app.Application;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.Choreographer;
import android.view.MotionEvent;
import android.view.VelocityTracker;
import android.view.View;
import java.util.HashSet;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Native touch, collision stepping and view writes. No per-event/per-frame JS callback exists. */
public final class CircleWorld implements Choreographer.FrameCallback, View.OnAttachStateChangeListener {
    private static final HashSet<CircleWorld> worlds=new HashSet<>();
    private final CircleMath state;
    private View container;
    private final View[] views;
    private final CircleGuide[] guides,pointerGuides;
    private final boolean[] clickable;
    private final double[] initialX,initialY,initialVX,initialVY,originalX,originalY;
    private final float density;
    private final int[] location=new int[2];
    private Application application;
    private Application.ActivityLifecycleCallbacks lifecycle;
    private boolean enabled,disposed,background,fits,scheduled;
    private double previous,accumulator,processingMs,droppedMs,offsetX,offsetY;
    private long frames,dragStarts,dragMoves,dragEnds,dragCancels,lastMove;
    private int dragging=-1;
    private VelocityTracker velocity;
    public static int worldCount(){return worlds.size();}
    public static int activeCount(){int count=0;for(CircleWorld w:worlds)if(w.scheduled)count++;return count;}
    public CircleWorld(View host,String options){
        container=host;density=host.getResources().getDisplayMetrics().density;
        try {
            JSONObject config=new JSONObject(options);JSONArray data=config.getJSONArray("bodies");
            int count=data.length();if(count<1||count>16)throw new IllegalArgumentException("Physics needs 1–16 circles");
            state=new CircleMath(count);views=new View[count];guides=new CircleGuide[count];pointerGuides=new CircleGuide[count];clickable=new boolean[count];
            initialX=new double[count];initialY=new double[count];initialVX=new double[count];initialVY=new double[count];originalX=new double[count];originalY=new double[count];
            state.width=config.getDouble("width");state.height=config.getDouble("height");
            state.gx=config.getJSONObject("gravity").getDouble("x");state.gy=config.getJSONObject("gravity").getDouble("y");
            state.restitution=config.getDouble("restitution");state.damping=config.getDouble("damping");
            for(int i=0;i<count;i++){
                JSONObject v=data.getJSONObject(i);CircleMath.Body b=state.bodies[i];
                b.x=v.getDouble("x");b.y=v.getDouble("y");b.r=v.getDouble("radius");b.m=v.getDouble("mass");b.vx=v.getDouble("vx");b.vy=v.getDouble("vy");
                initialX[i]=b.x/state.width;initialY[i]=b.y/state.height;initialVX[i]=b.vx;initialVY[i]=b.vy;
                configureAttachment(i,v.optJSONObject("attachment"));
                JSONObject drag=v.optJSONObject("drag");
                if(drag!=null){
                    b.drag.enabled=true;b.drag.length=drag.getDouble("length");b.drag.stiffness=drag.getDouble("stiffness");b.drag.damping=drag.getDouble("damping");
                    JSONObject line=drag.optJSONObject("line");
                    if(line!=null){pointerGuides[i]=new CircleGuide(i,line.getInt("color"),line.getDouble("width"),true);container.getOverlay().add(pointerGuides[i]);}
                }
                JSONObject snap=v.optJSONObject("snap");
                if(snap!=null){
                    JSONArray points=snap.getJSONArray("points");if(points.length()>CircleMath.SNAP_LIMIT)throw new IllegalArgumentException("Too many snap points");
                    b.snap.count=points.length();b.snap.stiffness=snap.getDouble("stiffness");b.snap.damping=snap.getDouble("damping");b.snap.projection=snap.getDouble("projection");
                    for(int j=0;j<points.length();j++){JSONObject point=points.getJSONObject(j);b.snap.u[j]=point.getDouble("x")/state.width;b.snap.v[j]=point.getDouble("y")/state.height;}
                }
            }
        }catch(JSONException e){throw new IllegalArgumentException(e);}
        fits=state.fits(state.width,state.height);
        host.addOnAttachStateChangeListener(this);
        if(host.getContext().getApplicationContext() instanceof Application){
            application=(Application)host.getContext().getApplicationContext();
            lifecycle=new Application.ActivityLifecycleCallbacks(){
                private boolean owns(Activity a){return container!=null && container.getRootView()==a.getWindow().getDecorView();}
                @Override public void onActivityPaused(Activity a){if(owns(a)){background=true;cancelDrag();refresh();}}
                @Override public void onActivityResumed(Activity a){if(owns(a)){background=false;refresh();}}
                @Override public void onActivityCreated(Activity a,Bundle b){}
                @Override public void onActivityStarted(Activity a){}
                @Override public void onActivityStopped(Activity a){}
                @Override public void onActivitySaveInstanceState(Activity a,Bundle b){}
                @Override public void onActivityDestroyed(Activity a){}
            };
            application.registerActivityLifecycleCallbacks(lifecycle);
        }
        worlds.add(this);
    }
    private final class CircleGuide extends Drawable {
        private final int index;
        private final boolean pointer;
        private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
        CircleGuide(int index,int color,double width,boolean pointer){this.index=index;this.pointer=pointer;paint.setColor(0xff000000|color);paint.setStrokeWidth((float)width*density);paint.setStyle(Paint.Style.STROKE);paint.setStrokeCap(Paint.Cap.ROUND);}
        @Override public void draw(Canvas canvas){
            CircleMath.Body b=state.bodies[index];
            if(pointer!=(b.held&&b.drag.enabled))return;
            double x=pointer?b.tx:b.snap.active?state.snapX(b,b.snap.index):b.attachment.u*state.width;
            double y=pointer?b.ty:b.snap.active?state.snapY(b,b.snap.index):b.attachment.v*state.height;
            double dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy);
            if(d>b.r){canvas.drawLine((float)x*density,(float)y*density,(float)(b.x-dx/d*b.r)*density,(float)(b.y-dy/d*b.r)*density,paint);}
            if(pointer||d>b.r)canvas.drawCircle((float)x*density,(float)y*density,2.5f*density,paint);
        }
        @Override public void setAlpha(int alpha){paint.setAlpha(alpha);invalidateSelf();}
        @Override public void setColorFilter(ColorFilter filter){paint.setColorFilter(filter);invalidateSelf();}
        @Override public int getOpacity(){return PixelFormat.TRANSLUCENT;}
    }
    private void configureAttachment(int index,JSONObject options) throws JSONException {
        if(options==null)state.attach(index,false,0,0,0,180,24);
        else state.attach(index,true,options.getDouble("x"),options.getDouble("y"),options.getDouble("length"),options.getDouble("stiffness"),options.getDouble("damping"));
        if(guides[index]!=null){container.getOverlay().remove(guides[index]);guides[index]=null;}
        JSONObject line=options==null?null:options.optJSONObject("line");
        if(line!=null){guides[index]=new CircleGuide(index,line.getInt("color"),line.getDouble("width"),false);container.getOverlay().add(guides[index]);}
    }
    public boolean supportsPointerSpring(){return true;}
    public void attach(int index,String options){
        if(disposed||index<0||index>=views.length)return;
        try{configureAttachment(index,options.equals("null")?null:new JSONObject(options));}catch(JSONException e){throw new IllegalArgumentException(e);}
        apply();refresh();
    }
    public void snapTo(int index,int target){if(disposed||index<0||index>=views.length)return;state.snapTo(index,target);apply();refresh();}
    public void connect(View view,int index){
        if(disposed||index<0||index>=views.length)return;
        if(view.getParent()!=container)throw new IllegalArgumentException("Physics circles must be direct native children");
        views[index]=view;originalX[index]=view.getTranslationX();originalY[index]=view.getTranslationY();clickable[index]=view.isClickable();
        view.setClickable(true);view.setOnTouchListener((v,event)->touch(index,event));apply();
    }
    private boolean ready(){return enabled&&!disposed&&!background&&fits&&container.isAttachedToWindow();}
    private void refresh(){
        if(ready()&&!state.sleeping){if(!scheduled){scheduled=true;Choreographer.getInstance().postFrameCallback(this);}}
        else {if(scheduled)Choreographer.getInstance().removeFrameCallback(this);scheduled=false;previous=0;accumulator=0;}
    }
    @Override public void doFrame(long nanos){
        scheduled=false;
        if(!ready()){cancelDrag();refresh();return;}
        long started=System.nanoTime();double now=nanos/1e9,elapsed=previous>0?Math.max(0,now-previous):0;previous=now;
        droppedMs+=Math.max(0,elapsed-1.0/15)*1000;accumulator+=Math.min(elapsed,1.0/15);
        int budget=16;
        while(accumulator+1e-10>=CircleMath.DT&&budget-->0&&!state.sleeping){state.step();accumulator-=CircleMath.DT;}
        apply();frames++;processingMs+=(System.nanoTime()-started)/1e6;refresh();
    }
    private void apply(){
        for(int i=0;i<views.length;i++)if(views[i]!=null){
            View v=views[i];if(v.getParent()!=container){enabled=false;continue;}
            v.setTranslationX((float)(state.bodies[i].x*density-v.getLeft()-v.getWidth()/2.0));
            v.setTranslationY((float)(state.bodies[i].y*density-v.getTop()-v.getHeight()/2.0));
        }
        for(int kind=0;kind<2;kind++)for(CircleGuide guide:kind==0?guides:pointerGuides)if(guide!=null){guide.setBounds(0,0,container.getWidth(),container.getHeight());guide.invalidateSelf();}
    }
    private void sampleVelocity(MotionEvent event){
        if(velocity==null)return;
        MotionEvent raw=MotionEvent.obtain(event);raw.offsetLocation(event.getRawX()-event.getX(),event.getRawY()-event.getY());velocity.addMovement(raw);raw.recycle();
    }
    private boolean touch(int index,MotionEvent event){
        if(!ready())return false;
        int action=event.getActionMasked();container.getLocationOnScreen(location);
        double x=(event.getRawX()-location[0])/density,y=(event.getRawY()-location[1])/density;
        if(action==MotionEvent.ACTION_DOWN){
            if(dragging>=0)return false;
            CircleMath.Body b=state.bodies[index];if(Math.hypot(x-b.x,y-b.y)>b.r)return false;
            dragging=index;offsetX=b.x-x;offsetY=b.y-y;velocity=VelocityTracker.obtain();lastMove=SystemClock.uptimeMillis();dragStarts++;
            container.getParent().requestDisallowInterceptTouchEvent(true);state.drag(index,b.x,b.y);sampleVelocity(event);refresh();return true;
        }
        if(dragging!=index)return false;
        if(action==MotionEvent.ACTION_POINTER_DOWN||action==MotionEvent.ACTION_CANCEL){cancelDrag();refresh();return true;}
        sampleVelocity(event);
        if(action==MotionEvent.ACTION_MOVE){state.drag(index,x+offsetX,y+offsetY);lastMove=SystemClock.uptimeMillis();dragMoves++;refresh();}
        else if(action==MotionEvent.ACTION_UP){
            velocity.computeCurrentVelocity(1000,(float)CircleMath.SPEED*density);
            boolean fresh=SystemClock.uptimeMillis()-lastMove<=80;
            state.release(index,fresh?velocity.getXVelocity()/density:0,fresh?velocity.getYVelocity()/density:0);
            dragging=-1;dragEnds++;releaseTracker();refresh();
        }
        return true;
    }
    private void releaseTracker(){
        if(velocity!=null){velocity.recycle();velocity=null;}
        if(container!=null&&container.getParent()!=null)container.getParent().requestDisallowInterceptTouchEvent(false);
    }
    private void cancelDrag(){if(dragging>=0){state.cancel(dragging);dragging=-1;dragCancels++;apply();}releaseTracker();}
    public void setEnabled(boolean active){if(disposed)return;boolean changed=enabled!=active;enabled=active;if(!active)cancelDrag();else if(changed)state.wake();refresh();}
    public void resize(double width,double height){
        if(disposed)return;fits=state.fits(width,height);
        if(!fits){cancelDrag();refresh();return;}
        if(Math.abs(width-state.width)>.1||Math.abs(height-state.height)>.1){cancelDrag();state.resize(width,height);}
        apply();refresh();
    }
    public void impulse(int index,double x,double y){
        if(!ready()||index<0||index>=views.length||state.bodies[index].held||!Double.isFinite(x)||!Double.isFinite(y))return;
        CircleMath.Body b=state.bodies[index];b.vx+=x/b.m;b.vy+=y/b.m;CircleMath.limit(b);state.wake();refresh();
    }
    public void reset(){
        if(disposed)return;cancelDrag();
        for(int i=0;i<views.length;i++){CircleMath.Body b=state.bodies[i];b.x=initialX[i]*state.width;b.y=initialY[i]*state.height;b.vx=initialVX[i];b.vy=initialVY[i];b.snap.active=b.snap.previousActive=false;b.released=false;}
        state.contacts(false,64);state.wake();apply();refresh();
    }
    @Override public void onViewAttachedToWindow(View v){refresh();}
    @Override public void onViewDetachedFromWindow(View v){cancelDrag();refresh();}
    public String snapshot(){
        try {
            int guideCount=0;for(int kind=0;kind<2;kind++)for(CircleGuide guide:kind==0?guides:pointerGuides)if(guide!=null)guideCount++;
            JSONArray bodies=new JSONArray();
            for(CircleMath.Body b:state.bodies){
                Object attachment=b.attachment.enabled?new JSONObject().put("anchor",new JSONObject().put("x",b.attachment.u*state.width).put("y",b.attachment.v*state.height)).put("length",b.attachment.length).put("stiffness",b.attachment.stiffness).put("damping",b.attachment.damping):JSONObject.NULL;
                Object snap=JSONObject.NULL;
                if(b.snap.active){double x=state.snapX(b,b.snap.index),y=state.snapY(b,b.snap.index);snap=new JSONObject().put("index",b.snap.index).put("point",new JSONObject().put("x",x).put("y",y)).put("settled",Math.hypot(b.x-x,b.y-y)<=.25&&Math.hypot(b.vx,b.vy)<=4&&!b.held);}
                Object pointer=b.held&&b.drag.enabled?new JSONObject().put("anchor",new JSONObject().put("x",b.tx).put("y",b.ty)).put("length",b.drag.length).put("stiffness",b.drag.stiffness).put("damping",b.drag.damping):JSONObject.NULL;
                Object release=b.released?new JSONObject().put("x",b.releaseX).put("y",b.releaseY).put("vx",b.releaseVX).put("vy",b.releaseVY):JSONObject.NULL;
                bodies.put(new JSONObject().put("x",b.x).put("y",b.y).put("vx",b.vx).put("vy",b.vy).put("radius",b.r).put("held",b.held).put("attachment",attachment).put("pointer",pointer).put("snap",snap).put("release",release));
            }
            String status=disposed?"disposed":!enabled?"paused":background||!container.isAttachedToWindow()?"detached":!fits?"invalid-bounds":state.sleeping?"sleeping":"running";
            return new JSONObject().put("status",status).put("guides",guideCount).put("bodies",bodies).put("frames",frames).put("steps",state.steps).put("contacts",state.contacts).put("dragStarts",dragStarts).put("dragMoves",dragMoves).put("dragEnds",dragEnds).put("dragCancels",dragCancels).put("processingMs",processingMs).put("droppedMs",droppedMs).put("clock",scheduled).toString();
        }catch(JSONException e){throw new IllegalStateException(e);}
    }
    public void dispose(){
        if(disposed)return;enabled=false;cancelDrag();disposed=true;refresh();
        if(application!=null)application.unregisterActivityLifecycleCallbacks(lifecycle);application=null;lifecycle=null;
        container.removeOnAttachStateChangeListener(this);
        for(int i=0;i<views.length;i++)if(views[i]!=null){View v=views[i];v.setOnTouchListener(null);v.setClickable(clickable[i]);v.setTranslationX((float)originalX[i]);v.setTranslationY((float)originalY[i]);views[i]=null;}
        for(int kind=0;kind<2;kind++){CircleGuide[] list=kind==0?guides:pointerGuides;for(int i=0;i<list.length;i++)if(list[i]!=null){container.getOverlay().remove(list[i]);list[i]=null;}}
        container=null;worlds.remove(this);
    }
}
