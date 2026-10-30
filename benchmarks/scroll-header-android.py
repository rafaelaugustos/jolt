"""Actual OS scroll input on an assigned emulator. Select the preview language first.
Usage: python3 benchmarks/scroll-header-android.py SERIAL OUTPUT audit|record|lifecycle|large-text [en|pt-BR]
"""
import json
from pathlib import Path
import re
import signal
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
serial, directory, mode, *locale = sys.argv[1:]
started_at = time.time() * 1000
assert serial.startswith('emulator-'), 'Use an assigned emulator'
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]; app = 'org.nativescript.jolt.benchmark'
report = f'/sdcard/Android/data/{app}/files/jolt-scroll-header.json'
def command(*args):
    return subprocess.check_output(adb + list(map(str,args)), text=True, timeout=30).strip()
def rect(name):
    for _ in range(3):
        dumped=command('shell','uiautomator','dump','/sdcard/jolt-scroll-ui.xml')
        # Rotation can briefly produce a null root with exit code zero. Never
        # reuse the previous (possibly landscape) hierarchy's coordinates.
        if '/sdcard/jolt-scroll-ui.xml' not in dumped:
            time.sleep(.3)
            continue
        root=ET.fromstring(command('shell','cat','/sdcard/jolt-scroll-ui.xml'))
        for node in root.iter('node'):
            if name in [node.get('resource-id'),node.get('content-desc'),node.get('text')] or node.get('content-desc','').startswith(name+'. '):
                return tuple(map(int,re.findall(r'\d+',node.get('bounds'))))
        time.sleep(.3)
    raise AssertionError('Missing '+name)
