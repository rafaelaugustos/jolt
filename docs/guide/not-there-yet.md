# Not there yet

- [Real width/height/auto transitions](./size) are available for StackLayout/GridLayout, including inside ScrollView. They run JS layout per frame; flex allocation, recycled cells and shared elements are outside that API.

- [Layout changes](./layout), [drag constraints](./drag), [motion values](./motion-values), [observable playback](./playback) and [joint timeline controls](./sequences) are available. They have different native execution and lifecycle contracts; see their guides.
- [Shared navigation](./shared-navigation), [shared gestures](./shared-gestures), [current-cell returns](./return-targets) and the [connected gallery](./gallery) are available in rc.1 within their documented Frame/ListView/static-image combinations. Physical-device gallery acceptance remains tracked in [#117](https://github.com/rafaelaugustos/jolt/issues/117).
- General-purpose multi-finger gesture composition remains outside `drag()`; [photo zoom](./photo-zoom) provides its own pinch, pan and dismissal controller.
- [External property adapters](./native-properties) require an optional native plugin. Camera pose and [light/solid-material adapters](./scene-lighting) use SceneKit on iOS; there is no bundled Android 3D renderer adapter. MapKit and MapLibre camera units are distinct.
- [SceneKit camera FOV](./scene-camera) is available for automatic perspective cameras on iOS. Orthographic-scale and arbitrary lens controls remain outside that adapter.
- Timelines pause and resume their participants, but do not offer arbitrary aggregate scrubbing of callbacks or one-shot effects. Native writes do not isolate a renderer from main-thread JavaScript.

The [issues](https://github.com/rafaelaugustos/jolt/issues) track upcoming work and integrations.

## From RC to 0.1.0

The documented rc.1 feature scope is frozen for 0.1.0. Subsequent candidates focus on correctness, compatibility, accessibility, lifecycle cleanup and documentation. New capabilities belong after 0.1.0; the broader feature issues do not expand the stable release's supported combinations.

Before stable acceptance:

- Validate the supported gallery flow on physical iOS and Android: interrupted zoom/return, recycled or deleted targets, rotation, accessibility and repeated navigation without retained overlays ([#117](https://github.com/rafaelaugustos/jolt/issues/117)).
- Validate the Core ListView scroll composition on physical devices, including reversal/fling, late layout changes, anchor preservation and cleanup ([#116](https://github.com/rafaelaugustos/jolt/issues/116)).
- Validate live rotation/gravity hardware, orientation mapping, sampling cost and subscription cleanup on a physical iPhone and Android device ([#114](https://github.com/rafaelaugustos/jolt/issues/114)). Simulator test inputs validate processing, not sensor hardware.
- Keep general, iOS and Android regression checks and their negative controls green on the release commit; verify matching package installation and a clean native rebuild. Record and resolve release-blocking regressions before tagging stable.

Frame pacing, input response and retained memory still need physical-device evidence. The [comparison project](https://github.com/rafaelaugustos/jolt/issues/65) is separate from shipping this supported scope. Additional framework adapters, arbitrary view shaders, sensor types, body-to-body physics joints and general modal navigation are later work. Existing platform fallbacks and per-frame JavaScript costs remain as documented; RC does not broaden those contracts.
