"""Record the native curve comparison with real OS taps on an explicit emulator."""
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
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-sampling-ui.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-sampling-ui.xml'))
    for node in root.iter('node'):
        if name in (node.get('resource-id'), node.get('content-desc'), node.get('text')):
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: ' + name)


def tap(name, delay):
    x1, y1, x2, y2 = bounds(name)
    command('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(delay)


def launch(checks=False):
    command('shell', 'am', 'force-stop', app)
    args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity',
            '--es', 'curve-sampling', 'true']
    if checks:
        args += ['--es', 'sampling-checks', 'true']
    command(*args)
    time.sleep(2)


touches = command('shell', 'settings', 'get', 'system', 'show_touches')
recorder = None
try:
    command('shell', 'rm', '-f', folder + 'jolt-curve-sampling.json')
    launch(True)
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        result = subprocess.run(adb + ['shell', 'cat', folder + 'jolt-curve-sampling.json'],
                                capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            report = json.loads(result.stdout)
            assert report['status'] == 'passed', report
            assert report['maxErrorDIP'] <= 0.28 and report['negativeControl'], report
            (output / 'native-checks.json').write_text(json.dumps(report, indent=2) + '\n')
            break
        time.sleep(0.3)
    else:
        raise AssertionError('Native precision report timed out')
    launch()
    before = bounds('sampling-adaptive')
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000',
                                     '--time-limit', '120', '/sdcard/jolt-sampling.mp4'])
    time.sleep(0.7)
    tap('sampling-play', 1.8)
    assert bounds('sampling-adaptive')[0] > before[0] + 200, 'No visible native motion'
    tap('sampling-play', 1.8)
    tap('sampling-slow', 0.4)
    tap('sampling-play', 4.3)
    tap('sampling-fast', 0.4)
    tap('sampling-play', 1.8)
    for pid in command('shell', 'pidof', 'screenrecord').split():
        command('shell', 'kill', '-2', pid)
    recorder.wait(timeout=10)
    assert recorder.returncode == 0
    command('pull', '/sdcard/jolt-sampling.mp4', output / 'curve-sampling-android.mp4')
    print('PASS native precision, interruption, negative control and real OS demo taps')
finally:
    if recorder and recorder.poll() is None:
        for pid in command('shell', 'pidof', 'screenrecord').split():
            command('shell', 'kill', '-2', pid)
        recorder.wait(timeout=10)
    if touches == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', touches)
