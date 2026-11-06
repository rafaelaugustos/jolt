"""Collect physical Android workloads without a recorder.

Usage: python3 benchmarks/portable-android-measure.py SERIAL OUTPUT [--port 5037]
Build/install the production-JavaScript demo first. Existing reports are never
accepted as new runs. A crash, backgrounding or missing result fails the run.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('serial')
parser.add_argument('output', type=Path)
parser.add_argument('--port', default='5037')
parser.add_argument('--kind', choices=['groups', 'drawing', 'activity', 'both'], default='both')
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
repo = Path(__file__).resolve().parent.parent
adb = ['adb', '-P', args.port, '-s', args.serial]
app = 'org.nativescript.jolt.benchmark'
source = '/sdcard/Android/data/'+app+'/files/portable-measurements.json'
def read():
    return subprocess.run(adb+['shell', 'cat', source], text=True, capture_output=True).stdout
for kind in ['groups', 'drawing', 'activity'] if args.kind == 'both' else [args.kind]:
    old = read()
    subprocess.run(adb+['shell', 'am', 'start', '-S', '-n', app+'/com.tns.NativeScriptActivity', '--es', 'portable-lab', 'groups' if kind == 'activity' else kind, '--es', 'portable-measure', 'activity' if kind == 'activity' else 'true'], check=True)
    print('Measuring '+kind+'; recording disabled', flush=True)
    deadline = time.monotonic()+180
    while time.monotonic() < deadline:
        time.sleep(5)
        raw = read()
        try: report = json.loads(raw)
        except json.JSONDecodeError: continue
        if raw == old or report.get('kind') != kind: continue
        if report.get('error'): raise RuntimeError(report['error'])
        if report.get('complete'):
            break
    else: raise RuntimeError('No new complete '+kind+' run; inspect app and crash logs.')
    report['collection'] = {'deviceLabel': 'physical-android-1', 'timestampUTC': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()), 'revision': subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=repo, text=True).strip(), 'workingTreeSourcesAtCollectionSHA256': {str(p.relative_to(repo)): hashlib.sha256(p.read_bytes()).hexdigest() for directory in ['src', 'platforms', 'demo/src', 'demo/native-fixture'] for p in sorted((repo/directory).rglob('*')) if p.is_file() and p.suffix in ['.ts', '.vue', '.java', '.m', '.h']}}
    apk = repo/'demo/platforms/android/app/build/outputs/apk/debug/app-debug.apk'
    report['collection']['apkSHA256'] = hashlib.sha256(apk.read_bytes()).hexdigest() if apk.exists() else None
    destination = args.output/('physical-android-'+kind+'.json')
    destination.write_text(json.dumps(report, indent=2)+'\n')
    print('Saved '+str(destination)+' ('+str(len(report['runs']))+' runs)', flush=True)
