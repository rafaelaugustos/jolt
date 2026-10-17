# Voice orb

`voice-orb.png` is the transparent illustration used by the voice preview. Jolt's `liquid()` deforms its texture natively on iOS; `animate()` adds scale, rotation, position and opacity on both platforms. The folds come from the artwork. The demo does not simulate a fluid or read microphone input.

# Icons

iOS draws the icons from SF Symbols. Android uses the [Material Icons](https://github.com/google/material-design-icons) font in `demo/src/fonts/MaterialIcons-Regular.ttf`, licensed under the Apache License 2.0, with one ligature per SF Symbol name in `Icon.vue`.
