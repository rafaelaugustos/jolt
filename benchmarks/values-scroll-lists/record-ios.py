"""Real native XCTest input and simulator capture; never uses another booted device."""
import json,os,signal,subprocess,sys,time
from pathlib import Path
from validate import validate
serial,folder=sys.argv[1:3];output=Path(folder).resolve();output.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[2];control=Path('/tmp/jolt-values-recording-'+serial);control.mkdir()
recorder=runner=None
try:
 subprocess.run(['ruby',str(root/'benchmarks/docs-ios-ui.rb'),str(output/'project'),str(root/'benchmarks/values-scroll-lists/NativeTests.swift')],check=True)
 with (output/'xctest.log').open('w') as log:
  runner=subprocess.Popen(['xcodebuild','test','-project',str(output/'project/DocsTests.xcodeproj'),'-scheme','DocsTests','-destination','platform=iOS Simulator,id='+serial,'-parallel-testing-enabled','NO','-collect-test-diagnostics','never','-derivedDataPath',str(output/'build'),'-resultBundlePath',str(output/'result.xcresult'),'CODE_SIGNING_ALLOWED=NO'],stdout=log,stderr=subprocess.STDOUT)
  seen=None;deadline=time.monotonic()+600
  while runner.poll() is None:
   if time.monotonic()>deadline:raise RuntimeError('XCTest timeout')
   try:cue=json.loads((control/'request.json').read_text())
   except (FileNotFoundError,json.JSONDecodeError):time.sleep(.05);continue
   if cue['id']==seen:time.sleep(.05);continue
   seen=cue['id'];name=cue['name'];assert name.replace('-','').isalnum()
   if cue['action']=='start':
    recorder=subprocess.Popen(['xcrun','simctl','io',serial,'recordVideo','--codec=h264',str(output/(name+'.mov'))],stdout=log,stderr=subprocess.STDOUT);time.sleep(.8)
   else:
    recorder.send_signal(signal.SIGINT);recorder.wait(timeout=15);recorder=None
   (control/'ack').write_text(str(seen))
  if runner.returncode:raise RuntimeError('XCTest failed; inspect '+str(output/'xctest.log'))
 for source in output.glob('*.mov'):
  subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-an','-vf','scale=-2:1200','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(source.with_suffix('.mp4'))],check=True)
 container=subprocess.check_output(['xcrun','simctl','get_app_container',serial,'dev.jolt.nativeci','data'],text=True).strip()
 report=json.loads((Path(container)/'Documents/values-scroll-lists.json').read_text());validate(report)
 (output/'acceptance.json').write_text(json.dumps(report,indent=2))
finally:
 if recorder and recorder.poll() is None:recorder.send_signal(signal.SIGINT);recorder.wait(timeout=15)
 if runner and runner.poll() is None:runner.terminate();runner.wait(timeout=30)
 for file in control.iterdir():file.unlink()
 control.rmdir()
