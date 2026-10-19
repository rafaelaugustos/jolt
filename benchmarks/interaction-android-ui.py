"""Actual touch checks on a dedicated Android device; install --env.interactionChecks first."""
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
    return subprocess.check_output(adb + list(args), text=True)


def controls():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-interaction.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-interaction.xml'))
    return {node.get('text'): node for node in root.iter('node') if node.get('text')}


def bounds(node):
    return tuple(map(int, re.findall(r'-?\d+', node.get('bounds'))))


def center(node):
    l, t, r, b = bounds(node)
    return (l + r) / 2, (t + b) / 2


def tap(x, y):
    command('shell', 'input', 'tap', str(round(x)), str(round(y)))


def action(name, positions):
    tap(*center(positions[name]))
    # Scenario switches request native layout (width, clipping and visibility).
    time.sleep(0.2)


def require(text):
    current = controls()
    assert text in current, (text, list(current))
    return current


density = int(re.findall(r'\d+', command('shell', 'wm', 'density'))[-1]) / 160
command('shell', 'am', 'force-stop', 'org.nativescript.jolt.benchmark')
command('shell', 'am', 'start', '-n', 'org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity')
time.sleep(1)
positions = require('Moving')
initial = bounds(positions['Moving'])
x, y = center(positions['Moving'])
checks = []
action('translation', positions)
tap(x + 100 * density, y)
positions = require('moving 1')
tap(x, y)
tap(x + 200 * density, y)
positions = require('moving 1')
checks.append('visible center activates once; old and final positions do not')
action('Stop', positions)
tap(x + 100 * density, y)
positions = require('moving 2')
checks.append('cancelled animation remains tappable at its visible position')
action('ancestor', positions)
positions = require('Held ancestor')
action('Moving', positions)
positions = require('moving 1')
checks.append('transformed ancestor keeps touch coordinates aligned')
action('clip', positions)
tap(initial[0] + 110 * density, y)
positions = require('moving 1')
tap(initial[0] + 145 * density, y)
positions = require('moving 1')
checks.append('parent clipping rejects the invisible portion')
action('overlap', positions)
tap(x + 100 * density, y)
positions = require('moving 1')
checks.append('overlapping front button wins without duplicate activation')
action('disabled', positions)
tap(x + 100 * density, y)
positions = require('Held disabled')
# NativeScript gates interaction separately from the native accessibility enabled flag.
assert positions['Moving'].get('class') == 'android.widget.Button'
checks.append('disabled control ignores taps and retains native button semantics')
action('live', positions)
time.sleep(1.3)
# Read the painted button rather than waiting for UIAutomator during live motion.
png = subprocess.check_output(adb + ['exec-out', 'screencap', '-p'])
picture = Image.open(io.BytesIO(png)).convert('RGB')
pixels = picture.load()
colored = [(px, py) for py in range(int(initial[1]), int(initial[3])) for px in range(picture.width)
           if all(abs(pixels[px, py][i] - [49, 95, 149][i]) < 8 for i in range(3))]
assert colored, 'No painted moving button found'
visible_x = (min(px for px, _ in colored) + max(px for px, _ in colored)) / 2
assert x + 20 * density < visible_x < x + 160 * density
tap(visible_x, y)
positions = require('moving 1')
checks.append('real tap during continuous motion activates the painted button')
action('Stop', positions)
positions = require('Stopped')
action('Moving', positions)
require('moving 2')
checks.append('press feedback and interruption preserve later activation')
print(json.dumps({'status': 'passed', 'checks': checks}, indent=2))
