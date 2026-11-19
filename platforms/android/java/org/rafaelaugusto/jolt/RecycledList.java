package org.rafaelaugusto.jolt;

import android.view.View;
import android.view.ViewGroup;
import android.widget.ListView;
import java.lang.reflect.Method;

/** Native geometry port shared by list adapters; RecyclerView remains an optional dependency. */
final class RecycledList {
    final ViewGroup view;
    private final ListView core;
    private final Object manager;
    private final Method childAtPoint, childPosition, find, itemCount;
    RecycledList(ViewGroup view) {
        this.view=view;core=view instanceof ListView?(ListView)view:null;
        if(core!=null){manager=null;childAtPoint=childPosition=find=itemCount=null;return;}
        manager=linearManager(view,false);
        try {
            Class<?> recycler=Class.forName("androidx.recyclerview.widget.RecyclerView");
            childAtPoint=recycler.getMethod("findChildViewUnder",float.class,float.class);
            childPosition=recycler.getMethod("getChildAdapterPosition",View.class);
            find=manager.getClass().getMethod("findViewByPosition",int.class);
            itemCount=manager.getClass().getMethod("getItemCount");
        } catch(ReflectiveOperationException error){throw new IllegalArgumentException("Unsupported CollectionView API",error);}
    }
    static Object linearManager(View source,boolean horizontal) {
        try {
            Class<?> recycler=Class.forName("androidx.recyclerview.widget.RecyclerView");
            if(!recycler.isInstance(source))throw new IllegalArgumentException("Expected a RecyclerView");
            Object manager=recycler.getMethod("getLayoutManager").invoke(source);
            if(manager==null || !Class.forName("androidx.recyclerview.widget.LinearLayoutManager").isInstance(manager))
                throw new IllegalArgumentException("CollectionView requires a linear layout");
            Class<?> type=manager.getClass();
            if(Class.forName("androidx.recyclerview.widget.GridLayoutManager").isInstance(manager) && (Integer)type.getMethod("getSpanCount").invoke(manager)!=1)
                throw new IllegalArgumentException("CollectionView requires one span");
            if(((Integer)type.getMethod("getOrientation").invoke(manager)==0)!=horizontal ||
                (Boolean)type.getMethod("getReverseLayout").invoke(manager) || (Boolean)type.getMethod("getStackFromEnd").invoke(manager))
                throw new IllegalArgumentException("CollectionView axis must match; reverse/stack-from-end layouts are unsupported");
            return manager;
        } catch(ReflectiveOperationException error){throw new IllegalArgumentException("Unsupported CollectionView layout",error);}
    }
    private Object invoke(Method method,Object target,Object...args) {
        try{return method.invoke(target,args);}catch(ReflectiveOperationException error){throw new IllegalStateException("CollectionView geometry changed",error);}
    }
    int count(){return core!=null?core.getCount():(Integer)invoke(itemCount,manager);}
    int index(View child){return core!=null?core.getPositionForView(child):(Integer)invoke(childPosition,view,child);}
    View at(int index){return core!=null?core.getChildAt(index-core.getFirstVisiblePosition()):(View)invoke(find,manager,index);}
    int point(float x,float y){
        if(core!=null)return core.pointToPosition((int)x,(int)y);
        View child=(View)invoke(childAtPoint,view,x,y);return child==null?-1:index(child);
    }
    int divider(){return core!=null?core.getDividerHeight():0;}
    int stride(View child){
        if(core!=null)return child.getHeight()+core.getDividerHeight();
        try {
            int height=(Integer)manager.getClass().getMethod("getDecoratedMeasuredHeight",View.class).invoke(manager,child);
            ViewGroup.LayoutParams params=child.getLayoutParams();
            if(params instanceof ViewGroup.MarginLayoutParams)height+=((ViewGroup.MarginLayoutParams)params).topMargin+((ViewGroup.MarginLayoutParams)params).bottomMargin;
            return height;
        }catch(ReflectiveOperationException error){throw new IllegalStateException(error);}
    }
    void scroll(int pixels){if(core!=null)core.scrollListBy(pixels);else view.scrollBy(0,pixels);}
    View cell(View descendant){
        View current=descendant;
        while(current!=null && current.getParent()!=view)current=current.getParent() instanceof View?(View)current.getParent():null;
        return current;
    }
}
