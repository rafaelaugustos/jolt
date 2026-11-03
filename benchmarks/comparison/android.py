"""Collect equivalent release apps on ONE Android emulator, without screen recording.

python3 benchmarks/comparison/android.py emulator-5590 OUTPUT TRACE_PROCESSOR
The three installed apps must match scenario.json. Keep other builds/tests idle.
Raw traces, CSV rows, package metadata, memory samples and per-run results are retained.
"""
import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import os
import platform
import re
import subprocess
import time
import xml.etree.ElementTree as ET
from pathlib import Path

APPS = {
    'jolt': ('dev.jolt.comparison.jolt', 'com.tns.NativeScriptActivity'),
    'reanimated': ('com.joltcomparison', '.MainActivity'),
    'flutter': ('dev.jolt.comparison.jolt_comparison', '.MainActivity'),
}

def distribution(values):
    if not values:
        return {'n': 0, 'p50': None, 'p95': None, 'p99': None, 'max': None}
    values = sorted(values)
    def percentile(p):
        i = (len(values) - 1) * p
        a, b = math.floor(i), math.ceil(i)
        return values[a] + (values[b] - values[a]) * (i - a)
    return {'n': len(values), 'p50': percentile(.5), 'p95': percentile(.95),
            'p99': percentile(.99), 'max': values[-1]}

def analyze_presentations(events):
    presented, queued = {}, {}
    for row in events:
        timestamp = int(row['ts'])
        if timestamp <= 0 or timestamp >= 9223372036854775807: continue
        key = (row['layer_name'], row['frame_number'])
        if row['name'] == 'PresentFenceSignaled': presented[key] = timestamp
        elif row['name'] == 'Queue': queued[key] = timestamp
    if not presented: raise AssertionError('No app buffer presentation fences')
    layers = {key[0] for key in presented}
    layer = max(layers, key=lambda value: sum(key[0] == value for key in presented))
    selected = {key: value for key,value in presented.items() if key[0] == layer}
    timestamps = sorted(set(selected.values()))
    return {'layer': layer, 'presentedFrames': len(selected),
        'presentationGapMs': distribution([(b-a)/1e6 for a,b in zip(timestamps,timestamps[1:])]),
        'queueToPresentMs': distribution([(value-queued[key])/1e6 for key,value in selected.items()
            if key in queued and queued[key] <= value]),
        'presentationLimit': 'SurfaceFlinger buffer present fences on the dominant app layer; emulator timestamps, not physical scanout. Queue-to-present is buffer latency, not input latency.'}

