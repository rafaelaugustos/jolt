"""Actual Android input/recording for the isolated native motion demo.

python3 benchmarks/native-motion-android.py SERIAL OUTPUT MODE [--port 5041] [--record]
MODE: resources, behaviors, rig, text, cues. Never used during performance collection.
"""
import argparse
import json
from pathlib import Path
import re
import subprocess
import time
import xml.etree.ElementTree as ET

p = argparse.ArgumentParser()
p.add_argument('serial'); p.add_argument('output', type=Path)
p.add_argument('mode', choices=['resources', 'behaviors', 'rig', 'text', 'cues'])
p.add_argument('--port', default='5037'); p.add_argument('--record', action='store_true')
p.add_argument('--background', action='store_true')
a = p.parse_args()
out = a.output.resolve(); out.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-P', a.port, '-s', a.serial]
app = 'org.nativescript.jolt.benchmark'
def run(*args, binary=False):
    return subprocess.check_output(adb + list(map(str, args)), timeout=40, text=not binary)
def screenshot(name):
    (out / (name + '.png')).write_bytes(run('exec-out', 'screencap', '-p', binary=True))
def positions():
    run('shell', 'uiautomator', 'dump', '/sdcard/jolt-native-motion-ui.xml')
    xml = run('shell', 'cat', '/sdcard/jolt-native-motion-ui.xml')
    (out / 'ui.xml').write_text(xml)
    result = {}
    for node in ET.fromstring(xml).iter('node'):
        rect = list(map(int, re.findall(r'\d+', node.get('bounds', ''))))
        if len(rect) != 4: continue
        x1,y1,x2,y2 = rect
        for key in ('resource-id', 'content-desc', 'text'):
            value = node.get(key)
            if value: result[value] = ((x1+x2)//2, (y1+y2)//2)
    return result
def tap(name, delay=.3):
    if name not in controls: raise RuntimeError('Missing native control: ' + name)
    run('shell', 'input', 'tap', *controls[name]); time.sleep(delay)
def snapshot(name):
    tap('motion-snapshot', .1); screenshot(name)

run('shell', 'am', 'force-stop', app)
run('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'native-motion', a.mode, '--es', 'native-motion-audit', 'true')
time.sleep(3)
pid = run('shell', 'pidof', app).strip()
controls = positions()
screenshot('initial')
recorder = None; recorder_pid = None; touch_setting = None
try:
    if a.record:
        existing = subprocess.run(adb + ['shell', 'pidof', 'screenrecord'], capture_output=True, text=True)
        if existing.stdout.strip(): raise RuntimeError('Another screen recording is active on this device.')
        touch_setting = run('shell', 'settings', 'get', 'system', 'show_touches').strip()
        run('shell', 'settings', 'put', 'system', 'show_touches', '1')
        recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', '/sdcard/jolt-native-motion.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        time.sleep(.8)
        recorder_pid = run('shell', 'pidof', 'screenrecord').strip()
        if not recorder_pid.isdigit(): raise RuntimeError('Recording did not start exclusively.')
    if a.background:
        start = {'behaviors': 'behavior-touch', 'rig': 'rig-wave', 'text': 'text-sheen', 'cues': 'cue-play'}.get(a.mode)
        if start: tap(start, .1)
        tap('motion-pause', .1); snapshot('before-background')
        run('shell', 'input', 'keyevent', 'KEYCODE_HOME'); time.sleep(2)
        run('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'native-motion', a.mode, '--es', 'native-motion-audit', 'true')
        time.sleep(.6)
        controls = positions()
        snapshot('after-background')
        tap('motion-pause', .15); snapshot('resumed-background')
        time.sleep(2.6); snapshot('completed-background')
    elif a.mode == 'resources':
        tap('motion-pause', .8); snapshot('paused')
        tap('motion-pause', 1)
        tap('resource-cache', .8); screenshot('cached')
        tap('resource-cache', 1); snapshot('restored')
        tap('resource-mount', .5); screenshot('disposed')
        tap('resource-mount', 1); snapshot('remounted')
    elif a.mode == 'behaviors':
        tap('behavior-touch', .35); tap('behavior-dress', .3)
        tap('behavior-touch', .3); screenshot('blocked')
        tap('behavior-eat', .3); tap('behavior-dress', .3)
        time.sleep(2.1); snapshot('rest')
    elif a.mode == 'rig':
        tap('rig-wave', .35); tap('rig-reach', .3); tap('rig-wave', 1.4)
        snapshot('wave'); tap('rig-reach', 1.4); snapshot('limit')
        tap('rig-rest', 1.3); snapshot('rest')
    elif a.mode == 'text':
        tap('text-sheen', 2)
        tap('text-change', .4); screenshot('changed')
        tap('text-sheen', .35); tap('motion-pause', .8); screenshot('held-sheen')
        tap('motion-pause', 1.6)
        tap('motion-reduce'); tap('text-sheen', .7); snapshot('reduced')
        tap('motion-reduce'); tap('text-change'); tap('text-sheen', 2)
    else:
        tap('cue-play', .2); tap('cue-cancel', 1.3); screenshot('cancelled')
        tap('cue-play', 2.6)
        tap('cue-play', .25); tap('motion-pause', .7); tap('motion-pause', 2.6)
        snapshot('completed')
    if run('shell', 'pidof', app).strip() != pid: raise RuntimeError('Demo exited or restarted during interaction.')
    report = run('shell', 'cat', f'/sdcard/Android/data/{app}/files/native-motion.json')
    (out / 'audit.json').write_text(report)
    if a.background:
        samples = [e for e in json.loads(report)['events'] if e['name'] == 'snapshot']
        if len(samples) != 4: raise RuntimeError('Missing background snapshots')
        before, after, resumed, final = samples
        if before['status'] != 'Paused' or after['status'] != 'Paused': raise RuntimeError('Manual pause lost on return')
        if a.mode == 'resources' and before['resource']['d'] != after['resource']['d']: raise RuntimeError('Paused drawing changed')
        if a.mode == 'rig' and any(abs(before['rig']['grip'][k]-after['rig']['grip'][k]) > 1 for k in ('x', 'y')): raise RuntimeError('Paused socket changed')
        if a.mode == 'text' and (after['text']['playing'] or not after['text']['attached']): raise RuntimeError('Paused text did not reattach')
        if not any(e['name'] == 'Resumed' and after['time'] < e['time'] <= resumed['time'] for e in json.loads(report)['events']):
            raise RuntimeError('Explicit resume did not run')
        if a.mode == 'cues' and (not after['cue']['paused'] or resumed['cue']['paused'] or final['scope'] != 0):
            raise RuntimeError('Cue pause/resume or completion failed')
    logs = run('logcat', '--pid=' + pid, '-d', '-s', 'AndroidRuntime:E', 'JS:E')
    (out / 'errors.log').write_text(logs)
    if 'FATAL EXCEPTION' in logs or 'JS: Error' in logs: raise RuntimeError('Native demo reported an error; inspect errors.log.')
    print(json.dumps({'mode': a.mode, 'serial': a.serial, 'events': len(json.loads(report)['events'])}))
finally:
    if recorder_pid and recorder_pid.isdigit(): run('shell', 'kill', '-INT', recorder_pid)
    if recorder:
        _, error = recorder.communicate(timeout=20)
        if recorder.returncode: raise RuntimeError(error.decode())
        run('pull', '/sdcard/jolt-native-motion.mp4', out / ('native-' + a.mode + '-android.mp4'))
    if touch_setting is not None:
        if touch_setting == 'null': run('shell', 'settings', 'delete', 'system', 'show_touches')
        else: run('shell', 'settings', 'put', 'system', 'show_touches', touch_setting)
