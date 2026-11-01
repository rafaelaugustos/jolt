"""Real OS taps/held touch on the opt-in Layers audit. SERIAL OUTPUT_DIRECTORY."""
import json
from pathlib import Path
import re
import shlex
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:3]
negative = "--negative" in sys.argv[3:]
out = Path(destination).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
package = 'org.nativescript.jolt.benchmark'
def shell(*args): return subprocess.check_output(adb + ['shell', shlex.join(args)], text=True, timeout=30)
shell('am', 'force-stop', package)
shell('am', 'start', '-n', package+'/com.tns.NativeScriptActivity', '--es', 'playground', 'true', '--es', 'section', 'layers', '--es', 'layer-cleanup-checks', 'true', *(['--es', 'layer-cleanup-negative', 'true'] if negative else []))
time.sleep(3)
shell('uiautomator', 'dump', '/sdcard/jolt-layer-cleanup.xml')
tree = ET.fromstring(shell('cat', '/sdcard/jolt-layer-cleanup.xml'))
positions = {}
for node in tree.iter('node'):
    label = node.get('text')
    if label:
        x1,y1,x2,y2 = map(int, re.findall(r'\d+', node.get('bounds')))
        positions[label] = (str((x1+x2)//2), str((y1+y2)//2))
for label in ['Move']: assert label in positions, positions
def tap(label, wait):
    shell('input', 'tap', *positions[label]); time.sleep(wait)
remote = '/sdcard/layer-cleanup-android.mp4'
previous = shell('settings', 'get', 'system', 'show_touches').strip()
recorder = None
try:
    shell('settings', 'put', 'system', 'show_touches', '1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--size', '720x1600', '--bit-rate', '4000000', remote])
    time.sleep(0.8)
    tap('Move', 9)

finally:
    if recorder:
        shell('pkill', '-INT', 'screenrecord'); recorder.wait(timeout=20)
    if previous == 'null': shell('settings', 'delete', 'system', 'show_touches')
    else: shell('settings', 'put', 'system', 'show_touches', previous)
subprocess.run(adb+['pull', remote, str(out/'layer-cleanup-android.mp4')], check=True)
raw = shell('cat', '/sdcard/Android/data/'+package+'/files/jolt-layer-cleanup.json')
report = out/'layer-cleanup-android.json'; report.write_text(raw)
assert json.loads(raw)['status'] == ('failed' if negative else 'passed'), raw
if negative: assert 'Interrupted release' in json.loads(raw)['error'], raw
print(raw)
