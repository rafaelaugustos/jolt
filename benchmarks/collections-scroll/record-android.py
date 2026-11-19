"""Real OS contact paths and native snapshots, on a dedicated Android emulator."""
import contextlib,json,pathlib,re,subprocess,sys,time,xml.etree.ElementTree as ET
serial,folder,jar=sys.argv[1:4]
edges_only=len(sys.argv)>4 and sys.argv[4]=='edges'
life_only=len(sys.argv)>4 and sys.argv[4]=='lifecycle'
if not serial.startswith('emulator-'):raise SystemExit('Use a dedicated emulator.')
output=pathlib.Path(folder).resolve();output.mkdir(parents=True,exist_ok=True)
lock=pathlib.Path('/tmp/jolt-collections-recording-'+serial);lock.mkdir()
def adb(*args):return subprocess.check_output(['adb','-s',serial,*map(str,args)],text=True)
def bounds(name):
 adb('shell','uiautomator','dump','/data/local/tmp/jolt-collections.xml')
 for node in ET.fromstring(adb('shell','cat','/data/local/tmp/jolt-collections.xml')).iter('node'):
  if name in [node.get('text'),node.get('content-desc'),node.get('resource-id')]:return tuple(map(int,re.findall(r'\d+',node.get('bounds'))))
 raise AssertionError('Missing control: '+name)
