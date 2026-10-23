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
  - title: Real dimensions
    details: Animate width, height and auto. Text reflows and neighboring controls move with the changing bounds. Uses JavaScript layout each frame.
    link: /guide/size
  - title: SceneKit camera zoom
    details: Animate perspective field of view alongside paint, lighting and camera pose on iOS, using the optional native plugin.
    link: /guide/scene-camera
---

## New in 0.1.0-beta.15

[Real dimensions](/guide/size) for expanding cards and [SceneKit camera field of view](/guide/scene-camera) for coordinated perspective zoom. [Install the release](/guide/install) or read the [release notes](https://github.com/rafaelaugustos/jolt/releases/tag/v0.1.0-beta.15).

<div class="clips">
<Clip name="size-ios" caption="Real width/height and auto sizing, with text reflow, interruption and working touch targets. iPhone 17 simulator, iOS 26; the app selects 0.25× speed for the interruption segment." />
<Clip name="scene-camera-ios" caption="SceneKit perspective zoom coordinated with paint and lighting, including pause and reversal. Real-time iPhone 17 simulator recording, iOS 26." />
</div>

## More motion

<div class="clips">
<Clip name="assistant-flow" caption="The demo assistant on iOS. Every movement is a Jolt call." />
<Clip name="presets" caption="Presets, springs and stagger in the playground." />
</div>
