"""Real Android Home/foreground and repeated navigation; record explicit native test input.

Usage: python3 benchmarks/sensor-lifecycle-android.py EMULATOR_SERIAL OUTPUT
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use a dedicated emulator'
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
report = f'/sdcard/Android/data/{app}/files/sensors-audit.json'
launch = ['shell', 'am', 'start', '-n', app+'/com.tns.NativeScriptActivity',
          '--es', 'showcase-example', 'device-sensors', '--es', 'sensors-lifecycle', 'true',
          '--es', 'showcase-audit', 'true']


def command(*args):
    return subprocess.check_output(adb+list(map(str, args)), text=True, timeout=30).strip()


def data():
    return json.loads(command('shell', 'cat', report))


def wait_event(name, previous=0):
    deadline = time.monotonic()+12
    while time.monotonic() < deadline:
        current = data()
        if any(event['name'] == name for event in current['events'][previous:]):
            return current
        time.sleep(.1)
    raise AssertionError(('missing fresh event', name, current['events'][-1]))


def rect(name):
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt114-ui.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt114-ui.xml'))
    for node in root.iter('node'):
        label = node.get('content-desc', '')
        if name in (node.get('resource-id'), label, node.get('text')) or label.startswith(name+'. '):
            a, b, c, d = map(int, re.findall(r'\d+', node.get('bounds')))
            assert c > a and d > b
            return ((a+c)//2, (b+d)//2)
    raise AssertionError('Missing control '+name)


positions = {}


def tap(name, delay=.2, cached=True):
    if name not in positions or not cached:
        positions[name] = rect(name)
    command('shell', 'input', 'tap', *positions[name])
    time.sleep(delay)


def snapshot():
    count = len(data()['events'])
    tap('sensor-snapshot')
    wait_event('snapshot', count)


def background():
    count = len(data()['events'])
    command('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    held = wait_event('background', count)
    time.sleep(2)
    still = data()
    assert all(e['name'] == 'unloaded' for e in still['events'][len(held['events']):]), \
        'unexpected audit writes while suspended'
    # A foreground am start replaces the Intent; preserve the diagnostic extras.
    command(*launch)
    time.sleep(.65)
    assert any(e['name'] == 'foreground' for e in data()['events'][len(still['events']):])
    snapshot()


command('shell', 'am', 'force-stop', app)
command(*launch)
time.sleep(5)
start = data()['session']
assert abs(time.time()*1000-start) < 20000, 'stale report from an earlier process'
# Native sensor updates can prevent UIAutomator from reaching idle. Resolve the
# control layout once while paused, before the reviewed recording begins.
size = command('shell', 'wm', 'size')
assert '1080x2400' in size, 'Reviewed capture layout is 1080x2400'
command('shell', 'input', 'tap', 900, 1975)
time.sleep(.6)
assert data()['events'][-1]['name'] == 'pause', 'pause control geometry changed'
for name in ('sensor-preview', 'sensor-pause', 'sensor-snapshot', 'Back to collection'):
    positions[name] = rect(name)
tap('sensor-pause')
recorder = None
old_touches = command('shell', 'settings', 'get', 'system', 'show_touches')
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb+['shell', 'screenrecord', '--size', '720x1600',
        '--bit-rate', '4000000', '/sdcard/jolt114-lifecycle.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    time.sleep(.7)
    snapshot()
    background()
    for cycle in range(3):
        tap('sensor-preview', 2.2)
        snapshot()
        background()
        if cycle == 0:
            tap('sensor-pause', .5)
            snapshot()
            background()
            tap('sensor-pause', .8)
            snapshot()
        count = len(data()['events'])
        tap('Back to collection', .8)
        wait_event('disposed', count)
        if cycle < 2:
            if cycle == 0:
                tap('Search examples', cached=False)
                command('shell', 'input', 'text', 'Move%sthe%slight')
                command('shell', 'input', 'keyevent', 'KEYCODE_ENTER')
                time.sleep(.4)
            tap('Open Move the light', .8, cached=False)
            assert data()['events'][-1]['name'] == 'loaded'
    time.sleep(1)
    result = data()
    assert result['session'] == start, 'app process restarted instead of reentering'
    (out/'sensor-lifecycle-android.json').write_text(json.dumps(result, indent=2)+'\n')
finally:
    try:
        if recorder is not None:
            command('shell', 'pkill', '-INT', 'screenrecord')
            recorder.communicate(timeout=20)
            assert recorder.returncode == 0, 'screenrecord failed'
            command('pull', '/sdcard/jolt114-lifecycle.mp4', out/'sensor-lifecycle-android.mp4')
    finally:
        if old_touches == 'null':
            command('shell', 'settings', 'delete', 'system', 'show_touches')
        else:
            command('shell', 'settings', 'put', 'system', 'show_touches', old_touches)
subprocess.run([sys.executable, str(Path(__file__).with_name('verify-sensor-lifecycle.py')),
                str(out/'sensor-lifecycle-android.json')], check=True)
