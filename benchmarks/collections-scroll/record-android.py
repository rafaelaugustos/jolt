"""Real OS contact paths and native snapshots, on a dedicated Android emulator."""
import contextlib,json,pathlib,re,subprocess,sys,time,xml.etree.ElementTree as ET
serial,folder,jar=sys.argv[1:4]
layouts_only=len(sys.argv)>4 and sys.argv[4]=='layouts'
edges_only=len(sys.argv)>4 and sys.argv[4]=='edges'
life_only=len(sys.argv)>4 and sys.argv[4]=='lifecycle'
if not serial.startswith('emulator-'):raise SystemExit('Use a dedicated emulator.')
output=pathlib.Path(folder).resolve();output.mkdir(parents=True,exist_ok=True)
lock=pathlib.Path('/tmp/jolt-collections-recording-'+serial);lock.mkdir()
def adb(*args):return subprocess.check_output(['adb','-s',serial,*map(str,args)],text=True)
control_bounds={}
static_controls={'Carousel','RTL','Grid','Heights','Transfer','Audit','Cancel','Move','Jump','Delete','Insert','Empty','Reject'}
def bounds(name):
 if layouts_only and name in control_bounds:return control_bounds[name]
 adb('shell','uiautomator','dump','/data/local/tmp/jolt-collections.xml')
 match=None
 for node in ET.fromstring(adb('shell','cat','/data/local/tmp/jolt-collections.xml')).iter('node'):
  labels=[node.get('text'),node.get('content-desc'),node.get('resource-id')]
  rect=tuple(map(int,re.findall(r'\d+',node.get('bounds'))))
  if layouts_only and node.get('class')=='android.widget.Button':
   for label in labels:
    if label in static_controls:control_bounds[label]=rect
  if name in labels:match=rect
 if match:return match
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
 adb('shell','am','start','-W','-S','-n','dev.jolt.nativeci/com.tns.NativeScriptActivity');time.sleep(2)
 if layouts_only:
  deadline=time.monotonic()+75
  while True:
   try:bounds('Carousel');break
   except (AssertionError,ET.ParseError):
    if time.monotonic()>=deadline:raise
    time.sleep(.5)
 density=int(adb('shell','wm','density').strip().split()[-1])/160
 if layouts_only:
  def read_history():
   return json.loads(adb('shell','run-as','dev.jolt.nativeci','cat','files/collection-layouts.json'))['history']
  def state():
   previous=len(read_history())
   tap('Audit',.1)
   deadline=time.monotonic()+10
   while time.monotonic()<deadline:
    for value in read_history()[previous:]:
     if value['scene']==scene and value['audit']:
      assert not value['message'].startswith('Error'),value
      reports.append(value)
      return value
    time.sleep(.1)
   raise AssertionError('No new audit from '+scene)
  def center(name):
   a,b,c,d=bounds(name);return ((a+c)/2,(b+d)/2)
  def drag(source,target,hold):
   x,y=center(source);xx,yy=center(target);contact(x,y,xx-x,yy-y,hold=hold)
  failures=[]
  for scene in sys.argv[5:] or ['Carousel','RTL','Grid','Heights','Transfer']:
   try:
    tap(scene,1);control_bounds={key:rect for key,rect in control_bounds.items() if key in {'Carousel','RTL','Grid','Heights','Transfer'}}
    with record('collection-'+scene.lower()+'-android'):
     if scene=='Transfer':
      drag('Atlas','Elm',120);assert state()['commits']==1,reports[-1]
      tap('Reject');drag('Birch','Dune',120);assert state()['commits']==1,reports[-1]
      xx,yy=center('Dune');tap('Reject');tap('Empty');x,y=center('Birch');contact(x,y,xx-x,yy-y,hold=120)
      assert state()['right']==['Birch'],reports[-1]
     else:
      if scene!='Heights':
       drag('Card 01','Card 04' if scene=='Grid' else 'Card 03',600)
       assert state()['commits']==1,reports[-1]
       a,b,c,d=bounds('cards');x,y=center('Card 01')
       far=(x,d-4*density) if scene=='Grid' else (c-4*density,y)
       near=(x,b+4*density) if scene=='Grid' else (a+4*density,y)
       contact(x,y,far[0]-x,far[1]-y,near[0]-far[0],near[1]-far[1],hold=600,dwell=1200,reverse_dwell=800)
       before=state();tap('Cancel',.05)
       contact(x,y,far[0]-x,far[1]-y,hold=600,dwell=800)
       after=state();assert after['commits']==before['commits'] and after['cancels']>before['cancels'],(before,after)
      tap('Jump',1);before=state();tap('Insert');after=state()
      assert after['count']==65 and (scene=='Grid' or (after['anchor']==before['anchor'] and abs(after['offset']-before['offset'])<2)),(before,after)
      tap('Move')
      tap('Delete');assert state()['count']==64,reports[-1]
   except (AssertionError,subprocess.CalledProcessError,ET.ParseError) as error:
    failures.append((scene,str(error)));print('Failed',scene,error,flush=True)
   else:print('Passed',scene,flush=True)
  (output/'acceptance.json').write_text(json.dumps(reports,indent=2))
  assert not failures,failures
 elif not edges_only and not life_only:
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
