"""Validate native haptic requests and record real Android touches.

Usage: python3 benchmarks/haptics-android.py SERIAL OUTPUT [checks background settings disabled record]
Install the benchmark-ID normal demo first. This restores changed device settings.
Physical vibration still needs a human check; API acceptance cannot establish it.
"""
from pathlib import Path
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:3]
selected = set(sys.argv[3:] or ['checks', 'background', 'settings', 'record'])
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
activity = app + '/com.tns.NativeScriptActivity'


def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=60)


def controls():
    result = command('shell', 'uiautomator', 'dump', '/sdcard/jolt-haptics-ui.xml')
    if 'dumped' not in result:
        return {}
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-haptics-ui.xml'))
    return {node.get('text'): tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
            for node in root.iter('node') if node.get('text')}


def launch(mode='all'):
    command('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
    command('shell', 'wm', 'dismiss-keyguard')
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', activity, '--es', 'haptics-lab', 'true',
            '--es', 'haptic-checks', mode)
    for _ in range(10):
        time.sleep(2)
        tree = controls()
        if 'light' in tree and 'heavy' in tree:
            return tree
    raise AssertionError(tree)


def tap(rect, seconds=0):
    left, top, right, bottom = rect
    command('shell', 'input', 'tap', str((left+right)//2), str((top+bottom)//2))
    if seconds:
        time.sleep(seconds)


def check(name, background=False):
    tree = launch('background' if background else 'all')
    for _ in range(5):
        if 'Run haptic checks' in tree:
            break
        width, height = map(int, re.findall(r'(\d+)x(\d+)', command('shell', 'wm', 'size'))[-1])
        command('shell', 'input', 'swipe', str(width//2), str(height*3//4),
                str(width//2), str(height//3), '500')
        tree = controls()
    command('shell', 'run-as', app, 'rm', '-f', 'files/jolt-haptics.json')
    tap(tree['Run haptic checks'])
    if background:
        # The fixture waits 150 ms for layout, then starts an 1800 ms tween.
        time.sleep(0.5)
        command('shell', 'input', 'keyevent', 'KEYCODE_HOME')
        time.sleep(4)
        command('shell', 'am', 'start', '-n', activity)
    deadline = time.monotonic() + 120
    while time.monotonic() < deadline:
        result = subprocess.run(adb + ['shell', 'run-as', app, 'cat',
                                      'files/jolt-haptics.json'], capture_output=True, text=True)
        if result.returncode == 0:
            payload = result.stdout
            try:
                data = json.loads(payload)
            except json.JSONDecodeError:
                continue
            (out/(name+'.json')).write_text(payload)
            assert data['passed'], payload
            print('PASS', name, data['metadata'], flush=True)
            return data
        time.sleep(1)
    raise TimeoutError(controls())


def restore(namespace, key):
    value = previous[(namespace, key)]
    if value == 'null':
        command('shell', 'settings', 'delete', namespace, key)
    else:
        command('shell', 'settings', 'put', namespace, key, value)


def touch_diagnostics():
    dump = command('shell', 'dumpsys', 'vibrator_manager')
    return {line.strip() for line in dump.splitlines()
            if app in line and 'usage: TOUCH' in line and '#performHapticFeedback' in line}


def disabled():
    # Modern ViewRootImpl acknowledges an async binder dispatch with true, even
    # when VibratorManager rejects it. Verify the service decision in that case.
    modern = int(command('shell', 'getprop', 'ro.build.version.sdk').strip()) >= 31
    before = touch_diagnostics() if modern else set()
    command('shell', 'settings', 'put', 'system', 'haptic_feedback_enabled', '0')
    if modern:
        command('shell', 'settings', 'put', 'system', 'haptic_feedback_intensity', '0')
    time.sleep(0.3)
    data = check('system-haptics-disabled')
    assert data['metadata']['hapticsEnabled'] == 0, data
    acknowledged = sum(event['accepted'] for result in data['results'] for event in result['requests'])
    validation = {'acknowledgedRequests': acknowledged, 'hapticFeedbackEnabled': 0}
    if modern:
        validation['hapticFeedbackIntensity'] = int(command(
            'shell', 'settings', 'get', 'system', 'haptic_feedback_intensity').strip())
        assert validation['hapticFeedbackIntensity'] == 0
        rows = sorted(touch_diagnostics() - before)
        assert len(rows) >= max(1, acknowledged), (acknowledged, rows)
        assert all('ignored_for_settings' in row for row in rows), rows
        (out/'system-haptics-disabled-service.txt').write_text('\n'.join(rows)+'\n')
        validation['evidence'] = 'VibratorManager: every new app TOUCH request ignored_for_settings'
    else:
        assert acknowledged == 0, data
        validation['evidence'] = 'Every performHapticFeedback call returned false'
    data['systemValidation'] = validation
    (out/'system-haptics-disabled.json').write_text(json.dumps(data, indent=2)+'\n')
    restore('system', 'haptic_feedback_enabled')
    restore('system', 'haptic_feedback_intensity')
    print('PASS system preference suppression', validation, flush=True)


def record():
    tree = launch()
    # The full control panel fits the reserved modern emulator. Physical devices
    # can record the spring/bounce flow without scrolling the first lane away.
    remote = '/sdcard/jolt-haptics-recording.mp4'
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', remote])
    try:
        time.sleep(1)
        for label in ['light', 'medium', 'heavy']:
            tap(tree[label], 1.3)
        tap(tree['light'], 0.05)
        tap(tree['heavy'], 1.3)
        tap(tree['Bounce'], 1.6)
        if all(label in tree for label in ['Tween', 'Pause', 'Stagger', 'No feedback']):
            tap(tree['Tween'], 0.15)
            tap(tree['Pause'], 1)
            # Resume occupies the same native button.
            tap(tree['Pause'], 2.4)
            tap(tree['Tween'], 0.15)
            tap(tree['Seek 70%'], 1.2)
            tap(tree['Stagger'], 1.4)
            tap(tree['No feedback'], 2.5)
        time.sleep(1)
    finally:
        command('shell', 'pkill', '-INT', 'screenrecord')
        recorder.wait(timeout=20)
    command('pull', remote, str(out/'haptics-android.mp4'))
    print('PASS real-touch recording', flush=True)


keys = [('system', 'show_touches'), ('global', 'animator_duration_scale'),
        ('system', 'haptic_feedback_enabled'), ('system', 'haptic_feedback_intensity')]
previous = {(namespace, key): command('shell', 'settings', 'get', namespace, key).strip()
            for namespace, key in keys}
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    command('shell', 'settings', 'put', 'global', 'animator_duration_scale', '1')
    if 'checks' in selected:
        check('conformance')
    if 'background' in selected:
        check('background', background=True)
    if 'settings' in selected:
        for scale in ['0', '0.5', '2']:
            command('shell', 'settings', 'put', 'global', 'animator_duration_scale', scale)
            data = check('scale-'+scale)
            assert data['metadata']['scale'] == float(scale), data
        command('shell', 'settings', 'put', 'global', 'animator_duration_scale', '1')
    if 'settings' in selected or 'disabled' in selected:
        disabled()
    if 'record' in selected:
        record()
finally:
    for namespace, key in previous:
        restore(namespace, key)
