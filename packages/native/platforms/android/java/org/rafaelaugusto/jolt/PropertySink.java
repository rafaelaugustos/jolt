package org.rafaelaugusto.jolt;

import java.lang.ref.WeakReference;
import java.lang.reflect.Method;

/** Implement in compiled Java/Kotlin. Property writes and reads run on Android's UI thread. */
public abstract class PropertySink {
    protected final WeakReference<Object> target;
    private final int dimensions;
    protected PropertySink(Object target, int dimensions) { this.target=new WeakReference<>(target); this.dimensions=dimensions; }
    public final int getDimensions() { return dimensions; }
    public boolean isAlive() { return target.get()!=null; }
    public final boolean isCompiled() {
        return !java.lang.reflect.Proxy.isProxyClass(getClass()) && !getClass().getName().startsWith("com.tns.gen.");
    }
    public abstract double[] read();
    public abstract void write(double[] values);
    public void dispose() { target.clear(); }

    /** Numeric JavaBean property, with cached reflection and no JS setter. */
    public static PropertySink scalar(Object target, String getter, String setter) {
        return new Scalar(target, getter, setter);
    }
    private static final class Scalar extends PropertySink {
        private final Method getter, setter;
        private final boolean useFloat;
        Scalar(Object target, String get, String set) {
            super(target,1);
            try {
                getter=target.getClass().getMethod(get);
                Class<?> type=getter.getReturnType();
                if (type!=float.class && type!=double.class) throw new IllegalArgumentException("Scalar properties must return float or double");
                setter=target.getClass().getMethod(set,type); useFloat=type==float.class;
            } catch (ReflectiveOperationException e) { throw new IllegalArgumentException("Unsupported numeric native property",e); }
        }
        public double[] read() {
            Object object=target.get(); if(object==null) return new double[]{0};
            try { return new double[]{((Number)getter.invoke(object)).doubleValue()}; }
            catch (ReflectiveOperationException e) { throw new IllegalStateException(e); }
        }
        public void write(double[] values) {
            Object object=target.get(); if(object==null) return;
            try {
                if(useFloat) setter.invoke(object, (float)values[0]); else setter.invoke(object,values[0]);
            } catch (ReflectiveOperationException e) { throw new IllegalStateException(e); }
        }
    }
}
