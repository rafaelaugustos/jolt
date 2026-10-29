package org.rafaelaugusto.jolt;

/** Fixed-step circle-only kernel, kept in parity with JoltCircleMath.h by compiled native tests. */
public final class CircleMath {
    public static final double DT=1.0/240.0, SPEED=1200;
    public static final int SNAP_LIMIT=8;
    public static final class Attachment {
        public boolean enabled;
        public double u,v,length,stiffness,damping;
    }
    public static final class Snap {
        public int count,index,previousIndex;
        public boolean active,previousActive;
        public final double[] u=new double[SNAP_LIMIT],v=new double[SNAP_LIMIT];
        public double stiffness,damping,projection;
    }
    public static final class Body {
        public double x,y,vx,vy,r,m,tx,ty,ax,ay,releaseX,releaseY,releaseVX,releaseVY;
        public boolean released;
        public boolean held,supported;
        public final Attachment attachment=new Attachment(),drag=new Attachment();
        public final Snap snap=new Snap();
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
    private static boolean kinematic(Body b){return b.held&&!b.drag.enabled;}
    private void walls(Body b,boolean impulse){
        double e=restitution;
        if(b.x<=b.r){b.x=b.r;if(b.ax<0)b.supported=true;if(impulse&&!kinematic(b)&&b.vx<0){b.vx=Math.abs(b.vx)<40?0:-b.vx*e;contacts++;}}
        if(b.x>=width-b.r){b.x=width-b.r;if(b.ax>0)b.supported=true;if(impulse&&!kinematic(b)&&b.vx>0){b.vx=Math.abs(b.vx)<40?0:-b.vx*e;contacts++;}}
        if(b.y<=b.r){b.y=b.r;if(b.ay<0)b.supported=true;if(impulse&&!kinematic(b)&&b.vy<0){b.vy=Math.abs(b.vy)<40?0:-b.vy*e;contacts++;}}
        if(b.y>=height-b.r){b.y=height-b.r;if(b.ay>0)b.supported=true;if(impulse&&!kinematic(b)&&b.vy>0){b.vy=Math.abs(b.vy)<40?0:-b.vy*e;contacts++;}}
    }
    public void contacts(boolean impulse,int iterations){
        for(int iteration=0;iteration<iterations;iteration++){
            for(int i=0;i<bodies.length;i++)for(int j=i+1;j<bodies.length;j++){
                Body a=bodies[i],b=bodies[j];
                double dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy),radius=a.r+b.r;
                if(d>radius+.02)continue;
                double nx=d>1e-9?dx/d:1,ny=d>1e-9?dy/d:0;
                double ia=kinematic(a)?0:1/a.m,ib=kinematic(b)?0:1/b.m,total=ia+ib;
                if(total==0)continue;
                double overlap=Math.max(0,radius-d);
                a.x-=nx*overlap*ia/total;a.y-=ny*overlap*ia/total;
                b.x+=nx*overlap*ib/total;b.y+=ny*overlap*ib/total;
                if(nx*a.ax+ny*a.ay>Math.hypot(a.ax,a.ay)*.35)a.supported=true;
                if(-nx*b.ax-ny*b.ay>Math.hypot(b.ax,b.ay)*.35)b.supported=true;
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
    public double snapX(Body b,int index){return clamp(b.snap.u[index]*width,b.r,width-b.r);}
    public double snapY(Body b,int index){return clamp(b.snap.v[index]*height,b.r,height-b.r);}
    public void attach(int index,boolean enabled,double x,double y,double length,double stiffness,double damping){
        Body b=bodies[index];Attachment a=b.attachment;
        a.enabled=enabled;a.u=x/width;a.v=y/height;a.length=length;a.stiffness=stiffness;a.damping=damping;
        b.snap.active=b.snap.previousActive=false;wake();
    }
    public void snapTo(int index,int target){
        Body b=bodies[index];if(b.held||target<0||target>=b.snap.count)return;
        b.snap.active=true;b.snap.index=target;wake();
    }
    public void cancel(int index){
        Body b=bodies[index];if(!b.held)return;
        b.held=false;b.vx=b.vy=0;b.snap.active=b.snap.previousActive;b.snap.index=b.snap.previousIndex;wake();
    }
    private boolean targetClear(int index,double x,double y){
        Body b=bodies[index];
        for(int i=0;i<bodies.length;i++)if(i!=index){Body other=bodies[i];if(Math.hypot(x-other.x,y-other.y)<b.r+other.r+.001)return false;}
        return true;
    }
    public void step(){
        if(sleeping)return;
        double decay=Math.exp(-damping*DT);boolean still=true;
        for(Body b:bodies){
            b.supported=false;b.ax=gx;b.ay=gy;
            if(b.held)still=false;
            if(kinematic(b)){b.vx=(b.tx-b.x)/DT;b.vy=(b.ty-b.y)/DT;still=false;}
            else {
                double damping=0;
                if((b.held&&b.drag.enabled)||b.attachment.enabled||b.snap.active){
                    double x,y,length,stiffness;
                    if(b.held&&b.drag.enabled){
                        x=b.tx;y=b.ty;length=b.drag.length;stiffness=b.drag.stiffness;damping=b.drag.damping;
                    }else if(b.snap.active){
                        x=snapX(b,b.snap.index);y=snapY(b,b.snap.index);length=0;stiffness=b.snap.stiffness;damping=b.snap.damping;b.ax=b.ay=0;
                    }else {
                        x=b.attachment.u*width;y=b.attachment.v*height;length=b.attachment.length;stiffness=b.attachment.stiffness;damping=b.attachment.damping;
                    }
                    double dx=b.x-x,dy=b.y-y,d=Math.hypot(dx,dy);
                    double nx=d>1e-9?dx/d:0,ny=d>1e-9?dy/d:1;
                    double force=stiffness*(d-length)/b.m;
                    b.ax-=force*nx;b.ay-=force*ny;
                }
                double divisor=1+damping*DT/b.m;
                b.vx=(b.vx+b.ax*DT)/divisor*decay;b.vy=(b.vy+b.ay*DT)/divisor*decay;
            }
            limit(b);b.x+=b.vx*DT;b.y+=b.vy*DT;
        }
        contacts(true,8);
        for(int i=0;i<bodies.length;i++){
            Body b=bodies[i];limit(b);double speed=Math.hypot(b.vx,b.vy),force=Math.hypot(b.ax,b.ay);boolean equilibrium=force<=1e-9;
            if(b.snap.active){
                double x=snapX(b,b.snap.index),y=snapY(b,b.snap.index);equilibrium=Math.hypot(b.x-x,b.y-y)<=.25;
                if(equilibrium&&speed<=4&&targetClear(i,x,y)){b.x=x;b.y=y;b.vx=b.vy=0;}
            }else if(b.attachment.enabled){
                double dx=b.x-b.attachment.u*width,dy=b.y-b.attachment.v*height,gravity=Math.hypot(gx,gy);
                // Residual force alone hides tangential drift in a stretched spring.
                if(gravity>1e-9){
                    double length=b.attachment.length+b.m*gravity/b.attachment.stiffness;
                    equilibrium=Math.hypot(dx-length*gx/gravity,dy-length*gy/gravity)<=.25;
                }else equilibrium=Math.abs(Math.hypot(dx,dy)-b.attachment.length)<=.25;
            }
            if(speed>4||(!b.supported&&!equilibrium))still=false;
        }
        steps++;quiet=still?quiet+DT:0;
        if(quiet>=.35){sleeping=true;for(Body b:bodies)b.vx=b.vy=0;}
    }
    public void drag(int index,double x,double y){
        Body b=bodies[index];if(!b.held){b.snap.previousActive=b.snap.active;b.snap.previousIndex=b.snap.index;b.snap.active=false;}
        b.held=true;double inset=b.drag.enabled?0:b.r;b.tx=clamp(x,inset,width-inset);b.ty=clamp(y,inset,height-inset);wake();
    }
    public void release(int index,double vx,double vy){
        Body b=bodies[index];
        // Preserve integrated body momentum rather than substituting pointer velocity.
        if(!b.held||!b.drag.enabled){b.vx=vx;b.vy=vy;}
        b.held=false;limit(b);
        b.released=true;b.releaseX=b.x;b.releaseY=b.y;b.releaseVX=b.vx;b.releaseVY=b.vy;
        if(b.snap.count>0){
            double x=b.x+b.vx*b.snap.projection,y=b.y+b.vy*b.snap.projection,best=Double.POSITIVE_INFINITY;
            for(int i=0;i<b.snap.count;i++){double distance=Math.hypot(x-snapX(b,i),y-snapY(b,i));if(distance<best){best=distance;b.snap.index=i;}}
            b.snap.active=true;
        }
        wake();
    }
    public void resize(double w,double h){
        for(int i=0;i<bodies.length;i++){cancel(i);Body b=bodies[i];b.x*=w/width;b.y*=h/height;b.vx=b.vy=0;}
        width=w;height=h;contacts(false,64);wake();
    }
}
