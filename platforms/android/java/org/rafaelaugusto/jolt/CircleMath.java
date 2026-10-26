package org.rafaelaugusto.jolt;

/** Fixed-step circle-only kernel, kept in parity with JoltCircleMath.h by compiled native tests. */
public final class CircleMath {
    public static final double DT=1.0/240.0, SPEED=1200;
    public static final class Body {
        public double x,y,vx,vy,r,m,tx,ty;
        public boolean held,supported;
    }
    public final Body[] bodies;
    public double width,height,gx,gy,restitution,damping,quiet;
    public long steps,contacts;
    public boolean sleeping;
    public CircleMath(int count){bodies=new Body[count];for(int i=0;i<count;i++)bodies[i]=new Body();}
    public static double clamp(double v,double lo,double hi){return Math.max(lo,Math.min(hi,v));}
    public static void limit(Body b){double speed=Math.hypot(b.vx,b.vy);if(speed>SPEED){b.vx*=SPEED/speed;b.vy*=SPEED/speed;}}
    public void wake(){sleeping=false;quiet=0;}
    public boolean fits(double width,double height){
        double area=0;
        if(!Double.isFinite(width)||!Double.isFinite(height)||width<=0||height<=0)return false;
        for(Body b:bodies){if(2*b.r>Math.min(width,height))return false;area+=Math.PI*b.r*b.r;}
        return area<=width*height*.4;
    }
    private void walls(Body b,boolean impulse){
        double e=restitution;
        if(b.x<=b.r){b.x=b.r;if(gx<0)b.supported=true;if(impulse&&!b.held&&b.vx<0){b.vx=Math.abs(b.vx)<40?0:-b.vx*e;contacts++;}}
        if(b.x>=width-b.r){b.x=width-b.r;if(gx>0)b.supported=true;if(impulse&&!b.held&&b.vx>0){b.vx=Math.abs(b.vx)<40?0:-b.vx*e;contacts++;}}
        if(b.y<=b.r){b.y=b.r;if(gy<0)b.supported=true;if(impulse&&!b.held&&b.vy<0){b.vy=Math.abs(b.vy)<40?0:-b.vy*e;contacts++;}}
        if(b.y>=height-b.r){b.y=height-b.r;if(gy>0)b.supported=true;if(impulse&&!b.held&&b.vy>0){b.vy=Math.abs(b.vy)<40?0:-b.vy*e;contacts++;}}
    }
    public void contacts(boolean impulse,int iterations){
        double gravity=Math.hypot(gx,gy);
        for(int iteration=0;iteration<iterations;iteration++){
            for(int i=0;i<bodies.length;i++)for(int j=i+1;j<bodies.length;j++){
                Body a=bodies[i],b=bodies[j];
                double dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),radius=a.r+b.r;
                if(d>radius+.02)continue;
                double nx=d>1e-9?dx/d:1,ny=d>1e-9?dy/d:0;
                double ia=a.held?0:1/a.m,ib=b.held?0:1/b.m,total=ia+ib;
                if(total==0)continue;
                double overlap=Math.max(0,radius-d);
                a.x-=nx*overlap*ia/total;a.y-=ny*overlap*ia/total;
                b.x+=nx*overlap*ib/total;b.y+=ny*overlap*ib/total;
                double support=nx*gx+ny*gy;
                if(support>gravity*.35)a.supported=true;
                if(support<-gravity*.35)b.supported=true;
                double closing=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
                if(impulse&&closing<0){
                    double e=closing < -40?restitution:0,jolt=-(1+e)*closing/total;
                    a.vx-=nx*jolt*ia;a.vy-=ny*jolt*ia;b.vx+=nx*jolt*ib;b.vy+=ny*jolt*ib;
                    if(closing < -.1)contacts++;
                }
            }
            for(Body b:bodies)walls(b,impulse);
        }
    }
    public void step(){
        if(sleeping)return;
        double decay=Math.exp(-damping*DT),gravity=Math.hypot(gx,gy);
        boolean still=true;
        for(Body b:bodies){
            b.supported=false;
            if(b.held){b.vx=(b.tx-b.x)/DT;b.vy=(b.ty-b.y)/DT;still=false;}
            else {b.vx=(b.vx+gx*DT)*decay;b.vy=(b.vy+gy*DT)*decay;}
            limit(b);b.x+=b.vx*DT;b.y+=b.vy*DT;
        }
        contacts(true,8);
        for(Body b:bodies){limit(b);if(Math.hypot(b.vx,b.vy)>4||(!b.supported&&gravity>1e-9))still=false;}
        steps++;quiet=still?quiet+DT:0;
        if(quiet>=.35){sleeping=true;for(Body b:bodies)b.vx=b.vy=0;}
    }
    public void drag(int index,double x,double y){
        Body b=bodies[index];b.held=true;b.tx=clamp(x,b.r,width-b.r);b.ty=clamp(y,b.r,height-b.r);wake();
    }
    public void release(int index,double vx,double vy){Body b=bodies[index];b.held=false;b.vx=vx;b.vy=vy;limit(b);wake();}
    public void resize(double w,double h){
        for(Body b:bodies){b.held=false;b.x*=w/width;b.y*=h/height;b.vx=b.vy=0;}
        width=w;height=h;contacts(false,64);wake();
    }
}
