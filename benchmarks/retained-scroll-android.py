"""Record and verify real OS input: SERIAL OUTPUT_DIR INPUT_JAR. Dedicated emulator only."""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, folder, jar = sys.argv[1:]
assert serial.startswith('emulator-')
output = Path(folder).resolve()
output.mkdir(parents=True, exist_ok=True)
package = 'org.nativescript.jolt.benchmark'

def adb(*args):
    return subprocess.check_output(['adb', '-s', serial, *map(str, args)], text=True, timeout=30)

def bounds(name):
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/retained.xml')
    root = ET.fromstring(adb('shell', 'cat', '/data/local/tmp/retained.xml'))
    for node in root.iter('node'):
        if node.get('resource-id') == name or node.get('text') == name:
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: ' + name)

def tap(name, delay=.7):
    x1, y1, x2, y2 = bounds(name)
    adb('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(delay)

def report(name):
    data = json.loads(adb('shell', 'cat', f'/sdcard/Android/data/{package}/files/jolt-retained-scroll.json'))
    (output / (name + '.json')).write_text(json.dumps(data, indent=2)+'\n')
    errors = [e for e in data['events'] if e['event'] == 'error']
    assert not errors, errors
    return data['events']

def shot(name):
    with (output / (name + '.png')).open('wb') as file:
        subprocess.run(['adb', '-s', serial, 'exec-out', 'screencap', '-p'], stdout=file, check=True)

def drag(key, y, hold=200, mode='reorder'):
    x1, y1, x2, y2 = bounds(key)
    adb('shell', 'CLASSPATH=/data/local/tmp/jolt-retained-input.jar', 'app_process', '/system/bin', 'NativeGestureInput', (x1+x2)//2, (y1+y2)//2, mode, y, hold)
    time.sleep(.8)

previous = adb('shell', 'settings', 'get', 'system', 'show_touches').strip()
recorder = None
try:
    adb('push', jar, '/data/local/tmp/jolt-retained-input.jar')
    adb('shell', 'settings', 'put', 'system', 'show_touches', 1)
    started = int(time.time() * 1000)
    adb('shell', 'am', 'start', '-S', '-n', package+'/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'retained-scroll', '--es', 'showcase-audit', 'true')
    deadline = time.monotonic() + 30
    while True:
        time.sleep(.5)
        initial = report('initial')[-1]
        if initial['time'] >= started and initial.get('ready') and len(initial['keys']) == 24:
            break
        assert time.monotonic() < deadline, 'Native demo did not become ready: ' + str(initial)
    assert len(set(row['height'] for row in initial['rows'])) > 1
    x1, top, x2, bottom = bounds('retained-scroll')
    remote = '/data/local/tmp/retained-scroll-android.mp4'
    recorder = subprocess.Popen(['adb', '-s', serial, 'shell', 'screenrecord', '--time-limit', '120', '--bit-rate', '6000000', remote])
    time.sleep(.8)
    adb('shell', 'input', 'swipe', 350, bottom-160, 350, bottom-940, 700)
    time.sleep(.8)
    shot('collapsed')
    tap('retained-add')
    events = report('insert')
    before = next(e for e in reversed(events) if e['event']=='before-insert')
    after = next(e for e in reversed(events) if e['event']=='insert')
    row = next(row for row in before['rows'] if row['top']+row['height'] > before['state']['offset']+110)
    shifted = next(r for r in after['rows'] if r['key']==row['key'])
    assert abs((row['top']-before['state']['offset'])-(shifted['top']-after['state']['offset']))<1, (before, after)
    tap('retained-top', 1)
    drag('handle-new-1', bottom-140)
    moves = [e for e in report('drop') if e['event']=='move']
    assert len(moves)==1 and moves[0]['detail']['key']=='new-1' and moves[0]['detail']['toIndex']>0, moves
    shot('reordered')
    # A drop may reveal the moved row; return to the top before a new pull.
    adb('shell', 'input', 'swipe', 350, top+200, 350, bottom-100, 700)
    time.sleep(.6)
    adb('shell', 'input', 'swipe', 350, top+200, 350, top+900, 800)
    time.sleep(2)
    events = report('refresh')
    assert any(e['event']=='refresh-commit' for e in events), events[-1]
    time.sleep(.8)
    shot('refreshed')
    adb('shell', 'pkill', '-2', 'screenrecord')
    recorder.wait(timeout=15)
    recorder = None
    adb('pull', remote, output/'retained-scroll-android.mp4')
    tap('retained-jump', 1)
    drag('handle-song-8', bottom-20, 2200)
    edges = [e for e in report('edge-scroll') if e['event']=='move']
    assert len(edges)==2 and edges[-1]['detail']['toIndex'] > 15, [e['detail'] for e in edges]
    drag('handle-song-8', top+450, 100, 'reorder-cancel')
    assert any(e['event']=='drag-cancel' for e in report('os-cancel'))
    tap('handle-song-8', .1)
    adb('shell','input','keycombination','-t','80','KEYCODE_ALT_LEFT','KEYCODE_DPAD_UP')
    time.sleep(.8)
    keyboard = [e for e in report('keyboard') if e['event']=='move']
    assert len(keyboard)==3 and keyboard[-1]['detail']['key']=='song-8'
    # Failure, retry, cancellation, reduced motion and lifecycle after the clip.
    tap('retained-details')
    tap('retained-fail')
    tap('retained-refresh', 1.8)
    assert any(e['event']=='refresh-error' for e in report('failure'))
    tap('retained-refresh', 1.8)
    events=report('retry')
    assert events[-1]['commits']>=2
    px1, py1, px2, py2 = bounds('retained-pause')
    tap('retained-refresh', .05)
    adb('shell', 'input', 'tap', (px1+px2)//2, (py1+py2)//2)
    time.sleep(1.6)
    assert report('cancelled')[-1]['commits']==events[-1]['commits']
    tap('retained-pause')
    tap('retained-reduce')
    tap('retained-remount')
    ended=report('disposed')[-1]
    assert ended['resources']=={'headers':0,'reorders':0}, ended
    assert all(row['nativeOpacity']==1 for row in ended['rows'])
    tap('retained-remount', 1)
    assert report('remounted')[-1]['ready']
    tap('retained-remount')
    assert report('final')[-1]['resources']=={'headers':0,'reorders':0}
    print('PASS: variable heights, keyed anchor, actual drag/drop, pull-to-refresh, failure/retry, cancellation, reduced motion, disposal and remount')
finally:
    if recorder and recorder.poll() is None:
        adb('shell', 'pkill', '-2', 'screenrecord')
        recorder.wait(timeout=15)
    if previous=='null': adb('shell', 'settings', 'delete', 'system', 'show_touches')
    else: adb('shell', 'settings', 'put', 'system', 'show_touches', previous)
