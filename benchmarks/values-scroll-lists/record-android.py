"""Explicit emulator/device id; real ADB taps, swipes and screenrecord."""
import json,re,signal,subprocess,sys,time,xml.etree.ElementTree as E
from pathlib import Path
from validate import validate
serial,folder=sys.argv[1:3];output=Path(folder).resolve();output.mkdir(parents=True,exist_ok=True)
lock=Path('/tmp/jolt-values-recording-'+serial);lock.mkdir()
def adb(*args):return subprocess.check_output(['adb','-s',serial,*args],text=True)
def controls():
 adb('shell','uiautomator','dump','/sdcard/jolt-values.xml')
 nodes=E.fromstring(adb('shell','cat','/sdcard/jolt-values.xml'));result={}
 for node in nodes.iter('node'):
  text=node.attrib.get('text');bounds=node.attrib.get('bounds')
  if text and bounds:
   a,b,c,d=map(int,re.findall(r'\d+',bounds));result[text]=((a+c)//2,(b+d)//2)
 return result
def tap(point,wait=.6):adb('shell','input','tap',str(point[0]),str(point[1]));time.sleep(wait)
def swipe(up=True):adb('shell','input','swipe','540',str(1780 if up else 1420),'540',str(1250 if up else 1920),'360');time.sleep(.5)
recorder=None
def start(name):
 global recorder
 recorder=subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--bit-rate','4000000','--size','720x1600','/sdcard/'+name+'.mp4'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE);time.sleep(.6)
def stop(name):
 global recorder
 adb('shell','pkill','-INT','screenrecord');recorder.wait(timeout=10);recorder=None
 subprocess.run(['adb','-s',serial,'pull','/sdcard/'+name+'.mp4',str(output/(name+'.mp4'))],check=True,stdout=subprocess.DEVNULL)
try:
 adb('shell','am','force-stop','dev.jolt.nativeci');adb('shell','am','start','-n','dev.jolt.nativeci/com.tns.NativeScriptActivity');time.sleep(1.5)
 c=controls();start('values-scroll-android');tap(c['Animate'],.4);tap(c['Interrupt'],1.2);tap(c['Animate'],2.8);swipe();tap(c['Audit']);swipe(False);tap(c['Audit']);stop('values-scroll-android')
 tap(c['Layout exits']);c=controls();start('layout-exits-android');tap(c['Mix changes'],1.2);tap(c['Remove'],.15);tap(c['Remove'],1.2);tap(c['Reset']);tap(c['Remove'],.2);tap(c['Cancel']);tap(c['Reset']);tap(c['Reinsert'],1.2);tap(c['Reduce motion']);tap(c['Mix changes']);tap(c['Reduce motion']);stop('layout-exits-android');tap(c['Audit costs'],.8)
 tap(c['Keyed lists']);c=controls();start('list-changes-android');swipe();tap(c['List audit']);tap(c['Insert above'],1.1);tap(c['Delete'],1.1);tap(c['Reverse'],.15);tap(c['Filter'],1.2);tap(c['Reset'],1);swipe(False);tap(c['Delete'],.2);tap(c['Insert above'],1);tap(c['Reduce motion']);tap(c['Reverse']);tap(c['List audit']);stop('list-changes-android')
 report=json.loads(adb('shell','run-as','dev.jolt.nativeci','cat','files/values-scroll-lists.json'));validate(report)
 (output/'acceptance.json').write_text(json.dumps(report,indent=2))
finally:
 if recorder and recorder.poll() is None:adb('shell','pkill','-INT','screenrecord');recorder.wait(timeout=10)
 lock.rmdir()
