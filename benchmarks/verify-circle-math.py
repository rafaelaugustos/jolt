#!/usr/bin/env python3
"""Compile the actual iOS/Android circle kernels and check physics + port parity.
Requires clang and a JDK; no simulator/emulator and no third-party Python packages.
"""
import json
import math
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
C = r'''
#include <stdio.h>
#include "JoltCircleMath.h"
int main(void) {
 JoltCircleState w={0};
 scanf("%d%lf%lf%lf%lf%lf%lf", &w.count,&w.width,&w.height,&w.gx,&w.gy,&w.restitution,&w.damping);
 for(int i=0;i<w.count;i++){JoltCircle *b=&w.bodies[i];scanf("%lf%lf%lf%lf%lf%lf",&b->x,&b->y,&b->vx,&b->vy,&b->r,&b->m);}
 char op;int n,index,active;double x,y,length,stiffness,damping,projection;
 while(scanf(" %c",&op)==1){
  if(op=='s'){scanf("%d",&n);while(n-->0)JoltCircleStep(&w);}
  if(op=='d'){scanf("%d%lf%lf",&index,&x,&y);JoltCircleDrag(&w,index,x,y);}
  if(op=='r'){scanf("%d%lf%lf",&index,&x,&y);JoltCircleRelease(&w,index,x,y);}
  if(op=='a'){scanf("%d%d%lf%lf%lf%lf%lf",&index,&active,&x,&y,&length,&stiffness,&damping);JoltCircleAttach(&w,index,active,x,y,length,stiffness,damping);}
  if(op=='p'){scanf("%d%d%lf%lf%lf",&index,&n,&stiffness,&damping,&projection);JoltCircleSnap *s=&w.bodies[index].snap;s->count=n;s->stiffness=stiffness;s->damping=damping;s->projection=projection;for(int j=0;j<n;j++){scanf("%lf%lf",&x,&y);s->u[j]=x/w.width;s->v[j]=y/w.height;}}
  if(op=='t'){scanf("%d%d",&index,&n);JoltCircleSnapTo(&w,index,n);}
  if(op=='c'){scanf("%d",&index);JoltCircleCancel(&w,index);}
  if(op=='z'){scanf("%lf%lf",&x,&y);JoltCircleResize(&w,x,y);}
 }
 printf("%lu %lu %d\n",w.steps,w.contacts,w.sleeping);
 for(int i=0;i<w.count;i++){JoltCircle b=w.bodies[i];printf("%.12g %.12g %.12g %.12g %d\n",b.x,b.y,b.vx,b.vy,b.held);}
}
'''
JAVA = r'''
import java.util.Scanner;
import java.util.Locale;
import org.rafaelaugusto.jolt.CircleMath;
public class CircleProbe {
 public static void main(String[] args){
  Locale.setDefault(Locale.US);Scanner s=new Scanner(System.in);int count=s.nextInt();CircleMath w=new CircleMath(count);
  w.width=s.nextDouble();w.height=s.nextDouble();w.gx=s.nextDouble();w.gy=s.nextDouble();w.restitution=s.nextDouble();w.damping=s.nextDouble();
  for(CircleMath.Body b:w.bodies){b.x=s.nextDouble();b.y=s.nextDouble();b.vx=s.nextDouble();b.vy=s.nextDouble();b.r=s.nextDouble();b.m=s.nextDouble();}
  while(s.hasNext())switch(s.next()){
   case "s":{int n=s.nextInt();while(n-->0)w.step();break;}
   case "d":w.drag(s.nextInt(),s.nextDouble(),s.nextDouble());break;
   case "r":w.release(s.nextInt(),s.nextDouble(),s.nextDouble());break;
   case "a":{int i=s.nextInt();boolean enabled=s.nextInt()!=0;w.attach(i,enabled,s.nextDouble(),s.nextDouble(),s.nextDouble(),s.nextDouble(),s.nextDouble());break;}
   case "p":{int i=s.nextInt(),n=s.nextInt();CircleMath.Snap snap=w.bodies[i].snap;snap.count=n;snap.stiffness=s.nextDouble();snap.damping=s.nextDouble();snap.projection=s.nextDouble();for(int j=0;j<n;j++){snap.u[j]=s.nextDouble()/w.width;snap.v[j]=s.nextDouble()/w.height;}break;}
   case "t":w.snapTo(s.nextInt(),s.nextInt());break;
   case "c":w.cancel(s.nextInt());break;
   case "z":w.resize(s.nextDouble(),s.nextDouble());break;
  }
  System.out.printf("%d %d %d%n",w.steps,w.contacts,w.sleeping?1:0);
  for(CircleMath.Body b:w.bodies)System.out.printf("%.12g %.12g %.12g %.12g %d%n",b.x,b.y,b.vx,b.vy,b.held?1:0);
 }
}
'''

def run(cmd, **kw):
    return subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=60, **kw).stdout

