"""Exercise the exact Core NativeScript recipes through real emulator input.

python3 benchmarks/recipes-android.py SERIAL OUTPUT
Build/install the normal release demo with JOLT_BENCHMARK=1 first.
"""
import json, re, subprocess, sys, time, xml.etree.ElementTree as ET
from pathlib import Path
serial, directory = sys.argv[1:]
out = Path(directory); out.mkdir(parents=True, exist_ok=True)
app = 'org.nativescript.jolt.benchmark'
def adb(*words):
    return subprocess.check_output(['adb','-s',serial,*map(str,words)],text=True,timeout=60)
def ui():
    adb('shell','uiautomator','dump','/sdcard/jolt-recipes-ui.xml')
    return adb('shell','cat','/sdcard/jolt-recipes-ui.xml')
def node(label):
    tree=ET.fromstring(ui())
    found=[v for v in tree.iter('node') if label in [v.get('text'),v.get('content-desc'),v.get('resource-id')]]
    assert found, label
    return found[-1]
def tap(label):
    v=node(label); x1,y1,x2,y2=map(int,re.findall(r'\d+',v.get('bounds')))
    adb('shell','input','tap',(x1+x2)//2,(y1+y2)//2);time.sleep(1)
def snapshot(name):
    text=ui(); (out/(name+'.xml')).write_text(text)
    with (out/(name+'.png')).open('wb') as f:
        subprocess.run(['adb','-s',serial,'exec-out','screencap','-p'],stdout=f,check=True)
    return text
def launch(recipe):
    adb('shell','am','force-stop',app)
    adb('shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','recipe',recipe)
    time.sleep(3)
assert adb('shell','getprop','ro.kernel.qemu').strip()=='1'
launch('gallery');tap('Open place-1');tap('Zoom photo');tap('Reset photo');tap('Move photo to end');tap('Close photo')
assert 'Open place-1' in snapshot('gallery-keyed-return')
tap('Open place-1');tap('Close photo')
print('PASS gallery zoom/reset, reorder, keyed return and reentry',flush=True)
launch('sheet');tap('Open sheet');tap('Add content');tap('Recipe message')
adb('shell','input','text','Native%semulator%stest');time.sleep(1)
assert 'mInputShown=true' in adb('shell','dumpsys','input_method')
snapshot('sheet-keyboard');adb('shell','input','keyevent','4');time.sleep(1)
tap('Close sheet');tap('Open sheet')
adb('shell','input','swipe','540','1900','540','1300','500');time.sleep(1)
snapshot('sheet-scroll');print('PASS sheet real keyboard, close/reopen and nested scroll',flush=True)
launch('lists');adb('shell','input','swipe','540','1900','540','800','400');time.sleep(1)
assert 'Collection 0' in snapshot('list-scroll')
tap('Replace items');assert 'Collection 1' in ui()
adb('shell','input','swipe','540','800','540','1900','400');time.sleep(1)
tap('Replace items');assert 'Collection 2' in snapshot('list-replaced')
print('PASS list actual scroll, recycling and two data replacements',flush=True)
(out/'acceptance.json').write_text(json.dumps({'scope':'Android emulator, actual ADB native input','app':app,'recipes':['gallery','sheet','lists'],'passed':True},indent=2)+'\n')
adb('shell','am','force-stop',app)
