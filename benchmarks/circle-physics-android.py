"""Real native touches on an explicitly assigned emulator. Choose English first.
Usage: python3 benchmarks/circle-physics-android.py SERIAL OUTPUT audit|record
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
command('shell','am','force-stop',app)
args=['shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example','circle-physics']
if mode=='audit':args+=['--es','circle-audit','true']
command(*args);time.sleep(7)
command('shell','uiautomator','dump','/sdcard/jolt-circle-ui.xml')
root=ET.fromstring(command('shell','cat','/sdcard/jolt-circle-ui.xml'))
positions={}
for node in root.iter('node'):
 for name in [node.get('resource-id'),node.get('content-desc'),node.get('text')]:
  if name:
   a,b,c,d=map(int,re.findall(r'\d+',node.get('bounds')))
   positions[name]=((a+c)//2,(b+d)//2)
   if name.startswith('Back to collection.'):positions['Back to collection']=positions[name]
def tap(name,delay=.5):
 assert name in positions,'Missing '+name
 command('shell','input','tap',*positions[name]);time.sleep(delay)
def fling(name,dx,dy):
 x,y=positions[name]
 command('shell','input','swipe',x,y,x+dx,y+dy,260);time.sleep(.2)
recorder=None;old=command('shell','settings','get','system','show_touches')
try:
 if mode=='record':
  command('shell','settings','put','system','show_touches',1)
  command('shell','rm','-f','/sdcard/jolt-circle-record.mp4')
  recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000','/sdcard/jolt-circle-record.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
  time.sleep(.7)
 else:tap('circle-snapshot')
 fling('circle-03',-180,-420)
 if mode=='audit':tap('circle-snapshot',.1)
 else:time.sleep(1.2)
 tap('circle-scatter',.2);tap('circle-pause',.6)
 if mode=='audit':tap('circle-snapshot');tap('circle-snapshot')
 tap('circle-pause',1)
 if mode=='audit':tap('circle-snapshot')
 tap('circle-reset',4)
 if mode=='record':fling('circle-01',200,-420);time.sleep(1.5)
 tap('circle-reduce');tap('circle-scatter')
 if mode=='audit':tap('circle-snapshot')
 if mode=='audit':
  tap('circle-reduce');tap('circle-resize');tap('circle-snapshot');tap('circle-resize');tap('circle-reset',.2)
  command('shell','input','keyevent','KEYCODE_HOME');time.sleep(.6)
  command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity');time.sleep(.5)
  tap('circle-snapshot');tap('Back to collection',1)
  data=command('shell','cat',f'/sdcard/Android/data/{app}/files/circle-audit.json')
  (out/'android.json').write_text(json.dumps(json.loads(data),indent=2)+'\n')
 else:time.sleep(.8)
finally:
 try:
  if recorder:
   command('shell','pkill','-INT','screenrecord');recorder.communicate(timeout=20)
   assert recorder.returncode==0,'screenrecord failed'
   command('pull','/sdcard/jolt-circle-record.mp4',out/'circle-physics-android.mp4')
 finally:
  if mode=='record':
   if old=='null':command('shell','settings','delete','system','show_touches')
   else:command('shell','settings','put','system','show_touches',old)
