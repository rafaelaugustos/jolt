#ifndef JOLT_CIRCLE_MATH_H
#define JOLT_CIRCLE_MATH_H
#include <math.h>
#include <stdbool.h>
#include <string.h>
#define JOLT_CIRCLE_LIMIT 16
#define JOLT_CIRCLE_SNAP_LIMIT 8
#define JOLT_CIRCLE_DT (1.0/240.0)
#define JOLT_CIRCLE_SPEED 1200.0
typedef struct {
    bool enabled;
    double u,v,length,stiffness,damping;
} JoltCircleAttachment;
typedef struct {
    int count,index,previousIndex;
    bool active,previousActive;
    double u[JOLT_CIRCLE_SNAP_LIMIT],v[JOLT_CIRCLE_SNAP_LIMIT];
    double stiffness,damping,projection;
} JoltCircleSnap;
typedef struct {
    double x,y,vx,vy,r,m,tx,ty,ax,ay,releaseX,releaseY,releaseVX,releaseVY;
    bool released;
    bool held,supported;
    JoltCircleAttachment attachment,drag;
    JoltCircleSnap snap;
} JoltCircle;
typedef struct {
    JoltCircle bodies[JOLT_CIRCLE_LIMIT]; int count;
    double width,height,gx,gy,restitution,damping,quiet;
    unsigned long steps,contacts; bool sleeping;
} JoltCircleState;
static inline double JoltCircleClamp(double v,double lo,double hi){return fmax(lo,fmin(hi,v));}
static inline void JoltCircleLimitVelocity(JoltCircle *b){double speed=hypot(b->vx,b->vy);if(speed>JOLT_CIRCLE_SPEED){b->vx*=JOLT_CIRCLE_SPEED/speed;b->vy*=JOLT_CIRCLE_SPEED/speed;}}
static inline void JoltCircleWake(JoltCircleState *w){w->sleeping=false;w->quiet=0;}
static inline bool JoltCircleFits(JoltCircleState *w,double width,double height){
    double area=0;
    if(!isfinite(width)||!isfinite(height)||width<=0||height<=0)return false;
    for(int i=0;i<w->count;i++){JoltCircle *b=&w->bodies[i];if(2*b->r>fmin(width,height))return false;area+=3.141592653589793*b->r*b->r;}
    return area<=width*height*.4;
}
static inline bool JoltCircleKinematic(JoltCircle *b){return b->held&&!b->drag.enabled;}
static inline void JoltCircleWalls(JoltCircleState *w,JoltCircle *b,bool impulse){
    double e=w->restitution;
    if(b->x<=b->r){b->x=b->r;if(b->ax<0)b->supported=true;if(impulse&&!JoltCircleKinematic(b)&&b->vx<0){b->vx=fabs(b->vx)<40?0:-b->vx*e;w->contacts++;}}
    if(b->x>=w->width-b->r){b->x=w->width-b->r;if(b->ax>0)b->supported=true;if(impulse&&!JoltCircleKinematic(b)&&b->vx>0){b->vx=fabs(b->vx)<40?0:-b->vx*e;w->contacts++;}}
    if(b->y<=b->r){b->y=b->r;if(b->ay<0)b->supported=true;if(impulse&&!JoltCircleKinematic(b)&&b->vy<0){b->vy=fabs(b->vy)<40?0:-b->vy*e;w->contacts++;}}
    if(b->y>=w->height-b->r){b->y=w->height-b->r;if(b->ay>0)b->supported=true;if(impulse&&!JoltCircleKinematic(b)&&b->vy>0){b->vy=fabs(b->vy)<40?0:-b->vy*e;w->contacts++;}}
}
static inline void JoltCircleContacts(JoltCircleState *w,bool impulse,int iterations){
    for(int iteration=0;iteration<iterations;iteration++){
        for(int i=0;i<w->count;i++)for(int j=i+1;j<w->count;j++){
            JoltCircle *a=&w->bodies[i],*b=&w->bodies[j];
            double dx=b->x-a->x,dy=b->y-a->y,d=hypot(dx,dy),radius=a->r+b->r;
            if(d>radius+.02)continue;
            double nx=d>1e-9?dx/d:1,ny=d>1e-9?dy/d:0;
            double ia=JoltCircleKinematic(a)?0:1/a->m,ib=JoltCircleKinematic(b)?0:1/b->m,total=ia+ib;
            if(total==0)continue;
            double overlap=fmax(0,radius-d);
            a->x-=nx*overlap*ia/total;a->y-=ny*overlap*ia/total;
            b->x+=nx*overlap*ib/total;b->y+=ny*overlap*ib/total;
            if(nx*a->ax+ny*a->ay>hypot(a->ax,a->ay)*.35)a->supported=true;
            if(-nx*b->ax-ny*b->ay>hypot(b->ax,b->ay)*.35)b->supported=true;
            double closing=(b->vx-a->vx)*nx+(b->vy-a->vy)*ny;
            if(impulse&&closing<0){
                double e=closing < -40?w->restitution:0,jolt=-(1+e)*closing/total;
                a->vx-=nx*jolt*ia;a->vy-=ny*jolt*ia;b->vx+=nx*jolt*ib;b->vy+=ny*jolt*ib;
                if(closing < -.1)w->contacts++;
            }
        }
        for(int i=0;i<w->count;i++)JoltCircleWalls(w,&w->bodies[i],impulse);
    }
}
// Targets use normalized coordinates so repeated resizes do not accumulate clamping drift.
static inline double JoltCircleSnapX(JoltCircleState *w,JoltCircle *b,int index) {
    return JoltCircleClamp(b->snap.u[index]*w->width,b->r,w->width-b->r);
}
static inline double JoltCircleSnapY(JoltCircleState *w,JoltCircle *b,int index) {
    return JoltCircleClamp(b->snap.v[index]*w->height,b->r,w->height-b->r);
}
static inline void JoltCircleAttach(JoltCircleState *w,int index,bool enabled,double x,double y,double length,double stiffness,double damping) {
    JoltCircle *b=&w->bodies[index];
    b->attachment=(JoltCircleAttachment){enabled,x/w->width,y/w->height,length,stiffness,damping};
    b->snap.active=b->snap.previousActive=false;JoltCircleWake(w);
}
static inline void JoltCircleSnapTo(JoltCircleState *w,int index,int target) {
    JoltCircle *b=&w->bodies[index];
    if(b->held||target<0||target>=b->snap.count)return;
    b->snap.active=true;b->snap.index=target;JoltCircleWake(w);
}
static inline void JoltCircleCancel(JoltCircleState *w,int index) {
    JoltCircle *b=&w->bodies[index];
    if(!b->held)return;
    b->held=false;b->vx=b->vy=0;
    b->snap.active=b->snap.previousActive;b->snap.index=b->snap.previousIndex;JoltCircleWake(w);
}
static inline bool JoltCircleTargetClear(JoltCircleState *w,int index,double x,double y) {
    JoltCircle *b=&w->bodies[index];
    for(int i=0;i<w->count;i++)if(i!=index){
        JoltCircle *other=&w->bodies[i];
        if(hypot(x-other->x,y-other->y)<b->r+other->r+.001)return false;
    }
    return true;
}
static inline void JoltCircleStep(JoltCircleState *w) {
    if(w->sleeping)return;
    const double dt=JOLT_CIRCLE_DT,decay=exp(-w->damping*dt);
    bool quiet=true;
    for(int i=0;i<w->count;i++){
        JoltCircle *b=&w->bodies[i];b->supported=false;b->ax=w->gx;b->ay=w->gy;
        if(b->held)quiet=false;
        if(JoltCircleKinematic(b)){b->vx=(b->tx-b->x)/dt;b->vy=(b->ty-b->y)/dt;quiet=false;}
        else {
            double damping=0;
            if((b->held&&b->drag.enabled)||b->attachment.enabled||b->snap.active){
                double x,y,length,stiffness;
                if(b->held&&b->drag.enabled){
                    x=b->tx;y=b->ty;length=b->drag.length;stiffness=b->drag.stiffness;damping=b->drag.damping;
                }else if(b->snap.active){
                    x=JoltCircleSnapX(w,b,b->snap.index);y=JoltCircleSnapY(w,b,b->snap.index);
                    length=0;stiffness=b->snap.stiffness;damping=b->snap.damping;
                    // A selected snap is a positional controller; gravity must not offset its dock.
                    b->ax=b->ay=0;
                }else {
                    x=b->attachment.u*w->width;y=b->attachment.v*w->height;
                    length=b->attachment.length;stiffness=b->attachment.stiffness;damping=b->attachment.damping;
                }
                double dx=b->x-x,dy=b->y-y,d=hypot(dx,dy);
                double nx=d>1e-9?dx/d:0,ny=d>1e-9?dy/d:1;
                double force=stiffness*(d-length)/b->m;
                b->ax-=force*nx;b->ay-=force*ny;
            }
            // Implicit viscous damping remains bounded for the supported mass/damping range.
            double divisor=1+damping*dt/b->m;
            b->vx=(b->vx+b->ax*dt)/divisor*decay;
            b->vy=(b->vy+b->ay*dt)/divisor*decay;
        }
        JoltCircleLimitVelocity(b);b->x+=b->vx*dt;b->y+=b->vy*dt;
    }
    JoltCircleContacts(w,true,8);
    for(int i=0;i<w->count;i++){
        JoltCircle *b=&w->bodies[i];JoltCircleLimitVelocity(b);
        double speed=hypot(b->vx,b->vy),force=hypot(b->ax,b->ay);
        bool equilibrium=force<=1e-9;
        if(b->snap.active){
            double x=JoltCircleSnapX(w,b,b->snap.index),y=JoltCircleSnapY(w,b,b->snap.index);
            equilibrium=hypot(b->x-x,b->y-y)<=.25;
            if(equilibrium&&speed<=4&&JoltCircleTargetClear(w,i,x,y)){b->x=x;b->y=y;b->vx=b->vy=0;}
        }else if(b->attachment.enabled){
            double dx=b->x-b->attachment.u*w->width,dy=b->y-b->attachment.v*w->height;
            double gravity=hypot(w->gx,w->gy);
            // Residual force alone hides tangential drift in a stretched spring.
            if(gravity>1e-9){
                double length=b->attachment.length+b->m*gravity/b->attachment.stiffness;
                equilibrium=hypot(dx-length*w->gx/gravity,dy-length*w->gy/gravity)<=.25;
            }else equilibrium=fabs(hypot(dx,dy)-b->attachment.length)<=.25;
        }
        if(speed>4||(!b->supported&&!equilibrium))quiet=false;
    }
    w->steps++;w->quiet=quiet?w->quiet+dt:0;
    if(w->quiet>=.35){w->sleeping=true;for(int i=0;i<w->count;i++)w->bodies[i].vx=w->bodies[i].vy=0;}
}
static inline void JoltCircleDrag(JoltCircleState *w,int index,double x,double y) {
    JoltCircle *b=&w->bodies[index];
    if(!b->held){b->snap.previousActive=b->snap.active;b->snap.previousIndex=b->snap.index;b->snap.active=false;}
    b->held=true;double inset=b->drag.enabled?0:b->r;
    b->tx=JoltCircleClamp(x,inset,w->width-inset);b->ty=JoltCircleClamp(y,inset,w->height-inset);JoltCircleWake(w);
}
static inline void JoltCircleRelease(JoltCircleState *w,int index,double vx,double vy) {
    JoltCircle *b=&w->bodies[index];
    // A spring-held body releases its integrated momentum, never the pointer velocity.
    if(!b->held||!b->drag.enabled){b->vx=vx;b->vy=vy;}
    b->held=false;JoltCircleLimitVelocity(b);
    b->released=true;b->releaseX=b->x;b->releaseY=b->y;b->releaseVX=b->vx;b->releaseVY=b->vy;
    if(b->snap.count){
        double x=b->x+b->vx*b->snap.projection,y=b->y+b->vy*b->snap.projection,best=INFINITY;
        for(int i=0;i<b->snap.count;i++){
            double distance=hypot(x-JoltCircleSnapX(w,b,i),y-JoltCircleSnapY(w,b,i));
            // Strict comparison makes equal-distance ties choose the first configured point.
            if(distance<best){best=distance;b->snap.index=i;}
        }
        b->snap.active=true;
    }
    JoltCircleWake(w);
}
static inline void JoltCircleResize(JoltCircleState *w,double width,double height) {
    for(int i=0;i<w->count;i++){
        JoltCircleCancel(w,i);JoltCircle *b=&w->bodies[i];b->x*=width/w->width;b->y*=height/w->height;b->vx=b->vy=0;
    }
    w->width=width;w->height=height;JoltCircleContacts(w,false,64);JoltCircleWake(w);
}
#endif
