#!/usr/bin/env python3
"""Compile the actual iOS/Android circle kernels and check physics + port parity.
Requires clang and a JDK; no simulator/emulator and no third-party Python packages.
"""
import json
import math
import os
from pathlib import Path
import shutil
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
 char op;int n,index;double x,y;
 while(scanf(" %c",&op)==1){
  if(op=='s'){scanf("%d",&n);while(n-->0)JoltCircleStep(&w);}
  if(op=='d'){scanf("%d%lf%lf",&index,&x,&y);JoltCircleDrag(&w,index,x,y);}
  if(op=='r'){scanf("%d%lf%lf",&index,&x,&y);JoltCircleRelease(&w,index,x,y);}
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
    # The same analytical collision oracle must reject a build with pair impulses disabled.
    header=(ROOT/'platforms/ios/src/JoltCircleMath.h').read_text().replace('if(impulse&&closing<0)','if(false&&closing<0)')
    (p/'JoltCircleMath.h').write_text(header)
    run(['clang','-std=c11','-O2','-I',str(p),str(p/'probe.c'),'-lm','-o',str(p/'negative')])
    negative=run([str(p/'negative')],input=head).splitlines()[1].split()
    assert abs(float(negative[2])+100)>10, 'Negative control unexpectedly passed'
    print(json.dumps({'passed':len(results),'ports':['C (iOS)','Java (Android)'],'negativeControl':'rejected missing pair impulses','results':results},indent=2))
