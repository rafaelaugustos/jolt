"""Real ADB taps on an assigned emulator. Native rendering uses explicitly labelled test inputs.
Usage: python3 benchmarks/device-sensors-android.py SERIAL OUTPUT audit|record [en|pt-BR]
Select the preview language before recording.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
serial, directory, mode, *locale = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use an assigned emulator'
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]; app = 'org.nativescript.jolt.benchmark'
report = f'/sdcard/Android/data/{app}/files/sensors-audit.json'
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()
def rect(name):
    command('shell', 'rm', '-f', '/sdcard/jolt-sensors-ui.xml')
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-sensors-ui.xml')
    root=ET.fromstring(command('shell', 'cat', '/sdcard/jolt-sensors-ui.xml'))
    for node in root.iter('node'):
        if name in [node.get('resource-id'), node.get('content-desc'), node.get('text')]:
            return tuple(map(int,re.findall(r'\d+',node.get('bounds'))))
    raise AssertionError('Missing '+name)
positions={}
def tap(name, delay=.6):
    if name not in positions: positions[name]=rect(name)
    a,b,c,d=positions[name]
    command('shell','input','tap',(a+c)//2,(b+d)//2);time.sleep(delay)
def data(): return json.loads(command('shell','cat',report))
command('shell','am','force-stop',app)
args=['shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example','device-sensors']
if mode=='audit': args+=['--es','sensors-audit','true']
command(*args);time.sleep(6)
# Real emulator sensor noise keeps accessibility busy. Pause once at the reviewed
# control position, resolve IDs while still, then resume before the capture/probe.
size=command('shell','wm','size')
assert '1080x2400' in size, 'This capture layout was reviewed at 1080x2400.'
command('shell','input','tap',900,1975 if mode=='audit' else 2080);time.sleep(.8)
# Resolve static control coordinates before playback so UIAutomator does not slow the scene.
for name in ['sensor-preview','sensor-pause','sensor-center','sensor-reduce']+(['sensor-snapshot','sensor-busy'] if mode=='audit' else []): positions[name]=rect(name)
tap('sensor-pause')
recorder=None
old=command('shell','settings','get','system','show_touches')
try:
    if mode=='record':
        command('shell','settings','put','system','show_touches','1')
        command('shell','rm','-f','/sdcard/jolt-sensors-record.mp4')
        recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000','/sdcard/jolt-sensors-record.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        time.sleep(1)
    else: tap('sensor-snapshot')
    tap('sensor-preview',2)
    if mode=='audit': tap('sensor-snapshot');tap('sensor-busy',2.2)
    tap('sensor-pause',1)
    if mode=='audit': tap('sensor-snapshot')
    tap('sensor-pause',1.5)
    if mode=='audit': tap('sensor-snapshot')
    tap('sensor-center',1)
    tap('sensor-reduce',1)
    if mode=='audit': tap('sensor-snapshot')
    tap('sensor-reduce',1)
    if mode=='audit':
        tap('sensor-preview',1)
        command('shell','input','keyevent','KEYCODE_HOME');time.sleep(1)
        command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity');time.sleep(1)
        tap('sensor-snapshot')
        command('shell','input','tap',110,210);time.sleep(1)
        (out/'android.json').write_text(json.dumps(data(),indent=2)+'\n')
    else: time.sleep(1)
finally:
    try:
        if recorder:
            command('shell','pkill','-INT','screenrecord');recorder.communicate(timeout=20)
            assert recorder.returncode==0,'screenrecord failed'
            suffix='-pt' if locale and locale[0]=='pt-BR' else ''
            command('pull','/sdcard/jolt-sensors-record.mp4',out/('device-sensors-android'+suffix+'.mp4'))
    finally:
        if mode=='record':
            if old=='null': command('shell','settings','delete','system','show_touches')
            else:command('shell','settings','put','system','show_touches',old)
