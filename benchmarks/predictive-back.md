# Android predictive back validation

The optional `@rafaelaugusto/jolt/predictive-back` entry uses AndroidX's existing view-tree back dispatcher. The production native class handles progress and Choreographer spring frames in Java. JavaScript owns configuration, lifecycle notifications and the application commit. There is no per-progress or per-frame bridge callback.

Validated on a **dedicated Android 16 / API 36 emulator**, gesture navigation enabled, NativeScript Core 9.1.3 and vue-router-ns 0.1.0-rc.2. These are emulator correctness checks, not physical-device performance measurements. iOS 26.2 simulator validation covers the unsupported-platform preview and startup, not Android gestures. Older Android, physical devices and native modal dispatcher owners were not exercised here.

## Reproduce

Build the library, then the normal release demo with `JOLT_BENCHMARK=1` and `--no-hmr`. The tracked demo manifest opts into `android:enableOnBackInvokedCallback="true"`. Install the resulting APK only on an assigned emulator. Build native platforms sequentially.

```sh
ANDROID_HOME=/path/to/sdk python3 benchmarks/gesture-input/build.py /tmp/JoltPredictiveInput
adb -s YOUR_ASSIGNED_EMULATOR push /tmp/JoltPredictiveInput/gesture-input.jar /data/local/tmp/jolt-predictive-input.jar
python3 benchmarks/predictive-back-android.py YOUR_ASSIGNED_EMULATOR benchmarks/results/predictive-back audit
python3 benchmarks/predictive-back-android.py YOUR_ASSIGNED_EMULATOR /tmp/jolt-video record en
```

For Portuguese, select Português in the preview's language settings using real OS taps, then run the recorder with `pt-BR`. Restore the previous language preference after recording. The recording script restores the original touch-indicator setting. The shell input helper is never packaged in the library or demo and injects actual OS touch sequences; it never invokes the app's gesture handlers directly.

## Evidence

[android.json](results/predictive-back/android.json) records lifecycle events, the native progress-event count, route identity, native transforms, active presentation count and registered callback count. Assertions cover:

- left and right edge cancellation without a route commit;
- right-edge completion accepted by Android below 50% progress;
- a real router leave guard rejecting a committed gesture and restoring the view;
- explicit cancellation while the OS still holds the gesture, without a later accidental pop;
- hardware back using the same single commit path;
- reduced motion preserving identity transforms throughout the gesture and completion;
- keyboard dismissal consuming back before the page callback;
- disabled callbacks yielding back to the router;
- explicit disposal and normal back afterwards;
- Activity stop/resume: Core unloads the view, the old handle releases input, and the reloaded preview binds a new owner before the next gesture;
- zero active presentations and callbacks after route completion, with the captured transform restored.

The host suite additionally covers commit rejection, exceptions, observer failure, bounded timeout, late promise results, reentrant disposal, view unload while commit resolves, duplicate ownership, validation, missing native code and unsupported attachment. Host mocks are not counted as native gesture evidence.

Two reviewed H.264 recordings live in `docs/public/media/predictive-back-android.mp4` and `predictive-back-pt-android.mp4`, embedded in both language guides and attached to the feature PR. They show the ordinary preview, cancellation, right-edge completion and a second return using the accessible button. Full-duration contact sheets and transition frames are inspected at original playback speed.

No extra GitHub Actions workflow or native CI job was added. Native settling is bounded at 1.5 seconds; application commit waiting defaults to 5 seconds and is capped at 10 seconds. A timeout restores presentation but cannot cancel an application-owned navigation promise.
