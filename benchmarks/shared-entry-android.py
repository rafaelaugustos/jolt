"""Real OS input on an assigned API 34+ emulator. Installed release preview and gesture helper required.
Usage: python3 benchmarks/shared-entry-android.py emulator-5582 OUTPUT audit|record [en|pt-BR]
Select the requested language through the preview settings before recording; restore it afterwards.
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
out=Path(directory).resolve(); out.mkdir(parents=True,exist_ok=True)
adb=['adb','-s',serial]; app='org.nativescript.jolt.benchmark'
report=f'/sdcard/Android/data/{app}/files/jolt-shared-entry.json'
checks=[]
def command(*args): return subprocess.check_output(adb+list(map(str,args)),text=True,timeout=30).strip()
def tree():
    command('shell','uiautomator','dump','/sdcard/jolt-shared-entry-ui.xml')
    return ET.fromstring(command('shell','cat','/sdcard/jolt-shared-entry-ui.xml'))
def rect(name):
    for node in tree().iter('node'):
        if name in [node.get('resource-id'),node.get('text'),node.get('content-desc')]:
            return tuple(map(int,re.findall(r'\d+',node.get('bounds'))))
    raise AssertionError('Missing control: '+name)
def tap_at(box,delay=.9):
    a,b,c,d=box;command('shell','input','tap',(a+c)//2,(b+d)//2);time.sleep(delay)
def tap(name,delay=.9):tap_at(rect(name),delay)
def gesture(cancel=False,right=False):
    command('shell','CLASSPATH=/data/local/tmp/jolt-predictive-input.jar','app_process','/system/bin','NativeGestureInput',1079 if right else 1,1100,'back-cancel' if cancel else 'back',-480 if right else 480)
    time.sleep(1)
def data():return json.loads(command('shell','cat',report))
def check(name,state,calls,retained,shared=None):
    r=data()
    assert r['state']==state and r['backCalls']==calls,(name,r)
    assert r['flights']==0 and r['active']==0 and r['retained']==retained,(name,r)
    assert r['inputs']==(0 if state=='disposed' else 1),(name,r)
    assert all(v['visible'] for v in r['visible']),(name,r)
    assert r['pixels']==0 if not retained else 0<r['pixels']<=8_000_000,(name,r)
    if shared:
        event=next(e for e in reversed(r['events']) if 'shared' in e)
        assert event['shared']['status']==shared,(name,event)
    checks.append({'check':name,'state':state,'backCalls':calls,'retained':retained})
    (out/'android.json').write_text(json.dumps({'platform':'Android 16 / API 36 emulator; real OS input','checks':checks,'report':r},indent=2)+'\n')
    print(name,'passed',flush=True)

assert command('shell','settings','get','secure','navigation_mode')=='2'
command('shell','am','force-stop',app)
args=['shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example','shared-entry']
if mode=='audit':
    command('shell','rm','-f',report);args+=['--es','shared-entry-audit','true']
command(*args);time.sleep(3)
if mode=='audit':
    tap('shared-entry-photo');check('image attached','idle',0,1)
    gesture(True);check('image left cancel','idle',0,1,'ready')
    assert any(s['flights']==1 and s['active']==1 and any(not v['visible'] for v in s['visible']) for s in data()['snapshots'])
    gesture(True,True);check('image right cancel','idle',0,1,'ready')
    gesture(right=True);check('image right commit','disposed',1,0,'ready');rect('shared-entry-photo')
    tap('shared-entry-pass');gesture(True);check('card cancel','idle',1,1,'ready')
    tap('shared-entry-back');check('card button commit','disposed',2,0,'ready')
    tap('shared-entry-photo');tap('shared-entry-lock');gesture();check('router rejects','idle',3,1,'ready')
    tap('shared-entry-lock');tap('shared-entry-cancel');gesture();check('cancel held gesture','idle',3,1,'ready')
    tap('shared-entry-move-return');gesture();check('changed static source fallback','disposed',4,0,'unavailable')
    tap('shared-entry-missing');tap('shared-entry-photo');tap('shared-entry-back');check('missing target fallback','disposed',5,0,'unavailable')
    tap('shared-entry-missing');tap('shared-entry-reduce');tap('shared-entry-photo');gesture();check('reduced motion','disposed',6,0,'unavailable')
    tap('shared-entry-reduce');tap('shared-entry-photo');tap('shared-entry-dispose');check('explicit disposal','disposed',6,0)
    tap('shared-entry-back');rect('shared-entry-photo')
    tap('shared-entry-photo');command('shell','input','keyevent','3');time.sleep(1);check('suspension releases snapshots','disposed',6,0)
    command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity');time.sleep(1);tap('shared-entry-back');rect('shared-entry-photo')
    print('All shared-entry checks passed.',flush=True)
elif mode=='record':
    photo=rect('shared-entry-photo');card=rect('shared-entry-pass');tap_at(photo);back=rect('shared-entry-back');tap_at(back)
    previous=command('shell','settings','get','system','show_touches');recorder=None;remote='/sdcard/jolt-shared-entry-video.mp4'
    try:
        command('shell','settings','put','system','show_touches','1')
        recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000',remote]);time.sleep(.6)
        tap_at(photo,1);gesture(True);gesture(right=True)
        tap_at(card,1);gesture(True);tap_at(back,1)
    finally:
        if recorder:command('shell','pkill','-2','screenrecord');recorder.wait(timeout=15)
        command('shell','settings','delete','system','show_touches') if previous=='null' else command('shell','settings','put','system','show_touches',previous)
    command('pull',remote,out/f'shared-entry-{locale[0] if locale else "en"}-android.mp4')
else:raise ValueError(mode)
