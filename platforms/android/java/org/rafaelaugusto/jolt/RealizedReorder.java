package org.rafaelaugusto.jolt;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.view.Choreographer;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewConfiguration;
import android.widget.ImageView;
import androidx.core.widget.NestedScrollView;
import java.util.ArrayList;
import org.json.JSONObject;

/** Native retained-row pickup, preview and edge scrolling. No frame callbacks cross to JS. */
public final class RealizedReorder implements ScrollInput.Listener, Choreographer.FrameCallback, View.OnAttachStateChangeListener {
    public interface Listener { void onState(int state,int from,int to); }
    private static int activeCount;
    public static int activeCount(){return activeCount;}
    private static final class Row {
        final View view;
        final ImageView preview;
        final Bitmap bitmap;
        final Rect bounds;
        final float alpha;
        final SpringState spring=new SpringState(0,0);
        Row(View view,ImageView preview,Bitmap bitmap,Rect bounds){this.view=view;this.preview=preview;this.bitmap=bitmap;this.bounds=bounds;alpha=view.getAlpha();}
    }
    private final NestedScrollView scroll;
    private final ViewGroup container;
    private ViewGroup overlayHost;
    private final Listener listener;
    private final float edgeSize,edgeSpeed,slop;
    private final long longPress;
    private final Runnable activate=()->begin();
    private ScrollInput input;
    private View[] rows=new View[0],handles=new View[0];
    private final ArrayList<Row> copies=new ArrayList<>();
    private boolean disposed,enabled=true,active,pending,settling,reduced;
    private float pointerX,pointerY,downX,downY,grabOffset,stride,remainder;
    private int from,target,width,height,generation;
    private long previousTime;
    private ValueAnimator drop;
    public RealizedReorder(NestedScrollView scroll,ViewGroup container,String options,Listener listener){
        this.scroll=scroll;this.container=container;this.listener=listener;
        float density=scroll.getResources().getDisplayMetrics().density;
        slop=ViewConfiguration.get(scroll.getContext()).getScaledTouchSlop();
        try{JSONObject config=new JSONObject(options);edgeSize=(float)config.getDouble("edgeSize")*density;edgeSpeed=(float)config.getDouble("edgeSpeed")*density;longPress=config.getLong("longPress");reduced=config.getBoolean("reducedMotion");}
        catch(Exception error){throw new IllegalArgumentException(error);}
        input=ScrollInput.attach(scroll,this);scroll.addOnAttachStateChangeListener(this);
    }
    public void setRows(View[] rows,View[] handles){if(disposed)return;cancel();this.rows=rows.clone();this.handles=handles.clone();}
    private Rect bounds(View row,ViewGroup host){Rect rect=new Rect();row.getDrawingRect(rect);host.offsetDescendantRectToMyCoords(row,rect);return rect;}
    private int rowAt(float x,float y){
        int[] position=new int[2];
        for(int i=0;i<rows.length;i++){View row=rows[i];row.getLocationOnScreen(position);if(row.isShown() && row.getAlpha()>.01 && x>=position[0] && x<position[0]+row.getWidth() && y>=position[1] && y<position[1]+row.getHeight())return i;}
        return -1;
    }
    @Override public boolean touch(MotionEvent event){
        if(disposed)return false;
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN){
            cancel();downX=pointerX=event.getRawX();downY=pointerY=event.getRawY();
            boolean handle=false;for(View view:handles)if(ScrollInput.contains(view,event)){handle=true;break;}
            if(enabled && handle && ScrollInput.contains(scroll,event) && rowAt(pointerX,pointerY)>=0){pending=true;scroll.postDelayed(activate,longPress);}
        }
        if(event.getPointerCount()>1){boolean owned=active;cancel();return owned;}
        if(action==MotionEvent.ACTION_MOVE){
            pointerX=event.getRawX();pointerY=event.getRawY();
            if(pending && Math.hypot(pointerX-downX,pointerY-downY)>slop)clearPending();
            if(active && !settling)update(0);
        }
        boolean owned=active;
        if(action==MotionEvent.ACTION_UP){clearPending();if(active && !settling)drop();}
        else if(action==MotionEvent.ACTION_CANCEL)cancel();
        return owned;
    }
    private void clearPending(){pending=false;scroll.removeCallbacks(activate);}
    private void begin(){
        if(!pending || disposed || !enabled || !scroll.isAttachedToWindow())return;
        clearPending();int index=rowAt(pointerX,pointerY);
        if(index<0 || rows.length>100 || !(scroll.getParent() instanceof ViewGroup))return;
        long pixels=0;
        for(View row:rows){pixels+=(long)row.getWidth()*row.getHeight();if(!row.isAttachedToWindow() || row.getWidth()<=0 || row.getHeight()<=0 || pixels>16000000)return;}
        overlayHost=scroll;
        try{
            for(View view:rows){
                Bitmap bitmap=Bitmap.createBitmap(view.getWidth(),view.getHeight(),Bitmap.Config.ARGB_8888);view.draw(new Canvas(bitmap));
                ImageView preview=new ImageView(view.getContext());preview.setImageBitmap(bitmap);preview.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);preview.setClickable(false);preview.setAlpha(view.getAlpha());
                preview.layout(0,0,view.getWidth(),view.getHeight());
                copies.add(new Row(view,preview,bitmap,bounds(view,container)));
            }
        }catch(RuntimeException|OutOfMemoryError error){clearCopies();return;}
        if(!input.claim()){clearCopies();return;}
        for(Row row:copies){overlayHost.getOverlay().add(row.preview);row.view.setAlpha(0);}
        Row dragged=copies.get(index);overlayHost.getOverlay().remove(dragged.preview);overlayHost.getOverlay().add(dragged.preview);dragged.preview.setElevation(12*scroll.getResources().getDisplayMetrics().density);
        int[] position=new int[2];rows[index].getLocationOnScreen(position);grabOffset=pointerY-position[1];
        stride=index+1<copies.size()?copies.get(index+1).bounds.top-dragged.bounds.top:dragged.bounds.height()+(index>0?Math.max(0,dragged.bounds.top-copies.get(index-1).bounds.bottom):0);
        from=target=index;width=scroll.getWidth();height=scroll.getHeight();active=true;settling=false;generation++;activeCount++;remainder=0;
        previousTime=System.nanoTime();emit(1,index);if(!active || disposed)return;
        update(0);Choreographer.getInstance().postFrameCallback(this);
    }
    private void emit(int state,int detail){if(!disposed && listener!=null)listener.onState(state,from,detail);}
    @Override public void doFrame(long time){
        if(!active || settling || disposed)return;
        if(!scroll.isAttachedToWindow() || width!=scroll.getWidth() || height!=scroll.getHeight()){finish(false,1);return;}
        for(Row row:copies)if(!row.view.isAttachedToWindow() || !ScrollInput.descendant(row.view,container) || !bounds(row.view,container).equals(row.bounds)){finish(false,1);return;}
        double dt=Math.min(.04,Math.max(0,(time-previousTime)/1e9));previousTime=time;
        int[] location=new int[2];scroll.getLocationOnScreen(location);
        float y=pointerY-location[1],edge=Math.min(edgeSize,scroll.getHeight()/3f),direction=0;
        if(y<edge)direction=-Math.min(1,(edge-y)/edge);else if(y>scroll.getHeight()-edge)direction=Math.min(1,(y-scroll.getHeight()+edge)/edge);
        float distance=(float)(direction*edgeSpeed*dt)+remainder;int pixels=(int)distance;remainder=distance-pixels;
        if(pixels!=0)scroll.scrollBy(0,pixels);
        update(dt);if(active)Choreographer.getInstance().postFrameCallback(this);
    }
    private void update(double dt){
        if(!active || settling)return;
        int[] origin=new int[2];container.getLocationOnScreen(origin);
        float top=pointerY-grabOffset-origin[1];int destination=0;
        for(int i=0;i<copies.size();i++){if(i==from)continue;Row row=copies.get(i);float midpoint=row.bounds.exactCenterY()-(i>from?stride:0);if(top<midpoint)break;destination++;}
        target=Math.max(0,Math.min(copies.size()-1,destination));
        int[] host=new int[2];overlayHost.getLocationOnScreen(host);
        for(int i=0;i<copies.size();i++){
            Row row=copies.get(i);int[] position=new int[2];row.view.getLocationOnScreen(position);
            float displacement=i>from && i<=target?-stride:i<from && i>=target?stride:0;
            if(reduced){row.spring.position=displacement;row.spring.velocity=0;}else row.spring.advance(displacement,360,34,1,dt);
            row.preview.setTranslationX(position[0]-host[0]);row.preview.setTranslationY(i==from?pointerY-grabOffset-host[1]:position[1]-host[1]+(float)row.spring.position);
        }
    }
    private void drop(){
        if(!active || settling)return;settling=true;Choreographer.getInstance().removeFrameCallback(this);
        Row row=copies.get(from),destination=copies.get(target);
        float delta=target>from?destination.bounds.bottom-row.bounds.bottom:destination.bounds.top-row.bounds.top;
        int[] origin=new int[2],host=new int[2];row.view.getLocationOnScreen(origin);overlayHost.getLocationOnScreen(host);
        float end=origin[1]-host[1]+delta;
        if(reduced){finish(true,0);return;}
        int ticket=generation;drop=ValueAnimator.ofFloat(row.preview.getTranslationY(),end);drop.setDuration(180);
        drop.addUpdateListener(animation->{if(active)row.preview.setTranslationY((float)animation.getAnimatedValue());});
        drop.addListener(new AnimatorListenerAdapter(){@Override public void onAnimationEnd(Animator animation){if(active && generation==ticket)finish(true,0);}});drop.start();
    }
    private void clearCopies(){
        for(Row row:copies){if(overlayHost!=null)overlayHost.getOverlay().remove(row.preview);row.preview.setImageDrawable(null);row.bitmap.recycle();if(row.view.getAlpha()==0)row.view.setAlpha(row.alpha);}
        copies.clear();overlayHost=null;
    }
    private void finish(boolean commit,int detail){
        if(!active)return;active=false;settling=false;generation++;activeCount--;
        Choreographer.getInstance().removeFrameCallback(this);
        if(drop!=null){ValueAnimator previous=drop;drop=null;previous.cancel();}
        clearCopies();emit(commit?2:3,commit?target:detail);
    }
    @Override public void cancel(){clearPending();finish(false,0);}
    public void setEnabled(boolean value){enabled=value;if(!value)cancel();}
    public void setReducedMotion(boolean value){reduced=value;}
    @Override public void onViewDetachedFromWindow(View view){cancel();}
    @Override public void onViewAttachedToWindow(View view){}
    public void dispose(){if(disposed)return;cancel();disposed=true;input.dispose();input=null;scroll.removeOnAttachStateChangeListener(this);rows=handles=new View[0];}
}
