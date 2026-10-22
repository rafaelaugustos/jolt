"""Check and record descending ranges with real sheet gestures on a reserved emulator.
Usage: python3 benchmarks/value-ranges-android.py SERIAL OUTPUT_MP4
Install the normal org.nativescript.jolt.benchmark demo first.
"""
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:]
adb = ['adb', '-s', serial]
def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=30)

def controls():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-value-ranges.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-value-ranges.xml'))
    return {node.get('text'): tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
            for node in root.iter('node') if node.get('text')}

def center(rect):
    l, t, r, b = rect
    return (l + r) // 2, (t + b) // 2

previous = command('shell', 'settings', 'get', 'system', 'show_touches').strip()
remote = '/sdcard/jolt-value-ranges.mp4'
recorder = None
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    command('shell', 'am', 'force-stop', 'org.nativescript.jolt.benchmark')
    command('shell', 'am', 'start', '-n', 'org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity', '--es', 'drag-values', 'true')
    time.sleep(2)
    initial = controls()
    assert 'Closed' in initial, initial
    x, y = center(initial['Now playing'])
    toggle = center(initial['Toggle sheet'])
    density = int(command('shell', 'wm', 'density').strip().split()[-1]) / 160
    distance = round(380 * density)
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '24', remote])
    time.sleep(.8)
    command('shell', 'input', 'swipe', str(x), str(y), str(x), str(y - distance), '850')
    time.sleep(1)
    opened = controls()
    assert 'Open' in opened, opened
    assert opened['Library'][0] > initial['Library'][0], 'Page did not shrink with descending progress'
    x2, y2 = center(opened['Now playing'])
    command('shell', 'input', 'swipe', str(x2), str(y2), str(x2), str(y2 + distance), '850')
    time.sleep(1)
    assert 'Closed' in controls()
    command('shell', 'input', 'tap', *map(str, toggle))
    time.sleep(1)
    assert 'Open' in controls()
    command('shell', 'input', 'tap', *map(str, toggle))
    time.sleep(1)
    assert 'Closed' in controls()
    recorder.wait(timeout=35)
    assert recorder.returncode == 0
    Path(destination).resolve().parent.mkdir(parents=True, exist_ok=True)
    command('pull', remote, str(Path(destination).resolve()))
    print('PASS: drag/release in both directions, mapped page scaling, button animation and final state.')
finally:
    if recorder and recorder.poll() is None:
        recorder.wait(timeout=35)
    if previous == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', previous)
