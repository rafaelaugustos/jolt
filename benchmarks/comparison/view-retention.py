"""Paired physical runs of settled view ownership; separate from motion timing."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import subprocess
import time
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('serial')
    parser.add_argument('output', type=Path)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('--adb-port', type=int, default=5037)
    parser.add_argument('--repetitions', type=int, default=5)
    parser.add_argument('--configurations', nargs='+', choices=['baseline', 'candidate'],
                        default=['baseline', 'candidate'])
    args = parser.parse_args()
    assert args.repetitions > 0
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    apks = {'baseline': args.baseline.resolve(), 'candidate': args.candidate.resolve()}
    with zipfile.ZipFile(apks['baseline']) as a, zipfile.ZipFile(apks['candidate']) as b:
        assert set(a.namelist()) == set(b.namelist()), 'APK files differ'
        changed = [name for name in a.namelist() if a.read(name) != b.read(name)]
        assert changed == ['assets/app/bundle.mjs'], changed
    prefix = ['adb', '-P', str(args.adb_port), '-s', args.serial]
    def adb(*words, timeout=60):
        return subprocess.check_output([*prefix, *map(str, words)], text=True, timeout=timeout)
    def shell(*words): return adb('shell', shlex.join(map(str, words)))
    def battery():
        raw = shell('dumpsys', 'battery')
        return raw, int(re.search(r'^\s*temperature:\s*(\d+)', raw, re.M)[1]) / 10
    assert shell('getprop', 'ro.kernel.qemu').strip() != '1'
    package = 'dev.jolt.comparison.retention'
    remote = '/sdcard/Android/data/' + package + '/files/retention.json'
    report = {
        'apkSha256': {name: hashlib.sha256(p.read_bytes()).hexdigest() for name, p in apks.items()},
        'changedApkEntries': changed,
        'deviceFingerprint': shell('getprop', 'ro.build.fingerprint').strip(),
        'collectorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'repetitions': args.repetitions,
        'configurations': args.configurations,
        'screenRecording': False,
        'scope': '16 detached views with the existing 4,000-record JSON model per view; eight natural completions and eight cancellations. Public animation handles survive at held checkpoint. Equal explicit collection requests outside workload timing. Not the single-tile comparison or a general app-memory claim.',
        'runs': [],
    }
    def save(): (out / 'summary.json').write_text(json.dumps(report, indent=2) + '\n')
    save()
    original_stay = shell('settings', 'get', 'global', 'stay_on_while_plugged_in').strip()
    shell('settings', 'put', 'global', 'stay_on_while_plugged_in', '7')
    folder = None
    try:
        for repetition in range(args.repetitions):
            order = list(dict.fromkeys(args.configurations))
            if repetition % 2: order.reverse()
            for name in order:
                folder = out / f'{repetition + 1}-{name}'
                folder.mkdir()
                for app in (package, 'dev.jolt.comparison.jolt', 'com.joltcomparison'):
                    shell('am', 'force-stop', app)
                before, temp = battery()
                while temp > 39:
                    print('Cooling:', temp, flush=True)
                    time.sleep(15)
                    before, temp = battery()
                (folder / 'battery-before.txt').write_text(before)
                (folder / 'install.txt').write_text(adb('install', '-r', apks[name], timeout=120))
                installed = shell('pm', 'path', package).strip().removeprefix('package:')
                assert shell('sha256sum', installed).split()[0] == report['apkSha256'][name]
                info = shell('dumpsys', 'package', package)
                assert 'DEBUGGABLE' not in info
                (folder / 'package.txt').write_text(info)
                (folder / 'launch.txt').write_text(shell('am', 'start', '-W', '-n', package + '/com.tns.NativeScriptActivity'))
                pid = int(shell('pidof', package).strip())
                deadline = time.monotonic() + 90
                seen = set()
                while True:
                    try:
                        data = json.loads(shell('cat', remote))
                    except (subprocess.CalledProcessError, json.JSONDecodeError):
                        data = {}
                    if data.get('processId') == pid:
                        (folder / 'workload.json').write_text(json.dumps(data, indent=2) + '\n')
                        phase = data.get('state')
                        if phase in ('held', 'complete') and phase not in seen:
                            (folder / ('memory-' + phase + '.txt')).write_text(shell('dumpsys', 'meminfo', package))
                            seen.add(phase)
                        if phase in ('complete', 'failed'): break
                    assert time.monotonic() < deadline, 'Workload timed out'
                    current = shell('pidof', package).strip()
                    assert current == str(pid), 'Process disappeared/restarted'
                    time.sleep(.5)
                assert data['state'] == 'complete', data
                after, after_temp = battery()
                (folder / 'battery-after.txt').write_text(after)
                assert after_temp <= 40
                assert len(data['snapshots']) == 4 and data['workload']['settledHandles'] == 16
                assert data['jsGcAvailable'], 'Required diagnostic JS collection unavailable'
                row = {'configuration': name, 'repetition': repetition + 1,
                       'snapshots': data['snapshots'], 'workload': data['workload'],
                       'batteryBeforeC': temp, 'batteryAfterC': after_temp}
                report['runs'].append(row)
                save()
                print(json.dumps(row), flush=True)
                shell('am', 'force-stop', package)
                time.sleep(10)
    except Exception as error:
        report['failure'] = str(error)
        save()
        if folder:
            (folder / 'failure.json').write_text(json.dumps({'error': str(error)}, indent=2) + '\n')
            (folder / 'crash.log').write_text(shell('logcat', '-b', 'crash', '-d', '-t', '160'))
        raise
    finally:
        if original_stay == 'null': shell('settings', 'delete', 'global', 'stay_on_while_plugged_in')
        else: shell('settings', 'put', 'global', 'stay_on_while_plugged_in', original_stay)


if __name__ == '__main__': main()
