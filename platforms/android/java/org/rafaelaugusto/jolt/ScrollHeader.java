package org.rafaelaugusto.jolt;

import android.view.View;
import android.view.MotionEvent;
import android.view.ViewConfiguration;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.os.SystemClock;
import android.view.ViewTreeObserver;
import android.view.ViewGroup;
import java.util.WeakHashMap;
import java.util.Iterator;
import java.util.Map;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.ListView;
import androidx.core.widget.NestedScrollView;
import android.graphics.Rect;
import android.widget.TextView;
import org.json.JSONObject;

/** Native ListView input; does not replace Core's adapter, item listener or scroll listener. */
public final class ScrollHeader implements ViewTreeObserver.OnScrollChangedListener, View.OnLayoutChangeListener {
    public interface Listener { void changed(); }
    private static int active;
    public static int activeCount(){return active;}
    private final ViewGroup source;
    private final ListView list;
    private final NestedScrollView scroll;
    private View[] rows=new View[0];
    private ScrollInput input;
    private View indicator;
    private ViewGroup indicatorHost;
    private LiveSpring node;
    private Listener listener;
    private final View header, title, toolbarTitle, toolbar;
    private final TextView diagnostic;
    private final int headerAccessibility, titleAccessibility, toolbarAccessibility, toolbarContainerAccessibility;
    private final int toolbarVisibility;
    private final float density;
    private ViewTreeObserver observer;
    private final WeakHashMap<View,Integer> coveredRows=new WeakHashMap<>();
    private boolean enabled, disposed;
    private ScrollHeaderSurface surface;
    private boolean refreshEnabled, reduced, eligible, pulling;
    private float startX, startY;
    private double pull, refreshThreshold=80;
    private int refreshState, refreshRequests, refreshDraws;
    private double handoff, minimumOffset, maximumOffset, fadeStart, range, spacer, rowHeight, offset=Double.NaN;
    private int phase=-1, accessibilityPhase=-1, updates, callbacks;
    public ScrollHeader(ViewGroup source, LiveSpring node, View header, View title, View toolbarTitle, View toolbar, View diagnostic, String options, Listener listener) {
        if(!(source instanceof ListView) && !(source instanceof NestedScrollView))throw new IllegalArgumentException("Expected vertical ScrollView or ListView");
        this.source=source;this.list=source instanceof ListView?(ListView)source:null;this.scroll=source instanceof NestedScrollView?(NestedScrollView)source:null;this.node=node;this.title=title;this.toolbarTitle=toolbarTitle;this.toolbar=toolbar;this.listener=listener;
        this.diagnostic=diagnostic instanceof TextView?(TextView)diagnostic:null;
        density=source.getResources().getDisplayMetrics().density;
        titleAccessibility=title.getImportantForAccessibility();toolbarAccessibility=toolbarTitle.getImportantForAccessibility();toolbarVisibility=toolbar.getVisibility();
        toolbarContainerAccessibility=toolbar.getImportantForAccessibility();
        this.header=header;headerAccessibility=header.getImportantForAccessibility();
        configure(options);setEnabled(true);
    }
    public void configure(String options) {
        try {JSONObject c=new JSONObject(options);handoff=c.getDouble(c.optBoolean("reduced")?"handoff":"focusHandoff");range=c.getDouble("range");spacer=c.getDouble("spacer");rowHeight=c.getDouble("rowHeight");fadeStart=c.getJSONArray("toolbarFade").getDouble(0)*range;
            reduced=c.optBoolean("reduced");refreshEnabled=c.optBoolean("refresh");refreshThreshold=c.optDouble("refreshThreshold",80);
            if(refreshEnabled && surface==null && scroll==null){
                if(!(source.getParent() instanceof ScrollHeaderSurface))throw new IllegalArgumentException("Pull-to-refresh requires ScrollHeaderSurface");
                surface=(ScrollHeaderSurface)source.getParent();surface.attach(this);
            }
            invalidateRefresh();}
        catch(Exception error){throw new IllegalArgumentException(error);}
        if(enabled)update(true);
    }
    public void setEnabled(boolean value) {
        if(disposed || enabled==value)return;
        enabled=value;
        if(value){observer=source.getViewTreeObserver();observer.addOnScrollChangedListener(this);source.addOnLayoutChangeListener(this);active++;if(scroll!=null && refreshEnabled)attachScrollInput();update(true);}
        else{if(input!=null){input.dispose();input=null;}if(observer!=null && observer.isAlive())observer.removeOnScrollChangedListener(this);observer=null;source.removeOnLayoutChangeListener(this);active--;cancelPull();}
        invalidateRefresh();
    }
    @Override public void onScrollChanged(){update(false);}
    @Override public void onLayoutChange(View view,int l,int t,int r,int b,int ol,int ot,int or,int ob){if(indicator!=null)indicator.layout(l,t,r,b);update(true);}
    private double current() {
        if(scroll!=null)return scroll.getScrollY()/density;
        View child=list.getChildAt(0);if(child==null)return 0;
        int first=list.getFirstVisiblePosition();double divider=list.getDividerHeight()/density;
        return (first==0?0:spacer+divider+(first-1)*(rowHeight+divider))+(list.getPaddingTop()-child.getTop())/density;
    }
    private void update(boolean force) {
        if(disposed)return;
        double next=current();if(!force && Math.abs(next-offset)<.001)return;
        boolean compact=next>=range*handoff;
        View incoming=compact?toolbarTitle:title;
        // Capture before alpha/visibility changes can clear the outgoing focus.
        boolean transfer=accessibilityPhase>=0 && accessibilityPhase!=(compact?1:0) && hasAccessibilityFocus(compact?header:toolbar);
        offset=next;minimumOffset=Math.min(minimumOffset,offset);maximumOffset=Math.max(maximumOffset,offset);updates++;node.setTarget(offset);
        toolbar.setVisibility(offset > fadeStart ? toolbarVisibility : View.INVISIBLE);
        updateAccessibleRows();
        if(accessibilityPhase!=(compact?1:0)) {
            accessibilityPhase=compact?1:0;
            header.setImportantForAccessibility(compact?View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS:headerAccessibility);
            title.setImportantForAccessibility(compact?View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS:titleAccessibility);
            toolbarTitle.setImportantForAccessibility(compact?toolbarAccessibility:View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
            toolbar.setImportantForAccessibility(compact?toolbarContainerAccessibility:View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
            if(transfer && canFocus(incoming))
                incoming.performAccessibilityAction(AccessibilityNodeInfo.ACTION_ACCESSIBILITY_FOCUS,null);
        }
        int nextPhase=offset<=.5?0:offset>=range-.5?2:1;
        if(nextPhase!=phase){phase=nextPhase;callbacks++;if(listener!=null)listener.changed();}
        if(diagnostic!=null)diagnostic.setText(String.format(java.util.Locale.US,"y %.0f · range %.0f · native %d · JS %d",offset,range,updates,callbacks));
    }
    private static boolean hasAccessibilityFocus(View view) {
        if(view.isAccessibilityFocused())return true;
        if(view instanceof ViewGroup){ViewGroup group=(ViewGroup)view;for(int i=0;i<group.getChildCount();i++)if(hasAccessibilityFocus(group.getChildAt(i)))return true;}
        return false;
    }
    private static boolean canFocus(View view) {
        if(!view.isImportantForAccessibility() || !view.isShown())return false;
        for(View current=view;current!=null;current=current.getParent() instanceof View?(View)current.getParent():null)
            if(current.getImportantForAccessibility()==View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS)return false;
        return true;
    }
    private void updateAccessibleRows() {
        if(scroll!=null){
            double edge=(spacer-Math.min(range,Math.max(0,offset)))*density;
            for(View row:rows){
                if(!ScrollInput.descendant(row,scroll)){if(coveredRows.containsKey(row))row.setImportantForAccessibility(coveredRows.remove(row));continue;}
                Rect rect=new Rect();row.getDrawingRect(rect);scroll.offsetDescendantRectToMyCoords(row,rect);
                boolean hidden=rect.bottom<=scroll.getScrollY()+edge+.5;
                if(hidden && !coveredRows.containsKey(row)){coveredRows.put(row,row.getImportantForAccessibility());row.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);}
                else if(!hidden && coveredRows.containsKey(row))row.setImportantForAccessibility(coveredRows.remove(row));
            }
            return;
        }
        for(Iterator<Map.Entry<View,Integer>> entries=coveredRows.entrySet().iterator();entries.hasNext();) {
            Map.Entry<View,Integer> entry=entries.next();
            if(entry.getKey().getParent()!=list){entry.getKey().setImportantForAccessibility(entry.getValue());entries.remove();}
        }
        double edge=(spacer-Math.min(range,Math.max(0,offset)))*density;
        for(int i=0;i<list.getChildCount();i++) {
            View row=list.getChildAt(i);
            boolean hidden=list.getFirstVisiblePosition()+i==0 || row.getBottom()<=edge+.5;
            if(hidden && !coveredRows.containsKey(row)) {
                coveredRows.put(row,row.getImportantForAccessibility());row.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO_HIDE_DESCENDANTS);
            } else if(!hidden && coveredRows.containsKey(row)) row.setImportantForAccessibility(coveredRows.remove(row));
        }
    }
    public String snapshot() {
        int first=0,visible=0,total=rows.length;
        if(list!=null){first=list.getFirstVisiblePosition();visible=list.getChildCount();total=list.getCount();}
        else for(int i=0;i<rows.length;i++){if(!ScrollInput.descendant(rows[i],scroll))continue;Rect rect=new Rect();rows[i].getDrawingRect(rect);scroll.offsetDescendantRectToMyCoords(rows[i],rect);if(rect.bottom>scroll.getScrollY() && rect.top<scroll.getScrollY()+scroll.getHeight()){if(visible==0)first=i;visible++;}}
        try {return new JSONObject().put("minimumOffset",minimumOffset).put("maximumOffset",maximumOffset).put("offset",Double.isFinite(offset)?offset:0).put("phase",new String[]{"expanded","between","collapsed"}[Math.max(0,phase)])
            .put("refresh",new String[]{"idle","pulling","armed","refreshing"}[refreshState]).put("refreshRequests",refreshRequests).put("refreshDraws",refreshDraws).put("updates",updates).put("callbacks",callbacks).put("first",first).put("visible",visible).put("total",total).toString();}
        catch(Exception error){throw new IllegalStateException(error);}
    }
    public void scroll(double target,boolean animated) {
        if(disposed || !Double.isFinite(target))return;
        if(scroll!=null){int y=(int)Math.round(Math.max(0,target)*density);if(animated)scroll.smoothScrollTo(scroll.getScrollX(),y);else scroll.scrollTo(scroll.getScrollX(),y);update(true);return;}
        target=Math.max(0,target);
        double divider=list.getDividerHeight()/density, stride=rowHeight+divider;
        int index=target<spacer+divider?0:1+(int)Math.floor((target-spacer-divider)/stride);
        index=Math.max(0,Math.min(list.getCount()-1,index));
        double start=index==0?0:spacer+divider+(index-1)*stride;
        int top=(int)Math.round((start-target)*density);
        if(animated){list.smoothScrollToPositionFromTop(index,top,300);return;}
        list.setSelectionFromTop(index,top);
        source.post(new Runnable(){public void run(){if(!disposed)update(true);}});
    }
    private void refreshState(int state) {
        if(refreshState==state)return;
        refreshState=state;
        if(state==3)refreshRequests++;
        invalidateRefresh();
        callbacks++;if(listener!=null)listener.changed();
    }
    public void setRows(View[] next) {
        if(disposed)return;
        for(Map.Entry<View,Integer> entry:coveredRows.entrySet())entry.getKey().setImportantForAccessibility(entry.getValue());
        coveredRows.clear();rows=next.clone();if(enabled)update(true);
    }
    private void invalidateRefresh(){
        if(surface!=null)surface.invalidate();
        if(indicator!=null){indicator.setVisibility(enabled && refreshState>0?View.VISIBLE:View.INVISIBLE);indicator.invalidate();}
    }
    private void attachScrollInput(){
        if(input!=null)return;
        if(indicator==null){
            if(!(source.getParent() instanceof ViewGroup))throw new IllegalArgumentException("ScrollView needs a mounted parent");
            indicatorHost=(ViewGroup)source.getParent();
            indicator=new View(source.getContext()){
                final Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG);
                @Override protected void onDraw(Canvas canvas){drawRefresh(canvas,paint,getWidth());}
            };
            indicator.setImportantForAccessibility(View.IMPORTANT_FOR_ACCESSIBILITY_NO);
            indicator.setClickable(false);indicator.setVisibility(View.INVISIBLE);
            indicator.layout(source.getLeft(),source.getTop(),source.getRight(),source.getBottom());
            indicatorHost.getOverlay().add(indicator);
        }
        input=ScrollInput.attach(source,new ScrollInput.Listener(){
            @Override public void cancel(){cancelPull();}
            @Override public boolean touch(MotionEvent event){
                if(disposed || !enabled || refreshState==3)return false;
                int action=event.getActionMasked();
                if(action==MotionEvent.ACTION_DOWN){cancelPull();startX=event.getRawX();startY=event.getRawY();eligible=ScrollInput.contains(source,event) && current()<=.5 && !source.canScrollVertically(-1);}
                else if(action==MotionEvent.ACTION_POINTER_DOWN){boolean owned=pulling;cancelPull();return owned;}
                else if(action==MotionEvent.ACTION_MOVE && eligible){
                    float dx=event.getRawX()-startX,dy=event.getRawY()-startY;
                    int slop=ViewConfiguration.get(source.getContext()).getScaledTouchSlop();
                    if(!pulling){if(Math.abs(dx)>slop && Math.abs(dx)>=Math.abs(dy) || dy < -slop){eligible=false;return false;}if(dy<=slop || source.canScrollVertically(-1))return false;pulling=true;}
                    pull=Math.max(0,(dy-slop)/(2*density));refreshState(pull>=refreshThreshold?2:1);invalidateRefresh();
                }
                boolean owned=pulling;
                if(action==MotionEvent.ACTION_UP){boolean trigger=pulling && refreshState==2;cancelPull();if(trigger)setRefreshing(true);}
                else if(action==MotionEvent.ACTION_CANCEL)cancelPull();
                return owned;
            }
        });
    }
    public void setRefreshing(boolean value) {
        if(disposed || (value && (!enabled || !refreshEnabled)))return;
        eligible=false;pulling=false;pull=0;
        refreshState(value?3:0);
    }
    void cancelPull() {
        eligible=false;pulling=false;pull=0;
        if(refreshState!=3)refreshState(0);
        invalidateRefresh();
    }
    boolean intercepts(){return pulling;}
    void beforeTouch(MotionEvent event) {
        if(disposed || !enabled || !refreshEnabled || refreshState==3)return;
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_DOWN){
            cancelPull();startX=event.getX();startY=event.getY();
            eligible=current()<=.5 && !source.canScrollVertically(-1)
                && startX>=source.getLeft() && startX<source.getRight() && startY>=source.getTop() && startY<source.getBottom();
        } else if(action==MotionEvent.ACTION_POINTER_DOWN){cancelPull();}
        else if(action==MotionEvent.ACTION_MOVE && eligible){
            double dx=event.getX()-startX,dy=event.getY()-startY;
            int slop=ViewConfiguration.get(source.getContext()).getScaledTouchSlop();
            if(!pulling){
                if(Math.abs(dx)>slop && Math.abs(dx)>=Math.abs(dy) || dy < -slop){eligible=false;return;}
                if(dy<=slop || source.canScrollVertically(-1))return;
                pulling=true;
                // Core receives ACTION_CANCEL from the parent's interception.
                if(surface.getParent()!=null)surface.getParent().requestDisallowInterceptTouchEvent(true);
            }
            pull=Math.max(0,(dy-slop)/(2*density));
            refreshState(pull>=refreshThreshold?2:1);
            surface.invalidate();
        }
    }
    void afterTouch(MotionEvent event) {
        int action=event.getActionMasked();
        if(action==MotionEvent.ACTION_UP){
            boolean trigger=pulling && refreshState==2;
            cancelPull();
            if(trigger)setRefreshing(true);
        } else if(action==MotionEvent.ACTION_CANCEL)cancelPull();
    }
    void drawRefresh(Canvas canvas,Paint paint,int width) {
        if(disposed || !enabled || refreshState==0)return;
        float x=width*.5f, y=(scroll!=null?0:source.getTop())+(refreshState==3?32:(float)Math.min(60,pull)*.6f+16)*density;
        float radius=18*density;
        paint.setStyle(Paint.Style.FILL);paint.setColor(0xfff4f0e7);canvas.drawCircle(x,y,radius,paint);
        paint.setStyle(Paint.Style.STROKE);paint.setStrokeWidth(3*density);paint.setStrokeCap(Paint.Cap.ROUND);paint.setColor(0xff193d34);
        float turn=refreshState==3&&!reduced?(SystemClock.uptimeMillis()%900)*.4f:-90;
        float sweep=refreshState==3?270:(float)(Math.max(.08,Math.min(1,pull/refreshThreshold))*330);
        float r=11*density;canvas.drawArc(x-r,y-r,x+r,y+r,turn,sweep,false,paint);
        refreshDraws++;
        if(refreshState==3&&!reduced){if(surface!=null)surface.postInvalidateOnAnimation();else if(indicator!=null)indicator.postInvalidateOnAnimation();}
    }
    public void dispose() {
        if(disposed)return;setRefreshing(false);setEnabled(false);disposed=true;
        if(surface!=null){surface.detach(this);surface=null;}
        if(input!=null){input.dispose();input=null;}
        if(indicatorHost!=null && indicator!=null)indicatorHost.getOverlay().remove(indicator);indicator=null;indicatorHost=null;rows=new View[0];
        title.setImportantForAccessibility(titleAccessibility);toolbarTitle.setImportantForAccessibility(toolbarAccessibility);toolbar.setVisibility(toolbarVisibility);
        toolbar.setImportantForAccessibility(toolbarContainerAccessibility);
        header.setImportantForAccessibility(headerAccessibility);
        for(Map.Entry<View,Integer> entry:coveredRows.entrySet())entry.getKey().setImportantForAccessibility(entry.getValue());coveredRows.clear();
        node=null;listener=null;
    }
}
