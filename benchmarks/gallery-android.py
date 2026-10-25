"""Real OS input for the complete gallery.
Usage: python3 benchmarks/gallery-android.py ASSIGNED_EMULATOR OUTPUT audit|record [en|pt-BR]
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
gallery_report = f'/sdcard/Android/data/{app}/files/jolt-gallery.json'
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
args=['shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example','gallery']
if mode=='audit': args += ['--es','collection-audit','true','--es','gallery-audit','true','--es','showcase-audit','true']
command(*args);time.sleep(3)
def inject(cx,cy,*args):
    command('shell','CLASSPATH=/data/local/tmp/jolt-predictive-input.jar','app_process','/system/bin','NativeGestureInput',cx,cy,*args)
    time.sleep(.7)
def photo_center():
    a,b,c,d=rect('gallery-image');return (a+c)//2,(b+d)//2
def photo_drag(amount):
    x,y=photo_center();inject(x,y,'reorder',y+amount,220)
def photo_state():
    r=json.loads(command('shell','cat',gallery_report))
    return next(e['state'] for e in reversed(r['events']) if e.get('state'))
def story(audit=False):
    tap('collection-place-1',1)
    x,y=photo_center();inject(x,y,'photo-pinch')
    if audit: assert photo_state()['scale']>1.1,photo_state()
    tap('gallery-reset')
    inject(x,y,'photo-interrupt')
    if audit: assert photo_state()['scale']>1,photo_state()
    # A downward drag while zoomed pans the image; it must not leave the route.
    photo_drag(100);rect('gallery-close')
    tap('gallery-reset')
    photo_drag(100)
    rect('gallery-close')
    if audit: assert abs(photo_state()['y'])<1 and not photo_state()['pending'],photo_state()
    tap('gallery-move',.3)
    photo_drag(500)
    if audit:
        check('drag returns from held pose to current final-row cell','disposed',1,59,'ready')
        r=json.loads(command('shell','cat',gallery_report))
        release=next(e for e in r['events'] if e['event']=='released')
        assert release['extra']['pose']['y']>50,release
        (out/'gallery-trace.json').write_text(json.dumps(r,indent=2)+'\n')
    tap('collection-place-1',1)
    tap('gallery-remove',.3);tap('gallery-close',1.2)
    if audit:check('deleted photo closes through fallback','disposed',2,-1,'unavailable')
    rect('collection-grid')

if mode=='audit':
    story(True)
    tap('collection-reset')
    tap('collection-place-3',1);tap('gallery-zoom');tap('gallery-close',1.2)
    check('transparent square resets zoom and returns','disposed',3,2,'ready')
    tap('collection-place-4',1)
    gesture(True);rect('gallery-close')
    gesture(right=True)
    check('landscape photo system back returns once','disposed',4,3,'ready')
    tap('collection-reset');tap('collection-place-1',1);tap('gallery-zoom')
    gesture(right=True);rect('gallery-close')
    assert photo_state()['scale']<1.01,photo_state()
    gesture(right=True)
    check('first system back resets zoom; second leaves','disposed',5,0,'ready')
    tap('collection-reduce');tap('collection-place-1',1);tap('gallery-close',1)
    check('reduced motion preserves accessible close','disposed',6,0,'unavailable')
    command('shell','am','force-stop',app)
    command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','gallery-direct','true','--es','gallery-audit','true')
    time.sleep(3);tap('gallery-close',1);rect('collection-grid')
    print('Gallery checks passed.',flush=True)
elif mode=='record':
    previous=command('shell','settings','get','system','show_touches');recorder=None;remote='/sdcard/jolt-gallery-video.mp4'
    try:
        command('shell','settings','put','system','show_touches','1')
        recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000',remote]);time.sleep(.6);story();time.sleep(.6)
    finally:
        if recorder:command('shell','pkill','-2','screenrecord');recorder.wait(timeout=15)
        if previous=='null':command('shell','settings','delete','system','show_touches')
        else:command('shell','settings','put','system','show_touches',previous)
    command('pull',remote,out/f'gallery-{locale[0] if locale else "en"}-android.mp4')
else:raise ValueError(mode)
