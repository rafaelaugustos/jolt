"""Run real native press input and collect each trace without timing recordings.

python3 benchmarks/portable-ios-run.py SIMULATOR_UUID OUTPUT [testMethod ...]
Settings activation supplies real backgrounding during held OS contact; it does
not inject NativeScript lifecycle callbacks or alter application counters.
"""
import json
from pathlib import Path
import subprocess
import sys
import time
import signal
import select

device, destination, *methods = sys.argv[1:]
repo = Path(__file__).resolve().parent.parent
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=True)
control = Path('/tmp/jolt-portable-control-' + device)
control.mkdir()
app = 'org.nativescript.jolt.benchmark'
runner = None
recorder = None
try:
    subprocess.run(['ruby', str(repo/'benchmarks/docs-ios-ui.rb'), str(out/'project'), str(repo/'benchmarks/portable-ios-ui.swift')], check=True)
    command = ['xcodebuild', 'test', '-project', str(out/'project/DocsTests.xcodeproj'), '-scheme', 'DocsTests',
               '-destination', 'platform=iOS Simulator,id='+device, '-parallel-testing-enabled', 'NO',
               '-collect-test-diagnostics', 'never', '-derivedDataPath', str(out/'build'),
               '-resultBundlePath', str(out/'result.xcresult'), 'CODE_SIGNING_ALLOWED=NO']
    command += ['-only-testing:DocsTests/DocsTests/'+method for method in methods]
    with (out/'xctest.log').open('w') as log:
        runner = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
        seen = None
        while runner.poll() is None:
            time.sleep(.05)
            try:
                cue = json.loads((control/'request.json').read_text())
            except (FileNotFoundError, json.JSONDecodeError):
                continue
            if cue['id'] == seen:
                continue
            seen = cue['id']
            if cue['action'].startswith('start-'):
                assert recorder is None
                name = cue['action'][6:]
                assert name.replace('-', '').isalnum()
                recorder = subprocess.Popen(['xcrun','simctl','io',device,'recordVideo','--codec=h264',str(out/(name+'.mov'))],stderr=subprocess.PIPE)
                deadline = time.monotonic()+20
                while time.monotonic()<deadline:
                    ready,_,_=select.select([recorder.stderr],[],[],1)
                    if ready and b'Recording started' in recorder.stderr.readline(): break
                else: raise RuntimeError('Recording did not start')
                print('Recording '+name,flush=True)
            elif cue['action'].startswith('stop-'):
                assert recorder is not None
                recorder.send_signal(signal.SIGINT);recorder.communicate(timeout=20)
                assert recorder.returncode==0
                recorder=None
                print('Saved '+cue['action'][5:],flush=True)
            elif cue['action'].startswith('save-foundations-') or cue['action']=='save-shape':
                container = Path(subprocess.check_output(['xcrun','simctl','get_app_container',device,app,'data'],text=True).strip())
                name=cue['action'][5:]
                trace=json.loads((container/'Documents'/('portable-lab.json' if name=='shape' else 'portable-foundations.json')).read_text())
                (out/(name+'.json')).write_text(json.dumps(trace,indent=2)+'\n')
                if name=='foundations-pointer':
                    assert any(event.get('presence')==1 for event in trace['events']), 'No real native hover reached the pointer source'
                    assert any(event.get('presence')==0 for event in trace['events']), 'No native pointer exit'
                    moves=[event['x'] for event in trace['events'] if event['name']=='pointer-move']
                    assert len(moves)>=4 and max(moves)-min(moves)>.5, 'No continuous native pointer movement'
            elif cue['action'] == 'background':
                subprocess.run(['xcrun', 'simctl', 'launch', device, 'com.apple.Preferences'], check=True, capture_output=True)
            elif cue['action'] in ['save-held', 'save-lifecycle']:
                container = Path(subprocess.check_output(['xcrun', 'simctl', 'get_app_container', device, app, 'data'], text=True).strip())
                trace = json.loads((container/'Documents/portable-lab.json').read_text())
                (out/(cue['action'][5:]+'.json')).write_text(json.dumps(trace, indent=2)+'\n')
            else:
                raise ValueError(cue)
            (control/'ack.json').write_text(json.dumps({'id': seen}))
        if runner.returncode:
            raise RuntimeError('XCTest failed; see '+str(out/'xctest.log'))
        print(json.dumps({'output': str(out), 'status': 'passed'}))
finally:
    if recorder:
        recorder.send_signal(signal.SIGINT); recorder.communicate(timeout=20)
    if runner and runner.poll() is None:
        runner.terminate()
        runner.wait(timeout=20)
    for name in ['request.json', 'ack.json']:
        (control/name).unlink(missing_ok=True)
    control.rmdir()
