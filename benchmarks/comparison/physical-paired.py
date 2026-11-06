"""Five rotated baseline/candidate/Reanimated triplets using the existing collector."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import zipfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('serial')
    parser.add_argument('output', type=Path)
    parser.add_argument('probe', type=Path)
    parser.add_argument('baseline', type=Path)
    parser.add_argument('candidate', type=Path)
    parser.add_argument('reanimated', type=Path)
    parser.add_argument('acceptance', type=Path)
    parser.add_argument('--adb-port', type=int, default=5037)
    args = parser.parse_args()
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=False)
    apks = {name: getattr(args, name).resolve() for name in ('baseline', 'candidate', 'reanimated')}
    with zipfile.ZipFile(apks['baseline']) as a, zipfile.ZipFile(apks['candidate']) as b:
        assert set(a.namelist()) == set(b.namelist())
        changed = [name for name in a.namelist() if a.read(name) != b.read(name)]
        assert changed == ['assets/app/bundle.mjs'], changed
    conditions = tuple(apks)
    order = [(r + 1, name) for r in range(5)
             for name in conditions[r % 3:] + conditions[:r % 3]]
    collector = Path(__file__).with_name('physical.py')
    plan = {
        'order': order,
        'windowSeconds': 30,
        'apkSha256': {name: hashlib.sha256(p.read_bytes()).hexdigest() for name, p in apks.items()},
        'changedJoltApkEntries': changed,
        'acceptance': json.loads(args.acceptance.read_text()),
        'collectorSha256': hashlib.sha256(collector.read_bytes()).hexdigest(),
        'runnerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'screenRecording': False,
    }
    (out / 'plan.json').write_text(json.dumps(plan, indent=2) + '\n')
    (out / 'runner.py').write_bytes(Path(__file__).read_bytes())
    prefix = ['adb', '-P', str(args.adb_port), '-s', args.serial]
    for repetition, name in order:
        folder = out / f'{repetition}-{name}'
        folder.mkdir()
        print(f'Round {repetition}: {name}', flush=True)
        try:
            installed = subprocess.check_output([*prefix, 'install', '-r', str(apks[name])], text=True, timeout=120)
            (folder / 'install.txt').write_text(installed)
            app = 'reanimated' if name == 'reanimated' else 'jolt'
            command = [sys.executable, str(collector), args.serial, str(folder),
                       str(args.probe.resolve()), '--adb-port', str(args.adb_port),
                       '--apps', app, '--phase', 'normal', '--repetitions', '1', '--seconds', '30']
            if app == 'jolt': command += ['--jolt-intent', 'diagnostic-driver=jolt']
            subprocess.run(command, check=True)
            metadata = json.loads((folder / 'metadata.json').read_text())
            assert metadata['identity']['packages'][app] == [plan['apkSha256'][name]], 'Wrong installed build'
        except Exception as error:
            (folder / 'failure.json').write_text(json.dumps({'error': str(error)}, indent=2) + '\n')
            raise


if __name__ == '__main__': main()
