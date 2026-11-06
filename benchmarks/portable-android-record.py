"""Record the native portable demo with real ADB taps, independently of measurements.

Usage: python3 benchmarks/portable-android-record.py SERIAL OUTPUT [--port 5037]
Pointer input is explicitly injected by the native demo, not a connected mouse.
"""
import argparse
import json
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('serial')
parser.add_argument('output', type=Path)
parser.add_argument('--port', default='5037')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-P', args.port, '-s', args.serial]
app = 'org.nativescript.jolt.benchmark'
def command(*parts):
    return subprocess.check_output(adb + list(parts), text=True, timeout=30)

def positions():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-portable-input.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-portable-input.xml'))
    result = {}
    for node in root.iter('node'):
        name = node.get('resource-id', '') or node.get('content-desc', '')
        if name.startswith('foundation-'):
            left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds', '')))
            result[name] = (str(round((left+right)/2)), str(round((top+bottom)/2)))
    return result

previous = command('shell', 'settings', 'get', 'system', 'show_touches').strip()
recorder = None
scenes = {
    'groups': (15, [('run', .5), ('pause', .8), ('resume', 1.6), ('run', .5), ('run', 2.1), ('remount', 1), ('run', 2.2)]),
    'drawing': (17, [('run', 1.3), ('indicator', 1), ('indicator', .7), ('pause', .5), ('run', 1), ('resume', 1.3), ('remount', 1), ('run', 1.5)]),
    'pointer': (11, [('inject', 3.2), ('tap', .6), ('inject', 3.2), ('tap', .6)]),
}
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    for mode, (duration, actions) in scenes.items():
        command('shell', 'am', 'start', '-S', '-n', app+'/com.tns.NativeScriptActivity', '--es', 'portable-lab', mode, '--es', 'portable-audit', 'true')
        time.sleep(3)
        controls = positions()
        for name, _ in actions: assert 'foundation-'+name in controls, (mode, name, controls)
        remote = '/sdcard/jolt-portable-'+mode+'.mp4'
        recorder = subprocess.Popen(adb+['shell', 'screenrecord', '--bit-rate', '6000000', '--time-limit', str(duration), remote])
        print('Recording '+mode, flush=True)
        time.sleep(.7)
        for name, delay in actions:
            command('shell', 'input', 'tap', *controls['foundation-'+name])
            time.sleep(delay)
        recorder.wait(timeout=35)
        assert recorder.returncode == 0
        recorder = None
        command('pull', remote, str((args.output/(mode+'-android.mp4')).resolve()))
        report = json.loads(command('shell', 'cat', '/sdcard/Android/data/'+app+'/files/portable-foundations.json'))
        assert not any(event['name'] == 'input-error' for event in report['events']), report
        if mode == 'pointer':
            moves = [event for event in report['events'] if event['name'] == 'pointer-move']
            assert len(moves) >= 5 and max(e['x'] for e in moves)-min(e['x'] for e in moves) > .5
            assert max(e.get('taps', 0) for e in report['events']) == 2
        (args.output/(mode+'-android.json')).write_text(json.dumps(report, indent=2)+'\n')
        print('Saved '+mode, flush=True)
finally:
    if recorder is not None and recorder.poll() is None: recorder.wait(timeout=40)
    if previous == 'null': command('shell', 'settings', 'delete', 'system', 'show_touches')
    else: command('shell', 'settings', 'put', 'system', 'show_touches', previous)