def tap(name,delay=.6):
    a,b,c,d=rect(name);command('shell','input','tap',(a+c)//2,(b+d)//2);time.sleep(delay)
def swipe(start,end,duration=500):
    command('shell','input','swipe',540,start,540,end,duration);time.sleep(.8)
def data(): return json.loads(command('shell','cat',report))
def snapshot():
    tap('scroll-header-snapshot');return data()['events'][-1]
def launch():
    command('shell','am','force-stop',app)
    args=['shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example','scroll-header']
    if mode in ['audit','lifecycle','large-text']:args+=['--es','scroll-header-audit','true','--es','showcase-audit','true']
    command(*args);time.sleep(2)
def lifecycle():
    swipe(1750,1100,250)
    tap('scroll-header-cover');tap('scroll-header-reload')
    portrait=snapshot()
    command('shell','settings','put','system','accelerometer_rotation','0')
    command('shell','settings','put','system','user_rotation','1');time.sleep(1)
    landscape=snapshot()
    assert landscape['viewport']['width']>portrait['viewport']['width']
    command('shell','settings','put','system','user_rotation','0');time.sleep(1)
    snapshot()
    # Cache coordinates before the fling. UI hierarchy queries wait for idle.
    a,b,c,d=rect('Back to collection');x,y=(a+c)//2,(b+d)//2
    command('shell',f'input swipe 540 1750 540 850 150 && input tap {x} {y}')
    time.sleep(1)
    result=data()
    assert result['events'][-1]['name']=='disposed'
    assert result['resources']['sources']==result['resources']['nodes']==0
    (out/'lifecycle-android.json').write_text(json.dumps(result,indent=2)+'\n')
    tap('Search examples')
    command('shell','input','text','Made%sto%sscroll')
    command('shell','input','keyevent','KEYCODE_ENTER');time.sleep(.5)
    tap('Open Made to scroll')
    swipe(1750,1100,250)
    fresh=snapshot()
    assert fresh['ready'] and fresh['state']['offset']>0
    (out/'reentry-android.json').write_text(json.dumps(data(),indent=2)+'\n')
def large_text():
    snapshot()
    tap('scroll-header-jump',1);snapshot()
    command('shell','settings','put','system','font_scale','2.0');time.sleep(1)
    snapshot()
    tap('scroll-header-cover',1);snapshot()
    with (out/'large-text-collapsed.png').open('wb') as image:
        subprocess.run(adb+['exec-out','screencap','-p'],stdout=image,check=True)
    tap('scroll-header-top',1);snapshot()
    with (out/'large-text-expanded.png').open('wb') as image:
        subprocess.run(adb+['exec-out','screencap','-p'],stdout=image,check=True)
    a,b,c,d=rect('scroll-header-list')
    command('shell','input','swipe',(a+c)//2,int(b+(d-b)*.78),(a+c)//2,int(b+(d-b)*.4),500)
    time.sleep(.8);snapshot()
    tap('scroll-header-jump',1);snapshot()
    a,b,c,d=rect('scroll-header-section')
    command('shell','input','tap',(a+c)//2,d+100);time.sleep(.5)
    command('shell','settings','put','system','font_scale','1.0');time.sleep(1)
    snapshot()
    tap('scroll-header-top',1);tap('Back to collection',1)
    (out/'large-text-android.json').write_text(json.dumps(data(),indent=2)+'\n')

recorder=None
old=command('shell','settings','get','system','show_touches')
old_rotation=command('shell','settings','get','system','user_rotation')
old_auto=command('shell','settings','get','system','accelerometer_rotation')
old_font=command('shell','settings','get','system','font_scale')
try:
    if mode=='large-text': command('shell','settings','put','system','font_scale','1.0')
    launch()
    if mode in ['record','lifecycle','large-text']:
        command('shell','settings','put','system','show_touches','1')
        command('shell','rm','-f','/sdcard/jolt-scroll-record.mp4')
        recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000','/sdcard/jolt-scroll-record.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        time.sleep(1)
    if mode=='large-text':
        large_text()
    elif mode=='lifecycle':
        lifecycle()
    else:
        swipe(1650,1900);swipe(1750,1250);swipe(1250,1500);swipe(1850,650,150)
        if mode=='audit': snapshot()
        tap('scroll-header-cover');tap('scroll-header-add')
        tap('scroll-header-jump',1)
    if mode=='audit':
        snapshot()
        a,b,c,d=rect('scroll-header-section')
        command('shell','input','tap',540,d+100);time.sleep(.5);snapshot()
        tap('scroll-header-reload',1)
        assert data()['events'][-1]['ready'], 'Scroll source did not reattach after native unload/load'
        portrait=snapshot()
        command('shell','settings','put','system','accelerometer_rotation','0')
        command('shell','settings','put','system','user_rotation','1');time.sleep(1)
        landscape=snapshot()
        assert landscape['viewport']['width']>portrait['viewport']['width'], 'Landscape rotation did not occur'
        command('shell','settings','put','system','user_rotation','0');time.sleep(1);snapshot()
        command('shell','input','keyevent','KEYCODE_HOME');time.sleep(.5)
        command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity');time.sleep(.7);snapshot()
        tap('scroll-header-reduce');tap('scroll-header-top');snapshot()
        tap('scroll-header-short');tap('scroll-header-jump');snapshot()
        tap('scroll-header-empty');tap('scroll-header-jump');snapshot()
        # Normal toolbar back, not an app-internal command or activity kill.
        tap('Back to collection',1)
        (out/'android.json').write_text(json.dumps(data(),indent=2)+'\n')
    elif mode=='record':
        tap('scroll-header-top',1.2);tap('scroll-header-details');time.sleep(1)
finally:
    try:
        if recorder:
            command('shell','pkill','-INT','screenrecord');recorder.communicate(timeout=20)
            assert recorder.returncode==0,'screenrecord failed'
            suffix='-pt' if locale and locale[0]=='pt-BR' else ''
            name='scroll-header-large-text-android' if mode=='large-text' else 'scroll-header-lifecycle-android' if mode=='lifecycle' else 'scroll-header-android'+suffix
            command('pull','/sdcard/jolt-scroll-record.mp4',out/(name+'.mp4'))
    finally:
        for key,value in [('user_rotation',old_rotation),('accelerometer_rotation',old_auto)]:
            if value == 'null': command('shell','settings','delete','system',key)
            else: command('shell','settings','put','system',key,value)
        if mode=='large-text':
            if old_font == 'null': command('shell','settings','delete','system','font_scale')
            else: command('shell','settings','put','system','font_scale',old_font)
        if mode in ['record','lifecycle','large-text']:
            if old == 'null': command('shell','settings','delete','system','show_touches')
            else: command('shell','settings','put','system','show_touches',old)
if mode == 'large-text':
    captured = out/'large-text-android.json'
    assert json.loads(captured.read_text())['events'][0]['time'] >= started_at, 'stale large-text report'
    subprocess.run([sys.executable, str(Path(__file__).with_name('verify-scroll-header-text.py')), str(captured)], check=True)
