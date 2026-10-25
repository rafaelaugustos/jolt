"""Real OS input plus semantic scroll/sheet regression probes on an explicit emulator.
Usage: python3 benchmarks/scroll-handoff-android.py SERIAL OUTPUT_DIRECTORY
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use a dedicated emulator'
output = Path(directory).resolve()
output.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
folder = '/sdcard/Android/data/' + app + '/files/'


def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()


def bounds(name):
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-handoff-ui.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-handoff-ui.xml'))
    for node in root.iter('node'):
        if name in (node.get('resource-id'), node.get('content-desc'), node.get('text')):
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: ' + name)


def tap(name, delay=0.4):
    x1, y1, x2, y2 = bounds(name)
    command('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(delay)


def launch(checks=False):
    command('shell', 'am', 'force-stop', app)
    args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity',
            '--es', 'scroll-handoff', 'true']
    if checks:
        args += ['--es', 'handoff-checks', 'true']
    command(*args)
    time.sleep(2)


def report(filename, destination):
    deadline = time.monotonic() + 35
    while time.monotonic() < deadline:
        result = subprocess.run(adb + ['shell', 'cat', folder + filename],
                                capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            (output / destination).write_text(json.dumps(data, indent=2) + '\n')
            return data
        time.sleep(0.2)
    raise AssertionError('Report timed out: ' + filename)


touches = command('shell', 'settings', 'get', 'system', 'show_touches')
recorder = None
try:
    command('shell', 'rm', '-f', folder + 'jolt-handoff-checks.json')
    launch(True)
    checks = report('jolt-handoff-checks.json', 'native-checks.json')
    assert checks['status'] == 'passed', checks
    launch()
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000',
                                     '--time-limit', '120', '/sdcard/jolt-handoff.mp4'])
    time.sleep(0.7)
    tap('handoff-record')
    first = bounds('handoff-sheet')
    for direction in (1, -1):
        x1, y1, x2, y2 = bounds('handoff-scroll')
        x, y = (x1+x2)//2, (y1+y2)//2
        command('shell', 'input', 'swipe', x, y, x, y+direction*420, 1100)
        time.sleep(0.6)
        now = bounds('handoff-sheet')
        if direction == 1:
            assert now[1] > first[1]+40, (first, now)
        else:
            assert now[1] < first[1]+8, (first, now)
    tap('handoff-finish')
    trace = report('jolt-handoff-trace.json', 'recorded-trace.json')
    assert len([e for e in trace['entries'] if e.get('input', {}).get('phase') == 'move']) > 5, trace
    for broken in (False, True):
        command('shell', 'rm', '-f', folder + 'jolt-handoff-replay.json')
        tap('handoff-break' if broken else 'handoff-replay')
        data = report('jolt-handoff-replay.json', 'negative-control.json' if broken else 'recorded-replay.json')
        assert data['broken'] is broken and len(data['reports']) == 2, data
        for result in data['reports']:
            assert result['passed'] is not broken, result['errors']
            assert result['remainingResources'] == 0, result
            if broken:
                assert any(o['positionError'] > 70 for o in result['observations']), result
        time.sleep(0.8)
    for pid in command('shell', 'pidof', 'screenrecord').split():
        command('shell', 'kill', '-2', pid)
    recorder.wait(timeout=10)
    assert recorder.returncode == 0
    command('pull', '/sdcard/jolt-handoff.mp4', output / 'scroll-handoff-replay-android.mp4')
    print('PASS real OS handoff, reversal, recorded replay and native negative control')
finally:
    if recorder and recorder.poll() is None:
        for pid in command('shell', 'pidof', 'screenrecord').split():
            command('shell', 'kill', '-2', pid)
        recorder.wait(timeout=10)
    if touches == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', touches)
