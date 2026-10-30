"""Run the installed isolated benchmark with an explicit device and a bounded wait."""
import argparse
import json
from pathlib import Path
import subprocess
import time
import uuid

APP = 'org.nativescript.jolt.bindings'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('platform', choices=('ios', 'android'))
    parser.add_argument('device')
    parser.add_argument('output', type=Path)
    parser.add_argument('--allow-simulator', action='store_true')
    parser.add_argument('--case')
    parser.add_argument('--recording', action='store_true')
    args = parser.parse_args()
    if args.output.exists(): raise SystemExit('Choose a new output path; evidence is never overwritten.')
    session = str(uuid.uuid4())
    options = {'budget-session': session, 'budget-autorun': 'true'}
    if args.allow_simulator: options['budget-allow-simulator'] = 'true'
    if args.case: options['budget-case'] = args.case
    if args.recording: options['budget-recording'] = 'true'
    args.output.parent.mkdir(parents=True, exist_ok=True)
    staging = args.output.with_suffix('.pending.json')

    def command(*words, check=True):
        return subprocess.run(words, text=True, capture_output=True, timeout=30, check=check)

    if args.platform == 'ios':
        command('xcrun', 'devicectl', 'device', 'process', 'launch', '--device', args.device,
                '--terminate-existing', APP, *[f'--{key}={value}' for key,value in options.items()])
    else:
        command('adb', '-s', args.device, 'shell', 'am', 'force-stop', APP)
        command('adb', '-s', args.device, 'shell', 'am', 'start', '-n', APP+'/com.tns.NativeScriptActivity',
                *[word for key,value in options.items() for word in ('--es',key,value)])
    deadline = time.monotonic() + 900
    last_count = -1
    try:
        while time.monotonic() < deadline:
            # Reports are written only between workloads; no app-side polling or
            # frame logging. Keep host file transfers infrequent on paired Wi-Fi.
            time.sleep(30)
            try:
                if args.platform == 'ios':
                    copied = command('xcrun', 'devicectl', 'device', 'copy', 'from', '--device', args.device,
                        '--domain-type', 'appDataContainer', '--domain-identifier', APP,
                        '--source', 'Documents/binding-budgets.json', '--destination', str(staging), check=False)
                else:
                    copied = command('adb', '-s', args.device, 'shell', 'cat',
                        f'/sdcard/Android/data/{APP}/files/binding-budgets.json', check=False)
                    if copied.returncode == 0: staging.write_text(copied.stdout)
            except subprocess.TimeoutExpired:
                print('Device transfer timed out; retrying within the original deadline.', flush=True)
                continue
            if copied.returncode or not staging.exists(): continue
            try: report = json.loads(staging.read_text())
            except json.JSONDecodeError: continue
            if report.get('session') != session: continue
            count = len(report['cases'])
            if count != last_count:
                print(f'{count}/{len(report["selected"])} workloads saved', flush=True); last_count = count
            if report['completed'] or report.get('error'):
                staging.rename(args.output)
                if not report['completed']: raise SystemExit(report['error'])
                print(f'Completed: {args.output}', flush=True)
                return
        raise SystemExit('Timed out. Partial evidence is kept at '+str(staging))
    except KeyboardInterrupt:
        raise SystemExit('Interrupted. The app was not stopped; partial evidence is kept at '+str(staging))


if __name__ == '__main__':
    main()
