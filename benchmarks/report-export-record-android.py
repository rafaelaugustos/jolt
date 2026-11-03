"""Record real UI/worker exports and cancellation in the release Android demo.
Usage: python3 benchmarks/report-export-record-android.py SERIAL INPUT_REPORT OUTPUT_MP4
The input must be an actual completed playback audit, never generated sample data.
"""
from pathlib import Path
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, source, output = sys.argv[1:]
root = Path(output).resolve().parent
root.mkdir(parents=True, exist_ok=True)
assert json.loads(Path(source).read_text())['phase'] == 'done'
adb = ['adb', '-s', serial]
package = 'org.nativescript.jolt.benchmark'
folder = f'/sdcard/Android/data/{package}/files'
remote = f'{folder}/jolt-report-export-demo.json'

def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=40).strip()

def until(phase, mode=None):
    deadline = time.monotonic() + 30
    while time.monotonic() < deadline:
        value = subprocess.run(adb + ['shell', 'cat', remote], text=True, capture_output=True, timeout=10)
        if value.returncode == 0:
            result = json.loads(value.stdout)
            if result['phase'] == 'error':
                raise RuntimeError(result)
            if result['phase'] == phase and (mode is None or result['mode'] == mode):
                return result
        time.sleep(.15)
    raise TimeoutError(f'{phase} {mode}')

previous = command('shell', 'settings', 'get', 'system', 'show_touches')
recorder = None
try:
    command('push', str(Path(source).resolve()), f'{folder}/profile-input.json')
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    command('shell', 'am', 'force-stop', package)
    command('shell', 'rm', '-f', remote)
    command('shell', 'am', 'start', '-n', f'{package}/com.tns.NativeScriptActivity', '--es', 'report-export', 'true')
    time.sleep(2)
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-report-export.xml')
    tree = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-report-export.xml'))
    buttons = {}
    for node in tree.iter('node'):
        if node.get('text') in ['Export on UI', 'Export in worker', 'Cancel']:
            l, t, r, b = map(int, re.findall(r'\d+', node.get('bounds')))
            buttons[node.get('text')] = (round((l+r)/2), round((t+b)/2))
    assert len(buttons) == 3, buttons
    def tap(name):
        command('shell', 'input', 'tap', *map(str, buttons[name]))
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '18', '/sdcard/jolt-report-export.mp4'])
    time.sleep(.8)
    tap('Export on UI')
    main = until('done', 'main')
    assert main['exports'] == 20 and main['characters'] > 100000
    (root / 'export-main.json').write_text(json.dumps(main, indent=2) + '\n')
    time.sleep(2)
    tap('Export in worker')
    worker = until('done', 'worker')
    assert worker['worker']['threadId'] != worker['mainThreadId']
    assert worker['characters'] == main['characters']
    (root / 'export-worker.json').write_text(json.dumps(worker, indent=2) + '\n')
    time.sleep(2)
    pid = command('shell', 'pidof', package)
    tid = str(worker['worker']['threadId'])
    gone = subprocess.run(adb + ['shell', 'test', '-d', f'/proc/{pid}/task/{tid}']).returncode != 0
    assert gone, 'Completed worker thread is still alive'
    command('pull', f'{folder}/profile-output.json', str(root / 'exported-report.json'))
    assert json.loads((root / 'exported-report.json').read_text()) == json.loads(Path(source).read_text())
    tap('Export in worker')
    tap('Cancel')
    cancelled = until('cancelled')
    time.sleep(2)
    assert until('cancelled')['phase'] == 'cancelled', 'Late completion replaced cancellation'
    (root / 'export-cancel.json').write_text(json.dumps({'result': cancelled, 'completedWorkerTerminated': gone}, indent=2) + '\n')
    recorder.wait(timeout=30)
    assert recorder.returncode == 0
    command('pull', '/sdcard/jolt-report-export.mp4', str(Path(output).resolve()))
    print(json.dumps({'main': main, 'worker': worker, 'cancelled': cancelled}, indent=2))
finally:
    if recorder and recorder.poll() is None:
        recorder.wait(timeout=30)
    if previous == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', previous)
