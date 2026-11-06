"""Check local shape geometry and press lifecycle on an installed Android demo."""
import argparse
import json
import re
import subprocess
import time
from pathlib import Path
import xml.etree.ElementTree as ET
p=argparse.ArgumentParser();p.add_argument('serial');p.add_argument('output',type=Path);p.add_argument('--port',default='5037');a=p.parse_args();a.output.mkdir(parents=True,exist_ok=True)
adb=['adb','-P',a.port,'-s',a.serial];app='org.nativescript.jolt.benchmark';component=app+'/com.tns.NativeScriptActivity'
def command(*parts):return subprocess.check_output(adb+list(parts),text=True,timeout=30)
def read():return json.loads(command('shell','cat','/sdcard/Android/data/'+app+'/files/portable-lab.json'))
def buttons():
 command('shell','uiautomator','dump','/sdcard/jolt-portable-regressions.xml')
 root=ET.fromstring(command('shell','cat','/sdcard/jolt-portable-regressions.xml'));result={}
 for node in root.iter('node'):
  key=node.get('resource-id','')
  if key.startswith('portable-'):
   l,t,r,b=map(int,re.findall(r'\d+',node.get('bounds','')))
   if b>t and r>l:result[key]=(str((l+r)//2),str((t+b)//2))
 return result
def tap(key,controls):command('shell','input','tap',*controls['portable-'+key])
command('shell','am','start','-S','-n',component,'--es','portable-lab','shape','--es','portable-audit','true','--es','portable-probe','true')
for _ in range(30):
 time.sleep(1)
 try:data=read()
 except (subprocess.CalledProcessError,json.JSONDecodeError):continue
 if any(e['name']=='probe-complete' for e in data['events']):break
else:raise AssertionError('shape probe did not complete')
assert not any(e['name']=='error' for e in data['events'])
assert [e['geometry']['actual']['width'] for e in data['events'] if e['name']=='transformed-layout']==[240,220,240],data
(a.output/'shape-android-candidate.json').write_text(json.dumps(data,indent=2)+'\n')
command('shell','am','start','-S','-n',component,'--es','portable-lab','press','--es','portable-audit','true');time.sleep(3)
for variant in ['plain','direct','scoped','repeated']:
 controls=buttons();tap(variant,controls);time.sleep(.3)
 for _ in range(2):
  tap('button',controls);command('shell','input','keyevent','3');time.sleep(.3);command('shell','am','start','-n',component,'--es','portable-lab','press','--es','portable-audit','true');time.sleep(.6)
 tap('remount',controls);time.sleep(.5);tap('button',controls);tap('snapshot',controls)
 data=read();snap=data['events'][-1];assert snap['name']=='snapshot' and snap['taps']==3,(variant,snap)
 assert not any(e['name']=='tap' and e['suspended'] for e in data['events']),data
(a.output/'press-android-candidate.json').write_text(json.dumps(data,indent=2)+'\n')
print('Android: local shape geometry and one action per tap across four press variants passed.')
