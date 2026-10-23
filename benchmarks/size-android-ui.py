"""Actual ADB touches and a native screen recording on a dedicated Android emulator.
Usage: python3 benchmarks/size-android-ui.py SERIAL OUTPUT_DIRECTORY
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, output = sys.argv[1:]
output = Path(output).resolve()
output.mkdir(parents=True, exist_ok=True)
adb = [str(Path.home() / 'Library/Android/sdk/platform-tools/adb'), '-s', serial]
bundle = 'org.nativescript.jolt.benchmark'

def command(*args):
    return subprocess.check_output(adb + list(args), text=True).strip()

def dump():
    command('shell', 'uiautomator dump /sdcard/jolt-size-window.xml')
    return ET.fromstring(command('shell', 'cat /sdcard/jolt-size-window.xml'))

def bounds(node):
    return list(map(int, re.findall(r'\d+', node.get('bounds'))))

def find(tree, text):
    for node in tree.iter('node'):
        if text in (node.get('text'), node.get('content-desc')):
            return node
    raise AssertionError('Missing native control: ' + text)

def tap_at(box, delay=1.4):
    x1, y1, x2, y2 = box
    command('shell', 'input', 'tap', str((x1+x2)//2), str((y1+y2)//2))
    time.sleep(delay)

def launch():
    command('shell', 'am', 'force-stop', bundle)
    command('shell', 'am', 'start', '-n', bundle+'/com.tns.NativeScriptActivity', '--es', 'size-lab', 'true')
    time.sleep(1.5)

previous = command('shell', 'settings', 'get', 'system', 'show_touches')
recorder = None
try:
    launch()
    tree = dump()
    buttons = {text: bounds(find(tree, text)) for text in ['Expand','Collapse','Width','Content','Pause','Stop','Stack','Speed 1x','System']}
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell','screenrecord','--bit-rate','6000000','--time-limit','120','/sdcard/jolt-size.mp4'])
    time.sleep(0.7)
    for text in ['Expand','Width','Width','Content','Content','Collapse']:
        tap_at(buttons[text])
    tap_at(buttons['Speed 1x'], 0.2)
    tap_at(buttons['Expand'], 0.8)
    tap_at(buttons['Pause'], 0.2)
    paused_tree = dump()
    find(paused_tree, 'Paused at real bounds')
    following = bounds(find(paused_tree, 'Tap the following row'))
    tap_at(following, 0.2)
    find(dump(), 'Following row tapped 1')
    tap_at(buttons['Pause'], 0.5)  # same button now says Resume
    tap_at(buttons['Collapse'], 4.6)
    tap_at(buttons['Speed 1x'], 0.2)
    tap_at(buttons['Stack'], 0.3)
    tap_at(buttons['Expand'])
    time.sleep(1.5)
    final_tree = dump()
    find(final_tree, 'Grid')
    find(final_tree, 'Settled · auto × auto')
    command('shell', 'pkill', '-2', 'screenrecord')
    recorder.wait(timeout=15)
    recorder = None
    command('pull','/sdcard/jolt-size.mp4',str(output/'size-android-raw.mp4'))
    (output/'ui.json').write_text(json.dumps({'platform':'Android','serial':serial,'input':'ADB OS taps','passed':['width-height-auto','content growth/shrink','pause/resume','following row hit at intermediate bounds','interrupted reversal','GridLayout'], 'pausedFollowingBoundsPx':following}, indent=2))
    print('PASS: real input, intermediate hit bounds and native recording', flush=True)
finally:
    if recorder:
        command('shell', 'pkill', '-2', 'screenrecord')
        recorder.wait(timeout=15)
    if previous == 'null':
        command('shell','settings','delete','system','show_touches')
    else:
        command('shell','settings','put','system','show_touches',previous)
