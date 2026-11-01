"""Pull-to-refresh through actual ADB touch input on a dedicated emulator.
Usage: python3 benchmarks/scroll-header-refresh-android.py SERIAL OUTPUT
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use a dedicated emulator'
out = Path(directory).resolve()
out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
report = f'/sdcard/Android/data/{app}/files/jolt-scroll-header.json'
started = time.time()*1000

def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()

def tree():
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-refresh-ui.xml')
    return ET.fromstring(command('shell', 'cat', '/sdcard/jolt-refresh-ui.xml'))

def bounds(root, name):
    for n in root.iter('node'):
        if name in [n.get('resource-id'), n.get('content-desc'), n.get('text')] or n.get('content-desc','').startswith(name+'. '):
            return tuple(map(int, re.findall(r'\d+', n.get('bounds'))))
    raise AssertionError('Missing ' + name)

def tap(name, wait=.15):
    a,b,c,d = positions[name]
    command('shell', 'input', 'tap', (a+c)//2, (b+d)//2)
    time.sleep(wait)

def swipe(start, end, duration=650):
    command('shell', 'input', 'swipe', x, start, x, end, duration)

def data():
    return json.loads(command('shell', 'cat', report))

checks=[]
def snapshot(label):
    tap('scroll-header-snapshot', .15)
    e=data()['events'][-1]
    assert e['name']=='snapshot'
    checks.append({'label':label,'event':e})
    return e

old=command('shell','settings','get','system','show_touches')
recorder=None
try:
    started=int(command('shell','date','+%s'))*1000-1000
    command('shell','am','force-stop',app)
    command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity',
            '--es','showcase-example','scroll-header','--es','scroll-header-audit','true','--es','showcase-audit','true')
    time.sleep(5)
    root=tree()
    names=['snapshot','refresh','fail-refresh','slow-refresh','reduce','short','empty','reload','jump','top']
    positions={f'scroll-header-{n}':bounds(root,f'scroll-header-{n}') for n in names if n!='top'}
    positions['back']=bounds(root,'Back to collection')
    a,b,c,d=bounds(root,'scroll-header-list');x=(a+c)//2
    height=d-b
    pull_start=int(b+height*.18);pull_end=int(b+height*.9)
    snapshot('initial')
    assert data()['events'][0]['time']>=started,'Stale report'
    command('shell','settings','put','system','show_touches','1')
    recorder=subprocess.Popen(adb+['shell','screenrecord','--time-limit','180','--bit-rate','6000000','/sdcard/jolt-refresh.mp4'])
    time.sleep(.5)
    swipe(pull_start,pull_start+65)
    time.sleep(.7)
    snapshot('short-pull')
    swipe(pull_start,pull_end)
    snapshot('loading')
    tap('scroll-header-refresh')
    tap('scroll-header-refresh')
    time.sleep(2)
    snapshot('success')
    tap('scroll-header-fail-refresh')
    swipe(pull_start,pull_end)
    time.sleep(2)
    snapshot('failure')
    swipe(pull_start,pull_end)
    time.sleep(2)
    snapshot('retry')
    tap('scroll-header-slow-refresh')
    tap('scroll-header-refresh')
    tap('scroll-header-jump',.6)
    swipe(int(b+height*.8),int(b+height*.45),450)
    time.sleep(.8)
    snapshot('scrolled-loading')
    time.sleep(5)
    snapshot('anchored')
    # The collapsed toolbar is now accessible, obtain its real bounds.
    positions['scroll-header-top']=bounds(tree(),'scroll-header-top')
    tap('scroll-header-top',1)
    tap('scroll-header-slow-refresh')
    tap('scroll-header-reduce')
    swipe(pull_start,pull_end)
    snapshot('reduced-loading')
    time.sleep(2)
    snapshot('reduced-success')
    tap('scroll-header-short',.4)
    swipe(pull_start,pull_end)
    time.sleep(2)
    snapshot('short-success')
    tap('scroll-header-empty',.4)
    swipe(pull_start,pull_end)
    time.sleep(2)
    snapshot('empty-success')
    time.sleep(1)
    command('shell','pkill','-INT','screenrecord')
    recorder.wait(timeout=20)
    recorder=None
    command('pull','/sdcard/jolt-refresh.mp4',out/'raw-android.mp4')
    tap('scroll-header-slow-refresh')
    tap('scroll-header-refresh')
    tap('scroll-header-reload',.5)
    time.sleep(5)
    snapshot('unload-cancelled')
    tap('scroll-header-refresh')
    command('shell','input','keyevent','KEYCODE_HOME')
    time.sleep(5)
    command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity')
    time.sleep(.8)
    snapshot('background-cancelled')
    tap('scroll-header-refresh')
    tap('back',1)
    time.sleep(5)
    result=data()
    (out/'android.json').write_text(json.dumps({'checks':checks,'report':result},indent=2)+'\n')
finally:
    if recorder:
        command('shell','pkill','-INT','screenrecord')
        recorder.wait(timeout=20)
        command('pull','/sdcard/jolt-refresh.mp4',out/'raw-android.mp4')
    if old=='null':command('shell','settings','delete','system','show_touches')
    else:command('shell','settings','put','system','show_touches',old)
subprocess.run([sys.executable,str(Path(__file__).with_name('verify-scroll-header-refresh.py')),'android',str(out/'android.json')],check=True)
print(out)
