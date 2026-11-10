"""Real standalone app interaction on a dedicated iOS simulator and the macOS runner."""
import json
import os
import pathlib
import subprocess
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
RESULTS = ROOT / 'benchmarks/swiftui-demo/results'
RESULTS.mkdir(parents=True, exist_ok=True)

def run(*args):
    subprocess.run(args, cwd=ROOT, check=True)

def read(*args):
    return json.loads(subprocess.check_output(args, cwd=ROOT, text=True))

# runner-images/configure-system.sh enables Reduce Motion. Control only the disposable
# CI runner's preference for full-motion interaction; unit tests inject both policies.
if os.environ.get('CI') == 'true':
    run('defaults','write','com.apple.universalaccess','reduceMotion','-bool','false')
run('ruby', 'benchmarks/swiftui-demo/project.rb')
runtimes = [r for r in read('xcrun','simctl','list','runtimes','--json')['runtimes'] if r.get('isAvailable') and 'iOS' in r['name']]
if not runtimes:
    raise RuntimeError('No available iOS runtime; interaction acceptance cannot be replaced by a build.')
runtime = max(runtimes, key=lambda r: tuple(map(int,r['version'].split('.'))))
devices = [d for d in read('xcrun','simctl','list','devicetypes','--json')['devicetypes'] if d['name'].startswith('iPhone') and d['name'].endswith(' Pro')]
device = devices[-1]
identifier = subprocess.check_output(['xcrun','simctl','create','Jolt-SwiftUI-CI-'+uuid.uuid4().hex[:8],device['identifier'],runtime['identifier']],text=True).strip()
try:
    run('xcrun','simctl','boot',identifier)
    run('xcrun','simctl','bootstatus',identifier,'-b')
    project = 'benchmarks/swiftui-demo/JoltSwiftUIDemo.xcodeproj'
    run('xcodebuild','-project',project,'-scheme','JoltSwiftUIDemo','-destination','platform=iOS Simulator,id='+identifier,'-parallel-testing-enabled','NO','-resultBundlePath',str(RESULTS/'ios.xcresult'),'test','CODE_SIGNING_ALLOWED=NO')
    run('xcodebuild','-project',project,'-scheme','JoltSwiftUIMac','-destination','platform=macOS','-parallel-testing-enabled','NO','-resultBundlePath',str(RESULTS/'macos.xcresult'),'test','CODE_SIGN_IDENTITY=-','CODE_SIGNING_ALLOWED=YES')
finally:
    subprocess.run(['xcrun','simctl','shutdown',identifier],check=False)
    subprocess.run(['xcrun','simctl','delete',identifier],check=False)
