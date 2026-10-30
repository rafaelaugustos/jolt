"""Hardware-only Android audit. Never injects samples or taps Preview movement.

Usage: python3 benchmarks/sensors-physical-android.py SERIAL OUTPUT lifecycle|intervals|recovery [--reuse]
The initial control coordinates are the reviewed ASUS 1080x1920 portrait layout.
Startup failures are reported, never silently retried as successful test attempts.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination, mode, *options = sys.argv[1:]
assert not serial.startswith('emulator-') and mode in ('lifecycle', 'intervals', 'recovery')
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
app = 'org.nativescript.jolt.benchmark'
report_name = {'lifecycle':'sensors-audit.json','intervals':'sensor-intervals.json','recovery':'sensor-acceptance.json'}[mode]
report_path = f'/sdcard/Android/data/{app}/files/{report_name}'
launch = ['shell', 'am', 'start', '-n', app+'/com.tns.NativeScriptActivity',
          '--es', 'showcase-example', 'device-sensors', '--es', 'showcase-audit', 'true',
          '--es', 'sensors-'+mode, 'true']

def command(*args):
    return subprocess.check_output(adb+list(map(str, args)), text=True, timeout=35).strip()

def data():
    # A boundary report can be observed while the app replaces its JSON bytes.
    # Retry only incomplete serialization, with a strict ceiling.
    deadline=time.monotonic()+5
    while True:
        try:
            return json.loads(command('shell', 'cat', report_path))
        except json.JSONDecodeError:
            if time.monotonic()>=deadline: raise
            time.sleep(.1)

def tap(x, y, delay=.6):
    command('shell', 'input', 'tap', x, y)
    time.sleep(delay)

def snapshot():
    tap(320, 1770)
    assert data()['events'][-1]['name'] == 'snapshot'

def named(name):
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt114-ui.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt114-ui.xml'))
    for node in root.iter('node'):
        label = node.get('content-desc', '')
        if name in (label, node.get('resource-id'), node.get('text')) or label.startswith(name+'. '):
            x,y,r,b=map(int,re.findall(r'\d+',node.get('bounds')))
            assert r>x and b>y
            tap((x+r)//2,(y+b)//2)
            return
    raise AssertionError('Missing control '+name)

def background():
    count = len(data()['events'])
    command('shell', 'input', 'keyevent', 'KEYCODE_HOME')
    time.sleep(2)
    assert any(e['name']=='background' for e in data()['events'][count:])
    command(*launch)
    time.sleep(1.5)
    snapshot()

assert '1080x1920' in command('shell','wm','size'), 'Use the reviewed ASUS portrait layout'
metadata = {key: command('shell','getprop',prop) for key,prop in {
    'model':'ro.product.model','os':'ro.build.version.release','sdk':'ro.build.version.sdk',
    'fingerprint':'ro.build.fingerprint','hardware':'ro.hardware'}.items()}
assert not re.search('generic|emulator|sdk_gphone|goldfish|ranchu',json.dumps(metadata))
(out/'device.json').write_text(json.dumps(metadata,indent=2)+'\n')
(out/'sensorservice.txt').write_text(command('shell','dumpsys','sensorservice'))
old_awake=command('shell','settings','get','global','stay_on_while_plugged_in')
try:
    command('shell','settings','put','global','stay_on_while_plugged_in','3')
    if '--reuse' not in options:
        try:
            previous_session = data()['session']
        except (subprocess.CalledProcessError, json.JSONDecodeError):
            previous_session = None
        command('shell','am','force-stop',app)
        command(*launch)
        time.sleep(7)
    assert command('shell','pidof',app), 'App failed to start; inspect crash log'
    if '--reuse' not in options:
        assert data()['session'] != previous_session, 'Diagnostic did not start a fresh session'
    if mode=='recovery':
        tap(540,1780)
        deadline=time.monotonic()+25
        while time.monotonic()<deadline:
            result=data()
            if result['events'][-1]['name']=='disposed': break
            time.sleep(.5)
        assert result['events'][-1]['name']=='disposed'
    elif mode=='intervals':
        named('sensor-interval-run')
        deadline=time.monotonic()+150
        while time.monotonic()<deadline:
            result=data()
            if result['status'] in ('completed','failed'): break
            time.sleep(2)
        assert result['status']=='completed',result.get('failure')
        named('Back to collection')
    else:
        session=data()['session']
        for cycle in range(3):
            time.sleep(3)
            snapshot()
            time.sleep(6)
            snapshot()
            background()
            if cycle==0:
                tap(850,1500,1)
                snapshot()
                background()
                tap(850,1500,2)
                snapshot()
                tap(750,1650,1)
                snapshot()
                tap(750,1650,2)
                snapshot()
                tap(300,1650,1)
                snapshot()
            tap(125,160,1)
            deadline=time.monotonic()+8
            while data()['events'][-1]['name']!='disposed' and time.monotonic()<deadline:
                time.sleep(.2)
            assert data()['events'][-1]['name']=='disposed'
            if cycle<2:
                if cycle==0:
                    named('Search examples')
                    command('shell','input','text','Move%sthe%slight')
                    command('shell','input','keyevent','KEYCODE_ENTER')
                    time.sleep(.5)
                named('Open Move the light')
        assert data()['session']==session, 'App restarted instead of recreating the screen'
    result=data()
    (out/report_name).write_text(json.dumps(result,indent=2)+'\n')
finally:
    try:
        (out/report_name).write_text(json.dumps(data(),indent=2)+'\n')
    except Exception:
        pass # Preserve the original failure if no readable report exists yet.
    command('shell','settings','put','global','stay_on_while_plugged_in',old_awake)
verifier={'lifecycle':'verify-sensors-physical-ios.py','intervals':'verify-sensor-intervals.py','recovery':'verify-sensor-acceptance.py'}[mode]
subprocess.run([sys.executable,str(Path(__file__).with_name(verifier)),str(out/report_name)],check=True)
