package org.rafaelaugusto.jolt;
/** Pure math shared by hardware and explicit test-input playback. Hamilton quaternions xyzw. */
public final class SensorMath {
    private SensorMath() {}
    public static boolean normalize(double[] q) {
        double length=0;
        for(double v:q) { if(!Double.isFinite(v)) return false; length+=v*v; }
        length=Math.sqrt(length);
        if(!Double.isFinite(length)||length<1e-8) return false;
        for(int i=0;i<4;i++) q[i]/=length;
        return true;
    }
    public static double[] multiply(double[] a,double[] b) {
        return new double[]{a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0], a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]};
    }
    public static double[] inverse(double[] q) {return new double[]{-q[0],-q[1],-q[2],q[3]};}
    public static double[] vector(double[] v,double degrees) {
        double a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
        return new double[]{c*v[0]+s*v[1],-s*v[0]+c*v[1],v[2]};
    }
    public static double[] rotation(double[] q,double degrees,double[] previous) {
        double[] v=vector(q,degrees), r={v[0],v[1],v[2],q[3]};
        double dot=0;for(int i=0;i<4;i++)dot+=r[i]*previous[i];
        if(dot<0)for(int i=0;i<4;i++)r[i]=-r[i];
        double x=r[0],y=r[1],z=r[2],w=r[3];
        return new double[]{Math.atan2(2*(w*x+y*z),1-2*(x*x+y*y)),Math.asin(Math.max(-1,Math.min(1,2*(w*y-z*x)))),Math.atan2(2*(w*z+x*y),1-2*(y*y+z*z)),x,y,z,w};
    }
}
