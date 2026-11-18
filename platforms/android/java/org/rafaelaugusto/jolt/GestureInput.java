package org.rafaelaugusto.jolt;

import android.view.MotionEvent;
import android.view.View;

/** Arbitration around an existing NativeScript listener. Decisions and buffered input stay native. */
public final class GestureInput implements View.OnTouchListener {
    private final View view;
    private final View.OnTouchListener previous;
    private final String kind, axis;
    private final GesturePeer peer;
    private final float threshold;
    private MotionEvent latest;
    private float x,y;
    private boolean admitted, rejected, disposed;
    public GestureInput(View view, View.OnTouchListener previous, String kind, String axis) {
        this.view=view;this.previous=previous;this.kind=kind;this.axis=axis;
        threshold=8*view.getResources().getDisplayMetrics().density;
        peer=new GesturePeer(()->cancelInput());view.setOnTouchListener(this);
    }
    public GesturePeer recognizer(){return peer;}
    private boolean forward(MotionEvent event){return previous!=null && previous.onTouch(view,event);}
    private void cancelInput(){
        if(rejected)return;rejected=true;admitted=false;
        if(latest!=null){MotionEvent event=MotionEvent.obtain(latest);event.setAction(MotionEvent.ACTION_CANCEL);forward(event);view.onTouchEvent(event);event.recycle();}
    }
    @Override public boolean onTouch(View target,MotionEvent event){
        if(disposed)return forward(event);
        if(latest!=null)latest.recycle();latest=MotionEvent.obtain(event);
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN){
            admitted=rejected=false;x=event.getX();y=event.getY();peer.begin(event.getDownTime());
            return forward(event);
        }
        if(rejected)return true;
        if(!peer.isCoordinated())return forward(event);
        if(action==MotionEvent.ACTION_CANCEL){peer.fail();cancelInput();return true;}
        if(action==MotionEvent.ACTION_MOVE && !admitted && kind.equals("pan")){
            float dx=event.getX()-x,dy=event.getY()-y;
            if(!axis.equals("both") && Math.abs(axis.equals("x")?dy:dx)>threshold*1.5f && Math.abs(axis.equals("x")?dx:dy)<threshold){peer.fail();cancelInput();return true;}
            if(Math.hypot(axis.equals("y")?0:dx,axis.equals("x")?0:dy)>=threshold){
                peer.request(()->{if(!disposed && !rejected){admitted=true;forward(latest);}});
            }
            return true;
        }
        if(action==MotionEvent.ACTION_UP){
            if(kind.equals("tap")){
                peer.request(()->{forward(latest);peer.finish();});
                return rejected;
            }
            if(admitted){boolean result=forward(event);peer.finish();return result;}
            peer.fail();cancelInput();return true;
        }
        return kind.equals("tap") || admitted ? forward(event) : true;
    }
    public void dispose(){
        if(disposed)return;peer.dispose();disposed=true;view.setOnTouchListener(previous);
        if(latest!=null){latest.recycle();latest=null;}
    }
}
