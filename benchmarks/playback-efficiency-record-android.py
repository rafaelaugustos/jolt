"""Record real controls in the normal Android demo. No benchmark runs while recording.
Usage: python3 benchmarks/playback-efficiency-record-android.py SERIAL OUTPUT_MP4
"""
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
serial, destination = sys.argv[1:]
adb = ['adb', '-s', serial]
pkg = 'org.nativescript.jolt.benchmark'
def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=30)
previous = command('shell', 'settings', 'get', 'system', 'show_touches').strip()
remote = '/sdcard/jolt-playback-efficiency.mp4'
recorder = None
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    command('shell', 'am', 'force-stop', pkg)
    command('shell', 'am', 'start', '-n', f'{pkg}/com.tns.NativeScriptActivity', '--es', 'playback-efficiency', 'true')
    time.sleep(2)
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-efficiency.xml')
    tree = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-efficiency.xml'))
    buttons = {}
    for node in tree.iter('node'):
        if node.get('text') in ['Play', 'Pause', 'Resume', '70%', 'Interrupt', 'Stop']:
            l, t, r, b = map(int, re.findall(r'\d+', node.get('bounds')))
            buttons[node.get('text')] = (round((l+r)/2), round((t+b)/2))
    assert len(buttons) == 6, buttons
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '24', remote])
    time.sleep(0.7)
    for name, delay in [('Play', 0.45), ('Pause', 1.2), ('Resume', 3.5),
                        ('Play', 0.3), ('70%', 1.2), ('Resume', 2.0),
                        ('Play', 0.35), ('Interrupt', 3.2), ('Play', 0.5), ('Stop', 2.0)]:
        command('shell', 'input', 'tap', *map(str, buttons[name]))
        time.sleep(delay)
    recorder.wait(timeout=30)
    assert recorder.returncode == 0
    Path(destination).resolve().parent.mkdir(parents=True, exist_ok=True)
    command('pull', remote, str(Path(destination).resolve()))
finally:
    if recorder and recorder.poll() is None:
        recorder.wait(timeout=30)
    if previous == 'null': command('shell', 'settings', 'delete', 'system', 'show_touches')
    else: command('shell', 'settings', 'put', 'system', 'show_touches', previous)
