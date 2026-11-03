"""One fresh release process per diagnostic; collect externally, never per JS frame.
Usage: python3 benchmarks/android-resource-profile.py SERIAL OUTPUT MODE [MODE ...]
Install the normal release demo first. Root is optional (only needed for smaps).
"""
from pathlib import Path
import json
import subprocess
import sys
import time

serial, output, *modes = sys.argv[1:]
assert modes
root = Path(output)
root.mkdir(parents=True, exist_ok=True)
adb = ['adb', '-s', serial]
package = 'org.nativescript.jolt.benchmark'
remote = f'/sdcard/Android/data/{package}/files/jolt-resource-profile.json'

def command(*args, check=True, input_text=None):
    p = subprocess.run(adb + list(args), input=input_text, capture_output=True, text=True, timeout=45)
    if check and p.returncode:
        raise RuntimeError(p.stderr or p.stdout)
    return p.stdout.strip()

def read():
    try:
        return json.loads(command('shell', 'cat', remote))
    except (RuntimeError, json.JSONDecodeError):
        return {}

def until(phase, timeout=80):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        result = read()
        if result.get('phase') == 'error':
            raise RuntimeError(result)
        if result.get('phase') == phase:
            return result
        time.sleep(.3)
    raise TimeoutError(f'Waiting for {phase}: {result}')

config = '''buffers { size_kb: 32768 fill_policy: RING_BUFFER }
duration_ms: 25000
data_sources { config { name: "linux.ftrace" ftrace_config {
  ftrace_events: "sched/sched_switch"
  ftrace_events: "sched/sched_waking"
  ftrace_events: "sched/sched_process_exit"
  ftrace_events: "task/task_newtask"
  ftrace_events: "task/task_rename"
  atrace_categories: "gfx"
  atrace_categories: "view"
  atrace_categories: "dalvik"
  atrace_apps: "org.nativescript.jolt.benchmark"
} } }
data_sources { config { name: "linux.process_stats" process_stats_config {
  scan_all_processes_on_start: true
  proc_stats_poll_ms: 1000
} } }
'''
config_path = root / 'config.pbtxt'
config_path.write_text(config)

for mode in modes:
    assert mode in ['idle', 'playback', 'playback-probe', 'retention', 'retention-drop', 'retention-cycles', 'report', 'report-worker', 'compile']
    destination = root / mode
    destination.mkdir(exist_ok=True)
    command('shell', 'am', 'force-stop', package)
    command('shell', 'rm', '-f', remote)
    command('shell', 'am', 'start', '-n', f'{package}/com.tns.NativeScriptActivity',
            '--es', 'playback-efficiency', 'true', '--es', 'resource-profile', 'true')
    initial = until('ready')
    assert not initial['debuggable'] and initial['build']['mode'] == 'production'
    assert initial['environment']['animatorScale'] == 1
    (destination / 'ready.json').write_text(json.dumps(initial, indent=2) + '\n')
    pid = command('shell', 'pidof', package)
    assert pid.isdigit()
    time.sleep(1)
    for name in ['meminfo', 'smaps']:
        value = command('shell', 'dumpsys', 'meminfo', package) if name == 'meminfo' else command('shell', 'cat', f'/proc/{pid}/smaps', check=False)
        (destination / f'before-{name}.txt').write_text(value)
    trace = f'/data/misc/perfetto-traces/jolt-resource-{mode}.pftrace'
    trace_pid = command('shell', 'perfetto', '--txt', '-c', '-',
                        '--background-wait', '-o', trace, input_text=config)
    assert trace_pid.isdigit(), trace_pid
    try:
        command('shell', 'am', 'broadcast', '-a', 'org.nativescript.jolt.RESOURCE_PROFILE',
                '-p', package, '--es', 'mode', mode)
        result = until('done')
        assert result['mode'] == mode
        (destination / 'report.json').write_text(json.dumps(result, indent=2) + '\n')
    finally:
        command('shell', 'kill', '-TERM', trace_pid, check=False)
        time.sleep(1)
        command('pull', trace, str(destination / 'trace.pftrace'))
    for name in ['meminfo', 'smaps']:
        value = command('shell', 'dumpsys', 'meminfo', package) if name == 'meminfo' else command('shell', 'cat', f'/proc/{pid}/smaps', check=False)
        (destination / f'after-{name}.txt').write_text(value)
    print(mode, 'CPU ms:', result['end']['cpuMs'] - result['begin']['cpuMs'],
          'main CPU ms:', round(result['end']['threadCpuMs'] - result['begin']['threadCpuMs'], 2),
          'PSS KiB:', [(r['label'], r['pssKiB']) for r in result['snapshots']], flush=True)
