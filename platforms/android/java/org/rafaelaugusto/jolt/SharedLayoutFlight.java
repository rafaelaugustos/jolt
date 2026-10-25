package org.rafaelaugusto.jolt;

import android.graphics.*;
import android.graphics.drawable.BitmapDrawable;
import android.widget.ImageView;
import android.view.*;
import android.webkit.WebView;
import org.json.*;
import java.util.*;

/** Window-relative snapshots; frame evaluation and drawing never call JavaScript. */
public final class SharedLayoutFlight extends View implements Choreographer.FrameCallback {
    public interface Listener { void onEnd(boolean completed); }
    private final ViewGroup root;
    private final float density;
    private final Map<View,Integer> hidden = new WeakHashMap<>();
    private static final PorterDuffXfermode ADD = new PorterDuffXfermode(PorterDuff.Mode.ADD);
    private final Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private Bitmap source, target, pageBitmap;
    private RectF pageFrame;
    private boolean fading, clippedImage;
    private float sourceWidth, sourceHeight, targetWidth, targetHeight;
    private boolean sourceImage, targetImage, disposed, running, navigationImage, borrowedTarget;
    private double[] interactiveStart, interactiveEnd;
    private View destination;
    private final double[] pose = new double[14], velocity = new double[14];
    private double[][] times, values;
    private double duration, started;
    private RectF destinationFrame;
    private int rootWidth, rootHeight;
    private Listener listener;
    private static int active;

    private SharedLayoutFlight(View view) {
        super(view.getContext()); root = (ViewGroup)view.getRootView();
        density = view.getResources().getDisplayMetrics().density;
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
        setWillNotDraw(false); rootWidth = root.getWidth(); rootHeight = root.getHeight();
        layout(0,0,rootWidth,rootHeight);
    }
    public static int activeCount() { return active; }
    private static boolean unsupported(View view) {
        return unsupported(view, false);
    }
    private static boolean unsupported(View view, boolean allowScrolling) {
        if (view instanceof SurfaceView || view instanceof TextureView || view instanceof WebView || (!allowScrolling && (view instanceof android.widget.AbsListView || view instanceof android.widget.ScrollView))) return true;
        if (view instanceof ViewGroup) {
            ViewGroup group = (ViewGroup)view;
            for (int i=0;i<group.getChildCount();i++) if (unsupported(group.getChildAt(i), allowScrolling)) return true;
        }
        return false;
    }
    private RectF geometry(View view) {
        if (view == null || !view.isAttachedToWindow() || view.getRootView()!=root || view.getWidth()<=0 || view.getHeight()<=0) return null;
        float sx=1,sy=1;
        for (View p=view;p!=null;p=p.getParent() instanceof View ? (View)p.getParent() : null) {
            if (p!=view && p.getVisibility()!=VISIBLE) return null;
            if (Math.abs(p.getRotation())>.01 || Math.abs(p.getRotationX())>.01 || Math.abs(p.getRotationY())>.01 || p.getScaleX()<=0 || p.getScaleY()<=0 || Math.abs(p.getAlpha()-1)>.001 || Math.abs(p.getScaleX()-p.getScaleY())>.0001) return null;
            sx*=p.getScaleX(); sy*=p.getScaleY();
        }
        int[] origin=new int[2], local=new int[2]; root.getLocationOnScreen(origin); view.getLocationOnScreen(local);
        return new RectF(local[0]-origin[0],local[1]-origin[1],local[0]-origin[0]+view.getWidth()*sx,local[1]-origin[1]+view.getHeight()*sy);
    }
    private boolean visibleBounds(View view, RectF frame) {
        if (frame==null || frame.left<-.5 || frame.top<-.5 || frame.right>rootWidth+.5 || frame.bottom>rootHeight+.5) return false;
        for (ViewParent p=view.getParent();p instanceof View;p=p.getParent()) {
            if (p instanceof ViewGroup && ((ViewGroup)p).getClipChildren()) {
                RectF clip=geometry((View)p);
                if (clip==null || frame.left<clip.left-.5 || frame.top<clip.top-.5 || frame.right>clip.right+.5 || frame.bottom>clip.bottom+.5) return false;
            }
        }
        return true;
    }
    private RectF visibleClip(View view, RectF frame) {
        if(frame==null)return null;
        RectF clip=new RectF(frame);if(!clip.intersect(0,0,rootWidth,rootHeight))return null;
        for(ViewParent p=view.getParent();p instanceof View;p=p.getParent())if(p instanceof ViewGroup && ((ViewGroup)p).getClipChildren()) {
            RectF parent=geometry((View)p);if(parent==null || !clip.intersect(parent))return null;
        }
        return clip;
    }
    private Bitmap snapshot(View view, long budget) {
        long pixels=(long)view.getWidth()*view.getHeight();
        if (pixels<=0 || pixels>budget || unsupported(view)) return null;
        Bitmap bitmap;
        try { bitmap=Bitmap.createBitmap(view.getWidth(),view.getHeight(),Bitmap.Config.ARGB_8888); }
        catch (OutOfMemoryError error) { return null; }
        int visibility=view.getVisibility();
        try { view.setVisibility(VISIBLE); view.draw(new Canvas(bitmap)); }
        catch (RuntimeException | OutOfMemoryError error) { bitmap.recycle(); return null; }
        finally { view.setVisibility(visibility); }
        return bitmap;
    }
    private void hide(View view) {
        if (!hidden.containsKey(view)) hidden.put(view,view.getVisibility());
        view.setVisibility(INVISIBLE);
    }
    public static SharedLayoutFlight capture(View view, boolean image, double radius, double maxPixels) {
        if (!(view.getRootView() instanceof ViewGroup)) return null;
        SharedLayoutFlight f=new SharedLayoutFlight(view);
        RectF rect=f.geometry(view);
        if (!f.visibleBounds(view,rect) || view.getVisibility()!=VISIBLE) return null;
        Bitmap bitmap=f.snapshot(view,(long)maxPixels); if (bitmap==null) return null;
        f.source=bitmap; f.sourceWidth=rect.width(); f.sourceHeight=rect.height(); f.sourceImage=image;
        f.pose[0]=rect.left/f.density; f.pose[1]=rect.top/f.density; f.pose[2]=rect.width()/f.density; f.pose[3]=rect.height()/f.density; f.pose[4]=radius*rect.width()/view.getWidth();
        f.hide(view); f.root.getOverlay().add(f); active++; return f;
    }

