"""Run native gradient/value checks and record real touches on an explicit Android device.
Usage: python3 benchmarks/gradient-values-android.py SERIAL OUTPUT [checks background reduced record]
Install the benchmark-ID normal demo first. Animator scale/show-touches are restored.
"""
from pathlib import Path
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:3]
selected = set(sys.argv[3:] or ['checks', 'background', 'reduced', 'record'])
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
activity = app + '/com.tns.NativeScriptActivity'


def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=60)


def controls():
    result = command('shell', 'uiautomator', 'dump', '/sdcard/jolt-gradient-ui.xml')
    if 'dumped' not in result:
        return {}
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-gradient-ui.xml'))
    return {(node.get('text') or node.get('content-desc')): tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
            for node in root.iter('node') if node.get('text') or node.get('content-desc')}


def launch(mode='all'):
    command('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
    command('shell', 'wm', 'dismiss-keyguard')
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', activity, '--es', 'gradient-values', 'true', '--es', 'gradient-checks', mode)
    for _ in range(10):
        time.sleep(1)
        tree = controls()
        if 'Travel' in tree and 'Run checks' in tree:
            return tree
    raise AssertionError(tree)


def tap(rect, delay=0):
    left, top, right, bottom = rect
    command('shell', 'input', 'tap', str((left+right)//2), str((top+bottom)//2))
    if delay:
        time.sleep(delay)


def check(mode='all'):
    tree = launch(mode)
    command('shell', 'run-as', app, 'rm', '-f', 'files/jolt-gradient-values.json')
    tap(tree['Run checks'], 0.6)
    if mode == 'background':
        command('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        time.sleep(1.5)
        command('shell', 'am', 'start', '-n', activity)
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        result = subprocess.run(adb + ['shell', 'run-as', app, 'cat', 'files/jolt-gradient-values.json'], text=True, capture_output=True)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            name = 'conformance' if mode == 'all' else mode
            (out/(name+'.json')).write_text(json.dumps(data, indent=2)+'\n')
            assert data['passed'], result.stdout
            assert data['observerFrames'] == 0, data
            print('PASS', name, data['model'], data['version'], len(data['results']), 'checks; no JS observer frames', flush=True)
            return
        time.sleep(1)
    raise TimeoutError(controls())


def record():
    tree = launch()
    remote = '/sdcard/jolt-gradient-values.mp4'
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', remote])
    try:
        time.sleep(1)
        left, top, right, bottom = tree['Drag light']
        x, y = (left+right)//2, (top+bottom)//2
        # Thumb diameter is 42 DIPs; drag about 150 DIPs horizontally.
        command('shell', 'input', 'swipe', str(x), str(y), str(x+int((right-left)*150/42)), str(y), '1100')
        time.sleep(1)
        tap(tree['Travel'], 0.5)
        tap(tree['Pulse'], 0.3)
        tap(tree['Pause'], 0.5)
        tap(tree['Seek 70%'], 0.5)
        tap(tree['Pause'], 1.1)
        tap(tree['Travel'], 0.5)
        tap(tree['Hold'], 0.6)
        tap(tree['Hold'], 0.6)
        tap(tree['Switch type'], 0.7)
        tap(tree['Rebind'], 0.4)
        tap(tree['Resize'], 0.8)
        # Resize moves controls; refresh before the last touch.
        tree = controls()
        tap(tree['Travel'], 3.3)
    finally:
        command('shell', 'pkill', '-INT', 'screenrecord')
        recorder.wait(timeout=20)
    command('pull', remote, str(out/'gradient-values-android.mp4'))
    print('PASS native interaction recording', flush=True)


keys = [('global', 'animator_duration_scale'), ('system', 'show_touches')]
previous = {(namespace,key): command('shell','settings','get',namespace,key).strip() for namespace,key in keys}
try:
    command('shell','settings','put','global','animator_duration_scale','1')
    command('shell','settings','put','system','show_touches','1')
    if 'checks' in selected:
        check()
    if 'background' in selected:
        check('background')
    if 'reduced' in selected:
        check('reduced')
    if 'record' in selected:
        record()
finally:
    for (namespace,key),value in previous.items():
        if value == 'null':
            command('shell','settings','delete',namespace,key)
        else:
            command('shell','settings','put',namespace,key,value)
