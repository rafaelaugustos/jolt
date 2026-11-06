package org.rafaelaugusto.jolt.fixture;
import android.app.Activity;
import android.animation.ValueAnimator;
import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.os.SystemClock;
import android.view.*;

/** Demo-only injected OS-format mouse events, explicitly labelled in the UI/video. */
public final class PointerReplay {
    public static void play(Activity activity, View target) {
        final long start = SystemClock.uptimeMillis();
        final ValueAnimator animator = ValueAnimator.ofFloat(0,1);
        animator.setDuration(2600);
        animator.addUpdateListener(value -> {
            float t = (float)value.getAnimatedValue();
            int[] origin = new int[2], decor = new int[2];
            target.getLocationOnScreen(origin); activity.getWindow().getDecorView().getLocationOnScreen(decor);
            send(activity,start,MotionEvent.ACTION_HOVER_MOVE,origin[0]-decor[0]+target.getWidth()*(.05f+.9f*t),origin[1]-decor[1]+target.getHeight()*(.5f+.3f*(float)Math.sin(t*Math.PI*2)));
        });
        animator.addListener(new AnimatorListenerAdapter() {
            @Override public void onAnimationEnd(Animator animation) { send(activity,start,MotionEvent.ACTION_HOVER_EXIT,0,0); animator.removeAllUpdateListeners(); animator.removeAllListeners(); }
        });
        animator.start();
    }
    private static void send(Activity activity,long start,int action,float x,float y) {
        MotionEvent.PointerProperties pointer = new MotionEvent.PointerProperties(); pointer.id=0; pointer.toolType=MotionEvent.TOOL_TYPE_MOUSE;
        MotionEvent.PointerCoords coordinates = new MotionEvent.PointerCoords(); coordinates.x=x; coordinates.y=y;
        MotionEvent event = MotionEvent.obtain(start,SystemClock.uptimeMillis(),action,1,new MotionEvent.PointerProperties[]{pointer},new MotionEvent.PointerCoords[]{coordinates},0,0,1,1,0,0,InputDevice.SOURCE_MOUSE,0);
        try { activity.getWindow().getCallback().dispatchGenericMotionEvent(event); } finally { event.recycle(); }
    }
}
