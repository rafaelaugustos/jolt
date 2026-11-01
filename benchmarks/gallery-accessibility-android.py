"""Real TalkBack gestures on a dedicated emulator; restores reader settings.

Build accessibility-input with a Python venv containing grpcio/grpcio-tools.
Usage: python SCRIPT SERIAL EMULATOR_PID_INI TOOLS_DIRECTORY OUTPUT_DIRECTORY [--large-text]
The emulator console's `grpc` command publishes its endpoint/credential ini.
No accessibility action is used to manufacture focus or activate controls.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import time

large_text = sys.argv[-1] == "--large-text"
serial, ini, tool_dir, output = sys.argv[1:-1] if large_text else sys.argv[1:]
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
report = '/sdcard/Android/data/' + app + '/files/jolt-gallery.json'
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
def read_report(path):
    for attempt in range(8):
        try: return json.loads(command('shell', 'cat', path))
        except json.JSONDecodeError:
            if attempt == 7: raise
            time.sleep(.3)
def data(): return read_report(report)

started_at = int(command('shell', 'date', '+%s')) * 1000
old = {key: command('shell', 'settings', 'get', 'secure', key) for key in ['enabled_accessibility_services', 'accessibility_enabled', 'touch_exploration_enabled']}
density = float(command('shell', 'wm', 'density').split()[-1]) / 160
old_font = command("shell", "settings", "get", "system", "font_scale")
recorder = None
try:
    if large_text: command("shell", "settings", "put", "system", "font_scale", "2.0")
    command('push', str(Path(tool_dir) / 'a11y-inspect.jar'), '/data/local/tmp/jolt-a11y-inspect.jar')
    services = [] if old['enabled_accessibility_services'] == 'null' else old['enabled_accessibility_services'].split(':')
    talkback = 'com.google.android.marvin.talkback/com.google.android.marvin.talkback.TalkBackService'
    command('shell', 'settings', 'put', 'secure', 'enabled_accessibility_services', ':'.join(dict.fromkeys(services + [talkback])))
    command('shell', 'settings', 'put', 'secure', 'accessibility_enabled', '1')
    time.sleep(1)
    command('shell', 'am', 'force-stop', app)
    command('shell', 'am', 'start', '-n', app + '/com.tns.NativeScriptActivity', '--es', 'showcase-example', 'gallery', '--es', 'gallery-audit', 'true', '--es', 'collection-audit', 'true', '--es', 'showcase-audit', 'true')
    time.sleep(2)
    assert command('shell', 'settings', 'get', 'secure', 'touch_exploration_enabled') == '1'
    time.sleep(4)
    (out / 'initial-tree.json').write_text(json.dumps(tree(), indent=2))
    explore(lambda n: n.get('id') == 'collection-place-1')
    recorder = subprocess.Popen(adb + ['shell', 'screenrecord', '--time-limit', '0', '--bit-rate', '6000000', '/sdcard/jolt-gallery-talkback.mp4'], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    time.sleep(.5)
    checkpoint('thumbnail', 'collection-place-1')
    next_focus()
    checkpoint('second-thumbnail', 'collection-place-2')
    swipe(800, 1800, 300, 1800)
    checkpoint('first-thumbnail-again', 'collection-place-1')
    def control(identifier):
        if large_text:
            backward = identifier == "gallery-zoom" and focus().get("id") == "gallery-reset"
            seek(lambda n: n.get("id") == identifier, backward=backward)
        else:
            explore(lambda n: n.get("id") == identifier)
        if large_text:
            # TalkBack can focus a partially clipped button before requesting
            # its rectangle. Use a real two-finger panel scroll when needed.
            for _ in range(3):
                node = focus()
                expected_height = next(e['typography'][identifier.removeprefix('gallery-')]['height'] for e in reversed(data()['events']) if e.get('typography', {}).get('zoom'))
                if (node['bounds'][3] - node['bounds'][1]) / density >= expected_height - 2: break
                panel = next(n for n in tree() if n.get('id') == 'gallery-controls')
                left, top, right, bottom = panel['bounds']
                swipe((left + right) / 2 - 40, top + (bottom - top) * .8, (left + right) / 2 - 40, top + (bottom - top) * .2, fingers=2)
                seek(lambda n: n.get('id') == identifier, backward=True)
            else: raise AssertionError('Reader could not reveal full control: ' + identifier)
        checkpoint(identifier, identifier)
        activate()
    def collect(name):
        deadline = time.monotonic() + 10
        while True:
            collection = read_report(report.replace('jolt-gallery.json', 'jolt-collection.json'))
            if collection.get('state') == 'disposed': break
            assert time.monotonic() < deadline, ('Return did not settle', collection)
            time.sleep(.3)
        gallery = data()
        assert gallery['events'][0]['time'] >= started_at, 'Stale gallery evidence'
        (out / (name + '-gallery.json')).write_text(json.dumps(gallery, indent=2))
        (out / (name + '-collection.json')).write_text(json.dumps(collection, indent=2))
        return gallery, collection
    activate()
    assert any(n.get('id') == 'gallery-close' for n in tree()), 'Reader activation must open the thumbnail'
    checkpoint('opened')
    if large_text:
        seek(lambda n: n.get('id') == 'gallery-title')
        checkpoint('title', 'gallery-title')
    control('gallery-zoom')
    assert abs(data()['events'][-1]['state']['scale'] - 2.5) < .02, 'Reader Zoom must update the native viewer'
    control('gallery-reset')
    assert abs(data()['events'][-1]['state']['scale'] - 1) < .02
    control('gallery-zoom')
    explore(lambda n: n.get('id') == 'gallery-close')
    checkpoint('close-zoomed', 'gallery-close')
    activate()
    time.sleep(1)
    collect('returned')
    checkpoint('returned', 'collection-place-1')
    activate()
    control('gallery-move')
    explore(lambda n: n.get('id') == 'gallery-close')
    activate()
    time.sleep(1)
    _, moved = collect('moved')
    checkpoint('moved-return', 'collection-place-1')
    assert moved['index'] == 59 and moved['resolvedTag'] == 'collection:place-1'
    activate()
    control('gallery-remove')
    explore(lambda n: n.get('id') == 'gallery-close')
    activate()
    time.sleep(1)
    _, removed = collect('removed')
    checkpoint('removed-return', 'collection-heading')
    assert removed['index'] == -1 and removed['commits'] == 3
    assert removed['flights'] == removed['inputs'] == removed['retained'] == 0
    explore(lambda n: n.get('id') == 'collection-reset')
    activate()
    explore(lambda n: n.get('id') == 'collection-reduce')
    activate()
    explore(lambda n: n.get('id') == 'collection-place-2')
    activate()
    control('gallery-zoom')
    explore(lambda n: n.get('id') == 'gallery-close')
    activate()
    final_gallery, reduced = collect('reduced')
    checkpoint('reduced-return', 'collection-place-2')
    assert reduced['commits'] == 4 and reduced['index'] == 1
    assert reduced['flights'] == reduced['inputs'] == reduced['retained'] == 0
    evidence = {'platform': 'Android emulator; actual TalkBack hardware input', 'gallery': final_gallery, 'collection': reduced}
    if large_text: evidence['textConfiguration'] = {'source': 'Android system font_scale', 'requested': 2.0, 'reader': 'TalkBack'}
    (out / 'android.json').write_text(json.dumps(evidence, indent=2) + '\n')

finally:
    try:
        if recorder:
            command('shell', 'pkill', '-INT', 'screenrecord')
            recorder.communicate(timeout=20)
            command('pull', '/sdcard/jolt-gallery-talkback.mp4', out / 'gallery-talkback-android.mp4')
    finally:
        if large_text:
            if old_font == "null": command("shell", "settings", "delete", "system", "font_scale")
            else: command("shell", "settings", "put", "system", "font_scale", old_font)
        for key, value in old.items():
            if value == 'null': command('shell', 'settings', 'delete', 'secure', key)
            else: command('shell', 'settings', 'put', 'secure', key, value)

restored_font = command('shell', 'settings', 'get', 'system', 'font_scale')
restored_reader = {key: command('shell', 'settings', 'get', 'secure', key) for key in old}
assert restored_font == old_font and restored_reader == old, 'Entry font/reader settings were not restored'
if large_text:
    evidence['textConfiguration']['initialFont'] = old_font
    evidence['textConfiguration']['restoredFont'] = restored_font
    evidence['textConfiguration']['readerSettingsRestored'] = restored_reader == old
    (out / 'android.json').write_text(json.dumps(evidence, indent=2) + '\n')
subprocess.run([sys.executable, str(Path(__file__).with_name('verify-gallery-accessibility.py')), 'android', str(out / 'android.json'), str(out / 'talkback.json')] + (['--large-text'] if large_text else []), check=True)
