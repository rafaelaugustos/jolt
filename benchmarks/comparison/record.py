"""Record equivalent release apps with real native touches, separately from timing runs.

python3 benchmarks/comparison/record.py EMULATOR_SERIAL OUTPUT
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('android.py'))
collector = importlib.util.module_from_spec(spec); spec.loader.exec_module(collector)
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('serial')
parser.add_argument('directory', type=Path)
parser.add_argument('--adb-port', type=int, default=5037)
parser.add_argument('--physical', action='store_true')
parser.add_argument('--apps', nargs='+', choices=collector.APPS, default=list(collector.APPS))
args = parser.parse_args()
out = args.directory.resolve(); out.mkdir(parents=True, exist_ok=True)
prefix = ['adb','-P',str(args.adb_port),'-s',args.serial]
def adb(*words): return subprocess.check_output([*prefix,*map(str,words)], text=True, timeout=30)
assert (adb('shell','getprop','ro.kernel.qemu').strip() != '1') == args.physical
metadata = {'physicalDevice':args.physical,'deviceFingerprint':adb('shell','getprop','ro.build.fingerprint').strip(),
            'scope':'Real native playback, original speed; separate from measurements. Screen recording adds work.', 'runs':[]}
for name in dict.fromkeys(args.apps):
    package,activity = collector.APPS[name]
    adb('shell','am','force-stop',package)
    adb('shell','am','start','-n',package+'/'+activity)
    time.sleep(2)
    adb('shell','uiautomator','dump','/sdcard/jolt-comparison-record.xml')
    tree = ET.fromstring(adb('shell','cat','/sdcard/jolt-comparison-record.xml'))
    buttons = {}
    for node in tree.iter('node'):
        labels = [(node.get(field) or '').strip().casefold() for field in ('text','content-desc')]
        for key,label in [('start','start'),('stop','stop'),('runtime','block app runtime'),('ui','block ui thread')]:
            if any(value == label or value.startswith(label+' ·') for value in labels):
                a,b,c,d = map(int,re.findall(r'\d+',node.get('bounds')))
                buttons[key] = [(a+c)//2,(b+d)//2]
    assert len(buttons)==4,(name,buttons)
    (out/(name+'-controls.json')).write_text(json.dumps(buttons,indent=2)+'\n')
    installed = adb('shell','pm','path',package).strip().removeprefix('package:')
    apk_hash = adb('shell','sha256sum',installed).split()[0]
    remote='/sdcard/jolt-comparison-record.mp4'
    existing = subprocess.run([*prefix,'shell','pidof','screenrecord'],capture_output=True,text=True)
    assert not existing.stdout.strip(), 'Another recorder is active on this device'
    with (out/(name+'-record.log')).open('w') as log:
        recorder=subprocess.Popen([*prefix,'shell','screenrecord','--size','720x1280','--bit-rate','4000000','--time-limit','60',remote],stdout=log,stderr=subprocess.STDOUT)
        recording_pid = None
        try:
            time.sleep(1)
            recording_pid = adb('shell','pidof','screenrecord').strip()
            assert re.fullmatch(r'\d+',recording_pid), 'Missing or ambiguous recorder'
            for key,wait in [('start',2),('start',2),('runtime',3),('ui',3),('stop',1),('start',2),('stop',1)]:
                adb('shell','input','tap',*buttons[key]);time.sleep(wait)
        finally:
            if recording_pid:adb('shell','kill','-2',recording_pid)
            recorder.wait(timeout=20)
    destination = out/('comparison-'+name+('-physical-android.mp4' if args.physical else '-android.mp4'))
    adb('pull',remote,destination)
    video_hash = hashlib.sha256(destination.read_bytes()).hexdigest()
    assert video_hash == adb('shell','sha256sum',remote).split()[0], 'Incomplete video transfer'
    metadata['runs'].append({'app':name,'apkSha256':apk_hash,'videoSha256':video_hash,'filename':destination.name})
    (out/'recordings.json').write_text(json.dumps(metadata,indent=2)+'\n')
    adb('shell','am','force-stop',package)
    print(name+': actual native recording saved',flush=True)
