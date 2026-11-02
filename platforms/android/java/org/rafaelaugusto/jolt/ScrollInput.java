package org.rafaelaugusto.jolt;

import android.app.Activity;
import android.content.Context;
import android.content.ContextWrapper;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import java.lang.ref.WeakReference;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.WeakHashMap;

/** Scoped native input on existing scroll views. Core's view listeners remain installed. */
final class ScrollInput {
    interface Listener {
        boolean touch(MotionEvent event);
        void cancel();
    }
    private static final WeakHashMap<Window, Router> routers = new WeakHashMap<>();
    private final Router router;
    private final Listener listener;
    private boolean disposed;
    private ScrollInput(Router router, Listener listener) { this.router=router;this.listener=listener; }
    static ScrollInput attach(View source, Listener listener) {
        Context context=source.getContext();
        while(context instanceof ContextWrapper && !(context instanceof Activity)) {
            Context next=((ContextWrapper)context).getBaseContext();
            if(next==context)break;
            context=next;
        }
        if(!(context instanceof Activity))throw new IllegalArgumentException("Native scroll input requires an Activity window");
        Window window=((Activity)context).getWindow();
        Router router=routers.get(window);
        if(router==null){router=new Router(window);routers.put(window,router);}
        if(window.getCallback()!=router.proxy)
            throw new IllegalStateException("Window callback changed; detach and reattach Jolt scroll input");
        router.listeners.add(listener);
        return new ScrollInput(router,listener);
    }
    boolean claim() { return !disposed && router.claim(listener); }
    void dispose() {
        if(disposed)return;disposed=true;
        listener.cancel();
        router.listeners.remove(listener);
        if(router.owner==listener)router.owner=null;
        if(router.listeners.isEmpty()) {
            Window window=router.window.get();
            if(window!=null){if(window.getCallback()==router.proxy)window.setCallback(router.forwarded);routers.remove(window);}
            router.clearEvent();
        }
    }
    static boolean contains(View view, MotionEvent event) {
        if(!view.isShown() || !view.isEnabled())return false;
        android.graphics.Rect rect=new android.graphics.Rect();
        return view.getGlobalVisibleRect(rect) && rect.contains((int)event.getRawX(),(int)event.getRawY());
    }
    static boolean descendant(View view, View parent) {
        for(View current=view;current!=null;current=current.getParent() instanceof View?(View)current.getParent():null)if(current==parent)return true;
        return false;
    }
    static float localY(View view, MotionEvent event) { int[] p=new int[2];view.getLocationOnScreen(p);return event.getRawY()-p[1]; }
    static float localX(View view, MotionEvent event) { int[] p=new int[2];view.getLocationOnScreen(p);return event.getRawX()-p[0]; }
    private static final class Router {
        final WeakReference<Window> window;
        final Window.Callback forwarded, proxy;
        final ArrayList<Listener> listeners=new ArrayList<>();
        Listener owner;
        MotionEvent last;
        boolean cancelled;
        Router(Window window) {
            this.window=new WeakReference<>(window);forwarded=window.getCallback();
            proxy=(Window.Callback)Proxy.newProxyInstance(Window.Callback.class.getClassLoader(),new Class<?>[]{Window.Callback.class},(object,method,args)->{
                if(method.getName().equals("dispatchTouchEvent"))return dispatch((MotionEvent)args[0]);
                try{return method.invoke(forwarded,args);}catch(InvocationTargetException error){throw error.getCause();}
            });
            window.setCallback(proxy);
        }
        void clearEvent(){if(last!=null)last.recycle();last=null;}
        boolean claim(Listener next) {
            if(owner!=null && owner!=next || last==null)return false;
            owner=next;
            if(!cancelled) {
                cancelled=true;
                MotionEvent cancel=MotionEvent.obtain(last);cancel.setAction(MotionEvent.ACTION_CANCEL);
                try{forwarded.dispatchTouchEvent(cancel);}finally{cancel.recycle();}
                for(Listener listener:new ArrayList<>(listeners))if(listener!=next)listener.cancel();
            }
            return true;
        }
        boolean dispatch(MotionEvent event) {
            int action=event.getActionMasked();
            if(action==MotionEvent.ACTION_DOWN){for(Listener listener:new ArrayList<>(listeners))listener.cancel();owner=null;cancelled=false;}
            clearEvent();last=MotionEvent.obtain(event);
            boolean handled=cancelled;
            if(owner!=null){owner.touch(event);handled=true;}
            else for(Listener listener:new ArrayList<>(listeners)) {
                if(!listeners.contains(listener))continue;
                if(listener.touch(event)){claim(listener);handled=true;break;}
            }
            if(!handled)handled=forwarded.dispatchTouchEvent(event);
            if(action==MotionEvent.ACTION_UP || action==MotionEvent.ACTION_CANCEL){owner=null;cancelled=false;clearEvent();}
            return handled;
        }
    }
}
