# Sequences

```ts
await sequence([
  [logo, 'popIn'],
  [[title, subtitle], 'fadeInUp', { stagger: 80 }],
  () => animate(button, 'fadeIn'),
])
```

Each step takes the same arguments as `animate`, or is a function that starts an animation. A step starts once the previous one looks done: a spring that's close to its target and staying there counts, even if it's still settling, so steps don't wait on the last pixel. The whole sequence finishes once every step has.

Views in later steps take their first absolute keyframe when the sequence starts, so the title above stays hidden until its turn instead of showing up and disappearing. Relative steps and `null` keyframes wait until their step starts to read the current value.

On Android, sequence timing follows the system’s **Animator duration scale**, including delays and early spring arrivals. With animations disabled, native completion advances the sequence without waiting for the requested durations.
