"""Real native XCTest input and simulator capture; never uses another booted device."""
import json,os,signal,subprocess,sys,time
from pathlib import Path
serial,folder=sys.argv[1:3];output=Path(folder).resolve();output.mkdir(parents=True,exist_ok=True)
root=Path(__file__).resolve().parents[2];control=Path('/tmp/jolt-collections-recording-'+serial);control.mkdir()
recorder=runner=None
try:
 subprocess.run(['/opt/homebrew/opt/ruby@3.3/bin/ruby',str(root/'benchmarks/docs-ios-ui.rb'),str(output/'project'),str(root/'benchmarks/collections-scroll/NativeTests.swift')],check=True)
 with (output/'xctest.log').open('w') as log:
  runner=subprocess.Popen(['xcodebuild','test','-project',str(output/'project/DocsTests.xcodeproj'),'-scheme','DocsTests','-destination','platform=iOS Simulator,id='+serial,'-parallel-testing-enabled','NO','-collect-test-diagnostics','never','-derivedDataPath',str(output/'build'),'-resultBundlePath',str(output/'result.xcresult'),'CODE_SIGNING_ALLOWED=NO','-only-testing:DocsTests/CollectionsScroll/'+(sys.argv[3] if len(sys.argv)>3 else 'testCollections')],stdout=log,stderr=subprocess.STDOUT)
  seen=None;deadline=time.monotonic()+600
  while runner.poll() is None:
   if time.monotonic()>deadline:raise RuntimeError('XCTest timeout')
   try:cue=json.loads((control/'request.json').read_text())
   except (FileNotFoundError,json.JSONDecodeError):time.sleep(.05);continue
   if cue['id']==seen:time.sleep(.05);continue
   seen=cue['id'];name=cue['name'];assert name.replace('-','').isalnum()
   if cue['action']=='start':
    recorder=subprocess.Popen(['xcrun','simctl','io',serial,'recordVideo','--codec=h264',str(output/(name+'.mov'))],stdout=log,stderr=subprocess.STDOUT);time.sleep(.8)
   elif cue['action']=='background':
    subprocess.run(['xcrun','simctl','launch',serial,'com.apple.Preferences'],check=True,stdout=log,stderr=subprocess.STDOUT)
   else:
    recorder.send_signal(signal.SIGINT);recorder.wait(timeout=15);recorder=None
   (control/'ack').write_text(str(seen))
  if runner.returncode:raise RuntimeError('XCTest failed; inspect '+str(output/'xctest.log'))
 for source in output.glob('*.mov'):
  subprocess.run(['ffmpeg','-y','-v','error','-i',str(source),'-an','-vf','scale=-2:1200','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(source.with_suffix('.mp4'))],check=True)
 container=subprocess.check_output(['xcrun','simctl','get_app_container',serial,'dev.jolt.nativeci','data'],text=True).strip()
 report_name = 'collection-layouts.json' if 'testCollectionLayouts' in sys.argv else 'collections-scroll.json'
 if 'testCollectionContinuity' in sys.argv:report_name='continuity.json'
 report=json.loads((Path(container)/'Documents'/report_name).read_text())
 if 'testCollectionContinuity' in sys.argv:
  audits=[e for e in report['history'] if e['message']=='Audit']
  compact,expanded,returned,reversed_contact,cancelled,transferred=audits
  assert compact['first']==0 and abs(compact['height']-compact['min'])<3,compact
  assert expanded['first']>0 and abs(expanded['height']-expanded['max'])<3,expanded
  for e in (returned,reversed_contact):assert e['first']==0 and abs(e['height']-e['min'])<3,e
  assert reversed_contact['maxFirst']>0,reversed_contact
  assert cancelled['commits']==0 and cancelled['offset']>0,cancelled
  assert transferred['commits']==1 and transferred['index']>12 and transferred['offset']>250,transferred
 if 'testCollectionLayouts' in sys.argv:
  for scene in ['Carousel','RTL','Heights']:
   audits=[e for e in report['history'] if e['scene']==scene and e['audit']]
   before=next(e for e in audits if e['message']=='Jumped to card 19')
   after=next(e for e in audits if e['message']=='Inserted a card')
   assert before['anchor']==after['anchor'] and abs(before['offset']-after['offset'])<2,(before,after)
  assert report['commits']==2 and report['right']==['Birch'], report
 if len(sys.argv)>3 and sys.argv[3]=='testHorizontalLifecycle':
  cancelled=[i for i,event in enumerate(report['events']) if event['scene']=='LTR' and event['name']=='cancel']
  assert len(cancelled)==1 and not any(event['name']=='commit' for event in report['events'][:cancelled[0]]),report
 (output/'acceptance.json').write_text(json.dumps(report,indent=2))
finally:
 if recorder and recorder.poll() is None:recorder.send_signal(signal.SIGINT);recorder.wait(timeout=15)
 if runner and runner.poll() is None:runner.terminate();runner.wait(timeout=30)
 for file in control.iterdir():file.unlink()
 control.rmdir()
