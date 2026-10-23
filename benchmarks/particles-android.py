"""Native particle checks, settings matrix and actual touch recordings.
Usage: python3 benchmarks/particles-android.py SERIAL OUTPUT [checks background settings record]
Install the benchmark-ID normal demo first. Device settings are always restored.
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
    result = command('shell', 'uiautomator', 'dump', '/sdcard/jolt-particles-ui.xml')
    if 'dumped' not in result:
        return {}
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-particles-ui.xml'))
    return {(node.get('text') or node.get('content-desc')): tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
            for node in root.iter('node') if node.get('text') or node.get('content-desc')}


def launch(mode='all'):
    command('shell', 'input', 'keyevent', 'KEYCODE_WAKEUP')
    command('shell', 'wm', 'dismiss-keyguard')
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', activity, '--es', 'particle-lab', 'true', '--es', 'particle-checks', mode)
    for _ in range(12):
        time.sleep(1)
        tree = controls()
        if 'Snow' in tree and 'Run checks' in tree:
            return tree
    raise AssertionError(tree)


def tap(rect, delay=0):
    left, top, right, bottom = rect
    command('shell', 'input', 'tap', str((left+right)//2), str((top+bottom)//2))
    if delay:
        time.sleep(delay)


def check(mode='all', name='conformance'):
    tree = launch(mode)
    command('shell', 'run-as', app, 'rm', '-f', 'files/jolt-particles.json')
    tap(tree['Run checks'], 0.8)
    if mode in ['background', 'setting-change']:
        cue = 'Background ready' if mode == 'background' else 'Scale change ready'
        ready = controls()
        assert cue in ready, ready
        if mode == 'background':
            command('shell', 'input', 'keyevent', 'KEYCODE_HOME')
            time.sleep(1.5)
            command('shell', 'am', 'start', '-n', activity)
        else:
            command('shell', 'settings', 'put', 'global', 'animator_duration_scale', '0')
    deadline = time.monotonic() + 100
    while time.monotonic() < deadline:
        result = subprocess.run(adb + ['shell', 'run-as', app, 'cat', 'files/jolt-particles.json'], text=True, capture_output=True)
        if result.returncode == 0:
            data = json.loads(result.stdout)
            (out/(name+'.json')).write_text(json.dumps(data, indent=2)+'\n')
            assert data['passed'], result.stdout
            assert data['observerFrames'] == 0 and data['activeAfter'] == 0, data
            print('PASS', name, data['model'], data['version'], len(data['results']), 'checks; no JS observer frames', flush=True)
            return
        time.sleep(1)
    raise TimeoutError(controls())


def record():
    tree = launch()
    remote = '/sdcard/jolt-particles.mp4'
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', remote])
    try:
        time.sleep(0.8)
        tap(tree['Snow'], 3)
        tap(tree['Touch 0'], 0.2)
        assert 'Touch 1' in controls(), 'Particle overlay intercepted touch'
        tap(tree['Resize'], 0.8)
        tree = controls()
        tap(tree['Bubbles'], 3)
        tap(tree['Touch 1'], 0.2)
        assert 'Touch 2' in controls(), 'Ring overlay intercepted touch'
        tap(tree['Sparks'], 2)
        tap(tree['Finite'], 2.4)
        tap(tree['Confetti'], 0.35)
        tap(tree['Touch 1'], 0.3)  # same rectangle; label has changed
        assert 'Touch 3' in controls(), 'Window confetti overlay intercepted touch'
        time.sleep(1)
        tap(tree['Stop'], 0.4)
        tap(tree['Motion on'], 0.3)
        tap(tree['Snow'], 0.7)
        tap(tree['Motion on'], 0.3)
        tap(tree['Confetti'], 2.5)
    finally:
        command('shell', 'pkill', '-INT', 'screenrecord')
        recorder.wait(timeout=20)
    command('pull', remote, str(out/'particles-android.mp4'))
    (out/'interaction.json').write_text(json.dumps({'passed': True, 'touchPassThrough': ['snow', 'rings', 'window confetti'], 'touches': 3}, indent=2)+'\n')
    print('PASS real native touch/recording checks', flush=True)


keys = [('global', 'animator_duration_scale'), ('system', 'show_touches')]
previous = {(namespace,key): command('shell','settings','get',namespace,key).strip() for namespace,key in keys}
try:
    command('shell','settings','put','global','animator_duration_scale','1')
    command('shell','settings','put','system','show_touches','1')
    if 'checks' in selected:
        check()
    if 'background' in selected:
        check('background', 'background')
    if 'settings' in selected:
        for scale in ['0', '0.5', '2']:
            command('shell','settings','put','global','animator_duration_scale',scale)
            check('scale', 'scale-'+scale)
        command('shell','settings','put','global','animator_duration_scale','1')
        check('setting-change', 'setting-change')
        command('shell','settings','put','global','animator_duration_scale','1')
    if 'record' in selected:
        record()
finally:
    for (namespace,key),value in previous.items():
        if value == 'null':
            command('shell','settings','delete',namespace,key)
        else:
            command('shell','settings','put',namespace,key,value)
