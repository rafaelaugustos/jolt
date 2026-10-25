"""Actual OS scroll input on an assigned emulator. Select the preview language first.
Usage: python3 benchmarks/scroll-header-android.py SERIAL OUTPUT audit|record [en|pt-BR]
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
assert serial.startswith('emulator-'), 'Use an assigned emulator'
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]; app = 'org.nativescript.jolt.benchmark'
report = f'/sdcard/Android/data/{app}/files/jolt-scroll-header.json'
def command(*args):
    return subprocess.check_output(adb + list(map(str,args)), text=True, timeout=30).strip()
def rect(name):
    command('shell','uiautomator','dump','/sdcard/jolt-scroll-ui.xml')
    root=ET.fromstring(command('shell','cat','/sdcard/jolt-scroll-ui.xml'))
    for node in root.iter('node'):
        if name in [node.get('resource-id'),node.get('content-desc'),node.get('text')]:
            return tuple(map(int,re.findall(r'\d+',node.get('bounds'))))
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
    if mode=='audit':args+=['--es','scroll-header-audit','true','--es','showcase-audit','true']
    command(*args);time.sleep(2)
launch()
recorder=None
old=command('shell','settings','get','system','show_touches')
try:
    if mode=='record':
        command('shell','settings','put','system','show_touches','1')
        command('shell','rm','-f','/sdcard/jolt-scroll-record.mp4')
        recorder=subprocess.Popen(adb+['shell','screenrecord','--bit-rate','6000000','/sdcard/jolt-scroll-record.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
        time.sleep(1)
    swipe(1650,1900);swipe(1750,1250);swipe(1250,1500);swipe(1850,650,150)
    if mode=='audit': snapshot()
    tap('scroll-header-cover');tap('scroll-header-add')
    tap('scroll-header-jump',1)
    if mode=='audit':
        snapshot()
        a,b,c,d=rect('scroll-header-section')
        command('shell','input','tap',540,d+100);time.sleep(.5);snapshot()
        command('shell','input','keyevent','KEYCODE_HOME');time.sleep(.5)
        command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity');time.sleep(.7);snapshot()
        tap('scroll-header-reduce');tap('scroll-header-top');snapshot()
        tap('scroll-header-short');tap('scroll-header-jump');snapshot()
        tap('scroll-header-empty');tap('scroll-header-jump');snapshot()
        # Normal toolbar back, not an app-internal command or activity kill.
        command('shell','input','tap',110,210);time.sleep(1)
        (out/'android.json').write_text(json.dumps(data(),indent=2)+'\n')
    else:
        tap('scroll-header-top',1.2);tap('scroll-header-details');time.sleep(1)
finally:
    try:
        if recorder:
            command('shell','pkill','-INT','screenrecord');recorder.communicate(timeout=20)
            assert recorder.returncode==0,'screenrecord failed'
            suffix='-pt' if locale and locale[0]=='pt-BR' else ''
            command('pull','/sdcard/jolt-scroll-record.mp4',out/('scroll-header-android'+suffix+'.mp4'))
    finally:
        if mode == 'record':
            if old == 'null': command('shell','settings','delete','system','show_touches')
            else: command('shell','settings','put','system','show_touches',old)
