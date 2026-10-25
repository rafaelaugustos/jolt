"""Real OS input, native-state checks and recording on a dedicated Android emulator.
Usage: python3 benchmarks/shared-layout-android.py SERIAL OUTPUT_DIRECTORY
Requires the normal benchmark-id Vue demo. Never selects an implicit device.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory = sys.argv[1:]
output = Path(directory).resolve()
output.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
remote = '/sdcard/Android/data/' + app + '/files/jolt-shared-layout.json'
positions = {}
reports = []


def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=30).strip()


def launch(checks=False):
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity',
            '--es', 'shared-layout', 'true', '--es',
            'shared-layout-checks' if checks else 'shared-layout-audit', 'true')
    time.sleep(2)
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-shared-ui.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-shared-ui.xml'))
    positions.clear()
    for node in root.iter('node'):
        if node.get('text'):
            left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
            positions[node.get('text')] = (str((left+right)//2), str((top+bottom)//2))
    assert 'Open player' in positions, ET.tostring(root).decode()


def tap(name, wait=0.5):
    command('shell', 'input', 'tap', *positions[name])
    time.sleep(wait)


def report(name, reason=None, active=False):
    data = json.loads(command('shell', 'cat', remote))
    assert data['active'] is active, data
    assert (data['nativeActive'] > 0) is active, data
    if not active:
        assert all(view['visible'] for view in data['views']), data
    if reason:
        last = data['results'][-1]
        assert last.get('reason', last['status']) == reason, data
    reports.append({'case': name, **data})
    (output / 'checks.json').write_text(json.dumps(reports, indent=2) + '\n')
    return data


touches = command('shell', 'settings', 'get', 'system', 'show_touches')
rotation = command('shell', 'settings', 'get', 'system', 'user_rotation')
automatic = command('shell', 'settings', 'get', 'system', 'accelerometer_rotation')
recorder = None
try:
    launch()
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000',
                                     '--time-limit', '18', '/sdcard/jolt-shared-layout.mp4'])
    time.sleep(0.7)
    for name in ['Your collection', 'Slow radio', 'For you', 'Open player',
                 'Open player', 'Change your mind', 'Open player']:
        tap(name, 1.6)
    recorder.wait(timeout=25)
    assert recorder.returncode == 0
    command('pull', '/sdcard/jolt-shared-layout.mp4', str(output / 'shared-layout-android.mp4'))
    data = report('recording', 'completed')
    assert len(data['results']) == 8, data
    assert sum(item['status'] == 'completed' for item in data['results']) == 7, data
    assert {'status': 'cancelled', 'reason': 'interrupted'} in data['results'], data

    launch(True)
    tap('Slow next')
    tap('Open player', 0.15)
    tap('Verify native', 0.15)
    report('overlay during playback', active=True)
    time.sleep(3)
    tap('Verify native')
    report('settled', 'completed')
    tap('Change your mind', 1.7)
    report('rapid reversal', 'completed')
    tap('Cancel', 1)
    report('explicit cancellation', 'cancelled')
    tap('Remove target', 1)
    report('missing destination', 'missing-target')
    tap('Reset')
    tap('Reduce motion')
    tap('Open player', 1)
    report('reduced motion', 'reduced-motion')
    tap('Reduce motion')
    tap('Slow next')
    tap('Open player', 0.1)
    command('shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0')
    command('shell', 'settings', 'put', 'system', 'user_rotation', '1')
    time.sleep(0.5)
    command('shell', 'settings', 'put', 'system', 'user_rotation', '0')
    time.sleep(1)
    tap('Verify native')
    report('rotation', 'geometry-changed')
    tap('Slow next')
    tap('Open player', 0.1)
    command('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    time.sleep(0.5)
    command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity')
    time.sleep(1)
    tap('Verify native')
    report('background and resume', 'suspended')
    print('Shared layout recording and native lifecycle checks passed.')
finally:
    if recorder and recorder.poll() is None:
        recorder.wait(timeout=25)
    for key, value in [('show_touches', touches), ('user_rotation', rotation),
                       ('accelerometer_rotation', automatic)]:
        if value == 'null':
            command('shell', 'settings', 'delete', 'system', key)
        else:
            command('shell', 'settings', 'put', 'system', key, value)
