"""Real TalkBack gestures on a dedicated emulator; restores reader settings.

Build accessibility-input with a Python venv containing grpcio/grpcio-tools.
Usage: python SCRIPT SERIAL EMULATOR_PID_INI TOOLS_DIRECTORY OUTPUT_DIRECTORY
The emulator console's `grpc` command publishes its endpoint/credential ini.
No accessibility action is used to manufacture focus or activate controls.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

serial, ini, tool_dir, output = sys.argv[1:]
# Avoid gRPC's fork handler when subprocess starts the read-only adb probe.
os.environ['GRPC_ENABLE_FORK_SUPPORT'] = '0'
assert serial.startswith('emulator-'), 'Assign a dedicated emulator'
sys.path.insert(0, str(Path(tool_dir).resolve()))
import grpc
import emulator_controller_pb2 as pb
import emulator_controller_pb2_grpc as rpc

settings = dict(line.split('=', 1) for line in Path(ini).read_text().splitlines() if '=' in line)
assert settings['port.serial'] == serial.removeprefix('emulator-')
client = rpc.EmulatorControllerStub(grpc.insecure_channel('localhost:' + settings['grpc.port']))
auth = (('authorization', 'Bearer ' + settings['grpc.token']),)
out = Path(output).resolve()
out.mkdir(parents=True, exist_ok=True)
app = 'org.nativescript.jolt.benchmark'
adb = ['adb', '-s', serial]
report = '/sdcard/Android/data/' + app + '/files/jolt-scroll-header.json'
results = []
def command(*args):
    return subprocess.check_output(adb + list(map(str, args)), text=True, timeout=30).strip()
def flat(node):
    return [node] + [child for n in node.get('children', []) for child in flat(n)]
def tree():
    for _ in range(5):
        root = json.loads(command('shell', 'CLASSPATH=/data/local/tmp/jolt-a11y-inspect.jar', 'app_process', '/system/bin', 'A11yInspect'))
        if root is not None: return flat(root)
        time.sleep(.3)
    raise AssertionError('Accessibility root did not become available')
def focus(nodes=None):
    selected = [n for n in (nodes if nodes is not None else tree()) if n['focused']]
    assert len(selected) == 1, 'Expected one actual TalkBack focus: ' + str(selected)
    return {k: v for k, v in selected[0].items() if k != 'children'}
def checkpoint(name, expected=None):
    nodes = tree()
    current = focus(nodes)
    if expected: assert current.get('id') == expected, (name, current)
    results.append({'name': name, 'focus': current, 'nodes': [{k: v for k, v in n.items() if k != 'children'} for n in nodes if n.get('id') or n.get('label') or n.get('heading')]})
    (out / 'talkback.json').write_text(json.dumps(results, indent=2) + '\n')
    print(name, current, flush=True)
    return current
def contact(points, pressure):
    client.sendTouch(pb.TouchEvent(touches=[pb.Touch(x=round(x), y=round(y), identifier=i, pressure=pressure) for i, (x, y) in enumerate(points)]), metadata=auth, timeout=5)
def swipe(x, y, tx, ty, fingers=1):
    points = [(x + i * 80, y) for i in range(fingers)]
    try:
        contact(points, 500)
        time.sleep(.07)
        steps = 30 if fingers == 2 else 10
        for step in range(1, steps + 1):
            points = [(x + i * 80 + (tx - x) * step / steps, y + (ty - y) * step / steps) for i in range(fingers)]
            contact(points, 500)
            time.sleep(.022 if fingers == 2 else .012)
        if fingers == 2: time.sleep(.2)
    finally:
        contact(points, 0)
    time.sleep(.7)
def next_focus(): swipe(300, 1800, 800, 1800)
def seek(predicate, backward=False):
    for _ in range(18):
        selected = [n for n in tree() if n['focused']]
        if len(selected) == 1 and predicate(selected[0]): return selected[0]
        if backward: swipe(800, 1800, 300, 1800)
        else: next_focus()
    raise AssertionError('TalkBack did not reach requested control')
def activate():
    for _ in range(2):
        try:
            contact([(500, 1800)], 500)
            time.sleep(.05)
        finally: contact([(500, 1800)], 0)
        time.sleep(.06)
    time.sleep(1)
def explore(predicate):
    node = next(n for n in tree() if n['visible'] and predicate(n))
    left, top, right, bottom = node['bounds']
    points = [((left + right) / 2, (top + bottom) / 2)]
    try:
        contact(points, 500)
        time.sleep(.4)
        contact([(points[0][0] + 3, points[0][1])], 500)
        time.sleep(.3)
    finally:
        contact(points, 0)
    time.sleep(.5)
def data(): return json.loads(command('shell', 'cat', report))

old = {key: command('shell', 'settings', 'get', 'secure', key) for key in ['enabled_accessibility_services', 'accessibility_enabled', 'touch_exploration_enabled']}
recorder = None
try:
    command('push', str(Path(tool_dir) / 'a11y-inspect.jar'), '/data/local/tmp/jolt-a11y-inspect.jar')
    services = [] if old['enabled_accessibility_services'] == 'null' else old['enabled_accessibility_services'].split(':')
    talkback = 'com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService'
    command('shell', 'settings', 'put', 'secure', 'enabled_accessibility_services', ':'.join(dict.fromkeys(services + [talkback])))
    command('shell', 'settings', 'put', 'secure', 'accessibility_enabled', '1')
    time.sleep(1)
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'scroll-header', '--es', 'scroll-header-audit', 'true', '--es', 'showcase-audit', 'true')
    time.sleep(2)
    assert command('shell', 'settings', 'get', 'secure', 'touch_exploration_enabled') == '1'
    seek(lambda n: n.get('id') == 'scroll-header-title')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--bit-rate', '6000000', '/sdcard/jolt-scroll-talkback.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    time.sleep(1)
    assert checkpoint('expanded', 'scroll-header-title')['heading']
    assert not any(n.get('id') in ['scroll-header-compact-title', 'scroll-header-top'] for n in tree())
    swipe(650, 1750, 650, 900, 2)
    assert checkpoint('collapsed', 'scroll-header-compact-title')['heading']
    assert not any(n.get('id') == 'scroll-header-title' and n['visible'] for n in tree())
    swipe(650, 900, 650, 1750, 2)
    checkpoint('expanded-again', 'scroll-header-title')
    seek(lambda n: n.get('id') == 'scroll-header-jump')
    activate()
    checkpoint('jump-keeps-control-focus', 'scroll-header-jump')
    seek(lambda n: n.get('label', '').startswith('Play '))
    checkpoint('recycled-row')
    before = sum(e['name'] == 'tap' for e in data()['events'])
    activate()
    after = data()
    assert sum(e['name'] == 'tap' for e in after['events']) == before + 1, 'Reader activation must reach the current recycled row'
    assert [e for e in after['events'] if e['name'] == 'tap'][-1]['extra'] == 'song-36', 'Rows covered by the pinned header must be skipped'
    (out / 'demo.json').write_text(json.dumps(after, indent=2) + '\n')
    checkpoint('activated-row')
    # Touch exploration reaches the pinned control without traversing every
    # preceding virtualized row in reverse order.
    explore(lambda n: n.get('id') == 'scroll-header-top')
    checkpoint('cover-control', 'scroll-header-top')
    activate()
    checkpoint('cover-control-returns-focus', 'scroll-header-title')
    explore(lambda n: n.get('label', '').startswith('Back to collection'))
    activate()
    final = data()
    assert final['events'][-1]['name'] == 'disposed'
    assert final['resources']['sources'] == final['resources']['nodes'] == 0
    (out / 'demo.json').write_text(json.dumps(final, indent=2) + '\n')
finally:
    try:
        if recorder:
            command('shell', 'pkill', '-INT', 'screenrecord')
            recorder.communicate(timeout=20)
            command('pull', '/sdcard/jolt-scroll-talkback.mp4', out / 'scroll-header-talkback-android.mp4')
    finally:
        for key, value in old.items():
            if value == 'null': command('shell', 'settings', 'delete', 'secure', key)
            else: command('shell', 'settings', 'put', 'secure', key, value)
