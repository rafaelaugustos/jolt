"""Real OS input for the complete gallery.
Usage: python3 benchmarks/gallery-android.py ASSIGNED_EMULATOR OUTPUT audit|record|lifecycle|large-text [en|pt-BR]
Select the preview language before recording. No app handlers are invoked by this runner.
"""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import xml.etree.ElementTree as ET

serial, directory, mode, *locale = sys.argv[1:]
started_at = time.time() * 1000
assert serial.startswith('emulator-'), 'Use an explicitly assigned emulator'
out = Path(directory).resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]; app = 'org.nativescript.jolt.benchmark'
report = f'/sdcard/Android/data/{app}/files/jolt-collection.json'
checks = []
gallery_report = f'/sdcard/Android/data/{app}/files/jolt-gallery.json'
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()
def tree():
    for _ in range(3):
        dumped = command('shell', 'uiautomator', 'dump', '/sdcard/jolt-return-ui.xml')
        if '/sdcard/jolt-return-ui.xml' in dumped:
            return ET.fromstring(command('shell', 'cat', '/sdcard/jolt-return-ui.xml'))
        time.sleep(.3)
    raise AssertionError('No fresh accessibility hierarchy')
def rect(name):
    for node in tree().iter('node'):
        if name in [node.get('resource-id'), node.get('text'), node.get('content-desc')]:
            return tuple(map(int, re.findall(r'\d+', node.get('bounds'))))
    raise AssertionError('Missing control: ' + name)
