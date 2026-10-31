"""Real OS background/foreground checks for the normal Vue demo (issue #273).

Usage: python3 benchmarks/background-playback-check.py ios|android DEVICE OUTPUT_DIR
Install a release build with --background-playback --background-probe support first.
The selected device must be reserved. The runner launches only the benchmark app.
"""
import argparse
import atexit
import json
import re
import signal
import subprocess
import time
from pathlib import Path
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('platform', choices=['ios', 'android'])
parser.add_argument('device')
parser.add_argument('output', type=Path)
parser.add_argument('--baseline', action='store_true')
parser.add_argument('--android-pause', help='Optional x,y screen pixels when UIAutomator cannot reach idle')
parser.add_argument('--android-stop', help='Optional x,y screen pixels when UIAutomator cannot reach idle')
parser.add_argument('--record', action='store_true', help='Record the first OS background/foreground cycle')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
app = 'org.nativescript.jolt.benchmark'
is_ios = args.platform == 'ios'
adb = ['adb', '-s', args.device]
sim = ['xcrun', 'simctl']
idb = str(Path.home() / 'Library/Python/3.9/bin/idb')

def run(command):
    return subprocess.check_output(command, text=True, timeout=40).strip()

def launch(fresh=False):
    if is_ios:
        if fresh:
            subprocess.run(sim + ['terminate', args.device, app], capture_output=True)
        run(sim + ['launch', args.device, app] +
            (['--background-playback', '--background-probe'] if fresh else []))
    else:
        if fresh:
            run(adb + ['shell', 'am', 'force-stop', app])
        run(adb + ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity'] +
            (['--es', 'background-playback', 'true', '--es', 'background-probe', 'true'] if fresh else []))

def home():
    if is_ios:
        run([idb, 'ui', 'button', 'HOME', '--udid', args.device])
    else:
        run(adb + ['shell', 'input', 'keyevent', 'KEYCODE_HOME'])

def tap(identifier, label):
    if is_ios:
        nodes = json.loads(run([idb, 'ui', 'describe-all', '--udid', args.device]))
        node = next(n for n in nodes if n.get('AXUniqueId') == identifier)
        frame = node['frame']
        x, y = frame['x'] + frame['width'] / 2, frame['y'] + frame['height'] / 2
        run([idb, 'ui', 'tap', str(round(x)), str(round(y)), '--udid', args.device])
    else:
        point = args.android_pause if identifier == 'background-pause' else args.android_stop
        if point:
            x, y = map(int, point.split(','))
            run(adb + ['shell', 'input', 'tap', str(x), str(y)])
            return
        run(adb + ['shell', 'uiautomator', 'dump', '/sdcard/jolt-background-ui.xml'])
        nodes = ET.fromstring(run(adb + ['shell', 'cat', '/sdcard/jolt-background-ui.xml']))
        node = next(n for n in nodes.iter('node') if n.get('text') == label)
        left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
        run(adb + ['shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2)])

def capture(name):
    target = args.output / (name + '.json')
    if is_ios:
        container = run(sim + ['get_app_container', args.device, app, 'data'])
        target.write_bytes((Path(container) / 'Documents/background-playback.json').read_bytes())
    else:
        run(adb + ['pull', '/sdcard/Android/data/' + app + '/files/background-playback.json', str(target)])
    return json.loads(target.read_text())

def ranges(samples, name):
    poses = [s['poses'][name] for s in samples if s['poses'][name] is not None]
    assert len(poses) >= 8, (name, 'insufficient native samples', len(poses))
    return {key: max(p[key] for p in poses) - min(p[key] for p in poses) for key in poses[0]}

def verify_running(data):
    resume = max(i for i, event in enumerate(data) if event['event'] == 'resume')
    samples = [event for event in data[resume + 1:] if event['event'] == 'sample']
    movement = {name: ranges(samples, name) for name in data[-1]['poses']}
    assert not data[-1]['ended'], data[-1]['ended']
    assert data[-1]['size'] == 6, data[-1]
    for name in ['planet', 'spark0', 'spark1', 'spark2', 'shadow', 'floating']:
        assert max(movement[name].values()) > 0.1, (name, 'frozen', movement[name])
    assert max(movement['held'].values()) < 0.01, movement['held']
    assert data[-1]['paused']['held']
    before = next(e for e in reversed(data[:resume]) if e['event'] == 'suspend')
    after = data[resume]
    assert all(before['paused'].values()), before['paused']
    for name, pose in before['poses'].items():
        for key, value in pose.items():
            tolerance = 5 if key in ('x', 'y') else 0.05
            assert abs(after['poses'][name][key] - value) <= tolerance, (name, key, before, after)
    return movement

launch(fresh=True)
time.sleep(3)
recording = None

def finish_recording():
    global recording
    if recording is None:
        return
    process, recording = recording, None
    if is_ios and process.poll() is None:
        process.send_signal(signal.SIGINT)
    process.wait(timeout=25)
    if not is_ios:
        run(adb + ['pull', '/sdcard/jolt-background.mp4', str(args.output / 'background.mp4')])

atexit.register(finish_recording)
if args.record:
    if is_ios:
        recording = subprocess.Popen(sim + ['io', args.device, 'recordVideo', str(args.output / 'background.mov')])
    else:
        recording = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '17', '/sdcard/jolt-background.mp4'])
time.sleep(4)
results = {}
for seconds in ([3] if args.baseline else [3, 20, 3]):
    print('Background for', seconds, 'seconds', flush=True)
    home()
    time.sleep(seconds)
    launch()
    time.sleep(5)
    data = capture('background-' + str(seconds) + '-' + str(len(results)))
    finish_recording()
    if args.baseline:
        try:
            verify_running(data)
        except AssertionError as error:
            results['negative-control'] = str(error)
        else:
            raise AssertionError('Baseline did not reproduce the regression')
    else:
        results['resume-' + str(len(results))] = verify_running(data)
if not args.baseline:
    tap('background-pause', 'Pause')
    time.sleep(2)
    home()
    time.sleep(3)
    launch()
    time.sleep(4)
    data = capture('manual-pause')
    samples = [e for e in data if e['event'] == 'sample'][-10:]
    assert data[-1]['scopeSuspended']
    assert all(max(ranges(samples, name).values()) < 0.01 for name in data[-1]['poses'])
    tap('background-pause', 'Resume')
    time.sleep(5)
    data = capture('manual-resume')
    assert not data[-1]['scopeSuspended']
    assert not data[-1]['ended']
    assert max(ranges([e for e in data if e['event'] == 'sample'][-15:], 'planet').values()) > 0.1
    tap('background-stop', 'Stop all')
    home()
    time.sleep(3)
    launch()
    time.sleep(4)
    data = capture('stopped')
    assert data[-1]['size'] == 0
    assert len(data[-1]['ended']) == 6 and not any(data[-1]['ended'].values())
    samples = [e for e in data if e['event'] == 'sample'][-10:]
    assert all(max(ranges(samples, name).values()) < 0.01 for name in data[-1]['poses'])
    results['manual-pause-resume-and-reset'] = 'passed'
(args.output / 'summary.json').write_text(json.dumps(results, indent=2) + '\n')
print(json.dumps(results, indent=2), flush=True)
