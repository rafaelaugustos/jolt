"""Export actual XCTest iPhone video and snapshot reports.
Usage: python3 SCRIPT DEVICE PROJECT DERIVED OUTPUT
"""
import json
from pathlib import Path
import re
import subprocess
import sys

device, project, derived, directory = sys.argv[1:]
out=Path(directory).resolve();out.mkdir(parents=True,exist_ok=False)
result=out/'results.xcresult';log=out/'xctest.log'
with log.open('w') as stream:
    subprocess.run(['xcodebuild','test-without-building','-project',project,'-scheme','DocsTests',
        '-destination','platform=iOS,id='+device,'-derivedDataPath',derived,'-parallel-testing-enabled','NO',
        '-resultBundlePath',str(result),'-only-testing:DocsTests/DocsTests/testRefresh'],
        stdout=stream,stderr=subprocess.STDOUT,check=True,timeout=360)
subprocess.run(['xcrun','xcresulttool','export','attachments','--path',str(result),
    '--output-path',str(out/'attachments'),'--filter','*.mp4'],check=True)
manifest=json.loads((out/'attachments/manifest.json').read_text())
videos=[a for test in manifest for a in test['attachments'] if a['deviceId']==device]
assert len(videos)==1
video=videos[0];text=log.read_text()
start=float(re.search(r'JOLT_RECORD_START ([\d.]+)',text)[1])
stop=float(re.search(r'JOLT_RECORD_STOP ([\d.]+)',text)[1])
offset=start-video['timestamp'];assert offset>=0 and stop>start
subprocess.run(['ffmpeg','-v','error','-ss',str(offset),'-i',str(out/'attachments'/video['exportedFileName']),
    '-t',str(stop-start),'-vf','fps=30,scale=540:-2','-c:v','libx264','-crf','23','-pix_fmt','yuv420p',
    '-movflags','+faststart','-an',str(out/'scroll-header-refresh-ios.mp4')],check=True)
subprocess.run(['xcrun','devicectl','device','copy','from','--device',device,'--domain-type','appDataContainer',
    '--domain-identifier','org.nativescript.jolt.benchmark','--source','Documents/jolt-scroll-header.json',
    '--destination',str(out/'native.json')],check=True)
report=json.loads((out/'native.json').read_text())
labels=re.findall(r'JOLT_CHECK (\S+)',text)
snapshots=[e for e in report['events'] if e['name']=='snapshot']
assert len(labels)==len(snapshots)
evidence={'platform':'Physical iPhone, native XCTest touch input','checks':[{'label':k,'event':v} for k,v in zip(labels,snapshots)],'report':report}
(out/'ios.json').write_text(json.dumps(evidence,indent=2)+'\n')
subprocess.run([sys.executable,str(Path(__file__).with_name('verify-scroll-header-refresh.py')),'ios',str(out/'ios.json')],check=True)
print(out)
