# Release history

## 0.1.0-rc.10: Web effects, device inputs and complete gallery return {#release-candidate}

RC.10 adds [gradients, loading and text](./web-effects), [particles, blur, shapes and image effects](./web-surfaces), [keyboard, sheets, navigation, physics and icons](./web-platforms), and [gravity, haptics, sensors, glass and keyed gallery return](./web-parity). Native apps gain [Core ScrollView headers](./scroll-header#retained-scrollview) and [reorder for mounted rows](./reorder#retained-rows).

Web APIs remain experimental. [Install RC.10](./install), keep optional native adapters at the matching version and rebuild native apps. [Release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.10). Mavis adoption remains separate.

## 0.1.0-rc.8: Web orchestration and lifecycle {#rc-8}

RC.8 adds [value playback, decay, progress, sequences, timelines, motion states and SVG drawing](/guide/web-orchestration), plus [Vue/Nuxt attachment, keyed item entrances and horizontal scroll](/guide/web-collections). Native [motion states](/guide/motion-controllers#paused-replacement) now resume a replacement view after detaching the previous view while paused.

Web APIs remain experimental, with documented coordinate/capture limits; Mavis adoption is separate. [Install RC.8](/guide/install), keep the optional native package at the matching version and rebuild native apps. Read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.8) and [remaining acceptance](/guide/not-there-yet).

## 0.1.0-rc.7: Web layout and complete interactions {#rc-7}

RC.7 adds [colors, borders, intrinsic size, FLIP and seekable scenes](/guide/web-visual), [owned scopes, pointer/viewport helpers and continuous Vue setup](/guide/web-lifecycle), plus [overlay geometry, shared elements, interaction recipes and diagnostics](/guide/web-interactions). The [showcase](/guide/showcase) presents native examples and community submissions.

Web APIs remain experimental, with documented coordinate/capture limits; Mavis adoption is separate. [Install RC.7](/guide/install), keep the optional native package at the matching version and rebuild native apps. Read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.7) and [remaining acceptance](/guide/not-there-yet).

## 0.1.0-rc.6: Web interaction and native motion {#rc-6}

RC.6 adds [continuous Web values, springs and drag/snap](/guide/web-dynamic) plus [mappings, geometry refresh and scroll](/guide/web-support). Native additions cover [live paint](/guide/live-springs), [seekable scenes](/guide/sequences), [Flexbox sizing](/guide/size) and [springs between bodies](/guide/physics-attachments).

The Web APIs remain experimental; Mavis integration is separate. [Install RC.6](/guide/install), rebuild native apps and read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.6) and [remaining acceptance](/guide/not-there-yet).

## 0.1.0-rc.4: native composition, resume and sheets {#rc-4}

RC.4 plays [endless layers with no common period](/guide/layers) on native composers instead of rebuilding four-second windows, so 64-view compositions go from hundreds of milliseconds per boundary to none on the measured phones. It continues [Android shapes, gradients and blur](/guide/shapes) from the paused time on resume, places the [bottom sheet](/guide/bottom-sheet) by the host's safe-area insets, and offers only the handle actions a stop can take.

The [preview](/guide/demo) has **74 examples in four languages**. [Install RC.4](/guide/install) and rebuild the native app. Read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.4) and the [remaining physical-device acceptance](/guide/not-there-yet) before stable.

## 0.1.0-rc.3: modals, shapes and targets {#_0-1-0-rc-3-modals-shapes-and-targets}

RC.3 adds [interactive iOS modals](/guide/interactive-navigation), builds [Android numeric keyframes in one native call](/guide/motion-values), lets [shapes be created before their view loads](/guide/shapes#draw-a-path) and accepts [component refs as targets](/guide/vue). It fits the [gallery](/guide/gallery) and [scroll headers](/guide/scroll-header) to enlarged system text and completes the [physical sensor](/guide/device-sensors) and [binding/layer](/guide/motion-values#binding-measurements) audits.

The [preview](/guide/demo) has **74 examples in four languages**. [Install RC.3](/guide/install) and rebuild the native app. Read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.3) and the [remaining physical-device acceptance](/guide/not-there-yet) before stable.

## 0.1.0-rc.2: lifecycle and composition fixes {#_0-1-0-rc-2-lifecycle-and-composition-fixes}

RC.2 fixes [scroll anchors during resize and reload](/guide/scroll-header), [iOS return gestures after backgrounding](/guide/interactive-navigation), [layered press release](/guide/press#layered-press) and [native composition timing](/guide/layers). It includes [native pointer spring dragging](/guide/physics-attachments#pointer-spring-dragging-development-build) and [Android gallery lifecycle validation](/guide/gallery#android-rotation-and-resume).

The [preview](/guide/demo) now has **74 examples in four languages**. [Install RC.2](/guide/install) and rebuild the native app. Read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.2) and the [remaining physical-device acceptance](/guide/not-there-yet) before stable.

## 0.1.0-rc.1: the first release candidate

