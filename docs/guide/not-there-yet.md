# Release status and limits {#not-there-yet}

RC.13 adds [standalone SwiftUI for iOS 17+/macOS 14+](./swiftui), [React/Angular/Svelte/Solid Web adapters](./web-frameworks), [portable inspection and replay](./portable-tools), and [snap panels, measured reorder and typed Bézier paths](./swiftui-geometry), from PR #436 (39 tasks). Web and SwiftUI remain experimental. Install matching npm packages and rebuild NativeScript apps; use tag `v0.1.0-rc.13` for Swift Package Manager. Reviewed native/browser recordings are embedded in all four documentation languages. Physical sensor delivery, inspector overhead and general performance comparisons remain separate.

RC.12.1 adds [retained Web resources and Vue shape ownership, behavior coordination, gradient text, 2D rigs, shared helpers and effective reduced-motion observation](./portable-composition). Browser vector adapters share acquisition and native-compatible units; magnetic-field input explicitly reports unavailable. Install matching packages and rebuild native apps. Web APIs remain experimental.

Physical browser sensor delivery and accuracy remain pending in #385. Acceptance uses simulators/emulators and labeled injected browser readings. Publication makes no new performance or blocked-JavaScript playback claim.

RC.12 adds [pointer presence, coordinated properties, renderer activity and bounded drawing](./portable-foundations), plus [drop targets, optional audio/cues, inspection/replay and Web paths, 3D rotation and shadows](./interaction-depth). Rebuild native apps with matching package versions. Web entries remain experimental.

