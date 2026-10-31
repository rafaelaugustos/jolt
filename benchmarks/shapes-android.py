"""Capture real Android shape interactions. Select English in the preview first.
Usage: python3 benchmarks/shapes-android.py SERIAL OUTPUT audit|record|mount
`mount` records the launch itself: the surfaces are created on mount and appear with the screen.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory, mode = sys.argv[1:]
assert serial.startswith('emulator-') and mode in ('audit', 'record', 'mount')
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]; app = 'org.nativescript.jolt.benchmark'
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()
command('shell', 'am', 'force-stop', app)
args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'shapes']
if mode == 'audit': args += ['--es', 'shape-audit', 'true']
recorder = None; old = command('shell', 'settings', 'get', 'system', 'show_touches')
def start_recording():
    global recorder
    command('shell', 'settings', 'put', 'system', 'show_touches', 1)
    command('shell', 'rm', '-f', '/sdcard/jolt-shapes-record.mp4')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', '/sdcard/jolt-shapes-record.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    time.sleep(.7)
if mode == 'mount': start_recording()
command(*args); time.sleep(4)
command('shell', 'uiautomator', 'dump', '/sdcard/jolt-shapes-ui.xml')
root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-shapes-ui.xml'))
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
def snapshot(): tap('shape-snapshot')
try:
    if mode == 'mount':
        tap('Draw again', 2.5); tap('Draw again', 2.2)
    elif mode == 'record':
        start_recording()
        tap('shape-draw', 1.5)
        tap('shape-morph', .15); tap('shape-morph', .7); tap('shape-morph', .7)
        tap('shape-draw', .15); tap('shape-pause', .8); tap('shape-pause', 1)
        tap('shape-reduce'); tap('shape-morph', .7)
    else:
        snapshot(); tap('shape-draw', .1); tap('shape-morph', .1)
        tap('shape-seek'); snapshot(); snapshot()
        tap('shape-invalid'); snapshot()
        tap('shape-resize'); snapshot(); tap('shape-resize'); snapshot()
        tap('shape-pause', 2); snapshot()
        tap('shape-draw', .3); tap('shape-pause', 1.2); snapshot(); tap('shape-pause', .6); snapshot()
        tap('shape-morph', .1); tap('shape-morph', 2); snapshot()
        tap('shape-loop', .05); tap('shape-pause', .8); snapshot(); snapshot()
        tap('shape-pause', 3.2); snapshot()
        tap('shape-reduce'); tap('shape-draw'); tap('shape-morph'); snapshot()
        tap('shape-reduce'); tap('shape-reset'); tap('shape-draw', .1)
        command('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        for _ in range(40):
            time.sleep(.25)
            record = re.search(r'Hist\s+#\d+: ActivityRecord\{[^}]*' + re.escape(app) + r'/[^}]*\}(.{0,4000})', command('shell', 'dumpsys', 'activity', 'activities'), re.S)
            if record and 'state=STOPPED' in record.group(1): break
        else: raise AssertionError('activity did not stop after HOME')
        command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity'); time.sleep(.4)
        snapshot(); tap('Back to collection', 1)
        for _ in range(20):
            try:
                report = json.loads(command('shell', 'cat', f'/sdcard/Android/data/{app}/files/shape-audit.json'))
                if report['events'][-1]['name'] == 'disposed': break
            except ValueError: pass
            time.sleep(.25)
        else: raise AssertionError('audit report did not record the disposal')
        (out/'android.json').write_text(json.dumps(report, indent=2)+'\n')
finally:
    try:
        if recorder:
            command('shell', 'pkill', '-INT', 'screenrecord'); recorder.communicate(timeout=20)
            assert recorder.returncode == 0
            command('pull', '/sdcard/jolt-shapes-record.mp4', out/('shapes-mount-android.mp4' if mode == 'mount' else 'shapes-android.mp4'))
    finally:
        if mode in ('record', 'mount'):
            if old == 'null': command('shell', 'settings', 'delete', 'system', 'show_touches')
            else: command('shell', 'settings', 'put', 'system', 'show_touches', old)
