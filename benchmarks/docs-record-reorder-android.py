"""Real OS input on a dedicated emulator: SERIAL OUTPUT_DIR INPUT_JAR."""
import json
import pathlib
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, folder, jar = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use a dedicated emulator'
output = pathlib.Path(folder).resolve()
output.mkdir(parents=True, exist_ok=True)
package = 'org.nativescript.jolt.benchmark'
reports = {}
def adb(*args):
    return subprocess.check_output(['adb', '-s', serial, *map(str, args)], text=True, timeout=30)
def dump():
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/jolt-reorder.xml')
    return ET.fromstring(adb('shell', 'cat', '/data/local/tmp/jolt-reorder.xml'))
def bounds(name):
    for node in dump().iter('node'):
        match = node.get('text') == name or node.get('content-desc', '').startswith(name)
        if name == 'list': match = node.get('class') == 'android.widget.ListView'
        if name.startswith('track-'): match = f', track {name[6:]}.' in node.get('content-desc', '')
        if match: return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: '+name)
def tap(name, delay=.6):
    x1,y1,x2,y2 = bounds(name)
    adb('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(delay)
def drag(key, to_y, hold=200, mode='reorder'):
    x1,y1,x2,y2 = bounds(key)
    adb('shell', 'CLASSPATH=/data/local/tmp/jolt-reorder-input.jar', 'app_process', '/system/bin', 'NativeGestureInput', (x1+x2)//2, (y1+y2)//2, mode, to_y, hold)
    time.sleep(.7)
def report(name):
    data = json.loads(adb('shell', 'cat', f'/sdcard/Android/data/{package}/files/jolt-reorder.json'))
    reports[name] = data
    (output/'native-state.json').write_text(json.dumps(reports, indent=2)+'\n')
    assert data['active'] is None, (name,data)
    assert len(data['keys']) == len(set(data['keys'])), name
    assert all(abs(c['alpha']-1)<.001 and abs(c['offset'])<.001 for c in data['cells']), (name,data['cells'])
    return data
def launch(probes=False):
    adb('shell','am','start','-S','-n',package+'/com.tns.NativeScriptActivity','--es','reorder-lab','true','--es','reorder-audit','true',*(['--es','reorder-checks','true'] if probes else []))
    time.sleep(1.5)
    return bounds('list')
def reset(): tap('Start over')

previous = adb('shell','settings','get','system','show_touches').strip()
recorder = None
try:
    adb('push',jar,'/data/local/tmp/jolt-reorder-input.jar')
    adb('shell','settings','put','system','show_touches',1)
    x1,top,x2,bottom = launch()
    initial = report('initial')
    assert len(initial['keys']) == 200
    assert len(set(c['height'] for c in initial['cells'])) > 1, initial['cells']
    remote = '/data/local/tmp/reorder-android.mp4'
    recorder = subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--time-limit','120','--bit-rate','6000000',remote])
    time.sleep(.7)
    drag('track-1', top+850)
    data = report('drop')
    assert len(data['moves']) == 1 and data['moves'][0]['key'] == 'track-1'
    tap('↑ Move up'); tap('↓ Move down'); reset()
    drag('track-2', bottom-30, 2500)
    data = report('recycled')
    assert len(data['moves']) == 1 and data['moves'][0]['toIndex'] > 10, data['moves']
    drag('track-2', top+25, 1800, 'reorder-fast')
    data = report('reverse-fast')
    assert len(data['moves']) == 2 and data['moves'][1]['toIndex'] < data['moves'][0]['toIndex']
    reset()
    time.sleep(.5)
    adb('shell','pkill','-2','screenrecord'); recorder.wait(timeout=15); recorder=None
    adb('pull',remote,output/'reorder-android.mp4')

    x1,top,x2,bottom = launch(True)
    for label,mode,reason in [('Cancel next','reorder','cancelled'),('Remove next','reorder','removed'),('Resize next','reorder','geometry-changed')]:
        reset(); tap(label); drag('track-1', top+400, 1000, mode)
        tap('Verify native')
        data=report(label)
        assert not data['moves'] and data['cancellations'][-1]['reason']==reason, data
        assert len(data['keys']) == (199 if label=='Remove next' else 200)
    reset(); drag('track-1',top+400,300,'reorder-cancel')
    data=report('os-cancel'); assert not data['moves'] and data['cancellations']
    reset(); tap('Reduce motion'); drag('track-1',top+400)
    data=report('reduced'); assert len(data['moves'])==1
    reset(); tap('Move action'); time.sleep(.5); tap('Move action')
    data=report('accessibility-actions')
    assert [m['key'] for m in data['moves']]==['track-1','track-1'] and data['keys'][2]=='track-1', data['moves']
    reset(); tap('track-1')
    for _ in range(2):
        adb('shell','input','keycombination','-t','80','KEYCODE_ALT_LEFT','KEYCODE_DPAD_DOWN'); time.sleep(.8)
    data=report('keyboard')
    assert [m['key'] for m in data['moves']]==['track-1','track-1'] and data['keys'][2]=='track-1', data['moves']
    reset(); tap('Verify native'); report('final')
    print('PASS: 200 items, variable heights, one commit, recycling, fast reverse, cancellation, removal, resize, reduced motion, native accessibility actions and repeated Alt+Down')
finally:
    if recorder and recorder.poll() is None:
        adb('shell','pkill','-2','screenrecord'); recorder.wait(timeout=15)
    if previous=='null': adb('shell','settings','delete','system','show_touches')
    else: adb('shell','settings','put','system','show_touches',previous)
