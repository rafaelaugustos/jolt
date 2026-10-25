"""Real OS taps, native assertions, and recording on a dedicated Android emulator."""
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


def launch(checks=False):
    command('shell', 'am', 'force-stop', app)
    args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'motion-inspector', 'true']
    if checks:
        args += ['--es', 'inspector-checks', 'true']
    command(*args)
    time.sleep(2)


def tree():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-inspector-ui.xml')
    return ET.fromstring(command('shell', 'cat', '/sdcard/jolt-inspector-ui.xml'))


def find(root, name):
    for node in root.iter('node'):
        if name in (node.get('resource-id'), node.get('content-desc'), node.get('text')):
            return node
    raise AssertionError('Missing inspector control: ' + name)


def bounds(root, name):
    return tuple(map(int, re.findall(r'\d+', find(root, name).get('bounds'))))


def tap_at(rect, delay=0.4, fraction=0.5):
    x1, y1, x2, y2 = rect
    assert x2 > x1 and y2 > y1, rect
    command('shell', 'input', 'tap', int(x1 + (x2-x1)*fraction), (y1+y2)//2)
    time.sleep(delay)


touches = command('shell', 'settings', 'get', 'system', 'show_touches')
recorder = None
try:
    command('shell', 'rm', '-f', folder + 'jolt-inspector-checks.json')
    launch(True)
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        result = subprocess.run(adb + ['shell', 'cat', folder + 'jolt-inspector-checks.json'], capture_output=True, text=True, timeout=10)
        if result.returncode == 0:
            report = json.loads(result.stdout)
            assert report['status'] == 'passed', report
            assert report['negativeControl'] and report['remainingProbes'] == 0, report
            (output/'native-checks.json').write_text(json.dumps(report, indent=2)+'\n')
            break
        time.sleep(.3)
    else:
        raise AssertionError('Inspector native report timed out')
    launch()
    ui = tree()
    # Keep all actions visible in the panel, while the stage remains above its scroll view.
    try:
        assert bounds(ui, 'inspector-copy')[3] > bounds(ui, 'inspector-copy')[1]
    except AssertionError:
        command('shell', 'input', 'swipe', 600, 1900, 600, 1650, 300)
        ui = tree()
    ids = ['spring', 'replay', 'interrupt', 'scrub', 'layers', 'sequence', 'binding', 'copy', 'duration', 'bounce']
    controls = {name: bounds(ui, 'inspector-'+name) for name in ids}
    tap_at(controls['duration'], .3, .95)
    tap_at(controls['bounce'], .3, .65)
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '120', '/sdcard/jolt-inspector.mp4'])
    time.sleep(.7)
    tap_at(controls['spring'], .15)
    tap_at(controls['interrupt'], .7)
    tap_at(controls['replay'], .15)
    tap_at(controls['scrub'], .6)
    ui = tree()
    assert any(n.get('text') == 'Paused at 25%. Explicit edit.' for n in ui.iter('node')), ET.tostring(ui).decode()
    tap_at(controls['scrub'], .7)
    tap_at(controls['layers'], 1)
    tap_at(controls['sequence'], 1.8)
    tap_at(controls['binding'], 1.2)
    tap_at(controls['copy'], .5)
    for pid in command('shell', 'pidof', 'screenrecord').split():
        command('shell', 'kill', '-2', pid)
    recorder.wait(timeout=10)
    assert recorder.returncode == 0
    command('pull', '/sdcard/jolt-inspector.mp4', output/'motion-inspector-android.mp4')
    settings = json.loads(command('shell', 'cat', folder+'jolt-inspector-settings.json'))
    assert settings['spring']['duration'] > 1000 and '"velocity": 0' in settings['code'], settings
    (output/'copied-settings.json').write_text(json.dumps(settings, indent=2)+'\n')
    launch()
    ui = tree()
    saved = find(ui, 'inspector-duration-value').get('text')
    assert saved == str(settings['spring']['duration'])+' ms', (saved, settings)
    print('PASS native probe, real taps, explicit scrub, copied settings and restart persistence')
finally:
    if recorder and recorder.poll() is None:
        for pid in command('shell', 'pidof', 'screenrecord').split():
            command('shell', 'kill', '-2', pid)
        recorder.wait(timeout=10)
    if touches == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', touches)
