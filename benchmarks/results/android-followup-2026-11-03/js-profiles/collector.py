"""Compare explicit NativeScript V8 profiles on a separate fixed JSON workload.

This is not a cross-framework JavaScript benchmark. Never run alongside motion
collection or recording. APK entries must match except the runtime configuration.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import shlex
import statistics
import subprocess
import time
import zipfile

from physical import pss_kib


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('serial')
    parser.add_argument('output', type=Path)
    parser.add_argument('default_apk', type=Path)
    parser.add_argument('size_apk', type=Path)
    parser.add_argument('--adb-port', type=int, default=5037)
    parser.add_argument('--repetitions', type=int, default=2)
    args = parser.parse_args()
    assert args.repetitions >= 2
    apks = {'default': args.default_apk, 'size': args.size_apk}
    with zipfile.ZipFile(args.default_apk) as a, zipfile.ZipFile(args.size_apk) as b:
        assert set(a.namelist()) == set(b.namelist()), 'Different APK entries'
        changed = [name for name in a.namelist() if a.read(name) != b.read(name)]
        assert changed == ['assets/app/package.json'], changed
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    prefix = ['adb', '-P', str(args.adb_port), '-s', args.serial]
    def adb(*words, timeout=60):
        return subprocess.check_output([*prefix, *map(str, words)], text=True, timeout=timeout)
    def shell(*words): return adb('shell', shlex.join(map(str, words)))
    def battery():
        text = shell('dumpsys', 'battery')
        return text, int(re.search(r'^\s*temperature:\s*(\d+)', text, re.M)[1]) / 10
    assert shell('getprop', 'ro.kernel.qemu').strip() != '1'
    package = 'dev.jolt.comparison.jswork'
    remote = '/sdcard/Android/data/' + package + '/files/js-work.json'
    metadata = {
        'serialSha256': hashlib.sha256(args.serial.encode()).hexdigest(),
        'deviceFingerprint': shell('getprop', 'ro.build.fingerprint').strip(),
        'apkSha256': {name: hashlib.sha256(path.read_bytes()).hexdigest() for name, path in apks.items()},
        'differentApkEntries': changed,
        'collectorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'workloadSha256': hashlib.sha256(Path(__file__).with_name('jolt').joinpath('workload/main.ts').read_bytes()).hexdigest(),
        'warmupBatchesExcludedPerProcess': 1,
        'aggregation': 'Median of five measured batches per fresh process; report process-level medians separately.',
        'scope': 'Fixed JSON allocation workload, not a cross-framework JS benchmark or representative application mix.',
        'screenRecording': False,
        'runs': [],
    }
    (out/'collector.py').write_bytes(Path(__file__).read_bytes())
    (out/'workload.ts').write_bytes(Path(__file__).with_name('jolt').joinpath('workload/main.ts').read_bytes())
    def save(): (out/'summary.json').write_text(json.dumps(metadata, indent=2)+'\n')
    save()
    original_stay = shell('settings', 'get', 'global', 'stay_on_while_plugged_in').strip()
    shell('settings', 'put', 'global', 'stay_on_while_plugged_in', '7')
    try:
        for repetition in range(args.repetitions):
            order = ['default', 'size'] if repetition % 2 == 0 else ['size', 'default']
            for profile in order:
                folder = out/f'{repetition+1}-{profile}'
                folder.mkdir()
                for name in (package, 'dev.jolt.comparison.jolt', 'com.joltcomparison', 'dev.jolt.comparison.jolt_comparison'):
                    shell('am', 'force-stop', name)
                text, temp = battery()
                while temp > 39:
                    print('Cooling:', temp, flush=True)
                    time.sleep(15); text, temp = battery()
                (folder/'battery-before.txt').write_text(text)
                (folder/'install.txt').write_text(adb('install', '-r', apks[profile].resolve(), timeout=120))
                installed = shell('pm', 'path', package).strip().removeprefix('package:')
                assert shell('sha256sum', installed).split()[0] == metadata['apkSha256'][profile]
                (folder/'launch.txt').write_text(shell('am', 'start', '-W', '-n', package+'/com.tns.NativeScriptActivity'))
                pid = int(shell('pidof', package).strip())
                deadline = time.monotonic()+90
                while True:
                    report = json.loads(shell('cat', remote))
                    if report['processId'] == pid and report['status'] in ('complete', 'failed'): break
                    assert time.monotonic() < deadline, 'Workload did not complete'
                    time.sleep(1)
                (folder/'workload.json').write_text(json.dumps(report, indent=2)+'\n')
                assert report['status'] == 'complete' and len(report['samples']) == 6, report
                assert ('optimize_for_size' in report['v8Flags']) == (profile == 'size')
                assert all(s['checksum'] == report['expectedChecksum'] for s in report['samples'])
                memory = shell('dumpsys', 'meminfo', package)
                (folder/'memory-after.txt').write_text(memory)
                after, after_temp = battery(); (folder/'battery-after.txt').write_text(after)
                assert after_temp <= 40, 'Temperature guard exceeded'
                measured = report['samples'][1:]
                row = {'profile': profile, 'repetition': repetition+1, 'processId': pid,
                       'medianWallMs': statistics.median(s['wallMs'] for s in measured),
                       'medianProcessCpuMs': statistics.median(s['processCpuMs'] for s in measured),
                       'pssAfterMiB': pss_kib(memory)/1024,
                       'batteryBeforeC': temp, 'batteryAfterC': after_temp}
                metadata['runs'].append(row); save()
                print(row, flush=True)
                shell('am', 'force-stop', package); time.sleep(10)
    except Exception as error:
        metadata['failure'] = str(error); save(); raise
    finally:
        if original_stay == 'null': shell('settings', 'delete', 'global', 'stay_on_while_plugged_in')
        else: shell('settings', 'put', 'global', 'stay_on_while_plugged_in', original_stay)


if __name__ == '__main__': main()
