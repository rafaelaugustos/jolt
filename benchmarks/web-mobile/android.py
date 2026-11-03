"""Real Chrome/keyboard input on a dedicated emulator, with original-speed video.

Start server.mjs, finish Chrome's first-run setup, then:
python3 benchmarks/web-mobile/android.py emulator-5590 OUTPUT
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory = sys.argv[1:]
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
def adb(*args):
    return subprocess.check_output(['adb', '-s', serial, *map(str, args)], text=True, timeout=30)
assert adb('shell', 'getprop', 'ro.kernel.qemu').strip() == '1'
def nodes():
    for _ in range(3):
        adb('shell', 'rm', '-f', '/sdcard/jolt-mobile.xml')
        try:
            adb('shell', 'uiautomator', 'dump', '/sdcard/jolt-mobile.xml')
            return list(ET.fromstring(adb('shell', 'cat', '/sdcard/jolt-mobile.xml')).iter('node'))
        except (subprocess.CalledProcessError, ET.ParseError): time.sleep(.5)
    raise AssertionError('No current browser hierarchy')
def tap(label):
    matches = []
    for _ in range(3):
        matches = [n for n in nodes() if label in (n.get('text'), n.get('content-desc'))]
        if matches: break
        time.sleep(.5)
    assert matches, 'Missing browser control: '+label
    a,b,c,d = map(int, re.findall(r'\d+', matches[-1].get('bounds')))
    adb('shell', 'input', 'tap', (a+c)//2, (b+d)//2)
    time.sleep(.7)
adb('reverse', 'tcp:4318', 'tcp:4318')
adb('shell', 'am', 'force-stop', 'com.android.chrome')
adb('shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', 'http://127.0.0.1:4318/', '-p', 'com.android.chrome')
time.sleep(2)
rotation = adb('shell', 'settings', 'get', 'system', 'user_rotation').strip()
automatic = adb('shell', 'settings', 'get', 'system', 'accelerometer_rotation').strip()
remote = '/sdcard/jolt-web-mobile.mp4'
log = (out/'record.log').open('w')
recorder = subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--time-limit','120',remote], stdout=log, stderr=subprocess.STDOUT)
try:
    time.sleep(1)
    tap('Request haptic'); tap('Enable sensors'); time.sleep(2)
    tap('Snapshot')
    # The browser's native accessibility tree exposes the actual editable field.
    fields = [n for n in nodes() if n.get('class') == 'android.widget.EditText' and n.get('resource-id') != 'com.android.chrome:id/url_bar']
    if fields:
        a,b,c,d = map(int,re.findall(r'\d+',fields[-1].get('bounds')))
        point = [(a+c)//2,(b+d)//2]
    else:
        # This Chrome build omits the fixed transformed input from its ADB tree.
        # These coordinates were inspected in an actual 1080x2400 screencap.
        assert '1080x2400' in adb('shell','wm','size')
        point = [540, 2220]
    (out/'input-point.json').write_text(json.dumps({'point':point,'accessibilityResolved':bool(fields)}))
    adb('shell','input','tap',*point)
    adb('shell','input','text','Jolt%smobile')
    time.sleep(3)
    keyboard = adb('shell','dumpsys','input_method')
    (out/'keyboard.txt').write_text(keyboard)
    assert 'mInputShown=true' in keyboard, 'The real software keyboard did not open'
    # Chrome can retain stale AX button bounds while panning for the keyboard.
    adb('shell','input','keyevent','KEYCODE_BACK'); time.sleep(1)
    tap('Dismiss keyboard'); tap('Snapshot')
    tap('Pause'); tap('Resume')
    adb('shell','settings','put','system','accelerometer_rotation','0')
    adb('shell','settings','put','system','user_rotation','1'); time.sleep(1)
    tap('Snapshot')
    adb('shell','settings','put','system','user_rotation','0'); time.sleep(1)
    tap('Unmount')
    assert not any(n.get('text') == 'Jolt mobile' for n in nodes())
finally:
    adb('shell','settings','put','system','user_rotation',rotation)
    adb('shell','settings','put','system','accelerometer_rotation',automatic)
    pid = adb('shell','pidof','screenrecord').strip()
    if pid: adb('shell','kill','-2',pid)
    recorder.wait(timeout=20); log.close()
    with (out/'web-mobile-android.mp4').open('wb') as video:
        subprocess.run(['adb','-s',serial,'exec-out','cat',remote],stdout=video,check=True)
    (out/'chrome-package.txt').write_text(adb('shell','dumpsys','package','com.android.chrome'))
print('Actual Chrome interactions complete; verify server telemetry and review the recording.')
