"""Real Android touches; optional dedicated ADB port. No audio is captured by screenrecord.
Usage: python3 benchmarks/record-interaction-android.py SERIAL OUTPUT_DIR [PORT]
"""
from pathlib import Path
import json, re, subprocess, sys, time
import xml.etree.ElementTree as ET
serial, destination, *ports = sys.argv[1:]
adb = ['adb', '-P', ports[0] if ports else '5037', '-s', serial]
output = Path(destination).resolve(); output.mkdir(parents=True, exist_ok=True)
package = 'org.nativescript.jolt.benchmark'
def command(*args): return subprocess.check_output(adb + list(args), text=True, timeout=40)
def controls(mode):
    # A failed uiautomator dump must never reuse the preceding scene's coordinates.
    remote = '/sdcard/jolt-depth-ui-'+mode+'.xml'
    for attempt in range(8):
        dump = command('shell', 'uiautomator', 'dump', remote)
        if 'dumped to:' not in dump:
            time.sleep(.5); continue
        root = ET.fromstring(command('shell', 'cat', remote))
        result = {}
        edges.clear()
        for node in root.iter('node'):
            name = node.get('resource-id', '')
            if name.startswith('depth-'):
                l,t,r,b = map(int, re.findall(r'\d+', node.get('bounds')))
                result[name[6:]] = (str(round((l+r)/2)), str(round((t+b)/2)))
                edges[name[6:]] = (l, t, r, b)
        if all(name in result for name in ['play','replace','pause','seek','inspect','reset']): return result
        time.sleep(.5)
    raise RuntimeError('Scene controls unavailable: '+mode)
edges = {}
previous = command('shell', 'settings', 'get', 'system', 'show_touches').strip()
recorder = None
try:
    command('shell', 'settings', 'put', 'system', 'show_touches', '1')
    for mode in ['drop', 'board', 'audio', 'inspector', 'path', 'depth', 'shadow']:
        started = time.time()*1000
        for attempt in range(3):
            command('shell', 'am', 'force-stop', package)
            time.sleep(1.5)
            command('shell', 'am', 'start', '-n', package+'/com.tns.NativeScriptActivity', '--es', 'interaction-depth', mode, '--es', 'depth-audit', 'true')
            time.sleep(3)
            try:
                points = controls(mode)
                break
            except RuntimeError:
                # Preserve evidence of startup failures. Never retry a failed interaction.
                (output/(mode+'-startup-'+str(attempt)+'.log')).write_text(command('logcat', '-d', '-b', 'crash', '-t', '60'))
                if attempt == 2: raise
        def tap(name, delay=.4):
            command('shell', 'input', 'tap', *points[name]); time.sleep(delay)
        remote = '/sdcard/jolt-interaction-'+mode+'.mp4'
        recorder = subprocess.Popen(adb+['shell', 'screenrecord', '--bit-rate', '6000000', '--time-limit', '23', remote])
        time.sleep(.8)
        if mode == 'drop':
            for zone in ['reject','accept']:
                command('shell', 'input', 'swipe', *points['card'], *points[zone], '900'); time.sleep(1.4)
            tap('reset', .8); tap('play', .9); tap('pause', .6); tap('pause')
        elif mode == 'board':
            def grip():
                l,t,r,b = controls(mode) and edges['grip']
                return str(round((l+r)/2)), str(round((t+b)/2))
            def at(name, fx, fy):
                l,t,r,b = edges[name]
                return str(round(l+(r-l)*fx)), str(round(t+(b-t)*fy))
            tap('open', .6)
            command('shell', 'input', 'swipe', *at('card', .75, .3), *at('card', .75, .9), '600'); time.sleep(.8)
            command('shell', 'input', 'swipe', *grip(), *at('backlog', .5, .12), '1400'); time.sleep(1.4)
            command('shell', 'input', 'swipe', *grip(), *at('done', .5, 1.35), '1200'); time.sleep(1.6)
            command('shell', 'input', 'swipe', *grip(), *at('locked', .5, .5), '1000'); time.sleep(1.4)
            tap('replace', .5)
            command('shell', 'input', 'swipe', *grip(), *at('locked', .5, .5), '1000'); time.sleep(1.2)
            tap('replace', .5); tap('play', 1.4); tap('pause', .6); tap('pause')
        else:
            tap('play', .45); tap('pause', .7); tap('seek', .6); tap('pause', 1.6)
            tap('play', .5); tap('replace', 2.8); tap('inspect', .8)
            tap('reset', .8); tap('play', 3.4); tap('inspect', .7)
        recorder.wait(timeout=30); assert recorder.returncode == 0
        recorder = None
        clip = 'interaction-depth-drop-android' if mode == 'board' else 'interaction-'+mode+'-android'
        command('pull', remote, str(output/(clip+'.mp4')))
        report = json.loads(command('shell','cat','/sdcard/Android/data/'+package+'/files/interaction-depth.json'))
        assert report['events'][0]['time'] >= started-1000, 'stale report'
        (output/(clip+'.json')).write_text(json.dumps(report,indent=2)+'\n')
        assert not any(e['name'].endswith('-error') for e in report['events']), report
        if mode == 'drop':
            assert any(e['name']=='rejected' for e in report['events']), report
            assert any(e['name']=='accepted' and e['method']=='drag' for e in report['events']), report
        if mode == 'board':
            assert sum(e['name']=='accepted' and e['method']=='drag' for e in report['events']) >= 2, report
            assert any(e['name']=='rejected' and e.get('id')=='locked' for e in report['events']), report
        if mode not in ('drop', 'board'):
            assert any(e['name']=='remount' for e in report['events']), report
            assert any(e['name']=='inspection' if mode=='inspector' else e['name']=='play' for e in report['events']), report
        if mode == 'audio':
            assert any(e['name']=='audio-ready' and e['ready'] for e in report['events']), report
            assert any(e['name']=='audio-finish' and e['completed'] for e in report['events']), report
        print('Recorded '+mode, flush=True)
finally:
    if recorder and recorder.poll() is None: recorder.wait(timeout=30)
    if previous=='null': command('shell','settings','delete','system','show_touches')
    else: command('shell','settings','put','system','show_touches',previous)
