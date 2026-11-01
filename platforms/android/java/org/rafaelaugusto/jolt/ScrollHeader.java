package org.rafaelaugusto.jolt;

import android.view.View;
import android.view.ViewTreeObserver;
import android.view.ViewGroup;
import java.util.WeakHashMap;
import java.util.Iterator;
import java.util.Map;
import android.view.accessibility.AccessibilityNodeInfo;
import android.widget.ListView;
import android.widget.TextView;
import org.json.JSONObject;

/** Native ListView input; does not replace Core's adapter, item listener or scroll listener. */
public final class ScrollHeader implements ViewTreeObserver.OnScrollChangedListener, View.OnLayoutChangeListener {
    public interface Listener { void changed(); }
    private static int active;
    public static int activeCount(){return active;}
    private final ListView list;
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
    private double handoff, minimumOffset, maximumOffset, fadeStart, range, spacer, rowHeight, offset=Double.NaN;
    private int phase=-1, accessibilityPhase=-1, updates, callbacks;
    public ScrollHeader(ListView list, LiveSpring node, View header, View title, View toolbarTitle, View toolbar, View diagnostic, String options, Listener listener) {
        this.list=list;this.node=node;this.title=title;this.toolbarTitle=toolbarTitle;this.toolbar=toolbar;this.listener=listener;
        this.diagnostic=diagnostic instanceof TextView?(TextView)diagnostic:null;
        density=list.getResources().getDisplayMetrics().density;
        titleAccessibility=title.getImportantForAccessibility();toolbarAccessibility=toolbarTitle.getImportantForAccessibility();toolbarVisibility=toolbar.getVisibility();
        toolbarContainerAccessibility=toolbar.getImportantForAccessibility();
        this.header=header;headerAccessibility=header.getImportantForAccessibility();
        configure(options);setEnabled(true);
    }
    public void configure(String options) {
        try {JSONObject c=new JSONObject(options);handoff=c.getDouble(c.optBoolean("reduced")?"handoff":"focusHandoff");range=c.getDouble("range");spacer=c.getDouble("spacer");rowHeight=c.getDouble("rowHeight");fadeStart=c.getJSONArray("toolbarFade").getDouble(0)*range;}
        catch(Exception error){throw new IllegalArgumentException(error);}
        if(enabled)update(true);
    }
    public void setEnabled(boolean value) {
        if(disposed || enabled==value)return;
        enabled=value;
        if(value){observer=list.getViewTreeObserver();observer.addOnScrollChangedListener(this);list.addOnLayoutChangeListener(this);active++;update(true);}
        else{if(observer!=null && observer.isAlive())observer.removeOnScrollChangedListener(this);observer=null;list.removeOnLayoutChangeListener(this);active--;}
    }
    @Override public void onScrollChanged(){update(false);}
    @Override public void onLayoutChange(View view,int l,int t,int r,int b,int ol,int ot,int or,int ob){update(true);}
    private double current() {
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
        try {return new JSONObject().put("minimumOffset",minimumOffset).put("maximumOffset",maximumOffset).put("offset",Double.isFinite(offset)?offset:0).put("phase",new String[]{"expanded","between","collapsed"}[Math.max(0,phase)])
            .put("updates",updates).put("callbacks",callbacks).put("first",list.getFirstVisiblePosition()).put("visible",list.getChildCount()).put("total",list.getCount()).toString();}
        catch(Exception error){throw new IllegalStateException(error);}
    }
    public void scroll(double target,boolean animated) {
        if(disposed || !Double.isFinite(target))return;
        target=Math.max(0,target);
        double divider=list.getDividerHeight()/density, stride=rowHeight+divider;
        int index=target<spacer+divider?0:1+(int)Math.floor((target-spacer-divider)/stride);
        index=Math.max(0,Math.min(list.getCount()-1,index));
        double start=index==0?0:spacer+divider+(index-1)*stride;
        int top=(int)Math.round((start-target)*density);
        if(animated){list.smoothScrollToPositionFromTop(index,top,300);return;}
        list.setSelectionFromTop(index,top);
        list.post(new Runnable(){public void run(){if(!disposed)update(true);}});
    }
    public void dispose() {
        if(disposed)return;setEnabled(false);disposed=true;
        title.setImportantForAccessibility(titleAccessibility);toolbarTitle.setImportantForAccessibility(toolbarAccessibility);toolbar.setVisibility(toolbarVisibility);
        toolbar.setImportantForAccessibility(toolbarContainerAccessibility);
        header.setImportantForAccessibility(headerAccessibility);
        for(Map.Entry<View,Integer> entry:coveredRows.entrySet())entry.getKey().setImportantForAccessibility(entry.getValue());coveredRows.clear();
        node=null;listener=null;
    }
}
