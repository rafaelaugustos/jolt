"""Record the Busy JavaScript demo using real taps on a dedicated Android emulator.
Usage: python3 benchmarks/docs-record-android.py ADB_SERIAL OUTPUT_MP4
Requires the normal org.nativescript.jolt.benchmark demo to be installed.
"""
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, destination = sys.argv[1:]
adb = ['adb', '-s', serial]
def command(*args):
    return subprocess.check_output(adb+list(args), text=True, timeout=30)

previous = command('shell', 'settings', 'get', 'system', 'show_touches').strip()
remote = '/sdcard/jolt-docs-busy.mp4'
recorder = None
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    command('shell', 'am', 'force-stop', 'org.nativescript.jolt.benchmark')
    command('shell', 'am', 'start', '-n', 'org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity',
            '--es', 'playground', 'true', '--es', 'section', 'Busy JavaScript')
    time.sleep(2)
    command('shell', 'uiautomator', 'dump', '/sdcard/jolt-docs-busy.xml')
    root = ET.fromstring(command('shell', 'cat', '/sdcard/jolt-docs-busy.xml'))
    positions = {}
    for node in root.iter('node'):
        if node.get('text') in ['Play','Block JS','Worker']:
            l,t,r,b = map(int, re.findall(r'\d+', node.get('bounds')))
            positions[node.get('text')] = (round((l+r)/2),round((t+b)/2))
    assert len(positions)==3, positions
    recorder = subprocess.Popen(adb+['shell','screenrecord','--bit-rate','8000000','--time-limit','13',remote])
    time.sleep(0.7)
    for name in ['Play','Block JS','Worker']:
        x,y=positions[name]
        command('shell','input','tap',str(x),str(y))
        time.sleep(3)
    recorder.wait(timeout=20)
    assert recorder.returncode==0
    Path(destination).resolve().parent.mkdir(parents=True,exist_ok=True)
    command('pull',remote,str(Path(destination).resolve()))
    command('shell','uiautomator','dump','/sdcard/jolt-docs-busy.xml')
    status=command('shell','cat','/sdcard/jolt-docs-busy.xml')
    assert 'Worker work:' in status, status
    print('Recorded idle, blocked UI thread and worker playback; worker completion verified.')
finally:
    if recorder and recorder.poll() is None:
        recorder.wait(timeout=20)
    if previous=='null':
        command('shell','settings','delete','system','show_touches')
    else:
        command('shell','settings','put','system','show_touches',previous)
