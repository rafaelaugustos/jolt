#ifndef JOLT_CIRCLE_MATH_H
#define JOLT_CIRCLE_MATH_H
#include <math.h>
#include <stdbool.h>
#include <string.h>
#define JOLT_CIRCLE_LIMIT 16
#define JOLT_CIRCLE_DT (1.0/240.0)
#define JOLT_CIRCLE_SPEED 1200.0
typedef struct { double x,y,vx,vy,r,m,tx,ty; bool held,supported; } JoltCircle;
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
static inline void JoltCircleWalls(JoltCircleState *w,JoltCircle *b,bool impulse){
    double e=w->restitution;
    if(b->x<=b->r){b->x=b->r;if(w->gx<0)b->supported=true;if(impulse&&!b->held&&b->vx<0){b->vx=fabs(b->vx)<40?0:-b->vx*e;w->contacts++;}}
    if(b->x>=w->width-b->r){b->x=w->width-b->r;if(w->gx>0)b->supported=true;if(impulse&&!b->held&&b->vx>0){b->vx=fabs(b->vx)<40?0:-b->vx*e;w->contacts++;}}
    if(b->y<=b->r){b->y=b->r;if(w->gy<0)b->supported=true;if(impulse&&!b->held&&b->vy<0){b->vy=fabs(b->vy)<40?0:-b->vy*e;w->contacts++;}}
    if(b->y>=w->height-b->r){b->y=w->height-b->r;if(w->gy>0)b->supported=true;if(impulse&&!b->held&&b->vy>0){b->vy=fabs(b->vy)<40?0:-b->vy*e;w->contacts++;}}
}
static inline void JoltCircleContacts(JoltCircleState *w,bool impulse,int iterations){
    double gravity=hypot(w->gx,w->gy);
    for(int iteration=0;iteration<iterations;iteration++){
        for(int i=0;i<w->count;i++)for(int j=i+1;j<w->count;j++){
            JoltCircle *a=&w->bodies[i],*b=&w->bodies[j];
            double dx=b->x-a->x,dy=b->y-a->y,d=hypot(dx,dy),radius=a->r+b->r;
            if(d>radius+.02)continue;
            double nx=d>1e-9?dx/d:1,ny=d>1e-9?dy/d:0;
            double ia=a->held?0:1/a->m,ib=b->held?0:1/b->m,total=ia+ib;
            if(total==0)continue;
            double overlap=fmax(0,radius-d);
            a->x-=nx*overlap*ia/total;a->y-=ny*overlap*ia/total;
            b->x+=nx*overlap*ib/total;b->y+=ny*overlap*ib/total;
            double support=nx*w->gx+ny*w->gy;
            if(support>gravity*.35)a->supported=true;
            if(support<-gravity*.35)b->supported=true;
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
static inline void JoltCircleStep(JoltCircleState *w){
    if(w->sleeping)return;
    const double dt=JOLT_CIRCLE_DT,decay=exp(-w->damping*dt);
    bool quiet=true;double gravity=hypot(w->gx,w->gy);
    for(int i=0;i<w->count;i++){
        JoltCircle *b=&w->bodies[i];b->supported=false;
        if(b->held){b->vx=(b->tx-b->x)/dt;b->vy=(b->ty-b->y)/dt;quiet=false;}
        else {b->vx=(b->vx+w->gx*dt)*decay;b->vy=(b->vy+w->gy*dt)*decay;}
        JoltCircleLimitVelocity(b);b->x+=b->vx*dt;b->y+=b->vy*dt;
    }
    JoltCircleContacts(w,true,8);
    for(int i=0;i<w->count;i++){
        JoltCircle *b=&w->bodies[i];JoltCircleLimitVelocity(b);
        if(hypot(b->vx,b->vy)>4||(!b->supported&&gravity>1e-9))quiet=false;
    }
    w->steps++;w->quiet=quiet?w->quiet+dt:0;
    if(w->quiet>=.35){w->sleeping=true;for(int i=0;i<w->count;i++)w->bodies[i].vx=w->bodies[i].vy=0;}
}
static inline void JoltCircleDrag(JoltCircleState *w,int index,double x,double y){
    JoltCircle *b=&w->bodies[index];b->held=true;
    b->tx=JoltCircleClamp(x,b->r,w->width-b->r);b->ty=JoltCircleClamp(y,b->r,w->height-b->r);JoltCircleWake(w);
}
static inline void JoltCircleRelease(JoltCircleState *w,int index,double vx,double vy){
    JoltCircle *b=&w->bodies[index];b->held=false;b->vx=vx;b->vy=vy;JoltCircleLimitVelocity(b);JoltCircleWake(w);
}
static inline void JoltCircleResize(JoltCircleState *w,double width,double height){
    for(int i=0;i<w->count;i++){
        JoltCircle *b=&w->bodies[i];b->held=false;b->x*=width/w->width;b->y*=height/w->height;
        b->vx=b->vy=0;
    }
    w->width=width;w->height=height;JoltCircleContacts(w,false,64);JoltCircleWake(w);
}
#endif