def host_observation(during_window=False):
    """Cheap boundary samples; rejects obvious shared-host contention, not thermal proof."""
    load = os.getloadavg()[0]
    cpus = os.cpu_count() or 1
    busy = []
    for line in subprocess.check_output(['ps', '-Ao', 'pcpu,comm'], text=True).splitlines()[1:]:
        parts = line.strip().split(None, 1)
        if len(parts) == 2 and float(parts[0]) > 10:
            name = Path(parts[1]).name
            if name in ('clang', 'clang++', 'swift-frontend', 'swift-test', 'cc1', 'rustc'):
                busy.append({'command': name, 'cpuPercent': float(parts[0])})
    return {'hostTime': time.time(), 'loadAverage1m': load, 'logicalCpus': cpus,
        'busyCompilers': busy, 'compilerCpuPercent': sum(p['cpuPercent'] for p in busy),
        'compilerCpuLimit': cpus * 25, 'duringWindow': during_window,
        'quiet': (during_window or load <= cpus * .75) and sum(p['cpuPercent'] for p in busy) <= cpus * 25}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('serial')
    parser.add_argument('output', type=Path)
    parser.add_argument('processor', type=Path)
    parser.add_argument('--repetitions', type=int)
    parser.add_argument('--app', choices=APPS)
    parser.add_argument('--seconds', type=int)
    args = parser.parse_args()
    scenario = json.loads(Path(__file__).with_name('scenario.json').read_text())
    seconds = args.seconds or scenario['collection']['windowSeconds']
    repetitions = args.repetitions or scenario['collection']['repetitions']
    assert seconds >= 6 and repetitions > 0
    output = args.output.resolve(); output.mkdir(parents=True, exist_ok=True)
    processor = str(args.processor.resolve())
    def adb(*words):
        return subprocess.check_output(['adb', '-s', args.serial, *words], text=True, timeout=60)
    def shell(*words):
        return adb('shell', *words)
    assert shell('getprop', 'ro.kernel.qemu').strip() == '1', 'This protocol is emulator-only.'
    for setting in ('animator_duration_scale', 'transition_animation_scale', 'window_animation_scale'):
        assert float(shell('settings', 'get', 'global', setting).strip()) == 1, setting + ' must be 1x'
    assert shell('settings', 'get', 'system', 'show_touches').strip() in ('0', 'null'), 'Disable touch overlays for primary measurements.'
    packages = {}
    for name, (package, _) in APPS.items():
        info = shell('dumpsys', 'package', package)
        assert 'versionName=' in info and 'DEBUGGABLE' not in info, name + ' must be installed as a release build'
        (output/(name+'-package.txt')).write_text(info)
        installed = shell('pm', 'path', package).strip().splitlines()
        apk_hashes = {path.removeprefix('package:'): shell('sha256sum', path.removeprefix('package:')).split()[0]
            for path in installed}
        packages[name] = {'package': package, 'installedApk': installed, 'apkSha256': apk_hashes}
    metadata = {'scope': 'Android emulator only; no physical-device ranking', 'serial': args.serial,
        'host': platform.platform(), 'device': shell('getprop'), 'display': shell('dumpsys', 'display'),
        'processor': subprocess.check_output([processor, '--version'], text=True),
        'scenario': scenario, 'windowSeconds': seconds, 'repetitions': repetitions, 'packages': packages,
        'screenRecording': False, 'hostAcceptance': 'Before launching the app: 1-minute load <= 0.75 * logical CPUs. All samples: aggregate compiler CPU <= 25% of host capacity (100% is one logical CPU). During playback, load is diagnostic only because it includes the measured emulator. Not thermal or exclusive-host proof.', 'runs': []}
    if (output/'metadata.json').exists():
        previous=json.loads((output/'metadata.json').read_text())
        for key in ('serial','packages','scenario','windowSeconds','repetitions','screenRecording','hostAcceptance'):
            assert previous[key]==metadata[key], 'Cannot resume changed configuration: '+key
        metadata=previous
    completed={(r['app'],r['phase'],r['repetition']) for r in metadata['runs']}
    (output/'metadata.json').write_text(json.dumps(metadata, indent=2)+'\n')

    def query(trace, sql, path):
        data = subprocess.check_output([processor, str(trace), '-Q', sql], text=True)
        path.write_text(data)
        return list(csv.DictReader(io.StringIO(data)))

    def controls():
        for attempt in range(3):
            shell('rm', '-f', '/sdcard/jolt-comparison-ui.xml')
            shell('uiautomator', 'dump', '/sdcard/jolt-comparison-ui.xml')
            try:
                tree = ET.fromstring(shell('cat', '/sdcard/jolt-comparison-ui.xml'))
                found = {}
                for node in tree.iter('node'):
                    labels = [(node.get(field) or '').strip().casefold() for field in ('content-desc', 'text')]
                    for key, expected in [('start', 'start'), ('runtime', 'block app runtime'), ('ui', 'block ui thread')]:
                        if any(label == expected or label.startswith(expected + ' ·') for label in labels):
                            x1,y1,x2,y2 = map(int,re.findall(r'\d+',node.get('bounds')))
                            found[key] = [(x1+x2)//2, (y1+y2)//2]
                if len(found) == 3: return found
            except (subprocess.CalledProcessError, ET.ParseError): pass
            time.sleep(1)
        raise AssertionError('Could not resolve actual native controls')

    names = [args.app] if args.app else list(APPS)
    for repetition in range(repetitions):
        # Rotate stack and phase ordering to expose order-related drift.
        order = names[repetition % len(names):] + names[:repetition % len(names)]
        phases = ['normal', 'app-runtime-block-300ms', 'ui-thread-block-300ms']
        phases = phases[repetition % 3:] + phases[:repetition % 3]
        for phase in phases:
            for name in order:
                if (name,phase,repetition+1) in completed: continue
                package, activity = APPS[name]
                folder = output/f'{repetition+1}-{phase}-{name}'; folder.mkdir(exist_ok=True)
                while True:
                    for other, _ in APPS.values(): shell('am', 'force-stop', other)
                    observations = [host_observation()]
                    while not observations[-1]['quiet']:
                        print('Waiting for quiet host:', observations[-1], flush=True)
                        time.sleep(10)
                        observations = [host_observation()]
                    for other, _ in APPS.values(): shell('am', 'force-stop', other)
                    launch = shell('am', 'start', '-W', '-n', package+'/'+activity)
                    (folder/'launch.txt').write_text(launch)
                    time.sleep(1)
                    buttons = controls()
                    resumed = [line for line in shell('dumpsys', 'activity', 'activities').splitlines()
                        if 'ResumedActivity' in line or 'Resumed:' in line]
                    assert any(package+'/' in line for line in resumed), 'Benchmark app must have focus'
                    shell('input', 'tap', *map(str, buttons['start']))
                    time.sleep(scenario['collection']['warmupSeconds'])
                    (folder/'memory-before.txt').write_text(shell('dumpsys', 'meminfo', package))
                    config = f'''buffers {{ size_kb: 65536 fill_policy: DISCARD }}
    duration_ms: {seconds * 1000}
    data_sources {{ config {{ name: "android.surfaceflinger.frametimeline" }} }}
    data_sources {{ config {{ name: "android.surfaceflinger.frame" }} }}
    data_sources {{ config {{ name: "linux.ftrace" ftrace_config {{
      ftrace_events: "sched/sched_switch" ftrace_events: "sched/sched_waking"
      atrace_categories: "gfx" atrace_categories: "view" atrace_categories: "input"
      atrace_apps: "{package}"
    }} }} }}
    data_sources {{ config {{ name: "android.input.inputevent" android_input_event_config {{ mode: TRACE_MODE_TRACE_ALL }} }} }}
    data_sources {{ config {{ name: "linux.process_stats" process_stats_config {{ scan_all_processes_on_start: true proc_stats_poll_ms: 1000 }} }} }}
    '''
                    (folder/'config.pbtxt').write_text(config)
                    remote = '/data/misc/perfetto-traces/jolt-comparison.perfetto-trace'
                    with (folder/'record.log').open('w') as log:
                        process = subprocess.Popen(['adb','-s',args.serial,'shell','perfetto','--txt','-c','-','-o',remote],
                            stdin=subprocess.PIPE, stdout=log, stderr=subprocess.STDOUT, text=True)
                        process.stdin.write(config); process.stdin.close()
                        # Wait for tracing, not merely for the shell process to exist.
                        deadline = time.monotonic()+15
                        while 'Connected to the Perfetto traced service' not in (folder/'record.log').read_text():
                            if process.poll() is not None or time.monotonic()>deadline: raise RuntimeError('Trace did not start')
                            time.sleep(.05)
                        start = time.monotonic()
                        key = 'start' if phase == 'normal' else 'runtime' if phase.startswith('app-') else 'ui'
                        input_times = []
                        for fraction in (1/6, 1/2, 5/6):
                            time.sleep(max(0, start+seconds*fraction-time.monotonic()))
                            observations.append(host_observation(during_window=True))
                            before = time.monotonic()
                            shell('input','tap',*map(str,buttons[key]))
                            input_times.append({'hostSecondsSinceTraceReady': before-start, 'button': key})
                        assert process.wait(timeout=20) == 0
                    observations.append(host_observation(during_window=True))
                    (folder/'host.json').write_text(json.dumps(observations,indent=2)+'\n')
                    (folder/'memory-after.txt').write_text(shell('dumpsys','meminfo',package))
                    trace = folder/'trace.perfetto-trace'
                    with trace.open('wb') as destination:
                        pulled = subprocess.run(['adb','-s',args.serial,'exec-out','cat',remote], stdout=destination, stderr=subprocess.PIPE, timeout=60)
                    (folder/'pull.log').write_text(pulled.stderr.decode())
                    assert pulled.returncode == 0 and trace.stat().st_size > 1000, 'Failed to retrieve trace'
                    if not all(sample['quiet'] for sample in observations):
                        with trace.open('rb') as source, gzip.open(str(trace)+'.gz','wb') as archive:
                            import shutil
                            shutil.copyfileobj(source,archive)
                        trace.unlink()
                        rejected = output/'rejected'; rejected.mkdir(exist_ok=True)
                        folder.rename(rejected/(folder.name+'-'+str(time.time_ns())))
                        print('Rejected contended host window; will retry',name,phase,repetition+1,flush=True)
                        folder.mkdir()
                        continue
                    (folder/'controls.json').write_text(json.dumps(buttons, indent=2)+'\n')
                    rows = query(trace, f"SELECT f.* FROM actual_frame_timeline_slice f JOIN process p USING(upid) WHERE p.name='{package}' AND dur>0 ORDER BY ts", folder/'frames.csv')
                    events = query(trace, f"SELECT * FROM frame_slice WHERE layer_name LIKE '%{package}/%' AND name IN ('Queue','PresentFenceSignaled') ORDER BY ts", folder/'buffer-events.csv')
                    presentations = analyze_presentations(events)
                    assert presentations['presentedFrames']>seconds*10, 'Insufficient actual app buffer presentations'
                    layers = {row['layer_name'] for row in rows}
                    dominant = max(layers,key=lambda layer:sum(row['layer_name']==layer for row in rows)) if layers else None
                    frames = [row for row in rows if row['layer_name']==dominant]
                    inputs = query(trace, f"INCLUDE PERFETTO MODULE android.input; SELECT * FROM android_input_events WHERE process_name='{package}'", folder/'input.csv')
                    cpu = query(trace, f"SELECT sum(s.dur)/1e9 cpuSeconds FROM sched s JOIN thread t USING(utid) JOIN process p USING(upid) WHERE p.name='{package}' AND s.dur>0", folder/'cpu.csv')
                    memory = query(trace, f"SELECT c.ts,t.name,c.value FROM counter c JOIN process_counter_track t ON c.track_id=t.id JOIN process p USING(upid) WHERE p.name='{package}' ORDER BY c.ts", folder/'memory.csv')
                    stats = query(trace,"SELECT name,idx,severity,value FROM stats WHERE value>0 AND severity IN ('error','data_loss')",folder/'trace-health.csv')
                    assert not any('overrun' in r['name'] or 'buffer_discard' in r['name'] or 'packet_loss' in r['name'] for r in stats), stats
                    numeric = lambda key: [float(r[key])/1e6 for r in inputs if r[key] not in ('[NULL]','') and float(r[key])>=0]
                    summary = {'app':name,'phase':phase,'repetition':repetition+1, **presentations,
                        'frameTimelineFrames':len(frames),'frameTimelineLayer':dominant, 'inputActions':input_times,
                        'appFrameTimelineDurationMs':distribution([int(r['dur'])/1e6 for r in frames]),
                        'frameTimelineLimit':'App interval ends at GPU completion/posting, not presentation. Unavailable for the tested Flutter SurfaceView; common cadence/latency metrics use buffer fences for every stack.',
                        'appDeadlineMissed':sum('App Deadline Missed' in r['jank_type'] for r in frames) if frames else None,
                        'droppedFrames':sum(r['present_type']=='Dropped Frame' for r in frames) if frames else None,
                        'inputHandlingMs':distribution(numeric('handling_latency_dur')),
                        'inputAssociatedPresentMs':distribution(numeric('end_to_end_latency_dur')),
                        'inputPresentLimit':'OS frame association; null means unavailable. This does not measure panel latency or identify the first changed tile pixel.',
                        'cpuSeconds':float(cpu[0]['cpuSeconds']),
                        'sampledRssBytes':distribution([float(r['value']) for r in memory if r['name']=='mem.rss']),
                        'traceWarnings':stats,'traceSha256':hashlib.sha256(trace.read_bytes()).hexdigest()}
                    (folder/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
                    with trace.open('rb') as source, gzip.open(str(trace)+'.gz','wb') as archive:
                        import shutil
                        shutil.copyfileobj(source,archive)
                    trace.unlink()
                    metadata['runs'].append(summary)
                    (output/'metadata.json').write_text(json.dumps(metadata,indent=2)+'\n')
                    print(f"{name} {phase} {repetition+1}: {presentations['presentedFrames']} presented buffers",flush=True)
                    break
    for package,_ in APPS.values(): shell('am','force-stop',package)

if __name__ == '__main__': main()
