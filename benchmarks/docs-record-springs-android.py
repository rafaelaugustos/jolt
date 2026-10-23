"""Record actual taps/swipes in the installed Live Springs demo on a dedicated emulator."""
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use a dedicated emulator'
adb = ['adb', '-s', serial]

def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=45)

command('shell', 'am', 'force-stop', 'org.nativescript.jolt.benchmark')
command('shell', 'am', 'start', '-n', 'org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity', '--es', 'live-springs', 'true')
time.sleep(2)
command('shell', 'uiautomator', 'dump', '/sdcard/jolt-live-springs.xml')
root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-live-springs.xml'))
bounds = {}
for node in root.iter('node'):
    name = node.get('content-desc') or node.get('text')
    if name:
        bounds[name] = tuple(map(int, re.findall(r'\d+', node.get('bounds', ''))))
for name, text in [('Target left', 'Left'), ('Target right', 'Right'), ('Shake follower', 'Shake'), ('Toggle reduced motion', 'Reduced motion: off')]:
    if name not in bounds and text in bounds:
        bounds[name] = bounds[text]
for name in ['Target left', 'Target right', 'Shake follower', 'Toggle reduced motion', '◎']:
    assert name in bounds, (name, bounds)

def tap(name, pause):
    left, top, right, bottom = bounds[name]
    command('shell', 'input', 'tap', str((left + right) // 2), str((top + bottom) // 2))
    time.sleep(pause)

previous = command('shell', 'settings', 'get', 'system', 'show_touches').strip()
remote = '/sdcard/jolt-live-springs.mp4'
recording = None
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recording = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000', '--time-limit', '23', remote])
    time.sleep(.8)
    tap('Target right', .2)
    tap('Target left', 1)
    left, top, right, bottom = bounds['◎']
    x1, y = (left + right) // 2, (top + bottom) // 2
    x2 = bounds['Shake follower'][2] - (x1 - bounds['Target left'][0])
    command('shell', 'input', 'swipe', str(x1), str(y), str(x2), str(y), '900')
    command('shell', 'input', 'swipe', str(x2), str(y), str(x1), str(y), '250')
    tap('Target right', .15)
    tap('Shake follower', 1.5)
    tap('Toggle reduced motion', .2)
    tap('Target left', .7)
    tap('Target right', .7)
    tap('Toggle reduced motion', .2)
    tap('Target left', 2)
    recording.wait(timeout=30)
    assert recording.returncode == 0
    output = Path(destination).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    command('pull', remote, str(output))
    with output.with_suffix('.png').open('wb') as screenshot:
        subprocess.run(adb + ['exec-out', 'screencap', '-p'], stdout=screenshot, check=True, timeout=30)
    print('Recorded real target reversals, drags, shake and reduced-motion controls.')
finally:
    if recording and recording.poll() is None:
        recording.wait(timeout=30)
    if previous == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', previous)
