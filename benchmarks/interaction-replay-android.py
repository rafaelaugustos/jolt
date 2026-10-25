"""Record real Android input, then assert engine/native replays and the negative control.
Usage: python3 benchmarks/interaction-replay-android.py SERIAL OUTPUT_DIRECTORY
Install the normal benchmark-id Vue demo first. Uses an explicit emulator only.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use a dedicated emulator.'
output = Path(directory).resolve()
output.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
folder = '/sdcard/Android/data/' + app + '/files/'
positions = {}


def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=30).strip()


def launch(checks=False):
    command('shell', 'am', 'force-stop', app)
    args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity',
            '--es', 'interaction-replay', 'true']
    if checks:
        args += ['--es', 'replay-checks', 'true']
    command(*args)
    time.sleep(2)
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-replay-ui.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-replay-ui.xml'))
    positions.clear()
    for node in root.iter('node'):
        name = node.get('resource-id') or node.get('content-desc') or node.get('text')
        if name:
            left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
            positions[name] = ((left + right) // 2, (top + bottom) // 2)
    assert 'record-spring' in positions, ET.tostring(root).decode()


def tap(name, wait=0.35):
    command('shell', 'input', 'tap', *map(str, positions[name]))
    time.sleep(wait)


def report(filename, destination, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = subprocess.run(adb + ['shell', 'cat', folder + filename],
                                capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            (output / destination).write_text(json.dumps(data, indent=2) + '\n')
            return data
        time.sleep(0.2)
    raise AssertionError('Report timed out: ' + filename)


def replay(name, broken=False):
    filename = 'jolt-interaction-replay.json'
    command('shell', 'rm', '-f', folder + filename)
    tap('replay-break' if broken else 'replay-run')
    data = report(filename, name + '.json')
    assert data['broken'] is broken and len(data['reports']) == 2, data
    for result in data['reports']:
        assert result['passed'] is not broken, result['errors']
        assert result['remainingResources'] == 0, result
        if broken:
            assert any(s['positionError'] > 70 for s in result['observations']), result
    time.sleep(0.8)


touches = command('shell', 'settings', 'get', 'system', 'show_touches')
recorder = None
try:
    command('shell', 'rm', '-f', folder + 'jolt-replay-checks.json')
    launch(True)
    checks = report('jolt-replay-checks.json', 'native-checks.json')
    assert checks['status'] == 'passed', checks
    assert len(checks['reports']) == 4 and checks['negativeControl']['passed'], checks
    launch()
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000',
                                     '--time-limit', '60', '/sdcard/jolt-replay.mp4'])
    time.sleep(0.7)
    tap('record-spring')
    tap('replay-right', 0.1)
    tap('replay-left', 1.7)
    tap('replay-finish')
    replay('spring')
    replay('negative-control', True)
    tap('record-drag')
    x, y = positions['replay-card']
    command('shell', 'input', 'swipe', str(x), str(y), str(x + 350), str(y), '700')
    time.sleep(0.7)
    tap('replay-finish')
    replay('cancelled-drag')
    for pid in command('shell', 'pidof', 'screenrecord').split():
        command('shell', 'kill', '-2', pid)
    recorder.wait(timeout=10)
    assert recorder.returncode == 0
    command('pull', '/sdcard/jolt-replay.mp4', str(output / 'interaction-replay-android.mp4'))
    print('Real touches, cancelled drag, engine/native replay and negative control passed.')
finally:
    if recorder and recorder.poll() is None:
        for pid in command('shell', 'pidof', 'screenrecord').split():
            command('shell', 'kill', '-2', pid)
        recorder.wait(timeout=10)
    if touches == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', touches)