def fixture(bodies, ops='s 120', width=600, height=600, gx=0, gy=0, e=1, drag=0):
    return '\n'.join([' '.join(map(str, [len(bodies), width, height, gx, gy, e, drag])), *[' '.join(map(str,b)) for b in bodies], ops])

def close(a,b,tol=1e-6):
    assert abs(a-b)<=tol, (a,b)

def bounded(rows,w,h,r=20):
    for x,y,vx,vy,_ in rows:
        assert r-1e-6<=x<=w-r+1e-6 and r-1e-6<=y<=h-r+1e-6, rows
        assert math.hypot(vx,vy)<=1200+1e-6, rows
    for i,a in enumerate(rows):
        for b in rows[i+1:]:
            assert math.hypot(a[0]-b[0],a[1]-b[1])>=2*r-.1, rows

with tempfile.TemporaryDirectory(prefix='jolt-circle-math-') as tmp:
    p=Path(tmp); (p/'probe.c').write_text(C); (p/'CircleProbe.java').write_text(JAVA)
    jdk=Path(os.environ.get('JAVA_HOME','/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home'))/'bin'
    java=str(jdk/'java') if (jdk/'java').exists() else 'java'
    javac=str(jdk/'javac') if (jdk/'javac').exists() else 'javac'
    run(['clang','-std=c11','-Wall','-Wextra','-Werror','-O2','-I',str(ROOT/'platforms/ios/src'),str(p/'probe.c'),'-lm','-o',str(p/'probe')])
    run([javac,'-d',str(p),str(ROOT/'platforms/android/java/org/rafaelaugusto/jolt/CircleMath.java'),str(p/'CircleProbe.java')])
    results={}
    def check(name,data):
        c=run([str(p/'probe')],input=data); j=run([java,'-cp',str(p),'CircleProbe'],input=data)
        a=[[float(v) for v in line.split()] for line in c.splitlines()];b=[[float(v) for v in line.split()] for line in j.splitlines()]
        assert len(a)==len(b)
        for ar,br in zip(a,b):
            for av,bv in zip(ar,br):
                if name!='maximum bodies':close(av,bv,1e-5)
        if name=='maximum bodies':bounded(a[1:],600,600);bounded(b[1:],600,600)
        results[name]={'steps':a[0][0],'contacts':a[0][1],'sleeping':bool(a[0][2]),'bodies':a[1:]}
        return a[0],a[1:]
    head=fixture([[220,300,100,0,20,1],[280,300,-100,0,20,1]],'s 48')
    _,b=check('elastic equal masses',head);close(b[0][2],-100);close(b[1][2],100)
    _,b=check('unequal masses',fixture([[220,300,200,0,20,1],[280,300,0,0,20,3]],'s 48'))
    close(b[0][2],-100);close(b[1][2],100);close(b[0][2]+3*b[1][2],200);close(b[0][2]**2+3*b[1][2]**2,40000)
    _,b=check('inelastic',fixture([[220,300,100,0,20,1],[280,300,-100,0,20,1]],'s 48',e=.5));close(b[0][2],-50);close(b[1][2],50)
    for gx,gy,axis,pos in [(750,0,0,580),(-750,0,0,20),(0,750,1,580),(0,-750,1,20)]:
        s,b=check(f'wall sleep {gx},{gy}',fixture([[300,300,0,0,20,1]],'s 7200',gx=gx,gy=gy,e=.6,drag=.5));assert s[2]==1;close(b[0][axis],pos)
    s,b=check('resting pile',fixture([[290,200,0,0,20,1],[310,120,0,0,20,1],[300,40,0,0,20,1]],'s 14400',gy=750,e=.6,drag=1.5));assert s[2]==1;bounded(b,600,600)
    _,b=check('drag pushes contact',fixture([[100,300,0,0,20,1],[160,300,0,0,20,1]],'d 0 200 300\ns 48'));assert b[1][0]>220;bounded(b,600,600)
    _,b=check('release speed cap',fixture([[100,300,0,0,20,1]],'d 0 200 300\ns 24\nr 0 3000 -4000\ns 1'));close(math.hypot(b[0][2],b[0][3]),1200);assert b[0][4]==0
    _,b=check('resize and cancel hold',fixture([[100,300,0,0,20,1],[200,300,0,0,20,1]],'d 0 100 300\nz 300 300'));bounded(b,300,300);assert b[0][4]==0
    s,b=check('maximum bodies',fixture([[70+110*(i%4),70+110*(i//4),(-1)**i*900,(-1)**(i//2)*700,20,1] for i in range(16)],'s 2400',gy=750,e=.65,drag=1));bounded(b,600,600);assert s[1]>0
    spring=fixture([[100,300,0,0,20,1]],'a 0 1 200 300 0 180 24\ns 2400')
    state,b=check('point attachment returns and sleeps',spring);assert state[2]==1;close(b[0][0],200,.25)
    state,b=check('gravity stretches the attachment',fixture([[300,250,0,0,20,2]],'a 0 1 300 100 80 150 24\ns 4800',gy=750));assert state[2]==1;close(b[0][1],190,.25)
    state,b=check('hanging spring finishes tangential return',fixture([[258,182,0,0,28,1]],'a 0 1 168 40.88 72 180 14\ns 4800',width=336,height=292,gy=750,drag=.6));assert state[2]==1;close(b[0][0],168,.25);close(b[0][1],40.88+72+750/180,.25)
    _,b=check('attachment retarget preserves velocity',fixture([[100,300,250,-50,20,1]],'a 0 1 200 300 0 180 24'));close(b[0][2],250);close(b[0][3],-50)
    _,b=check('held body suspends spring',fixture([[100,300,0,0,20,1]],'a 0 1 100 300 0 180 24\nd 0 300 100\ns 120'));close(b[0][0],300);close(b[0][1],100);assert b[0][4]==1
    state,b=check('release returns to attachment',fixture([[100,300,0,0,20,1]],'a 0 1 100 300 0 180 24\nd 0 300 100\ns 120\nr 0 500 0\ns 2400'));assert state[2]==1;close(b[0][0],100,.25);close(b[0][1],300,.25)
    points='p 0 2 180 24 0.2 200 300 400 300\n'
    state,b=check('velocity projects snap choice',fixture([[310,300,0,0,20,1]],points+'r 0 -600 0\ns 2400'));assert state[2]==1;close(b[0][0],200)
    _,b=check('nearest snap without velocity',fixture([[310,300,0,0,20,1]],points+'r 0 0 0\ns 2400'));close(b[0][0],400)
    _,b=check('snap ties prefer first point',fixture([[300,300,0,0,20,1]],points+'r 0 0 0\ns 2400'));close(b[0][0],200)
    _,b=check('snap keeps release momentum',fixture([[310,300,0,0,20,1]],points+'r 0 -600 25'));close(b[0][2],-600);close(b[0][3],25)
    state,b=check('snap has no gravity offset',fixture([[100,300,0,0,20,1]],'p 0 1 180 24 0.12 200 100\nt 0 0\ns 2400',gy=750));assert state[2]==1;close(b[0][0],200);close(b[0][1],100)
    _,b=check('cancel restores previous snap',fixture([[200,300,0,0,20,1]],points+'t 0 0\nd 0 400 300\ns 120\nc 0\ns 2400'));close(b[0][0],200)
    _,b=check('snap resize has no cumulative clamp drift',fixture([[100,300,0,0,20,1]],'p 0 1 180 24 0.12 20 300\nt 0 0\nz 120 300\ns 2400\nz 600 600\ns 2400'));close(b[0][0],20);close(b[0][1],300)
    state,b=check('weak attachment cannot sleep far from anchor',fixture([[100,300,0,0,20,100]],'a 0 1 200 300 0 1 0\ns 240'));assert state[2]==0 and b[0][0]>100
    _,b=check('spring collides with occupied dock',fixture([[100,300,0,0,20,1],[200,300,0,0,20,1]],'a 1 1 200 300 0 1000 40\np 0 1 180 24 0.12 200 300\nt 0 0\ns 2400'));bounded(b,600,600);assert b[0][0]<190
    _,b=check('maximum stiffness minimum mass stays bounded',fixture([[50,300,0,0,20,.1]],'a 0 1 550 300 0 1000 120\ns 2400'));bounded(b,600,600)
    # The same analytical collision oracle must reject a build with pair impulses disabled.
    header=(ROOT/'platforms/ios/src/JoltCircleMath.h').read_text().replace('if(impulse&&closing<0)','if(false&&closing<0)')
    (p/'JoltCircleMath.h').write_text(header)
    run(['clang','-std=c11','-O2','-I',str(p),str(p/'probe.c'),'-lm','-o',str(p/'negative')])
    negative=run([str(p/'negative')],input=head).splitlines()[1].split()
    assert abs(float(negative[2])+100)>10, 'Negative control unexpectedly passed'
    # Prove the spring oracle observes real force integration rather than just end-state bookkeeping.
    header=(ROOT/'platforms/ios/src/JoltCircleMath.h').read_text().replace('b->ax-=force*nx;b->ay-=force*ny;', 'b->ax-=0*nx;b->ay-=0*ny;')
    (p/'JoltCircleMath.h').write_text(header)
    run(['clang','-std=c11','-O2','-I',str(p),str(p/'probe.c'),'-lm','-o',str(p/'negative-spring')])
    negative=run([str(p/'negative-spring')],input=spring).splitlines()[1].split()
    assert abs(float(negative[0])-200)>10, 'Missing-spring negative control unexpectedly passed'
    print(json.dumps({'passed':len(results),'ports':['C (iOS)','Java (Android)'],'negativeControl':'rejected missing pair impulses and missing spring forces','results':results},indent=2))