Physical pointer-accessory acceptance, the iPhone silent switch and further inspector/performance validation on a newer Android remain open. The old phone supplies compatibility evidence only. Latency/PSS work (#405, #406) remains technical debt; publication does not establish performance superiority or playback through blocked application JavaScript.

**Current release: 0.1.0-rc.12.1.** Includes [native framework adapters](./frameworks), [additional sensor sources](./device-sensors#vector-sources), [mobile keyboard fixes](./mobile-web), [element-relative Web scroll ranges](./web-support#element-range), [native shader inputs and local iOS video textures](./image-effects), and [Android playback improvements](./android-performance). [Install matching packages](./install) and rebuild native applications. Web APIs remain experimental.

**New in RC.10:** [Web gradients, loading and text](./web-effects), [particles, blur, shapes and image effects](./web-surfaces), [keyboard, sheets, navigation, physics and icons](./web-platforms), [gravity, haptics, sensors, glass and keyed gallery return](./web-parity), plus native [Core ScrollView headers](./scroll-header#retained-scrollview) and [mounted-row reorder](./reorder#retained-rows). Rebuild native apps. Mavis adoption remains separate.

**New in RC.9:** [Web gestures, zoom, coordinated scroll/refresh and reorder](./web-gestures), plus [retained native paint channels and mixed ownership](./live-springs#extended-live-paint). Rebuild native apps after upgrading.

**New in RC.8:** [Web orchestration and SVG drawing](./web-orchestration), [Vue/Nuxt attachment, keyed items and horizontal scroll](./web-collections), and [paused native replacement recovery](./motion-controllers#paused-replacement).

**Also in RC.7:** [resource scopes, pointer/viewport helpers and continuous Vue setup](./web-lifecycle), plus [overlay geometry, shared elements, complete recipes and diagnostics](./web-interactions). Mavis adoption remains separate.

**Since RC.7:** [colors, borders, continuous paint, real size, FLIP and seekable scenes](./web-visual) extend this runtime. The Web APIs remain experimental; full parity is tracked in [#236](https://github.com/rafaelaugustos/jolt/issues/236).

**0.1.0-rc.12.1 is available.** Native features retain their documented platform limits while stable-release validation continues. The Web entries are experimental; publication does not complete Mavis integration or establish native/Web parity for every API.

RC.6 includes [continuous Web motion](./web-dynamic), with values, followers and drag/snap, plus [numeric mappings, geometry refresh and vertical scroll](./web-support). The Web APIs remain experimental.

RC.6 also adds native [live color/radius bindings](./live-springs), [seekable scenes](./sequences), [bounded Flexbox sizing](./size) and [body-to-body springs](./physics-attachments). Rebuild native applications after upgrading.

RC.5 adds [experimental Web playback](./web-runtime), [composable press](./web-press) and the optional [Vue DOM adapter](./web-vue), fixes scoped background recovery and Android layer removal, and adds [native pull-to-refresh](./scroll-header#pull-to-refresh) plus scroll/gallery reader-focus fixes. Mavis completed its initial press/reveal migration and shared application-animation proof; adoption of the RC.6 capabilities is tracked in [its integration issues](https://github.com/getcortexlabs/mavis-ui/issues/137).

RC.4 composes rolling layer windows on native live nodes, continues Android shapes, gradients and blur from the paused time on resume, places the bottom sheet by the host's safe-area insets and offers only the handle actions a stop can take. RC.3 added `interactiveModal()` on iOS, one-call Android numeric keyframes, shapes created before their view loads and component refs as targets.

The [binding/layer audit](./motion-values#binding-measurements) includes physical iPhone and Android preparation/playback measurements, automated input onset and repeated mount/unmount retention checks. Expensive composition boundaries, approximate allocation-counter failures and unavailable Android thermal telemetry remain explicit in the evidence. These results provide workload-specific guidance, not a universal capacity or presented-frame guarantee. Since RC.4, windowed compositions play on native composers with no boundary submissions; the remaining cost is the synchronous start of large keyframe batches, measured in the same audit.

## Available in RC.11 {#available-in-rc-1}

- Experimental [finite Web playback](./web-runtime), [press](./web-press) and [Vue DOM lifecycle](./web-vue), with optional framework/native peers and SSR-safe imports.
- [Shared navigation](./shared-navigation), [shared gestures](./shared-gestures), [current-cell returns](./return-targets) and the [connected gallery](./gallery), for the documented Frame/ListView/static-image combinations.
- [Native gesture composition](./gestures): pan, pinch and rotation, plus supported vertical Core ScrollView handoff. [Drag constraints](./drag) and [photo zoom](./photo-zoom) have their own interaction contracts.
- [Scroll composition](./scroll-header) with Core ListView and [mounted Core ScrollView rows](./scroll-header#retained-scrollview), and [rotation/gravity sensors](./device-sensors) feeding native motion values.
- [Real dimensions](./size), [layout changes](./layout), [motion values](./motion-values), [observable playback](./playback) and [joint timeline controls](./sequences).
- [External native properties](./native-properties), including [SceneKit lights/materials](./scene-lighting), [camera FOV](./scene-camera) and [environment/shader inputs](./scene-shaders), through the optional native plugin.
- [Gravity](./gravity), [circle physics with attachments](./physics-attachments), [vector drawing and morphing](./shapes), [animated blur](./blur) and [Liquid Glass](./glass), with their documented platform support and fallbacks.

## Current limits {#current-limits}

- Web APIs remain experimental. Snapshot content, coordinate spaces, hardware availability and browser fallbacks retain explicit limits. [Native framework adapters](./frameworks) ship in RC.11; stable portable references remain separate work.
- `animateSize()` supports StackLayout/GridLayout and direct children of non-wrapping row/column FlexboxLayout, including inside ScrollView. Flex main-axis children require `flexGrow=0` and `flexShrink=0`; parent allocation and cross-axis stretch remain authoritative. Measurement/layout runs in JavaScript per frame. Recycled cells and shared elements remain outside this API.
- `drag()` does not provide general-purpose multi-finger composition. Use [`gestures()`](./gestures) for pan/pinch/rotation, or [photo zoom](./photo-zoom) for its dedicated pinch, pan and dismissal controller. The gesture handoff adapter supports vertical Core ScrollView; other list/container combinations require their own adapters and native validation.
- External property adapters require `@rafaelaugusto/jolt-native`. The bundled SceneKit camera, light and material adapters are iOS-only; there is no bundled Android 3D renderer adapter. MapKit and MapLibre camera units are distinct.
- SceneKit camera FOV supports automatic perspective projection on iOS. Orthographic scaling, custom projection matrices and arbitrary lens controls are outside that adapter.
- `seekableTimeline()` scrubs finite declarative view/numeric-value scenes. Callbacks, haptics, live followers and arbitrary one-shot effects remain outside that contract; imperative timelines retain their participant controls.
- Native playback has API-specific [execution paths](./how-it-works). Native property writes do not isolate a renderer from main-thread JavaScript. Layout, opt-in subscriptions, input and lifecycle work retain their documented JavaScript costs.

## From RC to 0.1.0 {#from-rc-to-0-1-0}

The open acceptance issues below cover already-shipped APIs. Before stable, validate the supported combinations on physical iOS and Android devices:

- **Gallery ([#117](https://github.com/rafaelaugustos/jolt/issues/117)):** interrupted zoom/return, recycled or deleted targets, rotation, accessibility and repeated navigation without retained overlays.
- **Scroll composition ([#116](https://github.com/rafaelaugustos/jolt/issues/116)):** reversal/fling, late layout changes, anchor preservation and cleanup with the supported Core ListView adapter.
- Keep general, iOS and Android regression checks and their negative controls passing on the release commit. Verify matching package installation and a clean native rebuild, and resolve release-blocking regressions before tagging stable.

Initial physical rotation/gravity acceptance is documented in [#114](https://github.com/rafaelaugustos/jolt/issues/114) and the [sensor report](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/device-sensors.md). Acceleration, linear acceleration, gyroscope and magnetic-field sources ship in RC.11; [their simulator/emulator acceptance](./device-sensors#vector-sources) does not establish physical-device accuracy or cost.

Gallery and scroll acceptance still require the remaining physical-device frame-pacing, input, memory and accessibility checks. See their [gallery](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/gallery.md) and [scroll](https://github.com/rafaelaugustos/jolt/blob/main/benchmarks/scroll-header.md) reports. Simulator/emulator recordings do not complete physical-device acceptance.

## After 0.1.0 {#after-0-1-0}

Subsequent RCs focus on correctness, compatibility, accessibility, lifecycle cleanup and documentation. Broader future work includes arbitrary-view shaders, additional physics joint types and wider cross-platform modal support. The documented native framework adapters and vector sensor sources are already included in RC.11.

The [comparison project](https://github.com/rafaelaugustos/jolt/issues/65) is separate from shipping the current supported scope. Broader [feature issues](https://github.com/rafaelaugustos/jolt/issues) do not expand the stable release's supported combinations or change the documented platform fallbacks and JavaScript costs.
