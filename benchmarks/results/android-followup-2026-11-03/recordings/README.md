# Physical recording review

Actual ASUS ZenFone 3, Android 8.0.0, English UI. Captured after all timing samples; recording changes workload and is not a primary performance sample.

- Jolt, explicit V8 size profile: Start/restart, application-runtime block, UI-thread block, Stop, restart and Stop. The tile translates and fades; both blocking probes visibly pause playback.
- Reanimated reference: the same native interactions. Playback continues through the application-JS block and pauses at the UI-thread block.
- Separate JSON workload, default profile: Preparing, real batch progress and Complete with checksum verification. Values shown while recording are not the measured cohort’s batch samples.

All three H.264 files decode fully without errors. Documentation files use stream copy and faststart; every frame timestamp matches its native capture exactly. No frames were interpolated, removed or accelerated. Durations, frame counts, native-capture hashes, final-file hashes and APK identities are retained in the JSON records here.

Visual inspection covered the full native scenes through decoded frame sequences and representative frames: readable English controls, expected tile trajectory/opacity, reset and stop, the blocking pauses, and workload completion. Tile presence and the full horizontal trajectory were additionally checked across all 913 Jolt frames and 930 Reanimated frames. Recording timestamps show a pause at each Jolt block and only at the UI block for Reanimated. These are visual checks, not substitute timing measurements. No error dialogs or unrelated setup appear in the accepted clips.

The original captures and frame-review exports remain in the task workspace. Reviewed documentation MP4 files are in `docs/public/media/` and reused as English PR attachments. The same clips have captions in English, Portuguese, Spanish and Simplified Chinese.
