"""Record real XCTest gestures on an explicitly selected simulator; requires xcodeproj gem.
Usage: python3 benchmarks/docs-record-ios.py SIMULATOR_UUID OUTPUT_DIR [testMethod ...]
The normal demo must already be installed as org.nativescript.jolt.benchmark.
"""
import json
from pathlib import Path
import select
import shutil
import signal
import subprocess
import sys
import time

serial, destination, *methods = sys.argv[1:]
started_at = time.time() * 1000
output = Path(destination).resolve()
output.mkdir(parents=True, exist_ok=True)
control = Path('/tmp/jolt-docs-recording-control-' + serial)
# An exclusive directory also prevents two recording runs sharing cue files.
control.mkdir()
repo = Path(__file__).resolve().parent.parent
recorder = None
runner = None
original_content_size = None
try:
    subprocess.run(['ruby', str(repo/'benchmarks/docs-ios-ui.rb'), str(output/'project')], check=True)
    command = ['xcodebuild', 'test', '-project', str(output/'project/DocsTests.xcodeproj'),
               '-scheme', 'DocsTests', '-destination', 'platform=iOS Simulator,id='+serial,
               '-parallel-testing-enabled', 'NO', '-collect-test-diagnostics', 'never',
               '-derivedDataPath', str(output/'build'),
               '-resultBundlePath', str(output/('result-'+str(int(time.time()))+'.xcresult')),
               'CODE_SIGNING_ALLOWED=NO']
    command += ['-only-testing:DocsTests/DocsTests/'+method for method in methods]
    with (output/'xctest.log').open('w') as log:
        runner = subprocess.Popen(command, stdout=log, stderr=subprocess.STDOUT)
        seen = None
        while runner.poll() is None:
            try:
                cue = json.loads((control/'request.json').read_text())
            except (FileNotFoundError, json.JSONDecodeError):
                time.sleep(0.05)
                continue
            if cue['id'] == seen:
                time.sleep(0.05)
                continue
            seen = cue['id']
            name = cue['name']
            assert name.replace('-', '').isalnum()
            if cue['action'] == 'open-url':
                assert name == 'web-mobile'
                subprocess.run(['xcrun', 'simctl', 'openurl', serial, 'http://127.0.0.1:4318/'], check=True)
            elif cue['action'] == 'image-report':
                container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', serial,
                    'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
                report = json.loads((Path(container)/'Documents/jolt-image-profile.json').read_text())
                assert report['session'] >= started_at, 'stale image profile'
                (output/(name+'.json')).write_text(json.dumps(report, indent=2)+'\n')
            elif cue['action'] in ('scroll-rotation', 'scroll-report'):
                container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', serial,
                    'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
                report = json.loads((Path(container)/'Documents/jolt-scroll-header.json').read_text())
                assert report['events'][0]['time'] >= started_at, 'stale scroll report'
                if cue['action'] == 'scroll-rotation':
                    snapshots = [event for event in report['events'] if event['name'] == 'snapshot']
                    before = next(event for event in report['events'] if event['name'] == 'reload-before')
                    rotated = snapshots[-1]
                    # XCTest's retained UITableView snapshot can keep its old rectangle
                    # after remove/reinsert on iOS 26. Check actual UIKit geometry too.
                    for key in ('frame', 'bounds', 'accessibilityFrame'):
                        assert rotated['nativeList'][key][2] > before['nativeList'][key][2], (key, rotated)
                    assert abs(rotated['nativeList']['bounds'][2] - rotated['viewport']['width']) < 1
                else:
                    (output/(name+'.json')).write_text(json.dumps(report, indent=2)+'\n')
            elif cue['action'] == 'appearance':
                assert name in ('light', 'dark')
                subprocess.run(['xcrun', 'simctl', 'ui', serial, 'appearance', name], check=True)
            elif cue['action'] == 'content-size':
                assert name in ('large', 'accessibility-medium')
                if original_content_size is None:
                    original_content_size = subprocess.check_output(['xcrun', 'simctl', 'ui', serial, 'content_size'], text=True).strip()
                subprocess.run(['xcrun', 'simctl', 'ui', serial, 'content_size', name], check=True)
            elif cue['action'] == 'screenshot':
                subprocess.run(['xcrun', 'simctl', 'io', serial, 'screenshot', str(output/(name+'.png'))], check=True, stdout=subprocess.DEVNULL)
            elif cue['action'] == 'start':
                assert recorder is None
                path = output/(name+'.mov')
                if path.exists():
                    path.unlink()
                recorder = subprocess.Popen(['xcrun', 'simctl', 'io', serial, 'recordVideo',
                                             '--codec=h264', str(path)], stderr=subprocess.PIPE)
                deadline = time.monotonic()+20
                started = False
                while time.monotonic() < deadline:
                    ready, _, _ = select.select([recorder.stderr], [], [], 1)
                    if ready:
                        line = recorder.stderr.readline().decode()
                        if 'Recording started' in line:
                            started = True
                            break
                        if not line:
                            break
                if not started:
                    raise RuntimeError('Simulator recording did not start')
                subprocess.run(['xcrun', 'simctl', 'io', serial, 'screenshot', str(output/(name+'-before.png'))], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print('Recording '+name, flush=True)
            elif cue['action'] == 'stop':
                assert recorder is not None
                recorder.send_signal(signal.SIGINT)
                recorder.communicate(timeout=20)
                assert recorder.returncode == 0, 'Recorder failed'
                recorder = None
                subprocess.run(['xcrun', 'simctl', 'io', serial, 'screenshot', str(output/(name+'-after.png'))], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                print('Saved '+name, flush=True)
            else:
                raise ValueError(cue)
            temporary = control/'ack.tmp'
            temporary.write_text(json.dumps({'id': seen}))
            temporary.replace(control/'ack.json')
        if runner.returncode:
            raise RuntimeError('XCTest failed; inspect '+str(output/'xctest.log'))
        if 'testGestureNavigation' in methods:
            from gesture_navigation import verify_navigation
            verify_navigation('ios', serial)
        if 'testInteractiveNavigationLifecycle' in methods:
            container = subprocess.check_output([
                'xcrun', 'simctl', 'get_app_container', serial,
                'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
            report = output/'interactive-navigation-lifecycle.json'
            shutil.copy2(Path(container)/'Documents/jolt-navigation-lifecycle.json', report)
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-interactive-lifecycle.py'), str(report)], check=True)
        if 'testSensorLifecycle' in methods:
            container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', serial,
                'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
            report = output/'sensor-lifecycle-ios.json'
            shutil.copy2(Path(container)/'Documents/sensors-audit.json', report)
            assert json.loads(report.read_text())['session'] >= started_at, 'stale sensor lifecycle report'
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-sensor-lifecycle.py'), str(report)], check=True)
        if 'testVectorSensors' in methods:
            container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', serial,
                'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
            report = output/'vector-sensors.json'
            shutil.copy2(Path(container)/'Documents/vector-sensors.json', report)
            assert json.loads(report.read_text())['session'] >= started_at, 'stale vector sensor report'
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-vector-sensors.py'), str(report)], check=True)
        if 'testScrollHeaderChecks' in methods:
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-scroll-header.py'), str(output/'scroll-header-audit.json')], check=True)
        if 'testScrollHeaderLifecycle' in methods:
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-scroll-header.py'), str(output/'scroll-header-disposed.json'), '--lifecycle', str(output/'scroll-header-reentry.json')], check=True)
        if 'testScrollHeaderLargeText' in methods:
            container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', serial,
                'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
            report = output/'large-text-ios.json'
            shutil.copy2(Path(container)/'Documents/jolt-scroll-header.json', report)
            assert json.loads(report.read_text())['events'][0]['time'] >= started_at, 'stale large-text report'
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-scroll-header-text.py'), str(report)], check=True)
        if 'testGalleryLargeText' in methods:
            container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', serial,
                'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
            gallery = json.loads((Path(container)/'Documents/jolt-gallery.json').read_text())
            collection = json.loads((Path(container)/'Documents/jolt-collection.json').read_text())
            assert gallery['events'][0]['time'] >= started_at, 'stale gallery text report'
            report = output/'large-text-ios.json'
            report.write_text(json.dumps({'gallery': gallery, 'collection': collection}, indent=2)+'\n')
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-gallery-text.py'), str(report)], check=True)
        if any(method in methods for method in ('testInteractiveModalChecks', 'testInteractiveModalLifecycle')):
            container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', serial,
                'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
            report = output/'interactive-modal.json'
            shutil.copy2(Path(container)/'Documents/jolt-interactive-modal.json', report)
            assert json.loads(report.read_text())['events'][0]['time'] >= started_at, 'stale modal report'
            scenario = 'checks' if 'testInteractiveModalChecks' in methods else 'lifecycle'
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-interactive-modal.py'), str(report), scenario], check=True)
        if 'testMotionRfc' in methods:
            container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', serial,
                'org.nativescript.jolt.benchmark', 'data'], text=True).strip()
            report = output/'motion-rfc-ios.json'
            shutil.copy2(Path(container)/'Documents/jolt-motion-rfc.json', report)
            subprocess.run([sys.executable, str(repo/'benchmarks/verify-motion-rfc.py'), str(report)], check=True)
finally:
    if recorder and recorder.poll() is None:
        recorder.send_signal(signal.SIGINT)
        recorder.communicate(timeout=20)
    if runner and runner.poll() is None:
        runner.terminate()
        runner.wait(timeout=20)
    if original_content_size is not None:
        subprocess.run(['xcrun', 'simctl', 'ui', serial, 'content_size', original_content_size], check=True)
    shutil.rmtree(control)
