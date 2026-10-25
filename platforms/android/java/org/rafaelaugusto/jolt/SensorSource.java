package org.rafaelaugusto.jolt;

import android.app.Activity;
import android.app.Application;
import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.view.Choreographer;
import android.view.Surface;
import android.view.WindowManager;
import java.util.ArrayList;
import java.util.Arrays;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/** Shared hardware subscriptions, native display coalescing and native-only live-value delivery. */
public final class SensorSource {
    public interface Listener { void changed(); }
    private static final ArrayList<SensorSource> sources=new ArrayList<>();
    private static SensorManager manager;
    private static WindowManager window;
    private static Sensor rotationHardware, gravityHardware;
    private static boolean scheduled, background;
    private static int rotationRate, gravityRate;
    private static final Handler main=new Handler(Looper.getMainLooper());
    private static final SensorEventListener hardware=new SensorEventListener() {
        @Override public void onAccuracyChanged(Sensor sensor,int accuracy) {}
        @Override public void onSensorChanged(SensorEvent event) {
            if(background) return;
            boolean rotation=event.sensor.getType()==Sensor.TYPE_GAME_ROTATION_VECTOR;
            double[] values;
            if(rotation) {
                if(event.values.length<4)return;
                values=new double[]{event.values[0],event.values[1],event.values[2],event.values[3]};
            } else {
                if(event.values.length<3)return;
                // Android reports proper acceleration against gravity; canonical gravity points down.
                values=new double[]{-event.values[0],-event.values[1],-event.values[2]};
            }
            for(SensorSource source:new ArrayList<>(sources))
                if(source.enabled && source.trace==null && source.error==null && source.rotation==rotation)
                    source.receive(values,event.timestamp/1e6);
        }
    };
    private static final Choreographer.FrameCallback clock=new Choreographer.FrameCallback() {
        @Override public void doFrame(long nanos) {
            scheduled=false;
            for(SensorSource source:new ArrayList<>(sources)) if(source.enabled&&!background)source.frame(nanos/1e6);
            schedule();
        }
    };
    private static void initialize(Context context) {
        if(manager!=null)return;
        Context app=context.getApplicationContext();
        manager=(SensorManager)app.getSystemService(Context.SENSOR_SERVICE);
        window=(WindowManager)app.getSystemService(Context.WINDOW_SERVICE);
        rotationHardware=manager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
        gravityHardware=manager.getDefaultSensor(Sensor.TYPE_GRAVITY);
        if(app instanceof Application)((Application)app).registerActivityLifecycleCallbacks(new Application.ActivityLifecycleCallbacks() {
            @Override public void onActivityPaused(Activity activity) {
                background=true;
                for(SensorSource s:sources) s.holdReplay();
                refresh();
            }
            @Override public void onActivityResumed(Activity activity) {
                background=false;
                for(SensorSource s:sources) {s.rebase=true;s.receivedAt=SystemClock.uptimeMillis();s.replayStart=0;}
                refresh();
            }
            @Override public void onActivityCreated(Activity a,Bundle b){}
            @Override public void onActivityStarted(Activity a){}
            @Override public void onActivityStopped(Activity a){}
            @Override public void onActivitySaveInstanceState(Activity a,Bundle b){}
            @Override public void onActivityDestroyed(Activity a){}
        });
    }
    private static boolean ticking() {
        if(background)return false;
        for(SensorSource s:sources)if(s.enabled && !s.disposed && (s.trace!=null || (s.available && s.error==null)))return true;
        return false;
    }
    private static void schedule() {
        if(ticking()) {
            if(!scheduled){scheduled=true;Choreographer.getInstance().postFrameCallback(clock);}
        } else if(scheduled){Choreographer.getInstance().removeFrameCallback(clock);scheduled=false;}
    }
    private static void refresh() {
        if(manager==null)return;
        int rotation=0, gravity=0;
        if(!background)for(SensorSource s:sources)if(s.enabled && s.trace==null && s.available && s.error==null) {
            Sensor hardware=s.rotation?rotationHardware:gravityHardware;
            int rate=Math.max(5000,Math.max(hardware.getMinDelay(),(int)(s.interval*1000)));
            if(s.rotation)rotation=rotation==0?rate:Math.min(rotation,rate);
            else gravity=gravity==0?rate:Math.min(gravity,rate);
        }
        rotationRate=register(rotationHardware,rotationRate,rotation,true);
        gravityRate=register(gravityHardware,gravityRate,gravity,false);
        schedule();
    }
    private static int register(Sensor sensor,int previous,int next,boolean rotation) {
        if(previous==next)return previous;
        // A fusion implementation may reset its game-reference frame on re-registration.
        if(rotation)for(SensorSource s:sources)if(s.rotation&&s.enabled&&s.trace==null)s.rebase=true;
        if(previous>0)manager.unregisterListener(hardware,sensor);
        if(next==0)return 0;
        String error=null;
        try { if(!manager.registerListener(hardware,sensor,next,0,main))error="registration-failed"; }
        catch(SecurityException denied){error="access-denied";}
        catch(RuntimeException failure){error="sensor-start-failed";}
        if(error==null)return next;
        for(SensorSource s:new ArrayList<>(sources))if(s.rotation==rotation&&s.enabled&&s.trace==null){s.error=error;s.state("error");}
        return 0;
    }
    public static int activeCount(){return (rotationRate>0?1:0)+(gravityRate>0?1:0);}
    public static int sourceCount(){return sources.size();}
    private final boolean rotation, interfaceCoordinates, available;
    private final double interval;
    private final LiveSpring[] nodes;
    private Listener listener;
    private boolean enabled,disposed,dirty,rebase=true,reset;
    private String status,error;
    private double timestamp=-1,pendingTimestamp,receivedAt,committedAt,processingMs;
    private long samples,frames,callbacks;
    private double[] reference={0,0,0,1},relative={0,0,0,1},output,pending;
    private JSONArray trace;
    private int replayIndex;
    private double replayStart,replayElapsed,replayOrientation;
    public SensorSource(Context context,String kind,String options,Listener listener) {
        initialize(context);
        rotation=kind.equals("rotation");this.listener=listener;
        try {
            JSONObject config=new JSONObject(options);
            interfaceCoordinates=config.optString("coordinates").equals("interface");
            double requested=config.optDouble("interval",0);
            if(requested==0)requested=1000/Math.max(60,window.getDefaultDisplay().getRefreshRate());
            interval=Math.max(5,Math.min(1000,requested));
        } catch(JSONException e){throw new IllegalArgumentException(e);}
        available=(rotation?rotationHardware:gravityHardware)!=null;
        output=new double[rotation?7:3];if(rotation)output[6]=1;
        nodes=new LiveSpring[output.length];status=available?"idle":"unavailable";
        sources.add(this);
    }
    public void connect(LiveSpring node,int index){if(index>=0&&index<nodes.length)nodes[index]=node;}
    private void state(String next){if(status.equals(next))return;status=next;if(listener!=null){callbacks++;listener.changed();}}
    private void holdReplay(){if(trace!=null&&replayStart>0){replayElapsed=Math.max(0,SystemClock.uptimeMillis()-replayStart);replayStart=0;}}
    public void setEnabled(boolean active,boolean paused) {
        if(disposed)return;
        boolean changed=enabled!=active;enabled=active;
        if(changed){dirty=false;committedAt=0;rebase=true;if(active){receivedAt=SystemClock.uptimeMillis();error=null;replayStart=0;}else holdReplay();}
        if(!active)state(paused?"paused":(available?"idle":"unavailable"));
        else if(changed)state(trace!=null?"replaying":(available?"starting":"unavailable"));
        refresh();
    }
    public void recenter(){if(!disposed&&rotation){reset=true;rebase=true;}}
    public void replay(String input) {
        if(disposed)return;
        try {JSONArray next=new JSONArray(input);if(next.length()<2)return;trace=next;}catch(JSONException e){throw new IllegalArgumentException(e);}
        replayIndex=0;replayStart=0;replayElapsed=0;error=null;reset=true;rebase=true;dirty=false;committedAt=0;
        if(enabled)state("replaying");refresh();
    }
    private void receive(double[] values,double time) {
        if(!Double.isFinite(time)||time<0)return;
        if(trace==null&&timestamp>=0&&time<=pendingTimestamp)return;
        for(double v:values)if(!Double.isFinite(v))return;
        double[] copy=values.clone();if(rotation&&!SensorMath.normalize(copy))return;
        pending=copy;pendingTimestamp=time;samples++;dirty=true;receivedAt=SystemClock.uptimeMillis();
    }
    private double orientation() {
        if(!interfaceCoordinates)return 0;
        if(trace!=null)return replayOrientation;
        switch(window.getDefaultDisplay().getRotation()){
            case Surface.ROTATION_90:return 90;case Surface.ROTATION_180:return 180;case Surface.ROTATION_270:return 270;default:return 0;
        }
    }
    private void frame(double now) {
        if(disposed||error!=null)return;
        if(trace!=null) {
            if(replayStart==0)replayStart=now-replayElapsed;
            double elapsed=now-replayStart;
            try {
                while(replayIndex<trace.length()&&trace.getJSONObject(replayIndex).getDouble("time")<=elapsed){
                    JSONObject sample=trace.getJSONObject(replayIndex++);JSONArray values=sample.getJSONArray("values");
                    if(values.length()!=(rotation?4:3))continue;
                    double[] input=new double[values.length()];for(int i=0;i<input.length;i++)input[i]=values.getDouble(i);
                    replayOrientation=sample.optDouble("orientation",0);receive(input,sample.getDouble("time"));
                }
            }catch(JSONException e){error="invalid-test-input";trace=null;state("error");refresh();return;}
        } else if(available&&now-receivedAt>Math.max(3000,interval*3)){error="no-data";state("error");refresh();return;}
        if(dirty&&(committedAt==0||now-committedAt>=interval-.5)) {
            long start=System.nanoTime();
            if(rotation) {
                if(rebase){if(reset)relative=new double[]{0,0,0,1};reference=SensorMath.multiply(pending,SensorMath.inverse(relative));rebase=false;reset=false;}
                relative=SensorMath.multiply(SensorMath.inverse(reference),pending);
                output=SensorMath.rotation(relative,orientation(),Arrays.copyOfRange(output,3,7));
            } else output=SensorMath.vector(pending,orientation());
            for(int i=0;i<nodes.length;i++)if(nodes[i]!=null)nodes[i].setSensorInput(output[i]);
            dirty=false;timestamp=pendingTimestamp;frames++;committedAt=now;processingMs+=(System.nanoTime()-start)/1e6;
            if(trace==null)state("active");
        }
        if(trace!=null&&replayIndex>=trace.length()&&!dirty){trace=null;replayStart=0;replayElapsed=0;rebase=true;receivedAt=now;state(available?"starting":"unavailable");refresh();}
    }
    public String snapshot() {
        try {
            JSONObject result=new JSONObject();result.put("status",status);result.put("available",available);result.put("error",error==null?JSONObject.NULL:error);
            result.put("timestamp",timestamp<0?JSONObject.NULL:timestamp);result.put("samples",samples);result.put("frames",frames);result.put("callbacks",callbacks);
            result.put("processingMs",processingMs);result.put("interval",interval);JSONArray values=new JSONArray();for(double v:output)values.put(v);result.put("values",values);return result.toString();
        }catch(JSONException e){throw new IllegalStateException(e);}
    }
    public void dispose(){if(disposed)return;disposed=true;enabled=false;status="disposed";listener=null;trace=null;Arrays.fill(nodes,null);sources.remove(this);refresh();}
}
