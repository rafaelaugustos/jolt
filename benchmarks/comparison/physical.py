"""Physical Android comparison using /proc CPU and SurfaceFlinger presentation fences.

The native probe runs its clock, taps and polling on the phone. Host load cannot
delay scheduled inputs. These metrics are separate from the emulator Perfetto protocol.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess
import time
import xml.etree.ElementTree as ET

from android import APPS, DIAGNOSTIC_CHOICES, distribution, diagnostic_intents


def process_cpu(line):
    # comm may contain spaces and parentheses; all fields after its closing ')' are numeric/state.
    fields = line.rsplit(')', 1)[1].split()
    return {'pid': int(line.split(' ', 1)[0]), 'ticks': int(fields[11])+int(fields[12]),
            'startTicks': int(fields[19])}


def pss_kib(text):
    match = re.search(r'^\s*TOTAL(?: PSS)?:\s*(\d+)',text,re.M)
    assert match, 'Missing total process PSS'
    return int(match[1])


def analyze_probe(text):
    polls, starts, ends, stats, inputs = {}, {}, {}, {}, []
    ticks = start = end = None
    for line in text.splitlines():
        fields = line.split('\t')
        if fields[0] == 'CLOCK_TICKS': ticks = int(fields[1])
        elif fields[0] == 'WINDOW_START': start = int(fields[1])
        elif fields[0] == 'WINDOW_END': end = int(fields[1])
        elif fields[0] == 'STAT': stats[fields[1]] = (int(fields[2]), process_cpu(fields[3]))
        elif fields[0] == 'INPUT_START': inputs.append(int(fields[2]))
        elif fields[0] == 'POLL': starts[int(fields[1])] = int(fields[2]); polls[int(fields[1])] = set()
        elif fields[0] == 'POLL_END': ends[int(fields[1])] = int(fields[2])
        elif fields[0] == 'FENCE' and len(fields) == 5:
            row = tuple(map(int, fields[2:]))
            if 0 < row[1] < 2**63-1: polls[int(fields[1])].add(row)
    assert ticks and start and end and end > start, 'Missing device clock/window'
    assert len(inputs) == 3, 'Missing scripted inputs'
    assert set(starts) == set(ends) == set(polls), 'Incomplete presentation poll'
    all_rows = set()
    previous = None
    for sample in sorted(polls):
        actual = {row[1] for row in polls[sample]}
        assert actual, 'No presentation fences in poll '+str(sample)
        # Overlap proves that the 127-frame history did not roll over between samples.
        assert previous is None or actual & previous, 'Presentation history gap at poll '+str(sample)
        previous = actual
        all_rows.update(polls[sample])
    rows = sorted(row for row in all_rows if start <= row[1] <= end)
    presented = sorted({row[1] for row in rows})
    assert len(presented) >= 2, 'No measurable physical presentation interval'
    before_time, before = stats['before']; after_time, after = stats['after']
    assert (before['pid'],before['startTicks']) == (after['pid'],after['startTicks']), 'Process restarted'
    assert after['ticks'] >= before['ticks'] and after_time > before_time
    duration = (after_time-before_time)/1e9
    cpu = (after['ticks']-before['ticks'])/ticks
    ready = [(actual-ready)/1e6 for _,actual,ready in rows if 0 < ready <= actual]
    return {'windowSeconds': (end-start)/1e9, 'cpuWindowSeconds': duration, 'cpuSeconds': cpu,
            'cpuSecondsPer30Seconds': cpu*30/duration, 'cpuTickSeconds': 1/ticks,
            'presentedFrames': len(presented), 'presentationGapMs': distribution([(b-a)/1e6 for a,b in zip(presented,presented[1:])]),
            'frameReadyToPresentMs': distribution(ready), 'queueToPresentMs': None,
            'metricLimit': 'SurfaceFlinger actual-present fence and frame-ready fence. Frame-ready is not queue time. Neither identifies input-to-first-changed-pixel or panel scanout. No FrameTimeline classifications on this device.',
            'inputInvocationSeconds': [(t-start)/1e9 for t in inputs],
            'inputLimit': 'Device-clock invocation of Android input; not input delivery or acknowledgement.',
            'pollDurationMs': distribution([(ends[i]-starts[i])/1e6 for i in starts]),
            'pollHistoryOverlapVerified': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('serial')
    parser.add_argument('output', type=Path)
    parser.add_argument('probe', type=Path)
    parser.add_argument('--adb-port', type=int, default=5037)
    parser.add_argument('--apps', nargs='+', choices=APPS, default=['jolt','reanimated'])
    parser.add_argument('--phase', action='append', choices=['normal','app-runtime-block-300ms','ui-thread-block-300ms'])
    parser.add_argument('--repetitions', type=int, default=5)
    parser.add_argument('--seconds', type=int, default=30)
    parser.add_argument('--jolt-intent', action='append', default=[])
    args = parser.parse_args()
    assert 6 <= args.seconds <= 120 and args.repetitions > 0
    intents = diagnostic_intents(args.jolt_intent)
    names = list(dict.fromkeys(args.apps)); phases = list(dict.fromkeys(args.phase or ['normal']))
    output = args.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    prefix = ['adb','-P',str(args.adb_port),'-s',args.serial]
    def adb(*words, timeout=60): return subprocess.check_output([*prefix,*map(str,words)],text=True,timeout=timeout)
    def shell(*words, timeout=60): return adb('shell',shlex.join(map(str,words)),timeout=timeout)
    assert shell('getprop','ro.kernel.qemu').strip() != '1', 'Select a physical Android device'
    assert int(shell('getprop','ro.build.version.sdk')) >= 26
    for setting in ('animator_duration_scale','transition_animation_scale','window_animation_scale'):
        assert shell('settings','get','global',setting).strip() in ('null','1','1.0'), setting+' must be 1x'
    assert shell('settings','get','system','show_touches').strip() in ('null','0'), 'Turn off touch overlays'
    remote_probe = '/data/local/tmp/jolt-physical-probe'
    adb('push',args.probe.resolve(),remote_probe); shell('chmod','755',remote_probe)
    packages = {}
    for name in names:
        package,_ = APPS[name]
        info = shell('dumpsys','package',package)
        assert 'versionName=' in info and 'DEBUGGABLE' not in info, name+' must be a release app'
        (output/(name+'-package.txt')).write_text(info)
        paths = [p.removeprefix('package:') for p in shell('pm','path',package).splitlines()]
        assert paths
        packages[name] = [shell('sha256sum',p).split()[0] for p in paths]
    keys = ['ro.product.manufacturer','ro.product.model','ro.build.version.release','ro.build.version.sdk',
            'ro.build.fingerprint','ro.product.cpu.abilist','ro.board.platform']
    identity = {'serialSha256':hashlib.sha256(args.serial.encode()).hexdigest(),
                'device':{key:shell('getprop',key).strip() for key in keys},'packages':packages,
                'probeSha256':hashlib.sha256(args.probe.read_bytes()).hexdigest(),
                'probeSourceSha256':hashlib.sha256(Path(__file__).with_name('android-physical-probe.c').read_bytes()).hexdigest(),
                'collectorSha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                'selectedApps':names,'selectedPhases':phases,'repetitions':args.repetitions,
                'windowSeconds':args.seconds,'joltIntents':intents}
    metadata_path = output/'metadata.json'
    if metadata_path.exists():
        metadata = json.loads(metadata_path.read_text())
        assert metadata['identity'] == identity, 'Cannot resume a changed device/build/protocol'
    else:
        metadata = {'identity':identity,'scope':'Physical Android; on-device clock and input scheduling.',
                    'screenRecording':False,'warmupSeconds':5,'cooldownSeconds':10,
                    'temperatureGuard':'Battery temperature <=39 C before and <=40 C after; not proof of no CPU/GPU throttling.',
                    'method':'Process user+system CPU ticks; SurfaceFlinger 127-frame history polled every500ms with overlap verification. Observer work runs outside the measured app but may affect device scheduling.',
                    'runs':[]}
        metadata_path.write_text(json.dumps(metadata,indent=2)+'\n')
        (output/'collector.py').write_bytes(Path(__file__).read_bytes())
        (output/'probe.c').write_bytes(Path(__file__).with_name('android-physical-probe.c').read_bytes())
    completed = {(r['app'],r['phase'],r['repetition']) for r in metadata['runs']}
    original_stay = shell('settings','get','global','stay_on_while_plugged_in').strip()
    shell('settings','put','global','stay_on_while_plugged_in','7')
    def temperature(text):
        match = re.search(r'^\s*temperature:\s*(\d+)',text,re.M)
        assert match, 'No battery temperature'
        return int(match[1])/10
    def controls():
        remote = '/sdcard/jolt-physical-ui.xml'
        shell('uiautomator','dump',remote)
        xml = shell('cat',remote); found = {}
        for node in ET.fromstring(xml).iter('node'):
            labels = [(node.get(f) or '').strip().casefold() for f in ('text','content-desc')]
            for key,expected in [('start','start'),('runtime','block app runtime'),('ui','block ui thread')]:
                if any(value == expected or value.startswith(expected+' ·') for value in labels):
                    a,b,c,d = map(int,re.findall(r'\d+',node.get('bounds')))
                    found[key] = [(a+c)//2,(b+d)//2]
        assert len(found) == 3, 'Native comparison controls unavailable'
        return found
    try:
        for repetition in range(args.repetitions):
            order = names[repetition%len(names):]+names[:repetition%len(names)]
            phase_order = phases[repetition%len(phases):]+phases[:repetition%len(phases)]
            for phase in phase_order:
                for name in order:
                    if (name,phase,repetition+1) in completed: continue
                    folder = output/f'{repetition+1}-{phase}-{name}'
                    assert not folder.exists(), 'Preserve or move the incomplete attempt before resuming: '+str(folder)
                    folder.mkdir()
                    for package,_ in APPS.values(): shell('am','force-stop',package)
                    battery = shell('dumpsys','battery')
                    while temperature(battery) > 39:
                        print('Cooling physical device:',temperature(battery),flush=True)
                        time.sleep(15); battery = shell('dumpsys','battery')
                    (folder/'battery-before.txt').write_text(battery)
                    package,activity = APPS[name]
                    extras = [v for k,value in intents.items() for v in ('--es',k,value)] if name == 'jolt' else []
                    (folder/'launch.txt').write_text(shell('am','start','-W','-n',package+'/'+activity,*extras))
                    time.sleep(1)
                    buttons = controls()
                    (folder/'controls.json').write_text(json.dumps(buttons,indent=2)+'\n')
                    shell('input','tap',*buttons['start']); time.sleep(5)
                    pid = shell('pidof',package).strip(); assert re.fullmatch(r'\d+',pid)
                    if name == 'jolt' and intents:
                        actual = json.loads(shell('cat','/sdcard/Android/data/'+package+'/files/jolt-frame-diagnostic.json'))
                        assert str(actual['processId']) == pid, 'Stale diagnostic report'
                        for k,value in intents.items():
                            assert actual[DIAGNOSTIC_CHOICES[k][0]] == value, 'Diagnostic did not activate: '+k
                        (folder/'diagnostic.json').write_text(json.dumps(actual,indent=2)+'\n')
                    layers = [s for s in shell('dumpsys','SurfaceFlinger','--list').splitlines() if package+'/' in s and not s.startswith('Background')]
                    if name == 'flutter': layers = [s for s in layers if 'SurfaceView' in s]
                    else: layers = [s for s in layers if s.startswith(package+'/')]
                    assert len(layers) == 1, layers
                    layer = layers[0]
                    (folder/'memory-before.txt').write_text(shell('dumpsys','meminfo',package))
                    key = 'start' if phase == 'normal' else 'runtime' if phase.startswith('app-') else 'ui'
                    remote = '/data/local/tmp/jolt-physical-result.txt'
                    command = shlex.join([remote_probe,pid,layer,str(args.seconds),*map(str,buttons[key])])+' > '+shlex.quote(remote)
                    adb('shell',command,timeout=args.seconds+30)
                    destination = folder/'probe.txt'
                    expected = shell('sha256sum',remote).split()[0]
                    adb('pull',remote,destination)
                    assert hashlib.sha256(destination.read_bytes()).hexdigest() == expected, 'Incomplete probe transfer'
                    (folder/'memory-after.txt').write_text(shell('dumpsys','meminfo',package))
                    after = shell('dumpsys','battery'); (folder/'battery-after.txt').write_text(after)
                    assert temperature(after) <= 40, 'Temperature guard exceeded; keep attempt excluded'
                    result = analyze_probe(destination.read_text())
                    assert abs(result['windowSeconds']-args.seconds) < .25, 'Device window overran'
                    lateness = [actual-args.seconds*fraction for actual,fraction in zip(result['inputInvocationSeconds'],(1/6,1/2,5/6))]
                    assert all(-.01 <= value <= .5 for value in lateness), 'Device input schedule drifted'
                    result.update({'app':name,'phase':phase,'repetition':repetition+1,'layer':layer,
                                   'probeOutputSha256':expected,'batteryBeforeC':temperature(battery),'batteryAfterC':temperature(after),
                                   'pssBeforeKiB':pss_kib((folder/'memory-before.txt').read_text()),
                                   'pssAfterKiB':pss_kib((folder/'memory-after.txt').read_text()),
                                   'maxInputInvocationLatenessMs':max(lateness)*1000})
                    (folder/'summary.json').write_text(json.dumps(result,indent=2)+'\n')
                    metadata['runs'].append(result); metadata_path.write_text(json.dumps(metadata,indent=2)+'\n')
                    shell('am','force-stop',package)
                    print(name,phase,repetition+1,'CPU',round(result['cpuSecondsPer30Seconds'],3),'frames',result['presentedFrames'],flush=True)
                    time.sleep(10)
    finally:
        if original_stay == 'null': shell('settings','delete','global','stay_on_while_plugged_in')
        else: shell('settings','put','global','stay_on_while_plugged_in',original_stay)


if __name__ == '__main__': main()