def tap(name,wait=.6):
 a,b,c,d=bounds(name);adb('shell','input','tap',(a+c)//2,(b+d)//2);time.sleep(wait)
def snapshot():
 tap('Audit',.1)
 result=json.loads(adb('shell','run-as','dev.jolt.nativeci','cat','files/collections-scroll.json'))['events'][-1]
 assert result['name']!='ERROR',result
 reports.append(result);return result
def contact(x,y,dx,dy,rx=0,ry=0,hold=100,dwell=0,reverse_dwell=0):
 adb('shell','CLASSPATH=/data/local/tmp/jolt-collections-input.jar','app_process','/system/bin','NativeGestureInput',x,y,'scroll-contact',dx,dy,rx,ry,hold,dwell,reverse_dwell);time.sleep(.7)
@contextlib.contextmanager
def record(name):
 remote='/data/local/tmp/'+name+'.mp4';p=subprocess.Popen(['adb','-s',serial,'shell','screenrecord','--time-limit','0','--bit-rate','5000000',remote]);time.sleep(.7)
 try:yield;time.sleep(.5)
 finally:
  adb('shell','pkill','-2','screenrecord');p.wait(timeout=15);adb('pull',remote,output/(name+'-raw.mp4'))
  subprocess.run(['ffmpeg','-y','-v','error','-i',str(output/(name+'-raw.mp4')),'-an','-vf','fps=30,scale=-2:1200','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(output/(name+'.mp4'))],check=True)
reports=[];previous=adb('shell','settings','get','system','show_touches').strip()
try:
 adb('shell','settings','put','system','show_touches','1');adb('push',jar,'/data/local/tmp/jolt-collections-input.jar')
 adb('shell','am','start','-S','-n','dev.jolt.nativeci/com.tns.NativeScriptActivity');time.sleep(2)
 density=int(adb('shell','wm','density').strip().split()[-1])/160
 if not edges_only and not life_only:
  with record('collection-motion-android'):
   tap('Jump 100');before=snapshot();tap('Prepend');s=snapshot();assert s['count']==201 and s['anchor']==before['anchor'] and abs(s['anchorY']-before['anchorY'])<2,(before,s)
   tap('Remove');tap('Reverse');tap('Changes');tap('Reorder')
   a,b,c,d=bounds('collection-list');contact((a+c)/2,b+32*density,0,160*density,hold=600)
   s=snapshot();assert s['commits']==1 and s['first']=='row-1',s
   tap('Jump 100');contact((a+c)/2,b+32*density,0,d-b-35*density,0,b-d+6*density,hold=600,dwell=6000,reverse_dwell=2000)
   s=snapshot();assert s['commits']==2 and s['lastMove']['key']==s['lastMove']['committed'] and abs(s['panel'])<2,s
   assert s['travel']['maximum']-s['travel']['minimum']>(d-b)/density*2,s
   for index,action in enumerate(['replace','remove','cancel']):
    tap('Jump 100');tap('Arm '+action);contact((a+c)/2,b+32*density,0,150*density,hold=600)
    s=snapshot();assert s['commits']==2 and s['cancels']==index+1,s
   tap('Changes');tap('Reorder');a,b,c,d=bounds('collection-list')
   contact((a+c)/2,b+32*density,0,150*density,hold=600);s=snapshot();assert s['commits']==1,s
   contact((a+c)/2,d-20*density,0,-150*density);s=snapshot();assert s['commits']==1 and s['offset']>50,s
  tap('List handoff')
  with record('scroll-handoff-android'):
   for scene in ['List handoff','CV handoff']:
    tap(scene);a,b,c,d=bounds('collection-list');x=(a+c)/2;y=d-35*density
    contact(x,y,0,-300*density);s=snapshot();assert abs(s['panel'])<2 and s['scroll']>70 and s['ends']==1,s
    tap('Reset');contact(x,y,0,-300*density,0,260*density);s=snapshot();assert s['panel']>80 and abs(s['scroll'])<2,s
   tap('X handoff');a,b,c,d=bounds('collection-list');contact(c-20*density,b+100*density,-260*density,0)
   s=snapshot();assert abs(s['panel'])<2 and s['scroll']>80,s
  tap('LTR')
  with record('horizontal-reorder-android'):
   for scene in ['LTR','RTL']:
    tap(scene);a,b,c,d=bounds('Alpha');contact((a+c)/2,(b+d)/2,(-170 if scene=='RTL' else 170)*density,0,hold=600)
    s=snapshot();assert s['commits']==1 and s['order'][0]=='Bravo',s
  tap('Y source')
  with record('scroll-source-android'):
   for scene in ['Y source','X source','CV source']:
    tap(scene);tap('Offset 400');s=snapshot();assert abs(s['source']['offset']-400)<2 and s['source']['callbacks']==0 and s['source']['updates']>0,s
    if scene!='CV source':
     assert abs(s['baseline']['offset']-s['source']['offset'])<2,s
     tap('Origin');a,b,c,d=bounds('collection-list')
     contact((a+c)/2,(b+d)/2,-100*density if scene=='X source' else 0,-140*density if scene=='Y source' else 0)
     s=snapshot();assert abs(s['source']['offset']-s['baseline']['offset'])<2 and s['source']['callbacks']==0 and s['baseline']['callbacks']>10,s
    if scene!='Y source':
     tap('RTL source');tap('Offset 400');s=snapshot();assert abs(s['source']['offset']-400)<2,s
 elif edges_only:
  tap('LTR')
  with record('horizontal-reorder-edges-android'):
   for scene in ['LTR','RTL']:
    tap(scene);a,b,c,d=bounds('Alpha');contact((a+c)/2,(b+d)/2,(-170 if scene=='RTL' else 170)*density,0,hold=600)
    s=snapshot();assert s['commits']==1,s
    a,b,c,d=bounds('Alpha');left,top,right,bottom=bounds('horizontal-reorder');x=(a+c)/2;y=(b+d)/2
    far=left+3*density if scene=='RTL' else right-3*density;near=right-3*density if scene=='RTL' else left+3*density
    contact(x,y,far-x,0,near-far,0,hold=600,dwell=3000,reverse_dwell=3000)
    s=snapshot();assert abs(s['travel']['minimum'])<2 and abs(s['travel']['maximum']-s['extent'])<2 and s['commits']==2 and s['order'][0]=='Alpha',s
    tap('Reduce');a,b,c,d=bounds('Alpha');contact((a+c)/2,(b+d)/2,(-170 if scene=='RTL' else 170)*density,0,hold=600)
    s=snapshot();assert s['commits']==3,s
    for action in ['cancel','remove','resize']:
     tap(scene);tap('Arm '+action);a,b,c,d=bounds('Alpha');contact((a+c)/2,(b+d)/2,(-170 if scene=='RTL' else 170)*density,0,hold=600)
     s=snapshot();assert s['commits']==0 and s['cancels']==1,s
 else:
  tap('LTR');a,b,c,d=bounds('Alpha');x=(a+c)/2;y=(b+d)/2
  p=subprocess.Popen(['adb','-s',serial,'shell','CLASSPATH=/data/local/tmp/jolt-collections-input.jar','app_process','/system/bin','NativeGestureInput',str(x),str(y),'scroll-contact',str(150*density),'0','0','0','600','3000','0'])
  time.sleep(1.3);adb('shell','input','keyevent','KEYCODE_HOME');p.wait(timeout=10)
  adb('shell','am','start','-n','dev.jolt.nativeci/com.tns.NativeScriptActivity');time.sleep(.8)
  s=snapshot();assert s['commits']==0,s
  events=json.loads(adb('shell','run-as','dev.jolt.nativeci','cat','files/collections-scroll.json'))['events']
  cancelled=[i for i,e in enumerate(events) if e['scene']=='LTR' and e['name']=='cancel']
  assert len(cancelled)==1 and not any(e['name']=='commit' for e in events[:cancelled[0]]),events
  reports.append({'name':'background-events','events':events});tap('LTR')
  a,b,c,d=bounds('Alpha');contact((a+c)/2,(b+d)/2,170*density,0,hold=600);s=snapshot();assert s['commits']==1,s
  tap('Changes');tap('LTR');a,b,c,d=bounds('Alpha');contact((a+c)/2,(b+d)/2,170*density,0,hold=600);s=snapshot();assert s['commits']==1,s
 (output/'acceptance.json').write_text(json.dumps(reports,indent=2))
finally:
 try:
  if previous=='null':adb('shell','settings','delete','system','show_touches')
  else:adb('shell','settings','put','system','show_touches',previous)
 finally:lock.rmdir()
