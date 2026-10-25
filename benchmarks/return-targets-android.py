"""Real OS input for recycled return targets.
Usage: python3 benchmarks/return-targets-android.py ASSIGNED_EMULATOR OUTPUT audit|record [en|pt-BR]
Select the preview language before recording. No app handlers are invoked by this runner.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory, mode, *locale = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use an explicitly assigned emulator'
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]; app = 'org.nativescript.jolt.benchmark'
report = f'/sdcard/Android/data/{app}/files/jolt-collection.json'
checks = []
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()
def tree():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-return-ui.xml')
    return ET.fromstring(command('shell', 'cat', '/sdcard/jolt-return-ui.xml'))
def rect(name):
    for node in tree().iter('node'):
        if name in [node.get('resource-id'), node.get('text'), node.get('content-desc')]:
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: ' + name)
def tap_at(box, delay=.7):
    a,b,c,d = box; command('shell','input','tap',(a+c)//2,(b+d)//2); time.sleep(delay)
def tap(name, delay=.7): tap_at(rect(name), delay)
def gesture(cancel=False, right=False):
    command('shell','CLASSPATH=/data/local/tmp/jolt-predictive-input.jar','app_process','/system/bin','NativeGestureInput',1079 if right else 1,1100,'back-cancel' if cancel else 'back',-480 if right else 480)
    time.sleep(.9)
def data(): return json.loads(command('shell','cat',report))
def check(name, state, commits, index, shared=None):
    r = data()
    deadline = time.monotonic() + 4
    while r['state'] != state and time.monotonic() < deadline:
        time.sleep(.15); r = data()
    assert (r['state'],r['commits'],r['index']) == (state,commits,index), (name,r)
    assert r['flights'] == r['retained'] == 0, (name,r)
    assert r['inputs'] == (0 if state == 'disposed' else 1), (name,r)
    assert all(v['visible'] for v in r['tags']), (name,r)
    if shared:
        latest = next(e['shared'] for e in reversed(r['events']) if 'shared' in e)
        assert latest['status'] == shared, (name,latest)
    checks.append({'check':name,'state':state,'commits':commits,'index':index})
    (out/'android.json').write_text(json.dumps({'platform':'Android 16 / API 36 emulator; actual OS input','checks':checks,'report':r},indent=2)+'\n')
    print(name, 'passed', flush=True)

assert command('shell','settings','get','secure','navigation_mode') == '2'
command('shell','am','force-stop',app)
args = ['shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example','return-targets']
if mode == 'audit':
    command('shell','rm','-f',report); args += ['--es','collection-audit','true']
command(*args); time.sleep(3)

def story(audit=False):
    tap('collection-place-1',1)
    tap('collection-move',.3)
    gesture(True)
    if audit: check('cancel keeps detail and never calls resolver/route','idle',0,59)
    gesture(right=True)
    if audit:
        check('committed return resolves moved item at final row','disposed',1,59,'ready')
        assert data()['resolvedTag'] == 'collection:place-1'
    tap('collection-place-1',1)
    tap('collection-remove',.3)
    tap('collection-back',1.2)
    if audit:
        check('deleted item takes one fallback route','disposed',2,-1,'unavailable')
        assert all(v['tag'] != 'collection:place-1' for v in data()['tags'])
    rect('collection-grid')

if mode == 'audit':
    story(True)
    tap('collection-reset'); tap('collection-reduce')
    tap('collection-place-1',1); tap('collection-back',1)
    check('reduced motion still resolves current identity','disposed',3,0,'unavailable')
    tap('collection-reduce'); tap('collection-place-1',1)
    back = rect('collection-back'); tap_at(back,0); tap_at(back,1)
    check('repeated back commits only once','disposed',4,0,'ready')
    print('Return target checks passed.',flush=True)
elif mode == 'record':
    previous=command('shell','settings','get','system','show_touches')
    recorder=None;remote='/sdcard/jolt-return-video.mp4'
    try:
        command('shell','settings','put','system','show_touches','1')
        recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000',remote])
        time.sleep(.6);story();time.sleep(.6)
    finally:
        if recorder:
            command('shell','pkill','-2','screenrecord');recorder.wait(timeout=15)
        if previous == 'null':command('shell','settings','delete','system','show_touches')
        else:command('shell','settings','put','system','show_touches',previous)
    command('pull',remote,out/f'return-targets-{locale[0] if locale else "en"}-android.mp4')
else: raise ValueError(mode)
