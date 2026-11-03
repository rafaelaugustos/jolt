"""Real ADB input and optional screen recording on an explicit, dedicated emulator."""
import json, re, subprocess, sys, time, xml.etree.ElementTree as ET
from pathlib import Path
serial, output = sys.argv[1:3]
out = Path(output); out.mkdir(parents=True, exist_ok=True)
def adb(*args): return subprocess.check_output(['adb','-s',serial,*args], text=True)
adb('shell','am','force-stop','org.nativescript.jolt.benchmark')
adb('shell','am','start','-n','org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity','--es','recipe','shader-textures')
time.sleep(2)
adb('shell','uiautomator','dump','/sdcard/jolt-shader-ui.xml')
xml=adb('shell','cat','/sdcard/jolt-shader-ui.xml')
buttons={}
for n in ET.fromstring(xml).iter('node'):
 if n.get('class')=='android.widget.Button':
  x,y,r,b=map(int,re.findall(r'\d+',n.get('bounds')));buttons[n.get('text')]=((x+r)//2,(y+b)//2)
def tap(name,wait=.7):
 adb('shell','input','tap',*[str(v) for v in buttons[name]]);time.sleep(wait)
remote='/sdcard/jolt-shader-inputs.mp4'
record = subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--time-limit','32','--bit-rate','5000000',remote]) if '--record' in sys.argv else None
start=time.monotonic();time.sleep(.8)
tap('Spring merge',1.6);tap('Reverse',1.4);tap('Snapshot',.3)
tap('Native scroll',.4)
for _ in range(5):adb('shell','input','swipe','540','1170','540','1020','500');time.sleep(.15)
time.sleep(.5);tap('Snapshot',.3)
for _ in range(5):adb('shell','input','swipe','540','1020','540','1170','500');time.sleep(.15)
time.sleep(.5)
tap('Scrub 50%',.6);tap('Resize',.9);tap('Resize',.9)
tap('Play mask',.2);tap('Resize',.8);tap('Pause mask',.3);tap('Snapshot',.3);tap('Stop',.8)
if record:
 (out/'clip-seconds.txt').write_text(str(time.monotonic()-start))
 record.wait(timeout=max(5,40-(time.monotonic()-start)))
 subprocess.run(['adb','-s',serial,'pull',remote,str(out/'shader-inputs-liquid-mask-android.mp4')],check=True)
# Positive control and repeated resource turnover are measured outside recording.
tap('JS control',1.5);tap('Snapshot',.3);tap('Reset counters',.3);tap('Stop',.3)
tap('Spring merge',1.5);tap('Scrub 50%',.2)
for i in range(12):tap('Resize',.4)
tap('Snapshot',.3);tap('Stop',.3)
report=adb('shell','cat','/sdcard/Android/data/org.nativescript.jolt.benchmark/files/jolt-shader-textures.json')
(out/'android.json').write_text(json.dumps(json.loads(report),indent=2)+'\n')
print('Saved native input recording/report',flush=True)
