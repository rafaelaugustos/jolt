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
    private Method first, find;
    private boolean enabled, observing, disposed;
    private ViewTreeObserver observer;
    private double offset, previousTime;
    private long updates, callbacks;
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
                if (manager==null || !Class.forName("androidx.recyclerview.widget.LinearLayoutManager").isInstance(manager) || Class.forName("androidx.recyclerview.widget.GridLayoutManager").isInstance(manager) || rowHeight<=0)
                    throw new IllegalArgumentException("CollectionView needs a linear layout and fixed rowHeight (item stride for x)");
                Class<?> type=manager.getClass();
                int orientation=(Integer)type.getMethod("getOrientation").invoke(manager);
                if ((orientation==0)!=horizontal || (Boolean)type.getMethod("getReverseLayout").invoke(manager) || (Boolean)type.getMethod("getStackFromEnd").invoke(manager))
                    throw new IllegalArgumentException("Reversed/staggered CollectionView offsets are unsupported");
                first=type.getMethod("findFirstVisibleItemPosition"); find=type.getMethod("findViewByPosition",int.class);
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
                double local=horizontal ? source.getLayoutDirection()==View.LAYOUT_DIRECTION_RTL ? source.getWidth()-source.getPaddingRight()-child.getRight() : source.getPaddingLeft()-child.getLeft() : source.getPaddingTop()-child.getTop();
                return index*rowHeight+local/density;
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
        double next=read(), now=SystemClock.uptimeMillis();
        if(!Double.isFinite(next) || (!force && next==offset))return;
        double velocity=force || previousTime==0 || now<=previousTime || now-previousTime>100 ? 0 : (next-offset)*1000/(now-previousTime);
        offset=next; previousTime=now; updates++; node.setDataInput(offset,velocity);
        if(observing && listener!=null) { callbacks++; listener.changed(); }
    }
    public String snapshot() { return "{\"offset\":"+offset+",\"updates\":"+updates+",\"callbacks\":"+callbacks+"}"; }
    public void dispose() { if(disposed)return; setEnabled(false); disposed=true; listener=null; manager=null; }
}
