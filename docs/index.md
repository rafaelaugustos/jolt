---
layout: home

hero:
  text: Make NativeScript move.
  tagline: Presets, springs, keyframes and stagger for NativeScript views, one call each. Native playback for view tracks, real layout when content needs to reflow.
  image:
    light: /logo.png
    dark: /logo-dark.png
    alt: Jolt
  actions:
    - theme: brand
      text: Get started
      link: /guide/install
    - theme: alt
      text: What Jolt is
      link: /guide/
    - theme: alt
      text: Presets
      link: /guide/presets

homeVideos:
  title: 'See Jolt in motion.'
  description: 'Meet the project in one minute, then watch a native app in action.'
  items:
    - name: jolt-nativescript-film
      label: 'The film'
      title: 'This is NativeScript.'
      duration: '1:00'
      width: 1920
      height: 1080
      caption: 'A one-minute film featuring real iOS simulator captures of Jolt and Motion Studio, with editorial framing and music. SceneKit sequences are iOS-only.'
    - name: jolt-tesla-demo-ios
      label: 'The example'
      title: 'Inspired by Tesla.'
      duration: '2:04'
      width: 720
      height: 1566
      caption: 'iOS simulator: a Tesla-inspired example with a 3D car, climate controls and a pickup journey. Original playback speed; demo UI, with no connection to a real vehicle.'

features:
  - title: One call
    details: "animate(card, 'fadeInUp'), animate(button, { scale: 1.1 }, 'bouncy'), animate(rows, 'fadeInUp', { stagger: 40 }). That's the whole API for most screens."
  - title: Springs with real physics
    details: Describe them by feel, by bounce and duration, or by stiffness, damping and mass. An interrupted spring keeps its velocity.
  - title: Keyframes and easing per segment
    details: Lists of values with exact times, an easing per segment, cubic beziers or any function. Custom easings run once, not per frame.
  - title: Native view playback
    details: Default view tracks play through Core Animation on iOS and ObjectAnimator on Android without per-frame JavaScript. Layout and interaction APIs document their own execution costs.
  - title: Sequences, stagger and press
    details: Steps that start when the previous one looks done, staggers from the first, the last or the center, and press effects that let go when a scroll takes over.
  - title: Interruptions without a jump
    details: A new animation on a moving property starts from the value on screen, at the speed it was going.
  - title: Live springs
    details: Native followers retain position and velocity across target changes, with mappings, layers and scoped cleanup.
    link: /guide/live-springs
  - title: Native gestures
    details: Combine pan, pinch and rotation. Coordinate axes with a list and transfer a drag between a panel and its ScrollView.
    link: /guide/gestures
  - title: Real dimensions
    details: Animate width, height and auto. Text reflows and neighboring controls move with the changing bounds. Uses JavaScript layout each frame.
    link: /guide/size
  - title: SceneKit camera zoom
    details: Animate perspective field of view alongside paint, lighting and camera pose on iOS, using the optional native plugin.
    link: /guide/scene-camera
---

## 0.1.0-rc.4: native composition, resume and sheets {#release-candidate}

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
