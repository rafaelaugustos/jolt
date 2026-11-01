# Native accessibility input

`A11yInspect.java` reads the actual Android accessibility tree using
`UiAutomation.FLAG_DONT_SUPPRESS_ACCESSIBILITY_SERVICES`. It never requests focus,
clicks an accessibility node, or disables TalkBack. The runner sends hardware
contacts through the dedicated emulator's local gRPC endpoint. Ordinary
`adb shell input` events do not exercise the same TalkBack gesture path.

Use Android SDK platform/build-tools 36, Java 17 and a Python environment with
`grpcio` and `grpcio-tools` (the captured run used 1.80.0):

```sh
python3 -m venv /tmp/jolt-reader-python
/tmp/jolt-reader-python/bin/pip install grpcio==1.80.0 grpcio-tools==1.80.0
/tmp/jolt-reader-python/bin/python benchmarks/accessibility-input/build.py /tmp/jolt-reader-tools
adb -s YOUR_EMULATOR emu grpc 8558
/tmp/jolt-reader-python/bin/python benchmarks/scroll-header-accessibility-android.py \
  YOUR_EMULATOR /path/to/avd/running/pid_NUMBER.ini /tmp/jolt-reader-tools /tmp/jolt-reader-android
```

Set `ANDROID_HOME` and put Java 17 on `PATH` before building. `build.py` generates
bindings from the emulator SDK's own protocol definition. The emulator command
reports its actual endpoint; an already running endpoint may use a different
port. Select the matching PID ini in the emulator's running-device directory.
The script checks its serial and reads its local credential without printing or
copying it into evidence. Do not expose the endpoint externally.

The test requires the release demo installed with English selected. It enables
TalkBack, performs real two-finger scrolling, one-finger reader navigation,
double-tap activation and touch exploration, and restores the original reader
settings in `finally`. The read-only probe retries a missing root during startup.
Recordings are real Android `screenrecord` output, with no generated frames.

For the physical iPhone test and native XCTest video export, see
[scroll-header validation](../scroll-header.md#screen-readers-2026-10-31).
