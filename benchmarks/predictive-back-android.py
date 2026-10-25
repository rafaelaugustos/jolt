"""Actual Android system edge gestures. Dedicated emulator, installed release demo, shell input helper.
Usage: python3 benchmarks/predictive-back-android.py emulator-5582 OUTPUT audit|record [en|pt-BR]
The helper is built by gesture-input/build.py and pushed to /data/local/tmp/jolt-predictive-input.jar.
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
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
report_path = f'/sdcard/Android/data/{app}/files/jolt-predictive-back.json'
identity = [0, 0, 1, 1, 1, 0]
checks = []
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()
def launch(audit=False, home=False):
    command('shell', 'am', 'force-stop', app)
    args = ['shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity']
    if not home: args += ['--es', 'showcase-example', 'predictive-back']
    if audit:
        command('shell', 'rm', '-f', report_path)
        args += ['--es', 'predictive-back-audit', 'true']
    command(*args); time.sleep(3)
def tree():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-predictive-ui.xml')
    return ET.fromstring(command('shell', 'cat', '/sdcard/jolt-predictive-ui.xml'))
def rect(name):
    for node in tree().iter('node'):
        if name in [node.get('resource-id'), node.get('text'), node.get('content-desc')]:
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: ' + name)
def tap_at(box, delay=.8):
    x1,y1,x2,y2=box; command('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2); time.sleep(delay)
def tap(name, delay=.8): tap_at(rect(name), delay)
def gesture(edge='left', cancel=False):
    command('shell', 'CLASSPATH=/data/local/tmp/jolt-predictive-input.jar', 'app_process', '/system/bin', 'NativeGestureInput', 1 if edge=='left' else 1079, 1100, 'back-cancel' if cancel else 'back', 480 if edge=='left' else -480)
    time.sleep(.9)
def data(): return json.loads(command('shell','cat',report_path))
def check(name, state, commits, callbacks, outcome=None, reason=None):
    r=data()
    assert r['supported'] and r['state']==state and r['commits']==commits, (name,r)
    assert r['callbacks']==callbacks and r['active']==0 and r['transform']==identity, (name,r)
    if outcome:
        event=next(e for e in reversed(r['events']) if 'outcome' in e)
        assert event['outcome']==outcome and event.get('reason')==reason, (name,event)
    checks.append({'check':name,'state':state,'commits':commits,'callbacks':callbacks,'progressEvents':r['progressEvents']})
    (out/'android.json').write_text(json.dumps({'platform':'Android 16 / API 36 emulator; real OS input','checks':checks,'report':r},indent=2)+'\n')
    print(name, 'passed', flush=True)

assert command('shell','settings','get','secure','navigation_mode')=='2', 'Enable gesture navigation on this assigned emulator'
if mode=='audit':
    launch(True); tap('predictive-open'); check('attached', 'idle',0,1)
    gesture(cancel=True); check('left cancel', 'idle',0,1,'cancelled')
    gesture('right',True); check('right cancel','idle',0,1,'cancelled')
    gesture('right'); check('right commit','disposed',1,0,'completed')
    tap('predictive-open'); tap('predictive-lock'); gesture(); check('router guard rejects','idle',2,1,'cancelled','rejected')
    tap('predictive-lock'); tap('predictive-cancel'); gesture(); check('cancel held gesture','idle',2,1,'cancelled')
    command('shell','input','keyevent','4'); time.sleep(1); check('hardware back','disposed',3,0,'completed')
    tap('predictive-reduce'); tap('predictive-open'); start=len(data()['snapshots']); gesture()
    check('reduced motion','disposed',4,0,'completed')
    assert all(s['transform']==identity for s in data()['snapshots'][start:]), 'Reduced motion must preserve presentation'
    tap('predictive-reduce'); tap('predictive-open'); tap('predictive-keyboard'); tap('predictive-input')
    before=len(data()['events']); command('shell','input','keyevent','4'); time.sleep(.8)
    assert len(data()['events'])==before, 'IME must consume the first back'
    check('keyboard first','idle',4,1)
    gesture(); check('gesture after keyboard','disposed',5,0,'completed')
    tap('predictive-open'); tap('predictive-disable'); command('shell','input','keyevent','4'); time.sleep(1)
    check('disabled delegates to router','disposed',5,0); rect('predictive-open')
    tap('predictive-open'); tap('predictive-dispose'); check('explicit disposal','disposed',5,0)
    command('shell','input','keyevent','4'); time.sleep(1); rect('predictive-open')
    tap('predictive-open'); command('shell','input','keyevent','3'); time.sleep(.6)
    command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity'); time.sleep(1)
    gesture(); check('resume and commit','disposed',6,0,'completed')
    r=data()
    assert r['progressEvents']>100 and r['progressEvents']>len(r['events'])*2, 'Progress must be handled natively'
    print('All predictive back checks passed.', flush=True)
elif mode=='record':
    language=locale[0] if locale else 'en'
    launch(False)
    opened=rect('predictive-open'); tap_at(opened); back=rect('predictive-back'); tap_at(back); time.sleep(.5)
    previous=command('shell','settings','get','system','show_touches')
    recorder=None; remote='/sdcard/jolt-predictive-back.mp4'
    try:
        command('shell','settings','put','system','show_touches','1')
        recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000',remote])
        time.sleep(.6); tap_at(opened,1)
        gesture(cancel=True); gesture('right'); time.sleep(.4)
        tap_at(opened,1); tap_at(back,1)
    finally:
        if recorder:
            command('shell','pkill','-2','screenrecord'); recorder.wait(timeout=15)
        command('shell','settings','delete','system','show_touches') if previous=='null' else command('shell','settings','put','system','show_touches',previous)
    command('pull',remote,out/f'predictive-back-{language}-android.mp4')
    print('Recorded real native cancel, right-edge commit and accessible button.',flush=True)
else: raise ValueError(mode)
