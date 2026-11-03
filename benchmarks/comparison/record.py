"""Record equivalent release apps with real native touches, separately from timing runs.

python3 benchmarks/comparison/record.py EMULATOR_SERIAL OUTPUT
"""
import importlib.util
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory = sys.argv[1:]
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
spec = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('android.py'))
collector = importlib.util.module_from_spec(spec); spec.loader.exec_module(collector)
def adb(*args): return subprocess.check_output(['adb','-s',serial,*map(str,args)], text=True, timeout=30)
assert adb('shell','getprop','ro.kernel.qemu').strip() == '1'
for name,(package,activity) in collector.APPS.items():
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
    remote='/sdcard/jolt-comparison-record.mp4'
    with (out/(name+'-record.log')).open('w') as log:
        recorder=subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--time-limit','60',remote],stdout=log,stderr=subprocess.STDOUT)
        try:
            time.sleep(1)
            for key,wait in [('start',2),('runtime',2),('ui',2),('stop',1),('start',2),('stop',1)]:
                adb('shell','input','tap',*buttons[key]);time.sleep(wait)
        finally:
            pid=adb('shell','pidof','screenrecord').strip()
            if pid:adb('shell','kill','-2',pid)
            recorder.wait(timeout=20)
    with (out/('comparison-'+name+'-android.mp4')).open('wb') as video:
        subprocess.run(['adb','-s',serial,'exec-out','cat',remote],stdout=video,check=True)
    adb('shell','am','force-stop',package)
    print(name+': actual native recording saved',flush=True)
