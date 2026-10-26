"""Capture real Android blur interactions. Select English in the preview first.
Usage: python3 benchmarks/blur-android.py SERIAL OUTPUT audit|record
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory, mode = sys.argv[1:]
assert serial.startswith('emulator-') and mode in ('audit', 'record')
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]; app = 'org.nativescript.jolt.benchmark'
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()
command('shell', 'am', 'force-stop', app)
args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'blur']
if mode == 'audit': args += ['--es', 'blur-audit', 'true']
command(*args); time.sleep(4)
command('shell', 'uiautomator', 'dump', '/sdcard/jolt-blur-ui.xml')
root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-blur-ui.xml'))
positions = {}
for node in root.iter('node'):
    for name in (node.get('resource-id'), node.get('content-desc'), node.get('text')):
        if name:
            a, b, c, d = map(int, re.findall(r'\d+', node.get('bounds')))
            positions[name] = ((a+c)//2, (b+d)//2)
            if name.startswith('Back to collection.'): positions['Back to collection'] = positions[name]
def tap(name, delay=.4):
    assert name in positions, 'Missing ' + name
    command('shell', 'input', 'tap', *positions[name]); time.sleep(delay)
def snapshot(): tap('blur-snapshot')
recorder = None; old = command('shell', 'settings', 'get', 'system', 'show_touches')
try:
    if mode == 'record':
        command('shell', 'settings', 'put', 'system', 'show_touches', 1)
        command('shell', 'rm', '-f', '/sdcard/jolt-blur-record.mp4')
        recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', '/sdcard/jolt-blur-record.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        time.sleep(.7)
        tap('blur-soft', 1.6); tap('blur-full', 1.6)
        tap('blur-clear', .2); tap('blur-soft', 1.4)
        tap('blur-drift', .35); tap('blur-pause', .7); tap('blur-pause', 3.5)
        tap('blur-reduce', .2); tap('blur-full', .6); tap('blur-clear', .6)
    else:
        def shot(name):
            command('shell', 'screencap', '-p', '/sdcard/jolt-blur-shot.png')
            command('pull', '/sdcard/jolt-blur-shot.png', out/(name+'.png'))
        snapshot(); shot('blur-clear')
        tap('blur-full', .1); tap('blur-seek', .3); snapshot(); shot('blur-half')
        snapshot(); tap('blur-invalid'); snapshot()
        tap('blur-resize'); snapshot(); tap('blur-resize'); snapshot()
        tap('blur-pause', 1.2); snapshot(); shot('blur-full')
        tap('blur-clear', .1); tap('blur-full', 2); snapshot()
        tap('blur-drift', .05); tap('blur-pause', .8); snapshot(); snapshot()
        tap('blur-pause', 3.2); snapshot()
        tap('blur-full', .1); tap('blur-reduce'); snapshot()
        tap('blur-clear'); snapshot()
        tap('blur-reduce'); tap('blur-reset'); tap('blur-full', .1)
        command('shell', 'input', 'keyevent', 'KEYCODE_HOME'); time.sleep(.5)
        command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity'); time.sleep(.4)
        snapshot(); tap('Back to collection', 1)
        report = command('shell', 'cat', f'/sdcard/Android/data/{app}/files/blur-audit.json')
        (out/'android.json').write_text(json.dumps(json.loads(report), indent=2)+'\n')
finally:
    try:
        if recorder:
            command('shell', 'pkill', '-INT', 'screenrecord'); recorder.communicate(timeout=20)
            assert recorder.returncode == 0
            command('pull', '/sdcard/jolt-blur-record.mp4', out/'blur-android.mp4')
    finally:
        if mode == 'record':
            if old == 'null': command('shell', 'settings', 'delete', 'system', 'show_touches')
            else: command('shell', 'settings', 'put', 'system', 'show_touches', old)
