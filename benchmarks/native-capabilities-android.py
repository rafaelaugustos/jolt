"""Record actual ADB input on the normal demo. Pass an explicit dedicated emulator."""
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial,directory=sys.argv[1:3]
selected=set(sys.argv[3:])
assert serial.startswith('emulator-'), 'Use a dedicated emulator, not a physical-device default'
out=Path(directory);out.mkdir(parents=True,exist_ok=True)
app='org.nativescript.jolt.benchmark'
def adb(*args):return subprocess.check_output(['adb','-s',serial,*args],text=True,timeout=30)
def rect(name):
    adb('shell','uiautomator','dump','/sdcard/jolt-capabilities.xml')
    tree=ET.fromstring(adb('shell','cat','/sdcard/jolt-capabilities.xml'))
    for node in tree.iter('node'):
        if name in [node.get('text'),node.get('content-desc'),node.get('resource-id')]:
            return list(map(int,re.findall(r'\d+',node.get('bounds'))))
    raise AssertionError(f'Missing native control {name}')
def tap(name,delay=.6):
    x,y,r,b=rect(name);adb('shell','input','tap',str((x+r)//2),str((y+b)//2));time.sleep(delay)
def fast_tap(bounds,delay):
    x,y,r,b=bounds;adb('shell','input','tap',str((x+r)//2),str((y+b)//2));time.sleep(delay)
def drag(name,dx,dy):
    x,y,r,b=rect(name);x=(x+r)//2;y=(y+b)//2
    adb('shell','input','swipe',str(x),str(y),str(x+dx),str(y+dy),'650');time.sleep(1)
original=adb('shell','settings','get','system','show_touches').strip()
recorder=None
try:
    adb('shell','settings','put','system','show_touches','1')
    for mode,name in enumerate(['live-paint','seekable-scene','flex-size','body-springs']):
        if selected and name not in selected:continue
        adb('shell','am','force-stop',app)
        adb('shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','native-capabilities',str(mode))
        time.sleep(3)
        if mode==3:rect('native-body-ready')
        action=rect('native-action');pause=rect('native-pause')
        remote='/sdcard/jolt-'+name+'.mp4'
        recorder=subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--bit-rate','4000000',remote])
        time.sleep(1)
        if mode in [0,2]:
            fast_tap(action,.2);fast_tap(action,.4);fast_tap(action,.15);fast_tap(pause,1)
            fast_tap(pause,1);fast_tap(action,1.3)
        elif mode==1:
            x,y,r,b=rect('native-scrub');y=(y+b)//2;x+=42;r-=42
            # Keep swipe starts away from Android's system-back edge regions.
            current=int(x+(r-x)*.15)
            adb('shell','input','tap',str(current),str(y))
            for fraction in [.75,.9,.2]:
                target=int(x+(r-x)*fraction)
                adb('shell','input','swipe',str(current),str(y),str(target),str(y),'650')
                current=target;time.sleep(.7)
            fast_tap(pause,2.2);fast_tap(action,.4);fast_tap(pause,.7);fast_tap(pause,2)
        else:
            drag('linked-body-0',0,-150);drag('linked-body-2',-80,140)
            fast_tap(action,.2);fast_tap(pause,1);fast_tap(pause,2)
        time.sleep(1)
        rect('native-capabilities-lab')
        adb('shell','pkill','-INT','screenrecord');recorder.wait(timeout=20);recorder=None
        adb('pull',remote,str(out/(name+'-android.mp4')))
        print('Saved '+name,flush=True)
        if mode==3:tap('native-tab-0')
finally:
    if recorder is not None:
        adb('shell','pkill','-INT','screenrecord');recorder.wait(timeout=20)
    if original=='null':adb('shell','settings','delete','system','show_touches')
    else:adb('shell','settings','put','system','show_touches',original)
