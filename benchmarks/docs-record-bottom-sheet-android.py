"""Capture real bottom-sheet input on a dedicated emulator: SERIAL OUTPUT_DIR INPUT_JAR."""
import pathlib
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, folder, jar = sys.argv[1:]
assert serial.startswith('emulator-'), 'Use a dedicated emulator'
output = pathlib.Path(folder).resolve()
output.mkdir(parents=True, exist_ok=True)
def adb(*args):
    return subprocess.check_output(['adb', '-s', serial, *map(str, args)], text=True)
def dump():
    adb('shell', 'uiautomator', 'dump', '/data/local/tmp/jolt-sheet.xml')
    return ET.fromstring(adb('shell', 'cat', '/data/local/tmp/jolt-sheet.xml'))
def bounds(name, root=None):
    for node in (dump() if root is None else root).iter('node'):
        if node.get('text') == name or node.get('content-desc', '').startswith(name):
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: '+name)
def tap(name, delay=.6):
    x1,y1,x2,y2 = bounds(name)
    adb('shell', 'input', 'tap', (x1+x2)//2, (y1+y2)//2)
    time.sleep(delay)
def swipe(x,y,dy):
    adb('shell', 'input', 'swipe', x,y,x,y+dy,1400)
    time.sleep(.6)

settings = {key: adb('shell','settings','get','system',key).strip()
            for key in ('show_touches','accelerometer_rotation','user_rotation')}
recorder = None
try:
    adb('push',jar,'/data/local/tmp/jolt-gesture-input.jar')
    adb('shell','settings','put','system','show_touches',1)
    adb('shell','am','start','-S','-n','org.nativescript.jolt.benchmark/com.tns.NativeScriptActivity','--es','bottom-sheet','true')
    time.sleep(1.5)
    remote = '/data/local/tmp/bottom-sheet-android.mp4'
    recorder = subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--time-limit','120','--bit-rate','6000000',remote])
    time.sleep(.7)
    tap('Open stays')
    tap('Content')
    tap('More stays')
    tap('Open stays')
    first = bounds('Stays sheet')
    x = (first[0]+first[2])//2
    adb('shell','CLASSPATH=/data/local/tmp/jolt-gesture-input.jar','app_process','/system/bin','NativeGestureInput',x,(first[1]+first[3])//2,'sheet-interrupt')
    time.sleep(1)
    tap('Open stays')
    swipe(x, first[3]+250, -850)
    expanded = bounds('Stays sheet')
    assert expanded[1] < first[1]-300, (first,expanded)
    swipe(x, expanded[3]+650, -500)
    swipe(x, expanded[3]+160, 500)
    swipe(x, expanded[3]+160, 850)
    tap('Open stays')
    tap('Add a trip note')
    adb('shell','input','text','A%scalm%sweekend')
    time.sleep(.8)
    bounds('A calm weekend')
    adb('shell','input','keyevent','KEYCODE_BACK')
    time.sleep(.8)
    adb('shell','input','keyevent','KEYCODE_BACK')
    time.sleep(.8)
    bounds('Panel closed')
    tap('Open stays')
    tap('Close')
    time.sleep(.7)
    adb('shell','pkill','-2','screenrecord')
    recorder.wait(timeout=15)
    recorder = None
    adb('pull',remote,output/'bottom-sheet-android.mp4')
    tap('Open stays')
    adb('shell','settings','put','system','accelerometer_rotation',0)
    adb('shell','settings','put','system','user_rotation',1)
    time.sleep(1.5)
    bounds('A calm weekend')
    adb('shell','settings','put','system','user_rotation',0)
    time.sleep(1)
    tap('Close')
    print('PASS real drags, nested scroll, keyboard, Android back and rotation')
finally:
    if recorder and recorder.poll() is None:
        adb('shell','pkill','-2','screenrecord')
        recorder.wait(timeout=15)
    for key,value in settings.items():
        if value == 'null': adb('shell','settings','delete','system',key)
        else: adb('shell','settings','put','system',key,value)
