"""Record real native input on a dedicated emulator, with explicitly labelled test samples.
Usage: python3 benchmarks/vector-sensors-android.py SERIAL OUTPUT_DIRECTORY
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:]
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=35).strip()
assert command('shell', 'getprop', 'ro.kernel.qemu') == '1', 'This runner is labelled emulator evidence.'
previous = command('shell', 'settings', 'get', 'system', 'show_touches')
recorder = None
started = time.time() * 1000
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'device-sensors', '--es', 'sensors-vectors', 'true')
    deadline = time.monotonic() + 25
    report_path = '/sdcard/Android/data/' + app + '/files/vector-sensors.json'
    while True:
        try:
            report = json.loads(command('shell', 'cat', report_path))
            if report['session'] >= started and len(report.get('controls', [])) == 6: break
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            pass
        assert time.monotonic() < deadline, 'Vector screen did not become ready'
        time.sleep(.25)
    # Read actual native visible rectangles. Continuous native transforms keep
    # UiAutomator's idle heuristic busy; this does not change or fake the input.
    positions = {node['id']: (node['x'], node['y']) for node in report['controls'] if node['width'] > 0 and node['height'] > 0}
    def tap(name, delay=0.5):
        x, y = positions[name]
        command('shell', 'input', 'tap', x, y)
        time.sleep(delay)
    assert all('vector-' + key in positions for key in ['preview', 'pause', 'resume', 'snapshot', 'live', 'close']), positions
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '35', '/sdcard/jolt-vector-sensors.mp4'])
    time.sleep(.7)
    tap('vector-preview', 2)
    tap('vector-snapshot')
    tap('vector-pause', 1)
    tap('vector-snapshot')
    tap('vector-resume', 2)
    tap('vector-snapshot')
    tap('vector-live', 1)
    tap('vector-preview', 2)
    pid = command('shell', 'pidof', 'screenrecord')
    command('shell', 'kill', '-2', int(pid))
    recorder.wait(timeout=15)
    tap('vector-close')
    command('pull', '/sdcard/jolt-vector-sensors.mp4', out / 'vector-sensors-android.mp4')
    command('pull', '/sdcard/Android/data/' + app + '/files/vector-sensors.json', out / 'vector-sensors.json')
    report = json.loads((out / 'vector-sensors.json').read_text())
    assert report['session'] >= started, 'stale report'
    subprocess.run([sys.executable, str(Path(__file__).with_name('verify-vector-sensors.py')), str(out / 'vector-sensors.json')], check=True)
finally:
    if recorder and recorder.poll() is None:
        pid = command('shell', 'pidof', 'screenrecord')
        if pid: command('shell', 'kill', '-2', int(pid))
        recorder.wait(timeout=15)
    if previous == 'null': command('shell', 'settings', 'delete', 'system', 'show_touches')
    else: command('shell', 'settings', 'put', 'system', 'show_touches', previous)