    private double[] navigationGeometry(View view, double radius) {
        if(!(view instanceof ImageView)) return null;
        ImageView image=(ImageView)view;
        if(!(image.getDrawable() instanceof BitmapDrawable) || image.getColorFilter()!=null || image.getPaddingLeft()!=0 || image.getPaddingTop()!=0 || image.getPaddingRight()!=0 || image.getPaddingBottom()!=0) return null;
        if(image.getScaleType()!=ImageView.ScaleType.FIT_CENTER && image.getScaleType()!=ImageView.ScaleType.CENTER_CROP) return null;
        Bitmap bitmap=((BitmapDrawable)image.getDrawable()).getBitmap(); if(bitmap==null || bitmap.isRecycled())return null;
        RectF rect=geometry(view), clip=clippedImage?visibleClip(view,rect):rect;
        if(clippedImage?clip==null:!visibleBounds(view,rect))return null;
        double scale=image.getScaleType()==ImageView.ScaleType.CENTER_CROP?Math.max(rect.width()/bitmap.getWidth(),rect.height()/bitmap.getHeight()):Math.min(rect.width()/bitmap.getWidth(),rect.height()/bitmap.getHeight());
        double w=bitmap.getWidth()*scale,h=bitmap.getHeight()*scale;
        double[] pose=new double[]{rect.left/density,rect.top/density,rect.width()/density,rect.height()/density,radius*rect.width()/view.getWidth(),(rect.width()-w)/2/density,(rect.height()-h)/2/density,w/density,h/density};
        if(!clippedImage)return pose;
        double[] clipped=Arrays.copyOf(pose,13);clipped[9]=clip.left/density;clipped[10]=clip.top/density;clipped[11]=clip.width()/density;clipped[12]=clip.height()/density;return clipped;
    }
    public static SharedLayoutFlight captureNavigationImage(View view, double radius, double maxPixels) {
        return captureNavigationImage(view,radius,maxPixels,false);
    }
    public static SharedLayoutFlight captureClippedNavigationImage(View view, double radius, double maxPixels) {
        return captureNavigationImage(view,radius,maxPixels,true);
    }
    private static SharedLayoutFlight captureNavigationImage(View view, double radius, double maxPixels, boolean clipped) {
        if(!(view.getRootView() instanceof ViewGroup) || view.getVisibility()!=VISIBLE)return null;
        SharedLayoutFlight f=new SharedLayoutFlight(view);
        f.clippedImage=clipped;
        double[] pose=f.navigationGeometry(view,radius); if(pose==null)return null;
        Bitmap image=((BitmapDrawable)((ImageView)view).getDrawable()).getBitmap();
        if((long)image.getWidth()*image.getHeight()>maxPixels)return null;
        f.navigationImage=true; f.source=image;
        for(int i=0;i<pose.length;i++)f.pose[i<5?i:i+1]=pose[i];
        f.hide(view); f.root.getOverlay().add(f); active++; return f;
    }
    public String prepareNavigationImage(View view, double radius, double maxPixels) {
        if(disposed || !navigationImage || view.getVisibility()!=VISIBLE)return null;
        double[] geometry=navigationGeometry(view,radius); if(geometry==null)return null;
        Bitmap image=((BitmapDrawable)((ImageView)view).getDrawable()).getBitmap();
        if((long)image.getWidth()*image.getHeight()+pixels()>maxPixels || Math.abs((double)image.getWidth()/image.getHeight()-(double)source.getWidth()/source.getHeight())>.001)return null;
        target=image; destination=view; destinationFrame=geometry(view); hide(view);
        try { return new JSONArray(geometry).toString(); } catch(JSONException error) { throw new IllegalStateException(error); }
    }

