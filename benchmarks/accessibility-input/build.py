"""Build a read-only Android accessibility probe and the installed emulator's gRPC bindings."""
import os
from pathlib import Path
import subprocess
import sys

sdk = Path(os.environ['ANDROID_HOME'])
out = Path(sys.argv[1]).resolve()
out.mkdir(parents=True, exist_ok=True)
android = sdk / 'platforms/android-36/android.jar'
source = Path(__file__).with_name('A11yInspect.java')
subprocess.run(['javac', '-source', '8', '-target', '8', '-cp', str(android), '-d', str(out), str(source)], check=True)
subprocess.run([str(sdk / 'build-tools/36.0.0/d8'), '--lib', str(android), '--output', str(out), str(out / 'A11yInspect.class')], check=True)
subprocess.run(['jar', 'cf', str(out / 'a11y-inspect.jar'), '-C', str(out), 'classes.dex'], check=True)
subprocess.run([sys.executable, '-m', 'grpc_tools.protoc', '-I', str(sdk / 'emulator/lib'), '--python_out='+str(out), '--grpc_python_out='+str(out), str(sdk / 'emulator/lib/emulator_controller.proto')], check=True)
