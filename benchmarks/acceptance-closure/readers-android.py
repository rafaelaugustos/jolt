"""Actual TalkBack contacts and read-only accessibility observations on a dedicated emulator.

Usage: PYTHON SCRIPT SERIAL EMULATOR_PID_INI READER_TOOLS OUTPUT
Requires accessibility-input/build.py and the --env.readerAcceptance fixture.
Restores reader settings. Does not request accessibility focus or click nodes.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

serial, ini, tool_dir, destination = sys.argv[1:]
assert serial.startswith('emulator-'), 'Dedicated emulator required'
os.environ['GRPC_ENABLE_FORK_SUPPORT'] = '0'
sys.path.insert(0, tool_dir)
import grpc
import emulator_controller_pb2 as pb
import emulator_controller_pb2_grpc as rpc

config = dict(line.split('=', 1) for line in Path(ini).read_text().splitlines() if '=' in line)
assert config['port.serial'] == serial.removeprefix('emulator-')
client = rpc.EmulatorControllerStub(grpc.insecure_channel('localhost:' + config['grpc.port']))
auth = (('authorization', 'Bearer ' + config['grpc.token']),)
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=False)
adb = ['adb', '-s', serial]
app = 'dev.jolt.nativeci'
observations = []
recorder = None
recording = None

def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()

def flatten(node):
    return [node] + [child for item in node.get('children', []) for child in flatten(item)]

def tree():
    for _ in range(8):
        node = json.loads(command('shell', 'CLASSPATH=/data/local/tmp/jolt-a11y-inspect.jar', 'app_process', '/system/bin', 'A11yInspect'))
        if node: return flatten(node)
        time.sleep(.2)
    raise AssertionError('No accessibility root')

def focus():
    nodes = [node for node in tree() if node['focused']]
    assert len(nodes) == 1, ('Expected one actual TalkBack focus', nodes)
    return nodes[0]

def checkpoint(name, expected=None):
    nodes = tree()
    selected = [n for n in nodes if n['focused']]
    assert len(selected) == 1, (name, selected)
    if expected: assert selected[0].get('id') == expected, (name, selected[0])
    observations.append({'name': name, 'time': time.time(), 'focus': {k: v for k, v in selected[0].items() if k != 'children'}, 'nodes': [{k: v for k, v in n.items() if k != 'children'} for n in nodes]})
    (out / 'talkback.json').write_text(json.dumps(observations, indent=2) + '\n')
    print(name, selected[0].get('id'), selected[0].get('label'), flush=True)

def contact(points, pressure):
    client.sendTouch(pb.TouchEvent(touches=[pb.Touch(x=round(x), y=round(y), identifier=i, pressure=pressure) for i, (x, y) in enumerate(points)]), metadata=auth, timeout=5)

def swipe(backward=False):
    x, end = (800, 300) if backward else (300, 800)
    try:
        contact([(x, 1800)], 500)
        time.sleep(.07)
        for step in range(1, 11):
            contact([(x + (end-x)*step/10, 1800)], 500)
            time.sleep(.012)
    finally: contact([(end, 1800)], 0)
    time.sleep(.5)

def explore(identifier):
    nodes = tree()
    node = next((n for n in nodes if n.get('id') == identifier and n['visible']), None)
    assert node, ('Missing visible target', identifier, [(n.get('id'), n.get('label')) for n in nodes])
    left, top, right, bottom = node['bounds']
    points = [((left+right)/2, (top+bottom)/2)]
    try:
        contact(points, 500)
        time.sleep(.35)
        contact([(points[0][0]+3, points[0][1])], 500)
        time.sleep(.25)
    finally: contact(points, 0)
    time.sleep(.35)
    assert focus().get('id') == identifier, ('Exploration did not focus target', identifier, focus())

def activate(identifier, delay=.4):
    explore(identifier)
    for _ in range(2):
        try:
            contact([(500, 1800)], 500)
            time.sleep(.05)
        finally: contact([(500, 1800)], 0)
        time.sleep(.06)
    time.sleep(delay)

def data():
    return json.loads(command('shell', 'run-as', app, 'cat', 'files/reader-acceptance.json'))

def save_report(name):
    report = data()
    assert not any(e['name'] == 'error' for e in report['events']), report
    (out / (name + '.json')).write_text(json.dumps(report, indent=2) + '\n')
    return report

def begin(name):
    global recorder, recording
    recording = name
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--time-limit', '180', '--bit-rate', '6000000', '/sdcard/jolt-reader-' + name + '.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    time.sleep(.4)

def stop():
    global recorder
    if recorder is None: return
    for pid in command('shell', 'pidof', 'screenrecord').split(): command('shell', 'kill', '-2', pid)
    recorder.communicate(timeout=20)
    recorder = None
    command('pull', '/sdcard/jolt-reader-' + recording + '.mp4', str(out / (recording + '.raw.mp4')))
    subprocess.run(['ffmpeg', '-v', 'error', '-i', str(out / (recording + '.raw.mp4')), '-vf', 'fps=30,scale=720:-2', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(out / (recording + '.mp4'))], check=True)

old = {name: command('shell', 'settings', 'get', 'secure', name) for name in ['enabled_accessibility_services', 'accessibility_enabled', 'touch_exploration_enabled']}
try:
    command('push', str(Path(tool_dir) / 'a11y-inspect.jar'), '/data/local/tmp/jolt-a11y-inspect.jar')
    service = 'com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService'
    services = [] if old['enabled_accessibility_services'] == 'null' else old['enabled_accessibility_services'].split(':')
    command('shell', 'settings', 'put', 'secure', 'enabled_accessibility_services', ':'.join(dict.fromkeys(services + [service])))
    command('shell', 'settings', 'put', 'secure', 'accessibility_enabled', '1')
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity')
    time.sleep(4)
    assert command('shell', 'settings', 'get', 'secure', 'touch_exploration_enabled') == '1'
    deny = next((n.get('id') for n in tree() if n.get('id') in ['com.android.permissioncontroller:id/permission_deny_button', 'com.android.permissioncontroller:id/permission_deny_and_dont_ask_again_button']), None)
    if deny:
        activate(deny)
        command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity')
        time.sleep(1)
    begin('layout-exits-talkback-android')
    explore('card-alpha')
    swipe()
    checkpoint('initial-next', 'card-bravo')
    activate('exit-remove', .1)
    assert data()['events'][-1]['flights'] > 0, 'Must navigate while an actual exit copy exists'
    explore('card-alpha')
    swipe()
    checkpoint('removed-skipped', 'card-charlie')
    assert not any(n.get('id') == 'card-bravo' for n in tree())
    swipe(True)
    checkpoint('removed-skipped-backward', 'card-alpha')
    activate('exit-cancel')
    assert next(e for e in reversed(data()['events']) if e['name'] == 'exit-cancel-before')['flights'] > 0, 'Cancellation must interrupt a live copy'
    assert data()['events'][-1]['flights'] == 0
    activate('exit-reset')
    activate('exit-remove', .1)
    activate('exit-reinsert')
    explore('card-alpha')
    swipe()
    checkpoint('reinserted-once', 'card-bravo')
    activate('exit-reduced')
    assert data()['events'][-1]['flights'] == 0
    explore('card-alpha')
    swipe()
    checkpoint('reduced-skipped', 'card-charlie')
    activate('reader-dispose')
    assert data()['events'][-1]['flights'] == 0
    save_report('exits')
    stop()
    for scene, nav in [('list', 'reader-lists'), ('collection', 'reader-collections')]:
        activate(nav)
        begin(scene + '-focus-talkback-android')
        for control, row, name, next_row in [('list-move', 'reader-row-1', 'moved', 'reader-row-3'), ('list-insert', 'reader-row-3', 'inserted', 'reader-row-4'), ('list-interrupt', 'reader-row-2', 'interrupted', None), ('list-move', 'outside-anchor', 'outside-not-stolen', None), ('list-reduced', 'reader-row-1', 'reduced', None)]:
            activate(control, .1)
            explore(row)
            time.sleep(9.8)
            checkpoint(scene + '-' + name, row)
            if next_row:
                swipe()
                checkpoint(scene + '-' + name + '-next', next_row)
        activate('reader-dispose')
        assert not any(n.get('id') == 'reader-row-1' for n in tree())
        assert data()['events'][-1]['flights'] == 0
        save_report(scene + 's')
        stop()
finally:
    if recorder is not None: stop()
    for name, value in old.items():
        if value == 'null': command('shell', 'settings', 'delete', 'secure', name)
        else: command('shell', 'settings', 'put', 'secure', name, value)
