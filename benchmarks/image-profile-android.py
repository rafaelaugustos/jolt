"""Cold/ warm native image callbacks and textures on one dedicated Android emulator.
Usage: python3 benchmarks/image-profile-android.py SERIAL OUTPUT
No screen recording; reviewed image-effect recordings are separate evidence.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
serial, destination = sys.argv[1:]
out=Path(destination);out.mkdir(parents=True,exist_ok=True)
app='org.nativescript.jolt.benchmark';remote=f'/sdcard/Android/data/{app}/files/jolt-image-profile.json'
def adb(*args):return subprocess.check_output(['adb','-s',serial,*map(str,args)],text=True,timeout=30)
assert adb('shell','getprop','ro.kernel.qemu').strip()=='1'
adb('shell','am','force-stop',app);adb('shell','rm','-f',remote)
adb('shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','recipe','image-profile')
time.sleep(3)
adb('shell','uiautomator','dump','/sdcard/jolt-image-profile-ui.xml')
tree=ET.fromstring(adb('shell','cat','/sdcard/jolt-image-profile-ui.xml'))
buttons={}
for node in tree.iter('node'):
 for name in ['One ripple','Two dissolves','Cancel effects']:
  if name in [node.get('text'),node.get('content-desc')]:
   a,b,c,d=map(int,re.findall(r'\d+',node.get('bounds')));buttons[name]=((a+c)//2,(b+d)//2)
assert len(buttons)==3,buttons
(out/'memory-before.txt').write_text(adb('shell','dumpsys','meminfo',app))
def report():return json.loads(adb('shell','cat',remote))
for run in range(1,13):
 name='One ripple' if run<=6 else 'Two dissolves'
 adb('shell','input','tap',*buttons[name]);time.sleep(2)
 data=report();finished=next(e for e in reversed(data['events']) if e['name']=='finished')
 assert finished['run']==run,finished
 assert all(e['backend']=='agsl' and len(e['frameIntervalsMs'])>10 and e['textureBytes']==0 for e in finished['effects']),finished
 print('PASS',name,run,flush=True)
adb('shell','input','tap',*buttons['Two dissolves']);time.sleep(.2)
adb('shell','input','tap',*buttons['Cancel effects']);time.sleep(.5)
(out/'profile.json').write_text(json.dumps(report(),indent=2)+'\n')
(out/'memory-after.txt').write_text(adb('shell','dumpsys','meminfo',app))
(out/'device.txt').write_text(adb('shell','getprop'))
assert all(e['textureBytes']==0 for event in report()['events'] if event['name']=='cancelled' for e in event['effects'])
print('PASS native preparation, bounded draw intervals and texture release',flush=True)
