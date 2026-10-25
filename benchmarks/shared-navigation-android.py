"""Real OS taps, terminal cleanup assertions and optional native recording. Explicit emulator only."""
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
report_path = '/sdcard/Android/data/' + app + '/files/jolt-shared-navigation.json'

def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()

def launch(audit):
    command('shell', 'am', 'force-stop', app)
    args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'shared-navigation']
    if audit:
        command('shell', 'rm', '-f', report_path)
        args += ['--es', 'shared-navigation-audit', 'true']
    command(*args)
    time.sleep(4)

def tree():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-navigation-ui.xml')
    return ET.fromstring(command('shell', 'cat', '/sdcard/jolt-navigation-ui.xml'))

def bounds(name):
    for node in tree().iter('node'):
        if name == node.get('resource-id'):
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: ' + name)

def tap(name, delay=1.5):
    x1, y1, x2, y2 = bounds(name)
    command('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(delay)

def report(count, status='completed', reason=None):
    data = json.loads(command('shell', 'cat', report_path))
    assert len(data['results']) == count, data
    result = data['results'][-1]
    assert result['status'] == status and result['navigated'], data
    if reason: assert result['reason'] == reason, data
    assert data['state'] == 'idle' and data['nativeActive'] == 0, data
    assert all(view['visible'] for view in data['visible']), data
    (output/'native-checks.json').write_text(json.dumps(data, indent=2)+'\n')

launch(True)
for index, name in enumerate(['navigation-photo', 'navigation-back', 'navigation-pass', 'navigation-back']):
    tap(name); report(index+1)
tap('navigation-photo'); report(5)
tap('navigation-move-return', .2)
tap('navigation-back'); report(6)
tap('navigation-missing', .2)
tap('navigation-photo'); report(7, 'unavailable', 'missing-target')
tap('navigation-back'); report(8, 'unavailable', 'missing-source')
tap('navigation-missing', .2)
tap('navigation-reduce', .2)
tap('navigation-photo'); report(9, 'unavailable', 'reduced-motion')
tap('navigation-back'); report(10, 'unavailable', 'reduced-motion')

launch(False)
# Resolve idle-page coordinates before starting the video; input remains real OS taps.
photo, card = bounds('navigation-photo'), bounds('navigation-pass')
touches = command('shell', 'settings', 'get', 'system', 'show_touches')
recorder = None
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '5000000', '/sdcard/jolt-shared-navigation.mp4'])
    time.sleep(.5)
    for rect in [photo, card]:
        x1, y1, x2, y2 = rect
        command('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)
        time.sleep(1.8)
        tap('navigation-back', 1.8)
finally:
    if recorder:
        command('shell', 'pkill', '-2', 'screenrecord')
        recorder.wait(timeout=15)
    command('shell', 'settings', 'delete', 'system', 'show_touches') if touches == 'null' else command('shell', 'settings', 'put', 'system', 'show_touches', touches)
command('pull', '/sdcard/jolt-shared-navigation.mp4', output/'shared-navigation-android.mp4')
print('Shared navigation: 10 native terminal states clean; recorded photo/card forward and back.')
