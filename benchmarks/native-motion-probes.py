"""Run bounded native lifecycle/clock probes without recording.

python3 benchmarks/native-motion-probes.py android SERIAL OUTPUT --port 5041
python3 benchmarks/native-motion-probes.py ios SIMULATOR_UUID OUTPUT
The isolated native demo must already be installed. Never targets another device.
"""
import argparse
import json
from pathlib import Path
import subprocess
import time

p = argparse.ArgumentParser()
p.add_argument('platform', choices=['android', 'ios'])
p.add_argument('device')
p.add_argument('output', type=Path)
p.add_argument('--port', default='5037')
p.add_argument('--modes', nargs='+', choices=['text', 'rig', 'cues', 'resources', 'behaviors'], default=['text', 'rig', 'cues', 'resources', 'behaviors'])
a = p.parse_args()
a.output.mkdir(parents=True, exist_ok=True)
app = 'org.nativescript.jolt.benchmark'
adb = ['adb', '-P', a.port, '-s', a.device]
sim = ['xcrun', 'simctl']

def command(args, required=True):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    if required and result.returncode:
        raise RuntimeError(result.stderr or result.stdout)
    return result.stdout if result.returncode == 0 else ''

if a.platform == 'ios':
    container = Path(command(sim + ['get_app_container', a.device, app, 'data']).strip()) / 'Documents'

def read(name):
    if a.platform == 'ios':
        file = container / name
        return file.read_text() if file.exists() else ''
    return command(adb + ['shell', 'cat', f'/sdcard/Android/data/{app}/files/{name}'], False)

for mode in a.modes:
    previous = read('native-motion-probe.json')
    if a.platform == 'android':
        command(adb + ['shell', 'am', 'force-stop', app])
        time.sleep(2)
        command(adb + ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'native-motion', mode, '--es', 'native-motion-probe', 'true', '--es', 'native-motion-audit', 'true'])
    else:
        command(sim + ['terminate', a.device, app], False)
        command(sim + ['launch', a.device, app, '--native-motion=' + mode, '--native-motion-probe', '--native-motion-audit'])
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        time.sleep(.5)
        if a.platform == 'android' and not command(adb + ['shell', 'pidof', app], False).strip():
            (a.output / (mode + '-crash.log')).write_text(command(adb + ['logcat', '-b', 'crash', '-d', '-t', '60'], False))
            raise RuntimeError('Android demo exited during probe: ' + mode)
        current = read('native-motion-probe.json')
        if current and current != previous:
            report = json.loads(current)
            if report.get('mode') == mode:
                (a.output / (mode + '.json')).write_text(current)
                print(json.dumps({'platform': a.platform, 'mode': mode, 'samples': len(report['measurements'])}), flush=True)
                break
        audit = read('native-motion.json')
        if audit:
            events = json.loads(audit).get('events', [])
            if events and events[-1]['mode'] == mode and events[-1]['name'] == 'probe-error':
                (a.output / (mode + '-failure.json')).write_text(audit)
                raise RuntimeError(events[-1]['status'])
    else:
        (a.output / (mode + '-timeout.json')).write_text(read('native-motion.json'))
        raise TimeoutError('Native probe did not complete: ' + mode)
