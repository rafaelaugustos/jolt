"""Screen Jolt's motion overhead against direct Android playback and Reanimated.

Uses the existing physical collector, unchanged. This is a diagnosis, not a
candidate acceptance benchmark or an input-to-photon measurement. Install the
pinned release APKs first; this runner never rebuilds or switches APKs.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
from datetime import datetime, timezone


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('serial')
    parser.add_argument('output', type=Path)
    parser.add_argument('probe', type=Path)
    parser.add_argument('--adb-port', type=int, default=5037)
    args = parser.parse_args()
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    collector = Path(__file__).with_name('physical.py')
    conditions = ('jolt', 'native', 'reanimated')
    # Rotate all three conditions. Five repetitions per condition, fresh process
    # each time; preserve the unbalanced final rotation in the published order.
    order = [(r + 1, name) for r in range(5)
             for name in conditions[r % 3:] + conditions[:r % 3]]
    plan = {
        'kind': 'diagnostic screening; no optimized candidate has been selected',
        'createdAt': datetime.now(timezone.utc).isoformat(),
        'order': order,
        'windowSeconds': 30,
        'collectorSha256': hashlib.sha256(collector.read_bytes()).hexdigest(),
        'runnerSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
        'question': 'Does bypassing Jolt while retaining the same NativeScript view tree remove the presentation wait or process memory cost?',
        'limits': 'Native control still imports Jolt. This isolates active animation construction/playback, not import/runtime baseline. Frame-ready to presentation is not input latency. No forced GC or screen recording.',
        'candidateAcceptance': 'Not applicable to this diagnostic. Any future optimization needs separately declared tolerances based on this baseline and at least five paired baseline/candidate runs.',
    }
    plan_file = output / 'plan.json'
    if plan_file.exists():
        previous = json.loads(plan_file.read_text())
        for key in ('order', 'windowSeconds', 'collectorSha256', 'runnerSha256'):
            assert previous[key] == json.loads(json.dumps(plan[key])), 'Changed plan: ' + key
    else:
        plan_file.write_text(json.dumps(plan, indent=2) + '\n')
    for repetition, name in order:
        folder = output / f'{repetition}-{name}'
        command = [sys.executable, str(collector), args.serial, str(folder),
                   str(args.probe.resolve()), '--adb-port', str(args.adb_port),
                   '--apps', 'reanimated' if name == 'reanimated' else 'jolt',
                   '--phase', 'normal', '--repetitions', '1', '--seconds', '30']
        if name != 'reanimated':
            command += ['--jolt-intent', 'diagnostic-driver=' + name]
        print(f'Round {repetition}: {name}', flush=True)
        completed = subprocess.run(command)
        if completed.returncode:
            failure = {'condition': name, 'repetition': repetition,
                       'exitCode': completed.returncode,
                       'time': datetime.now(timezone.utc).isoformat()}
            folder.mkdir(exist_ok=True)
            (folder / 'failure.json').write_text(json.dumps(failure, indent=2) + '\n')
            raise SystemExit(completed.returncode)


if __name__ == '__main__':
    main()
