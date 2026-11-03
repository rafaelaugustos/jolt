"""Actual ADB interactions against the packed framework apps. Emulator only.

python3 benchmarks/frameworks/android.py emulator-5588 OUTPUT_DIR
Install each dev.jolt.framework.NAME app first. Run without other device input.
"""
from pathlib import Path
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination, *selected = sys.argv[1:]
output = Path(destination).resolve()
output.mkdir(parents=True, exist_ok=True)

def adb(*args):
    return subprocess.check_output(['adb', '-s', serial, *args], text=True, timeout=30)

assert adb('shell', 'getprop', 'ro.kernel.qemu').strip() == '1', 'Select an emulator.'

def nodes():
    for attempt in range(3):
        adb('shell', 'rm', '-f', '/sdcard/jolt-framework.xml')
        try:
            adb('shell', 'uiautomator', 'dump', '/sdcard/jolt-framework.xml')
            return list(ET.fromstring(adb('shell', 'cat', '/sdcard/jolt-framework.xml')).iter('node'))
        except (subprocess.CalledProcessError, subprocess.TimeoutExpired, ET.ParseError):
            if attempt == 2: raise
            time.sleep(1)

def find(text):
    return next((n for n in nodes() if n.get('text', '').casefold() == text.casefold()), None)

def center(node):
    assert node is not None, 'Missing native control'
    left, top, right, bottom = map(int, re.findall(r'\d+', node.get('bounds')))
    return (left + right) // 2, (top + bottom) // 2

def tap(text):
    x, y = center(find(text))
    adb('shell', 'input', 'tap', str(x), str(y))
    time.sleep(0.8)

report = {'platform': 'Android 16 emulator', 'serial': serial, 'cases': []}
for name, card_text, toggle, replace in [
    ('react', 'React NativeScript', 'Unmount', 'Replace ref'),
    ('svelte', 'Svelte Native', 'Unmount', 'Replace action'),
    ('solid', 'Solid / DOMiNATIVE', 'Unmount / remount', 'Replace directive'),
    ('angular', 'NativeScript Angular', 'Exit / reenter', 'Cancel exit'),
]:
    if selected and name not in selected: continue
    package = 'dev.jolt.framework.' + name
    adb('shell', 'am', 'force-stop', package)
    adb('shell', 'am', 'start', '-n', package + '/com.tns.NativeScriptActivity')
    time.sleep(2)
    initial = center(find(card_text))
    tap('Interrupt')
    moved = center(find(card_text))
    assert moved[0] > initial[0] + 40, (name, initial, moved)
    tap('Interrupt')
    x, y = center(find(card_text))
    adb('shell', 'input', 'swipe', str(x), str(y), str(x), str(y), '500')
    tap(toggle)
    assert find(card_text) is None, name + ' did not remove its native target'
    tap('Remount' if name in ('react', 'svelte') else toggle)
    assert find(card_text) is not None
    tap(replace)
    assert find(card_text) is not None
    tap('Interrupt')
    tap(toggle)
    assert find(card_text) is None
    report['cases'].append({'framework': name, 'passed': True, 'initialCenter': initial,
        'movedCenter': moved, 'checks': ['position interruption', 'real press',
        'unmount/remount', 'ref/action/directive replacement or cancelled Angular exit', 'final removal']})
    (output/'android.json').write_text(json.dumps(report, indent=2) + '\n')
    adb('shell', 'am', 'force-stop', package)
    print(name + ': native checks passed', flush=True)