def tap_at(box, delay=.7):
    a,b,c,d = box; command('shell','input','tap',(a+c)//2,(b+d)//2); time.sleep(delay)
def tap(name, delay=.7): tap_at(rect(name), delay)
def gesture(cancel=False, right=False):
    command('shell','CLASSPATH=/data/local/tmp/jolt-predictive-input.jar','app_process','/system/bin','NativeGestureInput',1079 if right else 1,1100,'back-cancel' if cancel else 'back',-480 if right else 480)
    time.sleep(.9)
def data(): return json.loads(command('shell','cat',report))
def check(name, state, commits, index, shared=None):
    r = data()
    deadline = time.monotonic() + 4
    while r['state'] != state and time.monotonic() < deadline:
        time.sleep(.15); r = data()
    assert (r['state'],r['commits'],r['index']) == (state,commits,index), (name,r)
    assert r['flights'] == r['retained'] == 0, (name,r)
    assert r['inputs'] == (0 if state == 'disposed' else 1), (name,r)
    assert all(v['visible'] for v in r['tags']), (name,r)
    if shared:
        latest = next(e['shared'] for e in reversed(r['events']) if 'shared' in e)
        assert latest['status'] == shared, (name,latest)
    checks.append({'check':name,'state':state,'commits':commits,'index':index})
    (out/'android.json').write_text(json.dumps({'platform':'Android 16 / API 36 emulator; actual OS input','checks':checks,'report':r},indent=2)+'\n')
    print(name, 'passed', flush=True)

assert command('shell','settings','get','secure','navigation_mode') == '2'
old_font = command('shell','settings','get','system','font_scale')
def launch():
    command('shell','am','force-stop',app)
    args=['shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','showcase-example','gallery']
    if mode in ['audit','lifecycle','large-text']: args += ['--es','collection-audit','true','--es','gallery-audit','true','--es','showcase-audit','true']
    command(*args);time.sleep(3)
if mode != 'large-text': launch()
def inject(cx,cy,*args):
    command('shell','CLASSPATH=/data/local/tmp/jolt-predictive-input.jar','app_process','/system/bin','NativeGestureInput',cx,cy,*args)
    time.sleep(.7)
def photo_center():
    a,b,c,d=rect('gallery-image');return (a+c)//2,(b+d)//2
def photo_drag(amount):
    x,y=photo_center();inject(x,y,'reorder',y+amount,220)
def photo_state():
    r=json.loads(command('shell','cat',gallery_report))
    return next(e['state'] for e in reversed(r['events']) if e.get('state'))
def gallery_data(): return json.loads(command('shell','cat',gallery_report))
def large_text():
    density=int(re.findall(r'\d+',command('shell','wm','density'))[-1])/160
    def snapshot(): tap('gallery-snapshot')
    def control(name):
        for _ in range(4):
            try:
                box=rect(name)
                sample=next(e for e in reversed(gallery_data()['events']) if e.get('typography',{}).get('zoom'))
                height=sample['typography'][name.replace('gallery-','')]['height']
                if (box[3]-box[1])/density >= height-2:
                    tap_at(box,1)
                    return
            except AssertionError:
                pass
            a,b,c,d=rect('gallery-controls')
            command('shell','input','swipe',(a+c)//2,int(b+(d-b)*.85),(a+c)//2,int(b+(d-b)*.15),400)
        raise AssertionError('Control is not reachable: '+name)
    tap('collection-place-1',1);snapshot()
    control('gallery-zoom');snapshot()
    command('shell','settings','put','system','font_scale','2.0');time.sleep(1)
    snapshot()
    control('gallery-reset');snapshot()
    with (out/'gallery-large-portrait.png').open('wb') as image:
        subprocess.run(adb+['exec-out','screencap','-p'],stdout=image,check=True)
    command('shell','settings','put','system','accelerometer_rotation','0')
    command('shell','settings','put','system','user_rotation','1');time.sleep(1.2)
    control('gallery-zoom');control('gallery-reset');snapshot()
    with (out/'gallery-large-landscape.png').open('wb') as image:
        subprocess.run(adb+['exec-out','screencap','-p'],stdout=image,check=True)
    command('shell','settings','put','system','user_rotation','0');time.sleep(1.2)
    snapshot()
    command('shell','settings','put','system','font_scale','1.0');time.sleep(1)
    snapshot()
    tap('gallery-close',1.3);rect('collection-place-1')
    command('shell','settings','put','system','font_scale','2.0');time.sleep(1)
    tap('collection-place-3',1);snapshot()
    control('gallery-zoom');tap('gallery-close',1.3);rect('collection-place-3')
    command('shell','settings','put','system','font_scale','1.0')
    result={'gallery':gallery_data(),'collection':data()}
    assert result['gallery']['events'][0]['time'] >= started_at, 'Stale gallery text report'
    path=out/'large-text-android.json'
    path.write_text(json.dumps(result,indent=2)+'\n')
    subprocess.run([sys.executable,str(Path(__file__).with_name('verify-gallery-text.py')),str(path)],check=True)
def lifecycle():
    observations=[]
    def observe(name):
        report=gallery_data()
        event=report['events'][-1]
        assert event.get('ready') and event.get('native') and event.get('viewport'),(name,event)
        if observations: assert event['time']>observations[-1]['event']['time'],(name,'No fresh native observation',event)
        state,native=event['state'],event['native']
        assert native['visible'] and native['alpha']>.99,(name,event)
        for prop in ['x','y','scale']:
            assert abs(state[prop]-native[prop])<.02,(name,prop,event)
        assert not state['pending'] and event['viewport']['height']>0,(name,event)
        observations.append({'check':name,'event':event})
        (out/'lifecycle-observations.json').write_text(json.dumps(observations,indent=2)+'\n')
        print(name,'passed',flush=True)
        return event
    tap('collection-place-1',1)
    opened=observe('opened')
    tap('gallery-zoom',1)
    portrait=observe('zoomed portrait')
    assert abs(portrait['state']['scale']-2.5)<.01
    command('shell','settings','put','system','accelerometer_rotation','0')
    command('shell','settings','put','system','user_rotation','1');time.sleep(1.2)
    landscape=observe('zoomed landscape')
    assert landscape['viewport']['width']>portrait['viewport']['width'],landscape
    assert abs(landscape['state']['scale']-2.5)<.01,landscape
    x,y=photo_center()
    command('shell','input','swipe',x,y,x,y+80,300);time.sleep(.8)
    panned=observe('pan after rotation')
    assert abs(panned['state']['y']-landscape['state']['y'])>1,panned
    command('shell','settings','put','system','user_rotation','0');time.sleep(1.2)
    restored=observe('portrait restored')
    assert abs(restored['viewport']['width']-portrait['viewport']['width'])<1
    command('shell','input','keyevent','KEYCODE_HOME');time.sleep(.8)
    suspended=gallery_data()
    assert any(e['event']=='suspended' for e in suspended['events']),suspended
    # Android replaces the Activity's Intent on this real foreground request.
    # Preserve diagnostic extras so subsequent observations remain enabled.
    command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity',
            '--es','collection-audit','true','--es','gallery-audit','true','--es','showcase-audit','true')
    time.sleep(1.2)
    assert any(e['event']=='resumed' for e in gallery_data()['events'])
    resumed=observe('resumed')
    assert resumed['route']==opened['route'] and resumed['depth']==opened['depth'],resumed
    tap('gallery-reset',.8)
    x,y=photo_center();inject(x,y,'photo-pinch')
    assert observe('pinch and pan after resume')['state']['scale']>1.1
    tap('gallery-reset',.8);photo_drag(100)
    cancelled=observe('dismissal cancelled after resume')
    assert abs(cancelled['state']['y'])<1 and abs(cancelled['state']['scale']-1)<.01
    tap('gallery-close',1.2);rect('collection-grid')
    check('backgrounded entry returns through ordinary navigation','disposed',0,0)
    assert data()['depth']==opened['depth']-1,data()
    for count,key,index in [(1,'place-1',0),(2,'place-3',2),(3,'place-4',3)]:
        tap('collection-'+key,1)
        assert observe('reopened '+key)['depth']==opened['depth']
        if count==1: photo_drag(500)
        else: tap('gallery-zoom',.8);tap('gallery-close',1.2)
        rect('collection-grid')
        check('cycle '+str(count)+' returns once and releases resources','disposed',count,index,'ready')
        assert data()['depth']==opened['depth']-1,data()
    report=gallery_data()
    assert len([e for e in report['events'] if e['event']=='released'])==4,report
    unloaded=[e for e in report['events'] if e['event']=='unloaded']
    assert len(unloaded)>=4 and all(not e['ready'] for e in unloaded),unloaded
    assert not [e for e in report['events'] if e['event'] in ['error','route-rejected']],report
    (out/'lifecycle-android.json').write_text(json.dumps({'observations':observations,'gallery':report,'collection':data()},indent=2)+'\n')
    subprocess.run([sys.executable,str(Path(__file__).with_name('verify-gallery-lifecycle.py')),str(out/'lifecycle-android.json')],check=True)
    print('Gallery lifecycle passed.',flush=True)
def story(audit=False):
    tap('collection-place-1',1)
    x,y=photo_center();inject(x,y,'photo-pinch')
    if audit: assert photo_state()['scale']>1.1,photo_state()
    tap('gallery-reset')
    inject(x,y,'photo-interrupt')
    if audit: assert photo_state()['scale']>1,photo_state()
    # A downward drag while zoomed pans the image; it must not leave the route.
    photo_drag(100);rect('gallery-close')
    tap('gallery-reset')
    photo_drag(100)
    rect('gallery-close')
    if audit: assert abs(photo_state()['y'])<1 and not photo_state()['pending'],photo_state()
    tap('gallery-move',.3)
    photo_drag(500)
    if audit:
        check('drag returns from held pose to current final-row cell','disposed',1,59,'ready')
        r=json.loads(command('shell','cat',gallery_report))
        release=next(e for e in r['events'] if e['event']=='released')
        assert release['extra']['pose']['y']>50,release
        (out/'gallery-trace.json').write_text(json.dumps(r,indent=2)+'\n')
    tap('collection-place-1',1)
    tap('gallery-remove',.3);tap('gallery-close',1.2)
    if audit:check('deleted photo closes through fallback','disposed',2,-1,'unavailable')
    rect('collection-grid')

if mode=='audit':
    story(True)
    tap('collection-reset')
    tap('collection-place-3',1);tap('gallery-zoom');tap('gallery-close',1.2)
    check('transparent square resets zoom and returns','disposed',3,2,'ready')
    tap('collection-place-4',1)
    gesture(True);rect('gallery-close')
    gesture(right=True)
    check('landscape photo system back returns once','disposed',4,3,'ready')
    tap('collection-reset');tap('collection-place-1',1);tap('gallery-zoom')
    gesture(right=True);rect('gallery-close')
    assert photo_state()['scale']<1.01,photo_state()
    gesture(right=True)
    check('first system back resets zoom; second leaves','disposed',5,0,'ready')
    tap('collection-reduce');tap('collection-place-1',1);tap('gallery-close',1)
    check('reduced motion preserves accessible close','disposed',6,0,'unavailable')
    command('shell','am','force-stop',app)
    command('shell','am','start','-n',app+'/com.tns.NativeScriptActivity','--es','gallery-direct','true','--es','gallery-audit','true')
    time.sleep(3);tap('gallery-close',1);rect('collection-grid')
    print('Gallery checks passed.',flush=True)
elif mode in ['record','lifecycle','large-text']:
    previous=command('shell','settings','get','system','show_touches');recorder=None;remote='/sdcard/jolt-gallery-video.mp4'
    old_rotation=command('shell','settings','get','system','user_rotation')
    old_auto=command('shell','settings','get','system','accelerometer_rotation')
    try:
        if mode=='large-text':
            command('shell','settings','put','system','font_scale','1.0')
            launch()
        command('shell','settings','put','system','show_touches','1')
        recorder=subprocess.Popen(adb+['shell','screenrecord','--size','720x1600','--bit-rate','4000000',remote]);time.sleep(.6)
        if mode=='large-text': large_text()
        elif mode=='lifecycle': lifecycle()
        else: story()
        time.sleep(2)
    finally:
        try:
            if recorder:
                command('shell','pkill','-2','screenrecord');recorder.wait(timeout=15)
                assert recorder.returncode==0,'screenrecord failed'
                name='gallery-large-text-android' if mode=='large-text' else 'gallery-lifecycle-android' if mode=='lifecycle' else f'gallery-{locale[0] if locale else "en"}-android'
                command('pull',remote,out/(name+'.mp4'))
        finally:
            if mode=='large-text':
                if old_font=='null':command('shell','settings','delete','system','font_scale')
                else:command('shell','settings','put','system','font_scale',old_font)
            for key,value in [('show_touches',previous),('user_rotation',old_rotation),('accelerometer_rotation',old_auto)]:
                if value=='null':command('shell','settings','delete','system',key)
                else:command('shell','settings','put','system',key,value)
else:raise ValueError(mode)
