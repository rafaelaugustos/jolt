---
layout: home

hero:
  text: Make NativeScript move.
  tagline: Presets, springs, keyframes and stagger for NativeScript views, one call each. Computed once in JavaScript, played by the platform.
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
  - title: Nothing runs while it plays
    details: The motion goes to Core Animation on iOS and ObjectAnimator on Android as keyframes. JavaScript is free during the animation.
  - title: Sequences, stagger and press
    details: Steps that start when the previous one looks done, staggers from the first, the last or the center, and press effects that let go when a scroll takes over.
  - title: Interruptions without a jump
    details: A new animation on a moving property starts from the value on screen, at the speed it was going.
---

<div class="clips">
<Clip name="assistant-flow" caption="The demo assistant on iOS. Every movement is a Jolt call." />
<Clip name="presets" caption="Presets, springs and stagger in the playground." />
</div>
