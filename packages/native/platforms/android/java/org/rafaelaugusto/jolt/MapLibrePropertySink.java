package org.rafaelaugusto.jolt;

import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.Method;

/** Optional MapLibre integration: cached reflection avoids a core dependency on the SDK. */
public final class MapLibrePropertySink extends PropertySink {
    private final boolean camera;
    private final Constructor<?> coordinate, builder;
    private final Method read, write, build, targetMethod, zoom, tilt, bearing, cameraUpdate;
    private final Method latitude, longitude;
    private final Field cameraTarget, cameraZoom, cameraTilt, cameraBearing;
    public MapLibrePropertySink(Object target, boolean camera) {
        super(target,camera?5:2); this.camera=camera;
        try {
            Class<?> latLng=Class.forName("org.maplibre.android.geometry.LatLng");
            coordinate=latLng.getConstructor(double.class,double.class);
            latitude=latLng.getMethod("getLatitude"); longitude=latLng.getMethod("getLongitude");
            if(camera) {
                Class<?> position=Class.forName("org.maplibre.android.camera.CameraPosition");
                Class<?> b=Class.forName("org.maplibre.android.camera.CameraPosition$Builder");
                Class<?> update=Class.forName("org.maplibre.android.camera.CameraUpdate");
                builder=b.getConstructor(); build=b.getMethod("build");
                targetMethod=b.getMethod("target",latLng); zoom=b.getMethod("zoom",double.class);
                tilt=b.getMethod("tilt",double.class); bearing=b.getMethod("bearing",double.class);
                cameraUpdate=Class.forName("org.maplibre.android.camera.CameraUpdateFactory").getMethod("newCameraPosition",position);
                read=target.getClass().getMethod("getCameraPosition"); write=target.getClass().getMethod("moveCamera",update);
                cameraTarget=position.getField("target"); cameraZoom=position.getField("zoom");
                cameraTilt=position.getField("tilt"); cameraBearing=position.getField("bearing");
            } else {
                read=target.getClass().getMethod("getPosition"); write=target.getClass().getMethod("setPosition",latLng);
                builder=null; build=targetMethod=zoom=tilt=bearing=cameraUpdate=null;
                cameraTarget=cameraZoom=cameraTilt=cameraBearing=null;
            }
        } catch(ReflectiveOperationException e) { throw new IllegalArgumentException("MapLibre adapter needs a compatible MapLibreMap or Marker",e); }
    }
    public double[] read() {
        Object object=target.get(); if(object==null) return new double[getDimensions()];
        try {
            Object value=read.invoke(object), p=camera?cameraTarget.get(value):value;
            double lat=((Number)latitude.invoke(p)).doubleValue(), lon=((Number)longitude.invoke(p)).doubleValue();
            return camera?new double[]{lat,lon,cameraZoom.getDouble(value),cameraTilt.getDouble(value),cameraBearing.getDouble(value)}:new double[]{lat,lon};
        } catch(ReflectiveOperationException e) { throw new IllegalStateException(e); }
    }
    public void write(double[] values) {
        Object object=target.get(); if(object==null) return;
        try {
            double lat=Math.max(-85.05112878,Math.min(85.05112878,values[0]));
            double lon=((values[1]+180)%360+360)%360-180;
            Object p=coordinate.newInstance(lat,lon);
            if(!camera) write.invoke(object,p);
            else {
                Object b=builder.newInstance(); targetMethod.invoke(b,p);
                zoom.invoke(b,Math.max(0,Math.min(24,values[2]))); tilt.invoke(b,Math.max(0,Math.min(60,values[3])));
                bearing.invoke(b,values[4]); write.invoke(object,cameraUpdate.invoke(null,build.invoke(b)));
            }
        } catch(ReflectiveOperationException e) { throw new IllegalStateException(e); }
    }
}
