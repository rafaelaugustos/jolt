"""Record motion value observers, layers and auto-height rolling on a reserved emulator.
Usage: python3 benchmarks/motion-values-android.py SERIAL OUTPUT_DIRECTORY
Requires the normal org.nativescript.jolt.benchmark demo installed.
"""
from pathlib import Path
import re
import shlex
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory = sys.argv[1:3]
selected = sys.argv[3:]
positions = {}
out = Path(directory).resolve()
out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]

def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=30)

def controls():
    for attempt in range(3):
        result = command('shell', 'uiautomator', 'dump', '/sdcard/jolt-motion-values.xml')
        if 'dumped' in result:
            break
        time.sleep(2)
    else:
        raise RuntimeError('No accessibility tree after three attempts')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-motion-values.xml'))
    return {node.get('text'): tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
            for node in root.iter('node') if node.get('text')}

def tap(label, wait=1):
    rect = positions[label]
    l, t, r, b = rect
    command('shell', 'input', 'tap', str((l+r)//2), str((t+b)//2))
    command('shell', 'sleep', str(wait))

def scene(section, name, actions):
    if selected and name not in selected:
        return
    command('shell', 'am', 'force-stop', 'org.nativescript.jolt.benchmark')
    command('shell', 'am', 'start', '-n', 'org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity',
            '--es', 'playground', 'true', '--es', 'section', shlex.quote(section))
    time.sleep(3)
    positions.clear()
    positions.update(controls())
    assert actions[0][0] in positions, 'Demo section did not load'
    for a, b in [('Play observers', 'Restart observers'), ('Detach observer', 'Attach observer'), ('Add charge pulse', 'Remove charge pulse')]:
        if a in positions:
            positions[b] = positions[a]
    remote = '/sdcard/' + name + '.mp4'
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '8000000', remote])
    try:
        command('shell', 'sleep', '1')
        for label, wait in actions:
            tap(label, wait)
        if section == 'rolling auto size':
            result = controls()
            assert 'Passed 18 layout checks' in result, result
        command('shell', 'sleep', '1')
    finally:
        # Signal the remote process explicitly so screenrecord finalizes the MP4.
        command('shell', 'pkill', '-INT', 'screenrecord')
        recorder.wait(timeout=15)
    command('pull', remote, str(out / (name + '.mp4')))
    print('PASS:', name, flush=True)

previous = command('shell', 'settings', 'get', 'system', 'show_touches').strip()
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    scene('value observers', 'value-observers-android', [
        ('Play observers', 3.2), ('Detach observer', 2.4),
        ('Attach observer', 3.2), ('Stop observers', 1),
    ])
    scene('value layers', 'value-layers-android', [
        ('Start base', 1.3), ('Add charge pulse', 2.5), ('Retarget base', 1),
        ('Remove charge pulse', 1.3), ('Retarget base', 1),
        ('Add charge pulse', 2), ('Reset values', 1),
    ])
    scene('rolling auto size', 'rolling-layout-android', [('Check auto height', 18)])
finally:
    if previous == 'null':
        command('shell', 'settings', 'delete', 'system', 'show_touches')
    else:
        command('shell', 'settings', 'put', 'system', 'show_touches', previous)
