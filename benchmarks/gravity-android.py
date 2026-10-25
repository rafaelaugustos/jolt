"""Record/audit gravity with real ADB input on an explicitly assigned emulator.
Usage: python3 benchmarks/gravity-android.py SERIAL OUTPUT audit|record
Choose English in the preview before recording.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory, mode = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use an assigned emulator'
assert mode in ['audit', 'record']
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]; app = 'org.nativescript.jolt.benchmark'
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()
command('shell', 'am', 'force-stop', app)
args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'gravity']
if mode == 'audit': args += ['--es', 'gravity-audit', 'true']
command(*args); time.sleep(5)
command('shell', 'rm', '-f', '/sdcard/jolt-gravity-ui.xml')
command('shell', 'uiautomator', 'dump', '/sdcard/jolt-gravity-ui.xml')
root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-gravity-ui.xml'))
positions = {}
for node in root.iter('node'):
    for name in [node.get('resource-id'), node.get('content-desc'), node.get('text')]:
        if name:
            a,b,c,d = map(int, re.findall(r'\d+', node.get('bounds')))
            positions[name] = ((a+c)//2, (b+d)//2)
            if name.startswith('Back to collection.'):
                positions['Back to collection'] = positions[name]
def tap(name, delay=.5):
    assert name in positions, 'Missing ' + name
    command('shell', 'input', 'tap', *positions[name]); time.sleep(delay)
recorder = None
old = command('shell','settings','get','system','show_touches')
try:
    if mode == 'record':
        command('shell','settings','put','system','show_touches','1')
        command('shell','rm','-f','/sdcard/jolt-gravity-record.mp4')
        recorder = subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000','/sdcard/jolt-gravity-record.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        time.sleep(.7)
        tap('gravity-drop', 4)
        tap('gravity-toss', .15)
    else: tap('gravity-drop', .15)
    tap('gravity-pause', .6)
    if mode == 'audit': tap('gravity-snapshot')
    tap('gravity-pause', .25)
    if mode == 'audit': tap('gravity-snapshot')
    tap('gravity-return', 1)
    if mode == 'audit': tap('gravity-snapshot')
    tap('gravity-mood-0', 2)
    tap('gravity-mood-2', 1)
    if mode == 'audit':
        tap('gravity-snapshot'); tap('gravity-toss', 2); tap('gravity-snapshot')
    tap('gravity-reduce'); tap('gravity-drop')
    if mode == 'audit': tap('gravity-snapshot')
    time.sleep(.5)
    if mode == 'audit':
        tap('gravity-reduce'); tap('gravity-mood-1', .1)
        command('shell','input','keyevent','KEYCODE_HOME'); time.sleep(.6)
        command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity'); time.sleep(.4)
        tap('gravity-snapshot')
        tap('Back to collection', 1)
        report = command('shell','cat',f'/sdcard/Android/data/{app}/files/gravity-audit.json')
        (out/'android.json').write_text(json.dumps(json.loads(report), indent=2)+'\n')
finally:
    try:
        if recorder:
            command('shell','pkill','-INT','screenrecord'); recorder.communicate(timeout=20)
            assert recorder.returncode == 0, 'screenrecord failed'
            command('pull','/sdcard/jolt-gravity-record.mp4',out/'gravity-android.mp4')
    finally:
        if mode == 'record':
            if old == 'null': command('shell','settings','delete','system','show_touches')
            else: command('shell','settings','put','system','show_touches',old)
