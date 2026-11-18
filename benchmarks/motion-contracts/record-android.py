"""Real OS input and recordings on a dedicated emulator; validates native snapshots."""
import contextlib,json,pathlib,re,subprocess,sys,time,xml.etree.ElementTree as ET
serial,folder,jar=sys.argv[1:]
if not serial.startswith('emulator-'):raise SystemExit('Use a dedicated emulator.')
output=pathlib.Path(folder).resolve();output.mkdir(parents=True,exist_ok=True)
lock=pathlib.Path('/tmp/jolt-contracts-recording-'+serial);lock.mkdir()
def adb(*args):return subprocess.check_output(['adb','-s',serial,*map(str,args)],text=True)
controls={}
def bounds(name):
 if name in controls:return controls[name]
 adb('shell','uiautomator','dump','/data/local/tmp/jolt-contracts.xml')
 for node in ET.fromstring(adb('shell','cat','/data/local/tmp/jolt-contracts.xml')).iter('node'):
  for key in [node.get('text'),node.get('content-desc'),node.get('resource-id')]:
   if key:controls[key]=tuple(map(int,re.findall(r'\d+',node.get('bounds'))))
 if name in controls:return controls[name]
 raise AssertionError('Missing control: '+name)
def tap(name,wait=.6):
 a,b,c,d=bounds(name);adb('shell','input','tap',(a+c)//2,(b+d)//2);time.sleep(wait)
 if name in ['Inner waits','Outer waits','Press & carousel','Swipe & reorder','Photo & sheet','Paused velocity']:controls.clear()
def snapshot():
 tap('Snapshot',.15)
 result=json.loads(adb('shell','run-as','dev.jolt.nativeci','cat','files/motion-contracts.json'))
 reports.append(result);return result
def drag(name,dx,dy,hold=False):
 a,b,c,d=bounds(name);x=int(a+(c-a)*.35);y=(b+d)//2
 if hold:adb('shell','CLASSPATH=/data/local/tmp/jolt-gesture-input.jar','app_process','/system/bin','NativeGestureInput',x,y,'reorder',y+dy)
 else:adb('shell','input','swipe',x,y,x+dx,y+dy,850)
 time.sleep(.6)
@contextlib.contextmanager
def record(name):
 remote='/data/local/tmp/'+name+'.mp4';p=subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--bit-rate','5000000',remote]);time.sleep(.7)
 try:yield;time.sleep(.5)
 finally:
  adb('shell','pkill','-2','screenrecord');p.wait(timeout=15);adb('pull',remote,output/(name+'.mp4'))
reports=[];previous=adb('shell','settings','get','system','show_touches').strip()
try:
 adb('shell','settings','put','system','show_touches','1');adb('push',jar,'/data/local/tmp/jolt-gesture-input.jar')
 adb('shell','am','start','-S','-n','dev.jolt.nativeci/com.tns.NativeScriptActivity');time.sleep(2)
 with record('gesture-relations-android'):
  drag('contract-inner',260,0);s=snapshot();assert s['log']==['inner start','inner end'],s
  tap('Outer waits');drag('contract-inner',260,0);s=snapshot();assert s['log']==['outer start','outer end'],s
  tap('Press & carousel');drag('contract-inner',260,0);s=snapshot();assert s['log']==['outer start','outer end'],s
  tap('Swipe & reorder');drag('Alpha',260,0);s=snapshot();assert s['log']==['swipe start','swipe end'] and s['order'][0]=='Alpha',s
  tap('Swipe & reorder');drag('Alpha',0,450,True);s=snapshot();assert s['log']==['reorder start','reorder commit'] and s['order'][0]=='Bravo',s
  tap('Photo & sheet',1.6);drag('contract-photo',0,400);s=snapshot();assert abs(s['height']-180)<3 and s['photo']['scale']==1,s
  tap('Photo & sheet',1.6);a,b,c,d=bounds('contract-photo');adb('shell','CLASSPATH=/data/local/tmp/jolt-gesture-input.jar','app_process','/system/bin','NativeGestureInput',(a+c)//2,(b+d)//2,'photo-pinch');time.sleep(.8);s=snapshot();assert s['photo']['scale']>1.3 and abs(s['height']-420)<3,s
 tap('Paused velocity')
 with record('spring-velocity-android'):
  tap('Move',.35);tap('Pause',.3);s=snapshot();assert s['speed']==0 and s['derivative']==0,s
  time.sleep(1);f=snapshot();assert f['spring']==s['spring'],(s,f)
  tap('Resume',.3);s=snapshot();assert abs(s['speed'])>1,s
  tap('Pause',.4)
 (output/'acceptance.json').write_text(json.dumps(reports,indent=2))
finally:
 try:
  if previous=='null':adb('shell','settings','delete','system','show_touches')
  else:adb('shell','settings','put','system','show_touches',previous)
 finally:lock.rmdir()
