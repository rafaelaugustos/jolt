package org.rafaelaugusto.jolt.tests;

import android.app.Instrumentation;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Rect;
import android.os.Build;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.MotionEvent;
import android.view.accessibility.AccessibilityNodeInfo;
import java.util.ArrayList;

/** Real input injection against ImageLab, independent of the library's implementation. */
public final class ImageInteractionTest extends Instrumentation {
    private final ArrayList<String> checks=new ArrayList<>();
    private android.app.Activity activity;
    private String stage="launch";
    @Override public void onCreate(Bundle arguments){super.onCreate(arguments);start();}
    @Override public void onStart(){
        Bundle result=new Bundle();
        try {
            Intent launch=getTargetContext().getPackageManager().getLaunchIntentForPackage(getTargetContext().getPackageName());
            launch.putExtra("image-lab","zoom");launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TASK);
            ActivityMonitor monitor=addMonitor("com.tns.NativeScriptActivity",null,false);
            getTargetContext().startActivity(launch);
            activity=waitForMonitorWithTimeout(monitor,15000);removeMonitor(monitor);
            require(activity!=null,"Target activity did not start");
            for(int i=0;i<60 && !text().contains("Zoom in");i++)sleep(250);
            clearInput();
            stage="programmatic zoom";click("Zoom in");sleep(800);require(text().contains("Zoom 2.00"),text());pass();
            stage="reset";click("Reset zoom");sleep(800);require(text().contains("Zoom 1.00"),text());pass();
            Rect photo=photoBounds();float cx=photo.exactCenterX(),cy=photo.exactCenterY();
            stage="pinch";pinch(cx+photo.width()*.04f,cy,photo.width()*.24f,photo.width()*.44f);sleep(800);
            String zoom=text();java.util.regex.Matcher match=java.util.regex.Pattern.compile("Zoom ([0-9.]+)").matcher(zoom);
            require(match.find() && Double.parseDouble(match.group(1))>1.4,zoom);pass();
            stage="pan while zoomed";drag(cx,cy,cx+photo.width()*.25f,cy+photo.height()*.1f,500);sleep(800);
            require(text().contains("Zoom ")&&!text().contains("Dismissal pending"),text());pass();
            stage="double tap toggles to minimum";tap(cx,cy);sleep(80);tap(cx,cy);sleep(800);
            require(text().contains("Zoom 1.00"),text());pass();
            stage="small dismiss cancels";drag(cx,cy,cx,cy+photo.height()*.08f,700);sleep(800);
            require(!text().contains("Dismissal pending")&&text().contains("Zoom 1.00"),text());pass();
            stage="cancelled gesture restores viewer";drag(cx,cy,cx,cy+photo.height()*.3f,600,true);sleep(800);
            require(!text().contains("Dismissal pending")&&text().contains("Zoom 1.00"),text());pass();
            stage="vertical dismiss and cancel";drag(cx,cy,cx,cy+photo.height()*.26f,600);sleep(200);
            require(text().contains("Dismissal pending"),text());click("Cancel close");sleep(800);
            require(text().contains("Zoom 1.00"),text());pass();
            stage="horizontal movement at minimum";drag(cx,cy,cx+photo.width()*.3f,cy,500);sleep(700);
            require(!text().contains("Dismissal pending"),text());pass();
            stage="dismiss completes and reopens";click("Close photo");sleep(800);require(text().contains("Dismissal pending"),text());
            click("Accept close");sleep(200);require(text().contains("Reopen photo"),text());click("Reopen photo");sleep(400);
            click("Zoom in");sleep(800);require(text().contains("Zoom 2.00"),text());pass();
            stage="repeated disposal";
            for(int i=0;i<8;i++){click("Reattach");sleep(80);}
            click("Zoom in");sleep(800);require(text().contains("Zoom 2.00"),text());pass();
            stage="viewer route and system back";click("Open viewer route");sleep(700);
            click("Route zoom in");sleep(800);require(text().contains("Route zoom 2.50"),text());
            getUiAutomation().performGlobalAction(android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK);sleep(800);
            require(text().contains("Close this route?"),text());click("Keep viewing");sleep(800);
            require(text().contains("Route zoom 1.00"),text());pass();
            stage="route accepts close after zoom reset";click("Route zoom in");sleep(800);click("Route close");sleep(800);
            require(text().contains("Close this route?"),text());click("Leave viewer");sleep(700);
            require(text().contains("Open viewer route"),text());pass();
            click("Effects");sleep(300);
            stage="dissolve backend";click("Dissolve");sleep(2800);
            require(text().contains(Build.VERSION.SDK_INT>=33?"agsl · finished":"fallback · finished"),text());pass();
            stage="reduced motion content update";click("Restore");click("Motion on");click("Dissolve");sleep(300);
            require(text().contains("fallback · finished"),text());pass();
            click("Motion off");
            if(Build.VERSION.SDK_INT>=33){
                photo=photoBounds();cx=photo.exactCenterX();cy=photo.exactCenterY();
                for(String stretch:new String[]{"aspectFit","aspectFill","fill","none"}) {
                    stage="identity pixels "+stretch;click("Restore");sleep(200);
                    Bitmap before=getUiAutomation().takeScreenshot();click("Prepare ripple");sleep(200);
                    awaitText("ripple · agsl · 0%");Bitmap after=getUiAutomation().takeScreenshot();
                    require(similarPhoto(before,after,photo),"image changed at progress zero");after.recycle();
                    click("Restore");sleep(200);after=getUiAutomation().takeScreenshot();
                    require(similarPhoto(before,after,photo),"stop did not restore original image");before.recycle();after.recycle();pass();
                    stage="rounded image pixels "+stretch;click("Restore");click("Corners off");sleep(200);
                    before=getUiAutomation().takeScreenshot();click("Prepare ripple");awaitText("ripple · agsl · 0%");after=getUiAutomation().takeScreenshot();
                    require(similarPhoto(before,after,photo),"border, corners or padding changed at progress zero");before.recycle();after.recycle();pass();
                    click("Restore");click("Corners on");click("Stretch: "+stretch);
                }
                stage="source replacement during effect";click("Restore");click("Swap source");sleep(300);
                Bitmap destination=getUiAutomation().takeScreenshot();click("Swap source");click("Prepare ripple");awaitText("ripple · agsl · 0%");
                click("Swap source");awaitText("ripple · agsl · stopped");Bitmap replacement=getUiAutomation().takeScreenshot();
                require(similarPhoto(destination,replacement,photo),"source replacement was overwritten during disposal");destination.recycle();replacement.recycle();click("Restore");pass();
                stage="paused dissolve";click("Dissolve");sleep(150);click("Scrub 50%");sleep(100);
                require(text().contains("50%"),text());Bitmap first=getUiAutomation().takeScreenshot();sleep(500);
                Bitmap second=getUiAutomation().takeScreenshot();require(samePhoto(first,second,photo),"paused pixels changed");first.recycle();second.recycle();pass();
                stage="reverse from pause";click("Reverse");sleep(1600);require(text().contains("agsl · finished"),text());pass();
                stage="native distortion";click("Drag warp");sleep(200);drag(cx,cy,cx+photo.width()*.2f,cy,600);sleep(800);
                require(text().contains("distortion · agsl"),text());click("Restore");pass();
            }
            result.putString("stream","\nPASS "+checks.size()+" native image checks: "+checks+"\n");finish(-1,result);
        } catch(Throwable error){clearInput();result.putString("stream","\nFAIL "+stage+": "+error+"\nPassed: "+checks+"\n");finish(0,result);}
    }
    private void pass(){checks.add(stage);Bundle b=new Bundle();b.putString("stream","PASS "+stage+"\n");sendStatus(0,b);}
    private static void sleep(long ms){SystemClock.sleep(ms);}
    private static void require(boolean condition,String message){if(!condition)throw new AssertionError(message);}
    private void clearInput(){
        long now=SystemClock.uptimeMillis();MotionEvent cancel=MotionEvent.obtain(now,now,MotionEvent.ACTION_CANCEL,0,0,0);
        cancel.setSource(InputDevice.SOURCE_TOUCHSCREEN);getUiAutomation().injectInputEvent(cancel,true);cancel.recycle();
    }
    private void awaitText(String expected){
        for(int i=0;i<40;i++){if(text().contains(expected)){sleep(250);return;}sleep(100);}
        throw new AssertionError("Timed out waiting for "+expected+": "+text());
    }
    private AccessibilityNodeInfo find(AccessibilityNodeInfo node,String wanted){
        if(node==null)return null;
        if(wanted.contentEquals(node.getText()==null?"":node.getText()) || wanted.contentEquals(node.getContentDescription()==null?"":node.getContentDescription()))return node;
        for(int i=0;i<node.getChildCount();i++){AccessibilityNodeInfo found=find(node.getChild(i),wanted);if(found!=null)return found;}
        return null;
    }
    private void click(String label){
        AccessibilityNodeInfo node=find(getUiAutomation().getRootInActiveWindow(),label);require(node!=null,"Missing control "+label+": "+text());
        Rect b=new Rect();node.getBoundsInScreen(b);tap(b.exactCenterX(),b.exactCenterY());sleep(100);
    }
    private Rect photoBounds(){
        AccessibilityNodeInfo node=find(getUiAutomation().getRootInActiveWindow(),"Color grid, pinch to zoom or use the zoom controls");
        require(node!=null,"Photo accessibility node missing");Rect b=new Rect();node.getBoundsInScreen(b);return b;
    }
    private String text(){StringBuilder s=new StringBuilder();collect(getUiAutomation().getRootInActiveWindow(),s);return s.toString();}
    private void collect(AccessibilityNodeInfo node,StringBuilder s){if(node==null)return;if(node.getText()!=null)s.append(node.getText()).append('\n');for(int i=0;i<node.getChildCount();i++)collect(node.getChild(i),s);}
    private void event(long down,int action,float[] xs,float[] ys){
        int count=xs.length;MotionEvent.PointerProperties[] props=new MotionEvent.PointerProperties[count];MotionEvent.PointerCoords[] coords=new MotionEvent.PointerCoords[count];
        for(int i=0;i<count;i++){props[i]=new MotionEvent.PointerProperties();props[i].id=i;props[i].toolType=MotionEvent.TOOL_TYPE_FINGER;
            coords[i]=new MotionEvent.PointerCoords();coords[i].x=xs[i];coords[i].y=ys[i];coords[i].pressure=1;coords[i].size=.1f;}
        MotionEvent e=MotionEvent.obtain(down,SystemClock.uptimeMillis(),action,count,props,coords,0,0,1,1,0,0,InputDevice.SOURCE_TOUCHSCREEN,0);
        require(getUiAutomation().injectInputEvent(e,true),"input injection rejected");e.recycle();
    }
    private void tap(float x,float y){long d=SystemClock.uptimeMillis();event(d,MotionEvent.ACTION_DOWN,new float[]{x},new float[]{y});sleep(30);event(d,MotionEvent.ACTION_UP,new float[]{x},new float[]{y});}
    private void drag(float x,float y,float endX,float endY,long duration){
        drag(x,y,endX,endY,duration,false);
    }
    private void drag(float x,float y,float endX,float endY,long duration,boolean cancel){
        long d=SystemClock.uptimeMillis();event(d,0,new float[]{x},new float[]{y});
        for(int i=1;i<=30;i++){sleep(duration/30);event(d,2,new float[]{x+(endX-x)*i/30},new float[]{y+(endY-y)*i/30});}
        event(d,cancel?MotionEvent.ACTION_CANCEL:MotionEvent.ACTION_UP,new float[]{endX},new float[]{endY});
    }
    private void pinch(float x,float y,float from,float to){
        long d=SystemClock.uptimeMillis();event(d,0,new float[]{x-from},new float[]{y});sleep(30);
        event(d,MotionEvent.ACTION_POINTER_DOWN|(1<<8),new float[]{x-from,x+from},new float[]{y,y});
        for(int i=1;i<=30;i++){sleep(20);float span=from+(to-from)*i/30;event(d,2,new float[]{x-span,x+span},new float[]{y,y});}
        float[] before=pose();
        event(d,MotionEvent.ACTION_POINTER_UP|(1<<8),new float[]{x-to,x+to},new float[]{y,y});
        float[] after=pose();
        require(Math.abs(before[0]-after[0])<1 && Math.abs(before[1]-after[1])<1 && Math.abs(before[2]-after[2])<.001f,"lifting the second finger moved the image");
        event(d,2,new float[]{x-to+30},new float[]{y});sleep(30);
        // Allow a frame to dispatch Android's batched input.
        event(d,2,new float[]{x-to+30},new float[]{y});sleep(60);after=pose();
        event(d,1,new float[]{x-to+30},new float[]{y});
        // Android may retain a predicted position up to half a sample ahead
        // (observed +45px for an injected +30px move). The pointer-up assertion
        // above is strict; this one checks that pan continues without rebasing
        // to the old pre-pinch pointer location.
        float delta=after[0]-before[0];
        require(delta>=15 && delta<=45.1f && Math.abs(after[1]-before[1])<1,"one-finger pan lost its pinch position: "+java.util.Arrays.toString(before)+" -> "+java.util.Arrays.toString(after));
    }
    private float[] pose(){
        float[] result=new float[3];runOnMainSync(()->{
            android.view.View image=imageView(activity.getWindow().getDecorView());require(image!=null,"Native photo view missing");
            result[0]=image.getTranslationX();result[1]=image.getTranslationY();result[2]=image.getScaleX();
        });return result;
    }
    private android.view.View imageView(android.view.View view){
        if("Color grid, pinch to zoom or use the zoom controls".contentEquals(view.getContentDescription()==null?"":view.getContentDescription()))return view;
        if(view instanceof android.view.ViewGroup){android.view.ViewGroup group=(android.view.ViewGroup)view;for(int i=0;i<group.getChildCount();i++){android.view.View found=imageView(group.getChildAt(i));if(found!=null)return found;}}
        return null;
    }
    private boolean samePhoto(Bitmap a,Bitmap b,Rect r){for(int y=r.top+2;y<r.bottom-2;y+=7)for(int x=r.left+2;x<r.right-2;x+=7)if(a.getPixel(x,y)!=b.getPixel(x,y))return false;return true;}
    private boolean similarPhoto(Bitmap a,Bitmap b,Rect r){
        int different=0,total=0;long totalDelta=0;
        for(int y=r.top+2;y<r.bottom-2;y+=3)for(int x=r.left+2;x<r.right-2;x+=3){
            int first=a.getPixel(x,y),second=b.getPixel(x,y);total++;
            int delta=Math.max(Math.abs(((first>>16)&255)-((second>>16)&255)),Math.max(Math.abs(((first>>8)&255)-((second>>8)&255)),Math.abs((first&255)-(second&255))));
            totalDelta+=delta;if(delta>16)different++;
        }
        if(different>=total*.005 || totalDelta>total*1.5){
            try {
                java.io.File dir=getTargetContext().getExternalFilesDir(null);
                try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(dir,"before.png"))){a.compress(Bitmap.CompressFormat.PNG,100,out);}
                try(java.io.FileOutputStream out=new java.io.FileOutputStream(new java.io.File(dir,"after.png"))){b.compress(Bitmap.CompressFormat.PNG,100,out);}
                Bundle bnd=new Bundle();bnd.putString("stream","Pixel mismatch "+different+"/"+total+"; screenshots: "+dir+"\n");sendStatus(0,bnd);
            }catch(java.io.IOException ignored){}
            return false;
        }
        return true;
    }
}
