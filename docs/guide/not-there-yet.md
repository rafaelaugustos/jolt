# Release status and limits {#not-there-yet}

**0.1.0-rc.4 is available.** Its features are shipped within the combinations documented in each guide. The feature scope for 0.1.0 is frozen; validation for the stable release is still in progress.

RC.4 composes rolling layer windows on native live nodes, continues Android shapes, gradients and blur from the paused time on resume, places the bottom sheet by the host's safe-area insets and offers only the handle actions a stop can take. RC.3 added `interactiveModal()` on iOS, one-call Android numeric keyframes, shapes created before their view loads and component refs as targets.

The [binding/layer audit](./motion-values#binding-measurements) includes physical iPhone and Android preparation/playback measurements, automated input onset and repeated mount/unmount retention checks. Expensive composition boundaries, approximate allocation-counter failures and unavailable Android thermal telemetry remain explicit in the evidence. These results provide workload-specific guidance, not a universal capacity or presented-frame guarantee. Since RC.4, windowed compositions play on native composers with no boundary submissions; the remaining cost is the synchronous start of large keyframe batches, measured in the same audit.

## Available in RC.4 {#available-in-rc-1}

- [Shared navigation](./shared-navigation), [shared gestures](./shared-gestures), [current-cell returns](./return-targets) and the [connected gallery](./gallery), for the documented Frame/ListView/static-image combinations.
- [Native gesture composition](./gestures): pan, pinch and rotation, plus supported vertical Core ScrollView handoff. [Drag constraints](./drag) and [photo zoom](./photo-zoom) have their own interaction contracts.
- [Scroll composition](./scroll-header) with the Core ListView adapter, and [rotation/gravity sensors](./device-sensors) feeding native motion values.
- [Real dimensions](./size), [layout changes](./layout), [motion values](./motion-values), [observable playback](./playback) and [joint timeline controls](./sequences).
- [External native properties](./native-properties), including [SceneKit lights/materials](./scene-lighting), [camera FOV](./scene-camera) and [environment/shader inputs](./scene-shaders), through the optional native plugin.
- [Gravity](./gravity), [circle physics with attachments](./physics-attachments), [vector drawing and morphing](./shapes), [animated blur](./blur) and [Liquid Glass](./glass), with their documented platform support and fallbacks.

## Current limits {#current-limits}

- `animateSize()` supports StackLayout/GridLayout, including inside ScrollView, and runs JavaScript measurement/layout per frame. Flex allocation, recycled cells and shared elements are outside that API.
- `drag()` does not provide general-purpose multi-finger composition. Use [`gestures()`](./gestures) for pan/pinch/rotation, or [photo zoom](./photo-zoom) for its dedicated pinch, pan and dismissal controller. The gesture handoff adapter supports vertical Core ScrollView; other list/container combinations require their own adapters and native validation.
- External property adapters require `@rafaelaugusto/jolt-native`. The bundled SceneKit camera, light and material adapters are iOS-only; there is no bundled Android 3D renderer adapter. MapKit and MapLibre camera units are distinct.
- SceneKit camera FOV supports automatic perspective projection on iOS. Orthographic scaling, custom projection matrices and arbitrary lens controls are outside that adapter.
- Timelines pause and resume their participants, but do not provide arbitrary aggregate scrubbing of callbacks or one-shot effects.
- Native playback has API-specific [execution paths](./how-it-works). Native property writes do not isolate a renderer from main-thread JavaScript. Layout, opt-in subscriptions, input and lifecycle work retain their documented JavaScript costs.

## From RC to 0.1.0 {#from-rc-to-0-1-0}

The open acceptance issues below cover already-shipped APIs. Before stable, validate the supported combinations on physical iOS and Android devices:

- **Gallery ([#117](https://github.com/rafaelaugustos/jolt/issues/117)):** interrupted zoom/return, recycled or deleted targets, rotation, accessibility and repeated navigation without retained overlays.
- **Scroll composition ([#116](https://github.com/rafaelaugustos/jolt/issues/116)):** reversal/fling, late layout changes, anchor preservation and cleanup with the supported Core ListView adapter.
- **Sensors ([#114](https://github.com/rafaelaugustos/jolt/issues/114)):** live rotation/gravity hardware, orientation mapping, sampling cost and subscription cleanup. Simulator inputs validate processing, not physical sensor acquisition.
- Keep general, iOS and Android regression checks and their negative controls passing on the release commit. Verify matching package installation and a clean native rebuild, and resolve release-blocking regressions before tagging stable.

Frame pacing, input response and retained memory still need physical-device evidence. See the [gallery](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md), [scroll](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md) and [sensor](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md) validation reports for the evidence collected and remaining checks. Simulator/emulator recordings do not complete physical-device acceptance.

## After 0.1.0 {#after-0-1-0}

Subsequent RCs focus on correctness, compatibility, accessibility, lifecycle cleanup and documentation. New capabilities belong after 0.1.0: additional framework adapters, arbitrary view shaders, more sensor types, body-to-body physics joints and general modal navigation.

The [comparison project](https://github.com/rafaelaugustos/jolt/issues/65) is separate from shipping the current supported scope. Broader [feature issues](https://github.com/rafaelaugustos/jolt/issues) do not expand the stable release's supported combinations or change the documented platform fallbacks and JavaScript costs.