The 0.1.0 feature scope is frozen. This candidate brings [shared navigation](/guide/shared-navigation) and a [connected photo gallery](/guide/gallery), native [iOS back gestures](/guide/interactive-navigation) and [Android predictive back](/guide/predictive-back), [scroll composition](/guide/scroll-header), [device sensors](/guide/device-sensors), [gravity](/guide/gravity) and [circle physics with attachments](/guide/physics-attachments).

[Vector drawing and morphing](/guide/shapes), [animated blur](/guide/blur) and [Liquid Glass on iOS 26](/guide/glass) join a [preview](/guide/demo) with **73 examples in English, Portuguese, Spanish and Simplified Chinese**. Rebuild the native app after upgrading. [Install RC.1](/guide/install), read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-rc.1), or check the [remaining acceptance work before stable](/guide/not-there-yet). The RC phase focuses on fixes, compatibility and validation on physical devices.

<div class="clips">
<Clip name="gallery-ios" caption="iOS simulator, English: real pinch/pan, interrupted zoom, cancelled dismissal and return to the current thumbnail after reordering. Original timing." />
<Clip name="physics-attachments-android" caption="Android emulator, English: real drag/release with native tethers, springs, collisions and snap points. Original timing; not a physical-device performance measurement." />
<Clip name="shapes-android" caption="Android emulator, English: real taps draw a vector stroke, morph compatible paths, interrupt and pause playback. Original timing." />
<Clip name="glass-ios" caption="iOS 26.2 simulator, English: native glass surfaces merge and split, with material changes, interruption, pause/resume and Reduce Motion. Real taps; original timing." />
</div>

## Earlier in beta.18

[Shared layouts](/guide/shared-layout) move stable elements between layouts within one page. [Interaction replay](/guide/interaction-replay) turns interrupted springs, cancelled drags and scroll-to-sheet handoffs into regression traces. [Adaptive sampling](/guide/transitions) places native keyframes where the curve needs them, while the [motion inspector](/guide/motion-inspector) shows ownership and native observations, tunes a spring and copies TypeScript. That release expanded the preview to 59 examples in English and Portuguese. [Install the release](/guide/install) or read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-beta.18).

<div class="clips">
<Clip name="shared-layout-ios" caption="Shared tab indicator, expanding album cover and rapid reversal. Real OS input on an iOS simulator, at original timing." />
<Clip name="scroll-handoff-replay-android" caption="Record a scroll-to-sheet handoff, replay it and detect an intentionally wrong checkpoint. Real ADB interaction on an Android emulator; held-contact replay is not an OS recognizer test." />
<Clip name="curve-sampling-ios" caption="Adaptive and fixed-rate curves through native playback on an iOS simulator. The fast spring is deliberately four times slower; numbers describe curve error, not FPS." />
<Clip name="motion-inspector-android" caption="Inspect ownership, tune and hold a spring, then copy its TypeScript. Actual Android emulator input; native View observations do not measure GPU presentation or physical-device FPS." />
</div>

## Bottom sheet, lists and SceneKit

[Bottom sheet](/guide/bottom-sheet) coordinates dragging, scrolling and the keyboard; [list reordering](/guide/reorder) moves items through recycled cells with native edge scrolling. On iOS, [environment and shaders](/guide/scene-shaders) receive intensity and typed uniforms through native playback. The preview also supports light/dark/system appearance.

<div class="clips">
<Clip name="bottom-sheet-ios" caption="Dragging, scroll handoff, content growth and keyboard following. Real XCTest input on an iOS 26 simulator." />
<Clip name="reorder-android" caption="Reorder 200 items with native edge scrolling and recycled cells. Real OS touches on an Android emulator, at original speed." />
<Clip name="scene-shaders-ios" caption="Environment lighting and scalar/vector shader inputs through native SceneKit playback. Real taps on an iOS simulator; not a physical-device performance measurement." />
<Clip name="showcase-appearance-ios" caption="Jolt preview with light/dark themes and a circular transition. Real iOS simulator recording." />
</div>

## Live springs and native gestures

<div class="clips">
<Clip name="live-springs-ios" caption="Native followers with reversals and an independent layer. Actual interaction on an iOS simulator; this demo's touch events enter JavaScript." />
<Clip name="live-springs-android" caption="The same spring chain with reversals and reduced motion on an Android emulator. This is not a physical-device performance measurement." />
<Clip name="gesture-composition-ios" caption="Simultaneous pan, pinch and rotation followed by single and double taps. Actual OS input on an iOS simulator." />
<Clip name="gesture-handoff-android" caption="One drag expands the panel and scrolls its content; the reverse drag returns to the panel without lifting the finger. Android emulator, vertical Core ScrollView." />
</div>

## Dimensions and camera

<div class="clips">
<Clip name="size-ios" caption="Real width/height and auto sizing, with text reflow, interruption and working touch targets. iPhone 17 simulator, iOS 26; the app selects 0.25× speed for the interruption segment." />
<Clip name="scene-camera-ios" caption="SceneKit perspective zoom coordinated with paint and lighting, including pause and reversal. Real-time iPhone 17 simulator recording, iOS 26." />
</div>

## More motion

<div class="clips">
<Clip name="assistant-flow" caption="The demo assistant on iOS. Every movement is a Jolt call." />
<Clip name="presets" caption="Presets, springs and stagger in the playground." />
</div>
