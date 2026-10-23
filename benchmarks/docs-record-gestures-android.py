"""Record real OS input on a dedicated emulator; pass SERIAL OUTPUT_DIR INPUT_JAR."""
import contextlib
import pathlib
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, folder, jar = sys.argv[1:]
if not serial.startswith('emulator-'):
    raise SystemExit('Use a dedicated emulator serial.')
output = pathlib.Path(folder).resolve()
output.mkdir(parents=True, exist_ok=True)
def adb(*args):
    return subprocess.check_output(['adb', '-s', serial, *map(str, args)], text=True)
def dump():
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/jolt-gestures.xml')
    return ET.fromstring(adb('shell', 'cat', '/data/local/tmp/jolt-gestures.xml'))
def bounds(name, root=None):
    root = dump() if root is None else root
    for node in root.iter('node'):
        if node.get('text') == name or node.get('content-desc') == name:
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: '+name)
def tap(name, delay=.6):
    x1, y1, x2, y2 = bounds(name)
    adb('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(delay)
def status():
    return [node.get('text', '') for node in dump().iter('node')]
@contextlib.contextmanager
def record(name):
    remote = '/data/local/tmp/'+name+'.mp4'
    recorder = subprocess.Popen(['adb', '-s', serial, 'shell', 'screenrecord', '--time-limit', '50', '--bit-rate', '6000000', remote])
    time.sleep(.7)
    try:
        yield
        time.sleep(.7)
    finally:
        # The helper owns the only recorder on this explicitly selected emulator.
        adb('shell', 'pkill', '-2', 'screenrecord')
        recorder.wait(timeout=15)
        adb('pull', remote, output/(name+'.mp4'))

previous = adb('shell', 'settings', 'get', 'system', 'show_touches').strip()
try:
    adb('shell', 'settings', 'put', 'system', 'show_touches', '1')
    adb('push', jar, '/data/local/tmp/jolt-gesture-input.jar')
    adb('shell', 'am', 'start', '-S', '-n', 'org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity', '--es', 'gesture-lab', 'true')
    time.sleep(1.5)
    with record('gesture-composition-android'):
        card = bounds('NORTH\n↗\nSTUDIO')
        cx, cy = (card[0]+card[2])//2, (card[1]+card[3])//2
        adb('shell', 'CLASSPATH=/data/local/tmp/jolt-gesture-input.jar', 'app_process', '/system/bin', 'NativeGestureInput', cx, cy)
        text = next(value for value in status() if value.startswith('x '))
        assert 'scale 1.50' in text and 'rotate 30°' in text, text
        tap('Reset')
        adb('shell', 'input', 'tap', cx, cy)
        time.sleep(.7)
        assert 'Single tap 1 · double taps 0' in status()
        assert 'Existing tap listener: 1' in status()
        adb('shell', 'CLASSPATH=/data/local/tmp/jolt-gesture-input.jar', 'app_process', '/system/bin', 'NativeGestureInput', cx, cy, 'double')
        time.sleep(.7)
        assert 'Double tap 1 · single taps 1' in status()
        tap('Reset')
        adb('shell', 'CLASSPATH=/data/local/tmp/jolt-gesture-input.jar', 'app_process', '/system/bin', 'NativeGestureInput', cx, cy, 'cancel')
        assert 'Gesture cancelled once.' in status()
    tap('Carousel')
    with record('gesture-carousel-android'):
        box = bounds('←  SLIDE SIDEWAYS  →')
        cx, cy = (box[0]+box[2])//2, (box[1]+box[3])//2
        adb('shell', 'input', 'swipe', cx, cy, cx+180, cy, 900)
        time.sleep(.5)
        first = bounds('List item 1 · native scroll')
        adb('shell', 'input', 'swipe', cx, cy, cx, cy-360, 1000)
        time.sleep(.5)
        after = bounds('List item 1 · native scroll')
        assert after[1] < first[1]-100, (first, after)
    tap('Sheet')
    with record('gesture-handoff-android'):
        root = dump()
        row = bounds('Result 2 · keep your finger down', root)
        header = bounds('↕  PANEL · DRAG OR SCROLL', root)
        cx, cy = (row[0]+row[2])//2, (row[1]+row[3])//2
        adb('shell', 'input', 'swipe', cx, cy, cx, cy-850, 1800)
        time.sleep(.6)
        text = next(value for value in status() if value.startswith('x '))
        assert 'y 0 ·' in text, text
        expanded = bounds('↕  PANEL · DRAG OR SCROLL')
        assert expanded[1] < header[1]-300, (header, expanded)
        start = expanded[3]+170
        adb('shell', 'input', 'swipe', cx, start, cx, start+850, 1800)
        time.sleep(.6)
        text = next(value for value in status() if value.startswith('x '))
        assert re.search(r'y (1\d\d|2\d\d) ·', text), text
    adb('shell', 'am', 'start', '-S', '-n', 'org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity', '--es', 'gesture-lab', 'true', '--es', 'gesture-navigation-check', 'true')
    time.sleep(1.5)
    card = bounds('NORTH\n↗\nSTUDIO')
    cx, cy = (card[0]+card[2])//2, (card[1]+card[3])//2
    adb('shell', 'input', 'swipe', cx, cy, cx+180, cy-60, 1200)
    time.sleep(.5)
    from gesture_navigation import verify_navigation
    verify_navigation('android', serial)
    print('PASS multi-touch, cancellation, existing tap listener, carousel and scroll handoff', flush=True)
finally:
    if previous == 'null': adb('shell', 'settings', 'delete', 'system', 'show_touches')
    else: adb('shell', 'settings', 'put', 'system', 'show_touches', previous)
