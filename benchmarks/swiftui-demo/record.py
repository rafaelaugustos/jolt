"""Capture the standalone application's actual XCTest interaction.
Usage: python3 benchmarks/swiftui-demo/record.py SIMULATOR_UUID|macos OUTPUT_DIRECTORY
Requires generated Xcode project; records only the dedicated simulator or demo Mac window.
"""
from pathlib import Path
import shutil, signal, subprocess, sys, time, re

device, output = sys.argv[1:3]
scene = sys.argv[3] if len(sys.argv)>3 else "standalone"
root = Path(__file__).resolve().parents[2]
output = Path(output).resolve(); output.mkdir(parents=True,exist_ok=True)
control = Path('/tmp/jolt-swiftui-recording-control-' + device)
control.mkdir()  # Exclusive ownership, never attach to another capture.
mac = device == 'macos'
name = 'swiftui-' + ('' if scene == 'standalone' else scene + '-') + ('macos' if mac else 'ios')
method = {'standalone':'testStandaloneMacMotionAndLifecycle' if mac else 'testStandaloneMotionAndLifecycle','interaction':'testInteractionExpansion','composition':'testCompositionExpansion','scroll':'testScrollExpansion','dynamics':'testDynamicsExpansion','graphics':'testGraphicsExpansion','viewport':'testViewportExpansion','key-gesture':'testKeyGestureExpansion','transfer':'testTransferExpansion','character':'testCharacterExpansion','panel':'testPanelExpansion','geometry':'testGeometryExpansion','depth':'testDepthExpansion'}[scene]
scheme = 'JoltSwiftUIMac' if mac else 'JoltSwiftUIDemo'
recorder = runner = None
try:
    command = ['xcodebuild','test','-project',str(root/'benchmarks/swiftui-demo/JoltSwiftUIDemo.xcodeproj'),'-scheme',scheme,
        '-destination','platform=macOS,arch=arm64' if mac else 'platform=iOS Simulator,id='+device,
        '-parallel-testing-enabled','NO','-collect-test-diagnostics','never','-derivedDataPath',str(output/'build'),
        '-resultBundlePath',str(output/'result.xcresult'),'-only-testing:'+scheme+'UITests/SwiftUIAcceptance/'+method]
    if not mac: command.append('CODE_SIGNING_ALLOWED=NO')
    with (output/'xctest.log').open('w') as log, (output/'record.log').open('w') as recording:
        runner = subprocess.Popen(command,stdout=log,stderr=subprocess.STDOUT)
        last = None; deadline = time.monotonic()+600
        while runner.poll() is None:
            if time.monotonic()>deadline: raise RuntimeError('Native capture timed out')
            ack = control/'ack'
            if mac:
                cues = re.findall(r'JOLT_CAPTURE_(start|stop) (.+)',(output/'xctest.log').read_text())
                request = cues[-1][0] if cues else None
                if cues: ack = Path(cues[-1][1])
            else:
                request = (control/'request').read_text() if (control/'request').exists() else None
            if request and request != last:
                last = request
                if request == 'start':
                    if mac:
                        window = subprocess.check_output(['swift',str(root/'benchmarks/swiftui-demo/window.swift')],text=True).strip()
                        capture = ['screencapture','-v','-o','-l'+window,str(output/(name+'.mov'))]
                    else:
                        capture = ['xcrun','simctl','io',device,'recordVideo','--codec=h264',str(output/(name+'.mov'))]
                    recorder = subprocess.Popen(capture,stdout=recording,stderr=subprocess.STDOUT)
                    time.sleep(1)
                    if recorder.poll() is not None: raise RuntimeError('Screen recorder failed; inspect record.log')
                elif request == 'stop':
                    recorder.send_signal(signal.SIGINT); recorder.wait(timeout=15); recorder=None
                else: raise RuntimeError('Unknown recorder cue')
                ack.write_text(request)
            time.sleep(0.05)
        if runner.returncode != 0: raise RuntimeError('XCTest failed; inspect xctest.log')
        if last != 'stop': raise RuntimeError('Capture handshake did not complete')
        subprocess.run(['ffmpeg','-y','-i',str(output/(name+'.mov')),'-an','-vf','scale=-2:900','-c:v','libx264','-crf','22','-pix_fmt','yuv420p','-movflags','+faststart',str(output/(name+'.mp4'))],check=True,stdout=recording,stderr=subprocess.STDOUT)
        subprocess.run(['ffmpeg','-v','error','-i',str(output/(name+'.mp4')),'-f','null','-'],check=True)
        print(output/(name+'.mp4'))
finally:
    if recorder and recorder.poll() is None: recorder.send_signal(signal.SIGINT); recorder.wait(timeout=15)
    if runner and runner.poll() is None: runner.send_signal(signal.SIGINT); runner.wait(timeout=30)
    shutil.rmtree(control)
