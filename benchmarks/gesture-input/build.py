"""Compile a shell-only multi-touch injector; it is never packaged in Jolt."""
from pathlib import Path
import os
import subprocess
import sys

sdk = Path(os.environ["ANDROID_HOME"])
source = Path(__file__).with_name("NativeGestureInput.java")
destination = Path(sys.argv[1]).resolve()
destination.mkdir(parents=True, exist_ok=True)
android = sdk / "platforms/android-36/android.jar"
build_tools = sdk / "build-tools/36.0.0"
subprocess.run(["javac", "-source", "8", "-target", "8", "-cp", str(android), "-d", str(destination), str(source)], check=True)
subprocess.run([str(build_tools / "d8"), "--lib", str(android), "--output", str(destination), str(destination / "NativeGestureInput.class")], check=True)
subprocess.run(["jar", "cf", str(destination / "gesture-input.jar"), "-C", str(destination), "classes.dex"], check=True)
print(destination / "gesture-input.jar")
