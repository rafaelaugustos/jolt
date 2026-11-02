"""Real ADB interaction with the dedicated normal-demo emulator (#338)."""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
serial, destination = sys.argv[1:3]
assert serial.startswith('emulator-')
out = Path(destination); out.mkdir(parents=True, exist_ok=True)
app = 'org.nativescript.jolt.benchmark'
def adb(*args):
    return subprocess.check_output(['adb', '-s', serial, *args], text=True, timeout=30)
def tree():
    adb('shell', 'uiautomator', 'dump', '/sdcard/jolt-replacement.xml')
    return ET.fromstring(adb('shell', 'cat', '/sdcard/jolt-replacement.xml'))
def controls():
    return {node.get('text'): list(map(int, re.findall(r'\d+', node.get('bounds')))) for node in tree().iter('node') if node.get('text')}
def tap(bounds, delay):
    x,y,r,b = bounds
    adb('shell', 'input', 'tap', str((x+r)//2), str((y+b)//2)); time.sleep(delay)
original = adb('shell','settings','get','system','show_touches').strip()
recorder = None
try:
    adb('shell','settings','put','system','show_touches','1')
    adb('shell','am','force-stop',app)
    adb('logcat','-c')
    adb('shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','playground','true','--es','section','replacement')
    time.sleep(4)
    positions = controls()
    assert 'Start motion' in positions, positions.keys()
    remote = '/sdcard/jolt-paused-replacement.mp4'
    recorder = subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--bit-rate','4000000',remote])
    time.sleep(1.5)
    tap(positions['Start motion'], .35)
    tap(positions['Pause motion'], .7)
    tap(positions['Replace view'], 1)
    tap(positions['Check state'], .5)
    assert 'Paused verified' in controls()
    tap(positions['Resume motion'], 3.8)
    tap(positions['Check state'], .5)
    assert 'Resume verified' in controls()
    tap(positions['Reset motion'], 3.6)
    adb('shell','pkill','-INT','screenrecord'); recorder.wait(timeout=20); recorder=None
    adb('pull',remote,str(out/'paused-replacement-android.mp4'))
    log=adb('logcat','-d')
    rows=[json.loads(line.split('JOLT_REPLACEMENT ',1)[1]) for line in log.splitlines() if 'JOLT_REPLACEMENT {' in line]
    if rows: assert len(rows)==2 and all(row['passed'] for row in rows), rows
    # Production builds may strip console.log; both native presentation assertions
    # above are independently surfaced by the real UI and checked by UIAutomator.
    checks = [{'stage':'paused', 'nativeAssertion':'Paused verified'}, {'stage':'resumed', 'nativeAssertion':'Resume verified'}]
    (out/'android.json').write_text(json.dumps({'platform':'Android API36 emulator', 'physical':False, 'checks':checks, 'consoleSamples':rows},indent=2)+'\n')
    print(json.dumps(checks), flush=True)
finally:
    if recorder:
        adb('shell','pkill','-INT','screenrecord');recorder.wait(timeout=20)
    if original == 'null': adb('shell','settings','delete','system','show_touches')
    else: adb('shell','settings','put','system','show_touches',original)
