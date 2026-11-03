"""Collect the release demo's native playback audit, retaining partial/error reports.
Usage: python3 benchmarks/android-playback-efficiency.py SERIAL OUTPUT_DIRECTORY
Requires the normal release demo, not the busyBenchmark entry point.
"""
from pathlib import Path
import json
import subprocess
import sys
import time

serial, destination = sys.argv[1:]
root = Path(destination)
root.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
package = 'org.nativescript.jolt.benchmark'
remote = f'/sdcard/Android/data/{package}/files/jolt-playback-efficiency.json'

def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=30).strip()

command('shell', 'am', 'force-stop', package)
command('shell', 'rm', '-f', remote)
command('shell', 'am', 'start', '-n', f'{package}/com.tns.NativeScriptActivity',
        '--es', 'playback-efficiency', 'true', '--es', 'efficiency-checks', 'true')
(root / 'device.json').write_text(json.dumps({
    'serial': serial, 'fingerprint': command('shell', 'getprop', 'ro.build.fingerprint'),
    'emulator': command('shell', 'getprop', 'ro.kernel.qemu') == '1',
}, indent=2) + '\n')
last = None
deadline = time.monotonic() + 600
while time.monotonic() < deadline:
    time.sleep(3)
    read = subprocess.run(adb + ['shell', 'cat', remote], text=True, capture_output=True, timeout=30)
    if read.returncode:
        continue
    report = json.loads(read.stdout)
    (root / 'report.json').write_text(read.stdout + '\n')
    phase = (report['phase'], len(report['batches']), len(report['playback']), len(report['retention']))
    if phase != last:
        print(phase, flush=True)
        last = phase
    if report['phase'] == 'error':
        raise RuntimeError(report['error'])
    if report['phase'] == 'done':
        assert not report['debuggable'], 'Use a release APK'
        assert report['build']['mode'] == 'production'
        assert report['environment']['animatorScale'] == 1
        assert report['checks']['exact'] and report['checks']['comparisons'] >= 240000
        assert len(report['batches']) == 40 and len(report['playback']) == 6
        for run in report['playback']:
            frames = run['frames']
            assert frames['overflow'] == 0 and len(frames['frames']) >= 600
            assert frames['after']['timeMs'] - frames['before']['timeMs'] >= 29000
            positions = [row[3] for row in frames['frames']]
            assert max(positions) - min(positions) > 100, 'Native position did not move'
        print('Complete release audit saved.', flush=True)
        break
else:
    raise TimeoutError('Native audit timed out; partial report retained')
