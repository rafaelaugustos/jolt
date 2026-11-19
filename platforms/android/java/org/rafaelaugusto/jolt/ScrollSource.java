package org.rafaelaugusto.jolt;

import android.os.SystemClock;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewTreeObserver;
import android.widget.ListView;
import java.lang.reflect.Method;

/** Observes without replacing the widget's scroll listener/adapter. No JS callback unless explicitly observed. */
public final class ScrollSource implements ViewTreeObserver.OnScrollChangedListener, View.OnLayoutChangeListener {
    public interface Listener { void changed(); }
    private final ViewGroup source;
    private final LiveSpring node;
    private Listener listener;
    private final boolean horizontal;
    private final double density, rowHeight;
    private final ListView list;
    private Object manager;
    private Method first, find, decoratedStart, decoratedEnd, itemCount;
    private boolean enabled, observing, disposed;
    private ViewTreeObserver observer;
    private double offset, previousTime;
    private long updates, callbacks;
    private boolean profiling;
    private double minimum, maximum;
    private double[] costs;
    private int costCount;
    public void setProfiling(boolean value) { profiling=value;costs=value?new double[256]:null;costCount=0;minimum=maximum=offset; }
    private static int active;
    public static int activeCount() { return active; }
    public ScrollSource(View source, LiveSpring node, boolean horizontal, double rowHeight, Listener listener) {
        if (!(source instanceof ViewGroup)) throw new IllegalArgumentException("Expected a native scroll container");
        this.source=(ViewGroup)source; this.node=node; this.horizontal=horizontal; this.rowHeight=rowHeight; this.listener=listener;
        density=source.getResources().getDisplayMetrics().density;
        list=source instanceof ListView ? (ListView)source : null;
        if (list != null) {
            if (horizontal || rowHeight<=0) throw new IllegalArgumentException("ListView scroll values need vertical fixed-height rows and rowHeight in DIPs");
        } else if (!(source instanceof android.widget.ScrollView) && !(source instanceof android.widget.HorizontalScrollView) && !(source instanceof androidx.core.widget.NestedScrollView)) {
            // CollectionView's RecyclerView dependency is optional. Resolve its linear layout manager once.
            try {
                Class<?> recycler=Class.forName("androidx.recyclerview.widget.RecyclerView");
                if (!recycler.isInstance(source)) throw new IllegalArgumentException("Unsupported scroll container");
                manager=recycler.getMethod("getLayoutManager").invoke(source);
                if (manager==null || !Class.forName("androidx.recyclerview.widget.LinearLayoutManager").isInstance(manager) || rowHeight<=0)
                    throw new IllegalArgumentException("CollectionView needs a linear layout and fixed rowHeight (item stride for x)");
                Class<?> type=manager.getClass();
                if (Class.forName("androidx.recyclerview.widget.GridLayoutManager").isInstance(manager) && (Integer)type.getMethod("getSpanCount").invoke(manager)!=1)
                    throw new IllegalArgumentException("CollectionView scroll values require one span");
                int orientation=(Integer)type.getMethod("getOrientation").invoke(manager);
                if ((orientation==0)!=horizontal || (Boolean)type.getMethod("getReverseLayout").invoke(manager) || (Boolean)type.getMethod("getStackFromEnd").invoke(manager))
                    throw new IllegalArgumentException("Reversed/staggered CollectionView offsets are unsupported");
                first=type.getMethod("findFirstVisibleItemPosition"); find=type.getMethod("findViewByPosition",int.class);
                decoratedStart=type.getMethod(horizontal?"getDecoratedLeft":"getDecoratedTop",View.class);
                decoratedEnd=type.getMethod(horizontal?"getDecoratedRight":"getDecoratedBottom",View.class);
                itemCount=type.getMethod("getItemCount");
            } catch (ReflectiveOperationException error) { throw new IllegalArgumentException("Unsupported CollectionView layout",error); }
        }
        setEnabled(true);
    }
    private double read() {
        if (list!=null) {
            View child=list.getChildAt(0); if(child==null)return 0;
            return list.getFirstVisiblePosition()*(rowHeight+list.getDividerHeight()/density)+(list.getPaddingTop()-child.getTop())/density;
        }
        if (manager!=null) {
            try {
                int index=(Integer)first.invoke(manager); if(index<0)return 0;
                View child=(View)find.invoke(manager,index); if(child==null)return offset;
                boolean rtl=horizontal && source.getLayoutDirection()==View.LAYOUT_DIRECTION_RTL;
                double local=rtl ? source.getWidth()-source.getPaddingRight()-(Integer)decoratedEnd.invoke(manager,child) :
                    (horizontal?source.getPaddingLeft():source.getPaddingTop())-(Integer)decoratedStart.invoke(manager,child);
                double logical=index*rowHeight+local/density;
                // Match ScrollView/UIKit: physical left is zero even when key order starts on the right.
                if(rtl) {
                    double maximum=Math.max(0,(Integer)itemCount.invoke(manager)*rowHeight-(source.getWidth()-source.getPaddingLeft()-source.getPaddingRight())/density);
                    return maximum-logical;
                }
                return logical;
            } catch(ReflectiveOperationException error) { return offset; }
        }
        return (horizontal?source.getScrollX():source.getScrollY())/density;
    }
    public void setEnabled(boolean value) {
        if(disposed || enabled==value)return;
        enabled=value;
        if(value) { observer=source.getViewTreeObserver(); observer.addOnScrollChangedListener(this); source.addOnLayoutChangeListener(this); active++; refresh(); }
        else { if(observer!=null && observer.isAlive())observer.removeOnScrollChangedListener(this); observer=null; source.removeOnLayoutChangeListener(this); active--; node.setDataInput(offset,0); }
    }
    public void setObserving(boolean value) { observing=value; }
    public void refresh() { update(true); }
    @Override public void onScrollChanged() { update(false); }
    @Override public void onLayoutChange(View view,int l,int t,int r,int b,int ol,int ot,int or,int ob) { update(true); }
    private void update(boolean force) {
        if(disposed || !enabled)return;
        long started=profiling&&!force?System.nanoTime():0;
        double next=read(), now=SystemClock.uptimeMillis();
        if(!Double.isFinite(next) || (!force && next==offset))return;
        double velocity=force || previousTime==0 || now<=previousTime || now-previousTime>100 ? 0 : (next-offset)*1000/(now-previousTime);
        offset=next; previousTime=now; updates++; node.setDataInput(offset,velocity);
        minimum=Math.min(minimum,next);maximum=Math.max(maximum,next);
        if(observing && listener!=null) { callbacks++; listener.changed(); }
        if(started!=0 && costCount<costs.length)costs[costCount++]=(System.nanoTime()-started)/1000000.0;
    }
    public String snapshot() {
        StringBuilder samples=new StringBuilder("[");
        for(int i=0;i<costCount;i++){if(i>0)samples.append(',');samples.append(costs[i]);}samples.append(']');
        return "{\"offset\":"+offset+",\"updates\":"+updates+",\"callbacks\":"+callbacks+",\"minimum\":"+minimum+",\"maximum\":"+maximum+",\"producerMs\":"+samples+"}";
    }
    public void dispose() { if(disposed)return; setEnabled(false); disposed=true; listener=null; manager=null; }
}
