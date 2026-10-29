"""Real OS taps/held touch on the opt-in Layers audit. SERIAL OUTPUT_DIRECTORY."""
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:]
out = Path(destination).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
package = 'org.nativescript.jolt.benchmark'
def shell(*args): return subprocess.check_output(adb + ['shell', shlex.join(args)], text=True, timeout=30)
shell('am', 'force-stop', package)
shell('am', 'start', '-n', package+'/com.tns.NativeScriptActivity', '--es', 'playground', 'true', '--es', 'section', 'layers', '--es', 'motion-rfc-checks', 'true')
time.sleep(3)
shell('uiautomator', 'dump', '/sdcard/jolt-motion-rfc.xml')
tree = ET.fromstring(shell('cat', '/sdcard/jolt-motion-rfc.xml'))
positions = {}
for node in tree.iter('node'):
    label = node.get('text')
    if label:
        x1,y1,x2,y2 = map(int, re.findall(r'\d+', node.get('bounds')))
        positions[label] = (str((x1+x2)//2), str((y1+y2)//2))
for label in ['Move', 'Shake', 'Breathe', 'Drag me']: assert label in positions, positions
def tap(label, wait):
    shell('input', 'tap', *positions[label]); time.sleep(wait)
remote = '/sdcard/motion-rfc-android.mp4'
previous = shell('settings', 'get', 'system', 'show_touches').strip()
recorder = None
try:
    shell('settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--size', '720x1600', '--bit-rate', '4000000', remote])
    time.sleep(0.8)
    tap('Move', 0.3); tap('Shake', 0.2)
    # Its center moves by at most 64 DIP, within the enlarged card's touch area.
    x,y = positions['Drag me']
    shell('input', 'swipe', x, y, x, y, '1100')
    time.sleep(2.2)
    tap('Breathe', 2); tap('Shake', 6); tap('Breathe', 2)
finally:
    if recorder:
        shell('pkill', '-INT', 'screenrecord'); recorder.wait(timeout=20)
    if previous == 'null': shell('settings', 'delete', 'system', 'show_touches')
    else: shell('settings', 'put', 'system', 'show_touches', previous)
subprocess.run(adb+['pull', remote, str(out/'motion-rfc-android.mp4')], check=True)
raw = shell('cat', '/sdcard/Android/data/'+package+'/files/jolt-motion-rfc.json')
report = out/'motion-rfc-android.json'; report.write_text(raw)
subprocess.run([sys.executable, str(Path(__file__).with_name('verify-motion-rfc.py')), str(report)], check=True)
