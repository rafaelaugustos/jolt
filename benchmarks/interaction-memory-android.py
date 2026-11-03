"""Retained-process-memory samples after real repeated gallery/scroll input.
Usage: python3 benchmarks/interaction-memory-android.py SERIAL OUTPUT [ROUNDS] [both|gallery|scroll]
Five post-interaction PSS samples are a baseline, not a proof of leak freedom.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET
serial,destination=sys.argv[1:3];rounds=int(sys.argv[3]) if len(sys.argv)>3 else 5
only=sys.argv[4] if len(sys.argv)>4 else 'both'
assert rounds>0 and only in ['both','gallery','scroll']
out=Path(destination);out.mkdir(parents=True,exist_ok=True)
app='org.nativescript.jolt.benchmark'
def adb(*args):return subprocess.check_output(['adb','-s',serial,*map(str,args)],text=True,timeout=30)
assert adb('shell','getprop','ro.kernel.qemu').strip()=='1'
def tap(name):
    adb('shell','uiautomator','dump','/sdcard/jolt-memory-ui.xml')
    tree=ET.fromstring(adb('shell','cat','/sdcard/jolt-memory-ui.xml'))
    matches=[n for n in tree.iter('node') if name in [n.get('text'),n.get('content-desc'),n.get('resource-id')]
        or n.get('content-desc','').startswith(name+'. ')]
    assert matches,name
    a,b,c,d=map(int,re.findall(r'\d+',matches[-1].get('bounds')))
    adb('shell','input','tap',(a+c)//2,(b+d)//2);time.sleep(.7)
def launch(scene):
    adb('shell','am','force-stop',app)
    adb('shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example',scene,
        '--es','gallery-audit','true','--es','collection-audit','true','--es','scroll-header-audit','true')
    time.sleep(3)
def sample(name):
    memory=adb('shell','dumpsys','meminfo',app);(out/(name+'.txt')).write_text(memory)
    total=re.search(r'TOTAL PSS:\s*(\d+)',memory)
    assert total,memory
    return {'sample':name,'pssKiB':int(total[1])}
samples={}
if only!='scroll':
    launch('gallery');tap('collection-place-1');tap('gallery-close')
    samples['gallery']=[sample('gallery-warm')]
    adb('shell','dumpsys','gfxinfo',app,'reset')
    for i in range(1,rounds+1):
        tap('collection-place-1');tap('gallery-zoom');tap('gallery-close');time.sleep(.5)
        deadline=time.monotonic()+5
        while True:
            data=json.loads(adb('shell','cat',f'/sdcard/Android/data/{app}/files/jolt-collection.json'))
            if data['state']=='disposed' or time.monotonic()>deadline:break
            time.sleep(.15)
        assert data['state']=='disposed' and data['flights']==data['retained']==data['inputs']==0
        samples['gallery'].append(sample('gallery-'+str(i)))
        print('PASS gallery round',i,flush=True)
    (out/'gallery-frames.txt').write_text(adb('shell','dumpsys','gfxinfo',app,'framestats'))
if only!='gallery':
    launch('scroll-header')
    samples['scroll']=[sample('scroll-warm')]
    adb('shell','dumpsys','gfxinfo',app,'reset')
    for i in range(1,rounds+1):
        adb('shell','input','swipe','540','1750','540','850','150');time.sleep(.8)
        tap('scroll-header-cover');tap('scroll-header-top')
        samples['scroll'].append(sample('scroll-'+str(i)))
        print('PASS scroll round',i,flush=True)
    tap('Back to collection')
    data=json.loads(adb('shell','cat',f'/sdcard/Android/data/{app}/files/jolt-scroll-header.json'))
    assert data['resources']['sources']==data['resources']['nodes']==0
    (out/'scroll-disposed.json').write_text(json.dumps(data,indent=2)+'\n')
    (out/'scroll-frames.txt').write_text(adb('shell','dumpsys','gfxinfo',app,'framestats'))
(out/'samples.json').write_text(json.dumps({'scope':'Android emulator; warm process PSS includes runtime, decoded images and caches. No forced GC; finite repeated runs do not prove absence of leaks. Gfxinfo measures UI rendering, not physical presentation.', 'rounds':rounds,'samples':samples},indent=2)+'\n')
print('PASS repeated real interactions, process PSS baseline and final zero Jolt native resources',flush=True)
