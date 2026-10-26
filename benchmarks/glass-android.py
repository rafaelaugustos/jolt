"""Capture real Android glass fallback interactions. Select English in the preview first.
Usage: python3 benchmarks/glass-android.py SERIAL OUTPUT audit|record
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
args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'glass']
if mode == 'audit': args += ['--es', 'glass-audit', 'true']
command(*args); time.sleep(4)
command('shell', 'uiautomator', 'dump', '/sdcard/jolt-glass-ui.xml')
root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-glass-ui.xml'))
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
def snapshot(): tap('glass-snapshot')
recorder = None; old = command('shell', 'settings', 'get', 'system', 'show_touches')
try:
    if mode == 'record':
        command('shell', 'settings', 'put', 'system', 'show_touches', 1)
        command('shell', 'rm', '-f', '/sdcard/jolt-glass-record.mp4')
        recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', '/sdcard/jolt-glass-record.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        time.sleep(.7)
        tap('glass-gather', 1.8); tap('glass-center', .5)
        tap('glass-separate', .15); tap('glass-gather', 1.5)
        tap('glass-flow', .5); tap('glass-pause', .8); tap('glass-pause', 3)
        tap('glass-reduce', .2); tap('glass-separate', .6)
    else:
        snapshot()
        tap('glass-gather', .1); tap('glass-seek', .3); snapshot(); snapshot()
        tap('glass-invalid'); snapshot()
        tap('glass-resize'); snapshot(); tap('glass-resize'); snapshot()
        tap('glass-pause', 1.3); snapshot()
        tap('glass-center'); snapshot()
        tap('glass-separate', .1); tap('glass-gather', 2); snapshot()
        tap('glass-flow', .05); tap('glass-pause', .8); snapshot(); snapshot()
        tap('glass-pause', 3.5); snapshot()
        tap('glass-gather', .1); tap('glass-reduce'); snapshot()
        tap('glass-separate'); snapshot()
        tap('glass-reduce'); tap('glass-gather', .1)
        command('shell', 'input', 'keyevent', 'KEYCODE_HOME'); time.sleep(.5)
        command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity'); time.sleep(2)
        snapshot(); tap('Back to collection', 1)
        report = command('shell', 'cat', f'/sdcard/Android/data/{app}/files/glass-audit.json')
        (out/'android.json').write_text(json.dumps(json.loads(report), indent=2)+'\n')

finally:
    try:
        if recorder:
            command('shell', 'pkill', '-INT', 'screenrecord'); recorder.communicate(timeout=20)
            assert recorder.returncode == 0
            command('pull', '/sdcard/jolt-glass-record.mp4', out/'glass-android.mp4')
    finally:
        if mode == 'record':
            if old == 'null': command('shell', 'settings', 'delete', 'system', 'show_touches')
            else: command('shell', 'settings', 'put', 'system', 'show_touches', old)
