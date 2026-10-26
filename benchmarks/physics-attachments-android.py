"""Real attachment/snap gestures on an assigned Android emulator. Choose English first.
Usage: python3 benchmarks/physics-attachments-android.py SERIAL OUTPUT audit|record
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial,directory,mode=sys.argv[1:]
assert serial.startswith('emulator-') and mode in ['audit','record']
out=Path(directory).resolve();out.mkdir(parents=True,exist_ok=True)
adb=['adb','-s',serial];app='org.nativescript.jolt.benchmark'
def command(*args):
 return subprocess.check_output(adb+list(map(str,args)),text=True,timeout=30).strip()
density=int(re.findall(r'\d+',command('shell','wm','density'))[-1])/160
command('shell','am','force-stop',app)
args=['shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example','physics-attachments']
if mode=='audit':args+=['--es','attachment-audit','true']
command(*args);time.sleep(5)
command('shell','uiautomator','dump','/sdcard/jolt-attachment-ui.xml')
root=ET.fromstring(command('shell','cat','/sdcard/jolt-attachment-ui.xml'))
positions={};rects={}
for node in root.iter('node'):
 for name in [node.get('resource-id'),node.get('content-desc'),node.get('text')]:
  if name:
   a,b,c,d=map(int,re.findall(r'\d+',node.get('bounds')))
   positions[name]=((a+c)//2,(b+d)//2);rects[name]=(a,b,c,d)
   if name.startswith('Back to collection.'):positions['Back to collection']=positions[name]
def tap(name,delay=.5):
 assert name in positions,'Missing '+name
 command('shell','input','tap',*positions[name]);time.sleep(delay)
def drag(start,dx,dy,duration=900):
 x,y=start
 command('shell','input','swipe',x,y,round(x+dx*density),round(y+dy*density),duration);time.sleep(.15)
def snapshot(delay=.4):
 if mode=='audit':tap('attachment-snapshot',delay)
left,top,right,bottom=rects['attachment-board'];dock_y=round(top+(bottom-top)*.78)
left_dock=(round(left+(right-left)*.2),dock_y)
center_dock=(round(left+(right-left)*.5),dock_y)
recorder=None;old=command('shell','settings','get','system','show_touches')
try:
 if mode=='record':
  command('shell','settings','put','system','show_touches',1)
  command('shell','rm','-f','/sdcard/jolt-attachment-record.mp4')
  recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000','/sdcard/jolt-attachment-record.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  time.sleep(.7)
 snapshot()
 drag(positions['attachment-tether'],90,65)
 snapshot(9)
 if mode=='record':time.sleep(2)
 snapshot()
 drag(positions['attachment-magnet'],-85,-45)
 snapshot(1.5)
 if mode=='record':time.sleep(1.5)
 snapshot()
 drag(left_dock,135,-20,260)
 snapshot(1.5)
 if mode=='record':time.sleep(1.5)
 snapshot()
 tap('attachment-anchor',1.5);snapshot()
 if mode=='audit':
  tap('attachment-dock-1',1.5)
  tap('attachment-cancel',0)
  drag(center_dock,-90,-30,4000)
  snapshot();snapshot()
  tap('attachment-pause',1.5);snapshot()
 else:
  tap('attachment-nudge',.15);tap('attachment-pause',.8);tap('attachment-pause',1)
  tap('attachment-dock-1',1)
 tap('attachment-reduce')
 if mode=='audit':
  tap('attachment-nudge');tap('attachment-dock-2');snapshot()
  tap('attachment-reduce',1.5)
  tap('attachment-resize',1.5);snapshot()
  tap('attachment-resize',1.5);snapshot()
  tap('attachment-nudge',.1)
  command('shell','input','keyevent','KEYCODE_HOME');time.sleep(.6)
  command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity');time.sleep(.5)
  snapshot();tap('Back to collection',1)
  data=command('shell','cat',f'/sdcard/Android/data/{app}/files/attachment-audit.json')
  (out/'android.json').write_text(json.dumps(json.loads(data),indent=2)+'\n')
 else:time.sleep(.8)
finally:
 try:
  if recorder:
   command('shell','pkill','-INT','screenrecord');recorder.communicate(timeout=20)
   assert recorder.returncode==0,'screenrecord failed'
   command('pull','/sdcard/jolt-attachment-record.mp4',out/'physics-attachments-android.mp4')
 finally:
  if mode=='record':
   if old=='null':command('shell','settings','delete','system','show_touches')
   else:command('shell','settings','put','system','show_touches',old)
