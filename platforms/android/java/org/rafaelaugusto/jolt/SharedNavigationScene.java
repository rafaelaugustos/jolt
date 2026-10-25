package org.rafaelaugusto.jolt;

import android.graphics.*;
import android.graphics.drawable.BitmapDrawable;
import android.view.*;
import android.webkit.WebView;
import android.widget.ImageView;
import java.lang.ref.WeakReference;
import java.util.ArrayList;

/** One static return page, retained within a pixel budget. Only the current gesture owns an overlay. */
public final class SharedNavigationScene extends View {
    private final ViewGroup root;
    private final ArrayList<WeakReference<View>> path=new ArrayList<>();
    private final ArrayList<float[]> poses=new ArrayList<>();
    private WeakReference<View> detail;
    private SharedLayoutFlight.Anchor anchor;
    private SharedLayoutFlight flight;
    private Bitmap background;
    private final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG | Paint.FILTER_BITMAP_FLAG);
    private final int rootWidth,rootHeight;
    private RectF pageFrame;
    private final double budget;
    private double radius,progress;
    private boolean disposed,visible;
    private static int retained,active;
    private static long retainedPixels;
    private long ownedPixels;
    private String failureReason="ready";
    public String getFailureReason(){return failureReason;}
    private boolean invalid(String reason){failureReason=reason;return false;}

    private SharedNavigationScene(View source,double budget) {
        super(source.getContext()); root=(ViewGroup)source.getRootView();
        this.budget=budget;rootWidth=root.getWidth();rootHeight=root.getHeight();
        layout(0,0,rootWidth,rootHeight);setWillNotDraw(false);
        setImportantForAccessibility(IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
    }
    public long pixels(){return ownedPixels;}
    public static int retainedCount(){return retained;}
    public static int activeCount(){return active;}
    public static long retainedPixelCount(){return retainedPixels;}
    private static boolean incompatible(View view) {
        if(view instanceof SurfaceView || view instanceof TextureView || view instanceof WebView)return true;
        if(view instanceof ViewGroup)for(int i=0;i<((ViewGroup)view).getChildCount();i++)if(incompatible(((ViewGroup)view).getChildAt(i)))return true;
        return false;
    }
    private static float[] pose(View v) {
        return new float[]{v.getLeft(),v.getTop(),v.getWidth(),v.getHeight(),v.getTranslationX(),v.getTranslationY(),v.getScaleX(),v.getScaleY(),v.getRotation(),v.getScrollX(),v.getScrollY()};
    }
    public static SharedNavigationScene capture(View source,View page,boolean image,double radius,double budget) {
        if(source==null || page==null || !source.isAttachedToWindow() || source.getRootView()!=page.getRootView() || !(source.getRootView() instanceof ViewGroup) || incompatible(page))return null;
        SharedNavigationScene scene=new SharedNavigationScene(source,budget);
        SharedLayoutFlight.Anchor anchor=SharedLayoutFlight.anchor(source,image,radius,budget);
        if(anchor==null)return null;
        long pagePixels=(long)page.getWidth()*page.getHeight();
        if(pagePixels<=0 || pagePixels+anchor.pixels()>budget){anchor.dispose();return null;}
        boolean found=false;
        for(View p=source;p!=null;p=p.getParent() instanceof View?(View)p.getParent():null) {
            scene.path.add(new WeakReference<>(p));scene.poses.add(pose(p));
            if(p==page){found=true;break;}
        }
        if(!found){anchor.dispose();return null;}
        int visibility=source.getVisibility();
        try {
            scene.background=Bitmap.createBitmap(page.getWidth(),page.getHeight(),Bitmap.Config.ARGB_8888);
            source.setVisibility(INVISIBLE);page.draw(new Canvas(scene.background));
        } catch(OutOfMemoryError | RuntimeException error) { anchor.dispose();if(scene.background!=null)scene.background.recycle();return null; }
        finally {source.setVisibility(visibility);}
        int[] a=new int[2],b=new int[2];rootLocation(scene.root,a);page.getLocationOnScreen(b);
        scene.pageFrame=new RectF(b[0]-a[0],b[1]-a[1],b[0]-a[0]+page.getWidth(),b[1]-a[1]+page.getHeight());
        scene.anchor=anchor;scene.ownedPixels=pagePixels+anchor.pixels();retained++;retainedPixels+=scene.ownedPixels;
        return scene;
    }
    private static void rootLocation(View root,int[] xy){root.getLocationOnScreen(xy);}
    public void bind(View view,double radius){this.detail=new WeakReference<>(view);this.radius=radius;}
    public boolean validSource() {
        if(disposed || root.getWidth()!=rootWidth || root.getHeight()!=rootHeight || background==null || background.isRecycled())return invalid("viewport-changed");
        if(anchor.bitmap==null || anchor.bitmap.isRecycled())return invalid("image-unavailable");
        // Core can detach and rebuild a covered page's native children. Its static JS
        // identity/content/layout stamp is checked once at gesture start by the adapter.
        View page=path.get(path.size()-1).get();
        if(page==null || !page.isAttachedToWindow())return true;
        for(int i=0;i<path.size();i++) {
            View v=path.get(i).get();if(v==null)return invalid("source-unavailable");
            if(i+1<path.size() && v.getParent()!=path.get(i+1).get())return invalid("source-reparented");
            float[] actual=pose(v),expected=poses.get(i);
            for(int k=0;k<actual.length;k++)if(Math.abs(actual[k]-expected[k])>.1)return invalid("source-layout-changed");
        }
        if(anchor.image) {
            View view=path.get(0).get();
            if(!(view instanceof ImageView) || !(((ImageView)view).getDrawable() instanceof BitmapDrawable) || ((BitmapDrawable)((ImageView)view).getDrawable()).getBitmap()!=anchor.bitmap)return invalid("source-image-changed");
        }
        return true;
    }
    public boolean begin() {
        finish();View view=detail==null?null:detail.get();
        if(!validSource())return false;
        if(view==null || !view.isAttachedToWindow() || view.getRootView()!=root)return invalid("target-unavailable");
        progress=0;root.getOverlay().add(this);visible=true;active++;
        try {
            flight=anchor.image?SharedLayoutFlight.captureNavigationImage(view,radius,budget-ownedPixels):SharedLayoutFlight.capture(view,false,radius,budget-ownedPixels);
            if(flight==null || !flight.prepareAnchor(anchor,budget-ownedPixels)){finish();return invalid("unsupported-target");}
            failureReason="ready";flight.updateInteractive(0);return true;
        } catch(RuntimeException | OutOfMemoryError error) { finish();return invalid("unsupported-target"); }
    }
    public boolean isAnimating(){return flight!=null;}
    public boolean validActive(){return !visible || (validSource() && detail!=null && detail.get()!=null && detail.get().isAttachedToWindow());}
    public void render(double p){if(flight==null)return;progress=Math.max(0,Math.min(1,p));flight.updateInteractive(progress);invalidate();}
    @Override protected void onDraw(Canvas canvas) {
        if(background==null)return;paint.setAlpha((int)Math.round(progress*255));canvas.drawBitmap(background,null,pageFrame,paint);
    }
    public void finish(){if(flight!=null){flight.dispose();flight=null;}if(visible){root.getOverlay().remove(this);visible=false;active--;}}
    public void dispose(){if(disposed)return;finish();disposed=true;if(anchor!=null)anchor.dispose();anchor=null;if(background!=null)background.recycle();background=null;detail=null;path.clear();poses.clear();retained--;retainedPixels-=ownedPixels;}
}
