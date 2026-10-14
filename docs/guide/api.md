# API

## Animating

- `animate(target, keyframes | preset, transition?)`
- `stop(target, properties?)`
- `sequence(steps)`
- `press(target, pressed?, transition?)`

`target` is a view, an array of views, or anything holding one (a template ref, an `ElementRef`).

## Animations

What `animate()`, `sequence()` and the steps of a sequence return: `await` it, read `finished`, or call `stop()`. It resolves with `true` when it played to the end and `false` when it was stopped or taken over, and never rejects.

## Transitions

- **Springs**: `'smooth' | 'snappy' | 'bouncy'`, `{ bounce, duration, velocity }` or `{ stiffness, damping, mass, velocity }`.
- **Tweens**: `{ duration, ease, times }`.
- **Timing**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `stagger: number | { each, from }`.
- **Per property**: any property name mapped to its own transition.

## Helpers

`definePreset(name, preset)`, `presets`, `springs`, `cubicBezier`. See [custom presets](./presets#custom-presets) for registration and typed names.

## Types

`Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target` and the rest exported from the package.
