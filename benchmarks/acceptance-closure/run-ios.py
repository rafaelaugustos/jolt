"""Run actual VoiceOver tests on an explicitly selected simulator and retain native video.

Usage: PYTHON SCRIPT SIMULATOR_UUID NEW_OUTPUT_DIRECTORY [TEST_METHOD]
Build/install the --env.readerAcceptance fixture first. Requires Xcode/iOS 27.
"""
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import time

device, destination = sys.argv[1:3]
method = sys.argv[3] if len(sys.argv) > 3 else None
assert re.fullmatch(r'[A-Fa-f0-9-]{36}', device)
assert method in (None, 'testExitTraversal', 'testListFocus', 'testCollectionFocus')
root = Path(__file__).resolve().parents[2]
out = Path(destination).resolve()
out.mkdir(parents=True, exist_ok=False)
devices = json.loads(subprocess.check_output(['xcrun', 'simctl', 'list', 'devices', 'available', '--json']))
assert any(d['udid'] == device and d['state'] == 'Booted' for group in devices['devices'].values() for d in group), 'Select a booted dedicated simulator'
ruby = os.environ.get('JOLT_RUBY', '/opt/homebrew/opt/ruby@3.3/bin/ruby')
subprocess.run([ruby, str(root / 'benchmarks/docs-ios-ui.rb'), str(out / 'project'), str(Path(__file__).with_name('ReaderTests.swift')), '--keep-recordings'], check=True)
args = ['xcodebuild', 'test', '-project', str(out / 'project/DocsTests.xcodeproj'), '-scheme', 'DocsTests', '-destination', 'platform=iOS Simulator,id=' + device, '-derivedDataPath', str(root / '.local/reader-ios-build'), '-resultBundlePath', str(out / 'result.xcresult'), '-parallel-testing-enabled', 'NO', 'CODE_SIGNING_ALLOWED=NO']
if method: args.append('-only-testing:DocsTests/ReaderTests/' + method)
started = time.time() * 1000
with (out / 'xctest.log').open('w') as log:
    result = subprocess.run(args, stdout=log, stderr=subprocess.STDOUT, timeout=600)
container = subprocess.check_output(['xcrun', 'simctl', 'get_app_container', device, 'dev.jolt.nativeci', 'data'], text=True).strip()
report = Path(container) / 'Documents/reader-acceptance.json'
if report.exists(): (out / 'acceptance.json').write_bytes(report.read_bytes())
text = (out / 'xctest.log').read_text()
for scene in ['exits', 'lists', 'collections']:
    mark = re.search(r'JOLT_RECORD_START ' + scene + r' ([\d.]+)', text)
    if not mark: continue
    reports = [(json.loads(source.read_text()), source) for source in (Path(container) / 'Documents').glob('reader-acceptance-*-' + scene + '.json')]
    reports = [(data, source) for data, source in reports if started <= data['session'] <= float(mark[1]) * 1000]
    if reports: (out / (scene + '.json')).write_bytes(max(reports, key=lambda item: item[0]['session'])[1].read_bytes())
(out / 'reader.txt').write_text('\n'.join(line for line in text.splitlines() if line.startswith('JOLT_')) + '\n')
subprocess.run(['xcrun', 'xcresulttool', 'export', 'attachments', '--path', str(out / 'result.xcresult'), '--output-path', str(out / 'attachments'), '--filter', '*.mp4'], check=True)
manifest = json.loads((out / 'attachments/manifest.json').read_text())
for scene, test in [('exits', 'testExitTraversal'), ('lists', 'testListFocus'), ('collections', 'testCollectionFocus')]:
    start = re.search(r'JOLT_RECORD_START ' + scene + r' ([\d.]+)', text)
    stop = re.search(r'JOLT_RECORD_STOP ' + scene + r' ([\d.]+)', text)
    if not start or not stop: continue
    videos = [a for record in manifest if test in json.dumps(record) for a in record['attachments'] if a.get('deviceId') == device and a['exportedFileName'].endswith('.mp4')]
    assert len(videos) == 1, ('Expected one native recording', scene, videos)
    video = videos[0]
    offset, duration = float(start[1]) - video['timestamp'], float(stop[1]) - float(start[1])
    assert offset >= 0 and duration > 0
    name = {'exits': 'layout-exits-voiceover-ios', 'lists': 'list-focus-voiceover-ios', 'collections': 'collection-focus-voiceover-ios'}[scene]
    subprocess.run(['ffmpeg', '-v', 'error', '-ss', str(offset), '-i', str(out / 'attachments' / video['exportedFileName']), '-t', str(duration), '-vf', 'fps=30,scale=720:-2', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', str(out / (name + '.mp4'))], check=True)
print('VoiceOver result:', result.returncode, out)
raise SystemExit(result.returncode)