    public boolean holdPage(View page,double maxPixels) {
        if(disposed || pageBitmap!=null || page==null || unsupported(page, true))return false;
        RectF frame=geometry(page);if(frame==null)return false;
        long pixels=(long)page.getWidth()*page.getHeight();if(pixels<=0 || pixels+pixels()>maxPixels)return false;
        try {pageBitmap=Bitmap.createBitmap(page.getWidth(),page.getHeight(),Bitmap.Config.ARGB_8888);page.draw(new Canvas(pageBitmap));}
        catch(RuntimeException | OutOfMemoryError error){if(pageBitmap!=null)pageBitmap.recycle();pageBitmap=null;return false;}
        pageFrame=frame;return true;
    }
    public void fade(double milliseconds,Listener callback) {
        if(disposed){if(callback!=null)callback.onEnd(false);return;}
        Choreographer.getInstance().removeFrameCallback(this);fading=true;running=true;duration=Math.max(1,Math.min(500,milliseconds));started=android.os.SystemClock.uptimeMillis();listener=callback;
        Choreographer.getInstance().postFrameCallback(this);
    }
    public double pixels() { return (pageBitmap==null?0:(long)pageBitmap.getWidth()*pageBitmap.getHeight())+(source==null?0:(long)source.getWidth()*source.getHeight())+(target==null?0:(long)target.getWidth()*target.getHeight()); }
    public String state() {
        try { JSONObject out=new JSONObject(); out.put("pose",new JSONArray(java.util.Arrays.copyOf(pose,navigationImage?(clippedImage?14:10):6))); out.put("velocity",new JSONArray(java.util.Arrays.copyOf(velocity,navigationImage?(clippedImage?14:10):5))); return out.toString(); }
        catch (JSONException error) { throw new IllegalStateException(error); }
    }
    public String prepare(View view, boolean image, double radius, double maxPixels) {
        if (disposed || (view.getVisibility()!=VISIBLE && !hidden.containsKey(view))) return null;
        RectF rect=geometry(view);
        if (!visibleBounds(view,rect)) return null;
        Bitmap bitmap=snapshot(view,(long)(maxPixels-pixels())); if(bitmap==null) return null;
        if(target!=null) target.recycle(); target=bitmap; targetWidth=rect.width(); targetHeight=rect.height(); targetImage=image;
        destination=view; destinationFrame=rect; hide(view);
        try { return new JSONArray(new double[]{rect.left/density,rect.top/density,rect.width()/density,rect.height()/density,radius*rect.width()/view.getWidth()}).toString(); } catch(JSONException error) { throw new IllegalStateException(error); }
    }
    static final class Anchor {
        Bitmap bitmap; boolean image; double[] geometry; float width,height;
        void dispose() { if(!image && bitmap!=null)bitmap.recycle(); bitmap=null; }
        long pixels() { return bitmap==null?0:(long)bitmap.getWidth()*bitmap.getHeight(); }
    }
    static Anchor anchor(View view, boolean image, double radius, double budget) {
        if(view==null || !(view.getRootView() instanceof ViewGroup) || view.getVisibility()!=VISIBLE)return null;
        SharedLayoutFlight probe=new SharedLayoutFlight(view);
        RectF rect=probe.geometry(view); if(!probe.visibleBounds(view,rect))return null;
        Anchor a=new Anchor(); a.image=image; a.width=rect.width(); a.height=rect.height();
        if(image) {
            a.geometry=probe.navigationGeometry(view,radius); if(a.geometry==null)return null;
            a.bitmap=((BitmapDrawable)((ImageView)view).getDrawable()).getBitmap();
            if(a.pixels()>budget)return null;
        } else {
            a.bitmap=probe.snapshot(view,(long)budget); if(a.bitmap==null)return null;
            a.geometry=new double[]{rect.left/probe.density,rect.top/probe.density,rect.width()/probe.density,rect.height()/probe.density,radius*rect.width()/view.getWidth()};
        }
        return a;
    }
    boolean prepareAnchor(Anchor anchor, double budget) {
        if(disposed || anchor==null || anchor.bitmap==null || navigationImage!=anchor.image || pixels()+anchor.pixels()>budget)return false;
        if(navigationImage && Math.abs((double)source.getWidth()/source.getHeight()-(double)anchor.bitmap.getWidth()/anchor.bitmap.getHeight())>.001)return false;
        target=anchor.bitmap; borrowedTarget=true; targetWidth=anchor.width; targetHeight=anchor.height; targetImage=false;
        interactiveStart=pose.clone(); interactiveEnd=pose.clone();
        for(int i=0;i<anchor.geometry.length;i++)interactiveEnd[i<5?i:i+1]=anchor.geometry[i];
        interactiveEnd[5]=1; return true;
    }
    void updateInteractive(double progress) {
        if(disposed || interactiveStart==null)return;
        double p=Math.max(0,Math.min(1,Double.isFinite(progress)?progress:0));
        for(int i=0;i<pose.length;i++)pose[i]=interactiveStart[i]+(interactiveEnd[i]-interactiveStart[i])*p;
        invalidate();
    }
    public boolean freeze(double maxPixels) {
        if(disposed) return false;
        if(running) evaluate(android.os.SystemClock.uptimeMillis());
        running=false; Choreographer.getInstance().removeFrameCallback(this); listener=null;
        int w=Math.max(1,(int)Math.ceil(pose[2]*density)),h=Math.max(1,(int)Math.ceil(pose[3]*density));
        if((long)w*h+pixels()>maxPixels) return false;
        Bitmap bitmap;
        try { bitmap=Bitmap.createBitmap(w,h,Bitmap.Config.ARGB_8888); } catch(OutOfMemoryError error) { return false; }
        Canvas canvas=new Canvas(bitmap); canvas.translate((float)-pose[0]*density,(float)-pose[1]*density); render(canvas);
        if(source!=null && !navigationImage) source.recycle(); if(target!=null && !borrowedTarget) target.recycle();
        source=bitmap; target=null; sourceWidth=(float)pose[2]*density; sourceHeight=(float)pose[3]*density; sourceImage=false; pose[5]=0;
        destination=null; invalidate(); return true;
    }
    public void play(String json, Listener callback) {
        if(disposed) return;
        try {
            JSONObject config=new JSONObject(json); JSONArray tracks=config.getJSONArray("tracks");
            int count=navigationImage?(clippedImage?14:10):6; times=new double[count][]; values=new double[count][]; duration=0;
            for(int k=0;k<(navigationImage?(clippedImage?14:10):6);k++) {
                JSONObject track=tracks.getJSONObject(k); JSONArray t=track.getJSONArray("times"),v=track.getJSONArray("values");
                times[k]=new double[t.length()]; values[k]=new double[v.length()];
                for(int j=0;j<t.length();j++){times[k][j]=t.getDouble(j);values[k][j]=v.getDouble(j);}
                duration=Math.max(duration,times[k][t.length()-1]);
            }
        } catch(JSONException error) { throw new IllegalArgumentException(error); }
        listener=callback; started=android.os.SystemClock.uptimeMillis(); running=true;
        Choreographer.getInstance().postFrameCallback(this);
    }
    private void evaluate(double now) {
        double elapsed=Math.max(0,now-started);
        for(int k=0;k<(navigationImage?(clippedImage?14:10):6);k++) {
            double[] t=times[k],v=values[k]; int j=1;
            while(j<t.length-1 && t[j]<elapsed)j++;
            double span=t[j]-t[j-1], fraction=span<=0?1:Math.max(0,Math.min(1,(elapsed-t[j-1])/span));
            pose[k]=v[j-1]+(v[j]-v[j-1])*fraction;
            if(k!=5) velocity[k]=elapsed>=t[t.length-1]||span<=0?0:(v[j]-v[j-1])*1000/span;
        }
    }
    @Override public void doFrame(long nanos) {
        if(!running || disposed)return;
        if(fading){double p=Math.min(1,(android.os.SystemClock.uptimeMillis()-started)/duration);setAlpha((float)(1-p));if(p>=1)end(true);else Choreographer.getInstance().postFrameCallback(this);return;}
        RectF frame=geometry(destination);
        if(root.getWidth()!=rootWidth || root.getHeight()!=rootHeight || frame==null || Math.abs(frame.left-destinationFrame.left)>1 || Math.abs(frame.top-destinationFrame.top)>1 || Math.abs(frame.width()-destinationFrame.width())>1 || Math.abs(frame.height()-destinationFrame.height())>1) { end(false); return; }
        double now=android.os.SystemClock.uptimeMillis(); evaluate(now); invalidate();
        if(now-started>=duration)end(true); else Choreographer.getInstance().postFrameCallback(this);
    }
    private void end(boolean completed) { Listener callback=listener; listener=null; running=false; Choreographer.getInstance().removeFrameCallback(this); if(callback!=null)callback.onEnd(completed); }
    private void bitmap(Canvas canvas,Bitmap bitmap,float width,float height,boolean image,float alpha,RectF box) {
        if(bitmap==null || alpha<=0)return;
        float scale=image?Math.max(box.width()/width,box.height()/height):1;
        float w=width*scale,h=height*scale;
        paint.setAlpha(Math.round(alpha*255)); canvas.drawBitmap(bitmap,null,new RectF(box.centerX()-w/2,box.centerY()-h/2,box.centerX()+w/2,box.centerY()+h/2),paint);
    }
    private void render(Canvas canvas) {
        if(pageBitmap!=null){paint.setAlpha((int)Math.round((1-Math.max(0,Math.min(1,pose[5])))*255));canvas.drawBitmap(pageBitmap,null,pageFrame,paint);}
        RectF box=new RectF((float)pose[0]*density,(float)pose[1]*density,(float)(pose[0]+Math.max(.1,pose[2]))*density,(float)(pose[1]+Math.max(.1,pose[3]))*density);
        float radius=(float)Math.max(0,Math.min(pose[4]*density,Math.min(box.width(),box.height())/2));
        Path path=new Path(); path.addRoundRect(box,radius,radius,Path.Direction.CW); int save=canvas.save(); canvas.clipPath(path);
        if(navigationImage) {
            if(clippedImage)canvas.clipRect((float)pose[10]*density,(float)pose[11]*density,(float)(pose[10]+Math.max(0,pose[12]))*density,(float)(pose[11]+Math.max(0,pose[13]))*density);
            paint.setAlpha(255);
            canvas.drawBitmap(source,null,new RectF(box.left+(float)pose[6]*density,box.top+(float)pose[7]*density,box.left+(float)(pose[6]+Math.max(.1,pose[8]))*density,box.top+(float)(pose[7]+Math.max(.1,pose[9]))*density),paint);
            canvas.restoreToCount(save); return;
        }
        int composite=canvas.saveLayer(box,null);
        float mix=(float)Math.max(0,Math.min(1,pose[5]));
        bitmap(canvas,source,sourceWidth,sourceHeight,sourceImage,1-mix,box);
        paint.setXfermode(ADD); bitmap(canvas,target,targetWidth,targetHeight,targetImage,mix,box); paint.setXfermode(null);
        canvas.restoreToCount(composite); canvas.restoreToCount(save);
    }
    @Override protected void onDraw(Canvas canvas) { render(canvas); }
    public void dispose() {
        if(disposed)return; disposed=true; running=false; listener=null;
        Choreographer.getInstance().removeFrameCallback(this); root.getOverlay().remove(this); active--;
        for(Map.Entry<View,Integer> entry:hidden.entrySet()) if(entry.getKey().getVisibility()==INVISIBLE)entry.getKey().setVisibility(entry.getValue()); hidden.clear();
        if(!navigationImage) { if(source!=null)source.recycle(); if(target!=null && !borrowedTarget)target.recycle(); } source=null;target=null;destination=null;if(pageBitmap!=null)pageBitmap.recycle();pageBitmap=null;
    }
}
