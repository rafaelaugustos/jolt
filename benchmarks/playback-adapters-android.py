"""Check and record real native playback on a reserved Android emulator.
Usage: python3 benchmarks/playback-adapters-android.py SERIAL OUTPUT_DIRECTORY
Install the benchmark-ID normal demo first. The script restores show_touches.
"""
from pathlib import Path
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:3]
selected = set(sys.argv[3:] or ['checks', 'background', 'record', 'settings'])
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
activity = app + '/com.tns.NativeScriptActivity'

def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=60)

def controls():
    result = command('shell', 'uiautomator', 'dump', '/sdcard/jolt-playback-ui.xml')
    if 'dumped' not in result:
        return {}
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-playback-ui.xml'))
    return {node.get('text'): tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
            for node in root.iter('node') if node.get('text')}

def launch(mode):
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', activity, '--es', 'playback-lab', mode)
    for _ in range(15):
        time.sleep(2)
        tree = controls()
        if 'Play scene' in tree and 'Ready' in tree:
            return tree
    raise AssertionError(tree)

def tap(rect, seconds=0):
    left, top, right, bottom = rect
    command('shell', 'input', 'tap', str((left+right)//2), str((top+bottom)//2))
    if seconds:
        time.sleep(seconds)

def record(mode, name):
    tree = launch(mode)
    time.sleep(3)
    remote = '/sdcard/' + name + '.mp4'
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', remote])
    try:
        time.sleep(1)
        tap(tree['Play scene'], 1.6)
        tap(tree['Pause scene'], 1.6)
        paused = controls()
        assert 'Paused' in paused, paused
        tap(tree['Pause scene'], 8)
        final = controls()
        assert 'Finished' in final and '100%' in final, final
        time.sleep(1)
    finally:
        command('shell', 'pkill', '-INT', 'screenrecord')
        recorder.wait(timeout=20)
    command('pull', remote, str(out/(name+'.mp4')))
    print('PASS recording:', name, flush=True)

previous = command('shell', 'settings', 'get', 'system', 'show_touches').strip()
previous_scale = command('shell', 'settings', 'get', 'global', 'animator_duration_scale').strip()
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    if 'checks' in selected:
        tree = launch('timeline')
        tap(tree['Run native checks'])
        for _ in range(20):
            time.sleep(2)
            result = controls()
            if any('native checks passed' in text or text.startswith('FAILED:') for text in result):
                break
        payload = command('shell', 'run-as', app, 'cat', 'files/jolt-playback-adapters.json')
        (out/'conformance.json').write_text(payload)
        assert json.loads(payload)['passed'], payload
        print('PASS native conformance', flush=True)
    if 'background' in selected:
        tree = launch('timeline')
        tap(tree['Play scene'], 1)
        command('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        time.sleep(1)
        command('shell', 'am', 'start', '-n', activity)
        paused = controls()
        assert 'Paused' in paused, paused
        tap(paused['Resume scene'], 10)
        assert 'Finished' in controls()
        print('PASS background / resume', flush=True)
    if 'record' in selected:
        record('timeline', 'controlled-playback-android')
        record('map', 'native-map-android')
    if 'settings' in selected:
        for scale in ['0', '0.5', '2']:
            command('shell', 'settings', 'put', 'global', 'animator_duration_scale', scale)
            tree = launch('timeline')
            tap(tree['Run native checks'], 6)
            result = controls()
            payload = command('shell', 'run-as', app, 'cat', 'files/jolt-playback-adapters.json')
            (out/('scale-'+scale+'.json')).write_text(payload)
            data = json.loads(payload)
            assert data['passed'] and data['systemScale']==float(scale), data
            print('PASS animator scale:', scale, flush=True)
finally:
    if previous_scale == 'null':
        command('shell', 'settings', 'delete', 'global', 'animator_duration_scale')
    else:
        command('shell', 'settings', 'put', 'global', 'animator_duration_scale', previous_scale)
    if previous == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', previous)
