"""OS-input layout checks; install the normal demo with JOLT_BENCHMARK=1 first."""
import io
import json
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
from PIL import Image

adb = ['adb', '-s', sys.argv[1]]

def command(*args):
    return subprocess.check_output(adb + list(args), text=True, timeout=25)

def controls():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-layout-ui.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-layout-ui.xml'))
    result = {}
    for node in root.iter('node'):
        for name in [node.get('text'), node.get('content-desc')]:
            if name:
                result[name] = tuple(map(int, re.findall(r'-?\d+', node.get('bounds'))))
    return result

def center(bounds):
    l, t, r, b = bounds
    return (l+r)/2, (t+b)/2

def tap_at(x, y):
    command('shell', 'input', 'tap', str(round(x)), str(round(y)))

def tap(name, positions):
    tap_at(*center(positions[name]))

def require(name):
    actual = controls()
    assert name in actual, (name, list(actual))
    return actual

def settled(name):
    for _ in range(4):
        actual = controls()
        if 'Settled · '+name in actual:
            return actual
    raise AssertionError((name, list(actual)))

def near(value, expected, tolerance=3):
    assert abs(value-expected) <= tolerance*density, (value, expected)

density = int(re.findall(r'\d+', command('shell', 'wm', 'density'))[-1])/160
command('shell', 'am', 'force-stop', 'org.nativescript.jolt.benchmark')
command('shell', 'am', 'start', '-n', 'org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity', '--es', 'layout-lab', 'true')
time.sleep(1)
positions = require('Card 1')
one, two = positions['Card 1'], positions['Card 2']
checks = []
tap('Insert', positions); positions = settled('Insert')
assert 'Card 4' in positions
near(positions['Card 2'][1]-two[1],62*density)
tap('Remove', positions); positions = settled('Remove')
assert 'Card 4' not in positions
near(positions['Card 2'][1],two[1])
checks.append('insert/remove move surviving native children and retain stable keys')
tap('Card 1', positions); positions = settled('Card 1')
near(positions['Card 1'][2]-positions['Card 1'][0],300*density)
near(positions['Card 1'][3]-positions['Card 1'][1],100*density)
near(positions['Card 2'][1]-two[1],46*density)
tap('Card 1', positions); positions = settled('Card 1')
checks.append('card expansion/resizing moves neighbours and returns to its original size')
tap('Slow layout', positions); positions = require('Normal layout')
tap('Reverse', positions)
time.sleep(1)
png = subprocess.check_output(adb + ['exec-out','screencap','-p'],timeout=20)
picture = Image.open(io.BytesIO(png)).convert('RGB')
# Sample one vertical line so image processing cannot make the tap coordinates
# stale while the native animation keeps running. Skip the white text naturally.
x = round(center(one)[0])
colored = [y for y in range(max(0,one[1]), min(picture.height,one[3]+round(140*density)))
           if all(abs(picture.getpixel((x,y))[i]-[49,95,149][i])<8 for i in range(3))]
assert colored, 'Moving card is not painted'
y = (min(colored)+max(colored))/2
assert center(one)[1]+10*density < y < center(one)[1]+115*density, y
tap_at(x,y)
positions = settled('Card 1')
assert positions['Card 1'][1] > positions['Card 2'][1]
near(positions['Card 1'][3]-positions['Card 1'][1],100*density)
checks.append('coordinate tap on the painted moving card interrupts reorder and expands that card')
tap('Reverse', positions); time.sleep(0.3)
tap('Stop layout', positions); positions = require('Stopped')
near(positions['Card 1'][1],one[1])
checks.append('stop settles temporary offsets into the final layout')
tap('Normal layout', positions); positions = require('Slow layout')
tap('Size: scale', positions); positions = require('Size: instant')
tap('Card 1', positions); positions = settled('Card 1')
near(positions['Card 1'][3]-positions['Card 1'][1],54*density)
checks.append('instant-size mode preserves final geometry')
tap('Motion: system', positions); positions = require('Motion: reduced')
tap('Reverse', positions); positions = settled('Reverse')
assert positions['Card 1'][1] > positions['Card 2'][1]
checks.append('Reduced Motion applies the new order and completes')
tap('Motion: reduced', positions); positions = require('Motion: system')
tap('Slow layout', positions); positions = require('Normal layout')
tap('Reverse', positions)
tap('Unmount layout', positions); positions = require('Layout examples unmounted')
tap('Mount layout', positions); positions = require('Card 1')
near(positions['Card 1'][1],one[1])
tap('Card 1', positions); settled('Card 1')
checks.append('Vue unmount cancels active work and remount creates a working layout controller')
print(json.dumps({'status':'passed','checks':checks},indent=2))
