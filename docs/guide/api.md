# API

## Animating

- `animate(target, keyframes | preset, transition?)` — [colors](./colors), [corners, borders and shadows](./decorations)
- [`decay(target, velocity, options?)`](./decay)
- `stop(target, properties?)`
- `sequence(steps)`
- `press(target, pressed?, transition?)`
- [`scrollLinked(scrollView, target, keyframes, { range, axis? })`](./scroll-linked) — returns a cleanup function.
- [`symbolEffect(image, effect, options?)`](./symbol-effects) — iOS SF Symbols.
- [`shimmer(target, options?)`](./shimmer) — iOS loading placeholders; returns a cleanup function.
- [`liquid(image, options?)`](./liquid) — iOS texture deformation; returns a `LiquidEffect` with `pause()`, `resume()` and `stop()`.
- [`loader(target, options?)`](./loaders) — iOS dots, bars and ring indicators; returns a cleanup function.
- [`reveal(target, options?)`, `conceal(target, options?)`](./reveal) — iOS circular visibility transitions; return an `Animation`.
- [`animateText(label, options?)`](./text) — iOS letter-by-letter or word-by-word entrances; returns an `Animation`.
- [`confetti(target, options?)`, `particles(target, options?)`](./particles) — iOS particle effects; return cleanup functions.

`target` is a view or anything holding one (a template ref, an `ElementRef`). `animate()`, `decay()`, `stop()` and sequence steps also accept arrays of targets.

`animate()` options also accept [`haptic`](./haptics): `light`, `medium`, `heavy`, `{ style, times }`, or `false`. Feedback is iOS only.

## Animations

What `animate()`, `decay()`, `sequence()` and the steps of a sequence return: `await` it, read `finished`, or call `stop()`. It resolves with `true` when it played to the end and `false` when it was stopped or taken over, and never rejects.

`animate()` and `decay()` return [`PlaybackAnimation`](./playback): the base lifecycle plus `pause()`, `play()`, writable `progress`, and readonly `paused`/`duration`. Sequence and effect handles keep the base `Animation` contract.

## Transitions

- **Springs**: `'smooth' | 'snappy' | 'bouncy'`, `{ bounce, duration, velocity }` or `{ stiffness, damping, mass, velocity }`.
- **Tweens**: `{ duration, ease, times }`.
- **Timing**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `stagger: number | { each, from }`.
- **Per property**: any property name mapped to its own transition.
- **Relative keyframes**: `{ relative: true }` adds translation/rotation offsets and multiplies scale/opacity by their starting values.

## Helpers

`definePreset(name, preset)`, `presets`, `springs`, `cubicBezier`. See [custom presets](./presets#custom-presets) for registration and typed names.

## Types

`ScrollLinkedOptions`, `ColorValue`, `ColorKeyframes`, `Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`, `DecayVelocity`, `DecayOptions`, `SymbolEffect`, `SymbolEffectName`, `SymbolEffectOptions`, `ShimmerOptions`, `LiquidOptions`, `LiquidEffect`, `LoaderOptions`, `LoaderStyle`, `TextOptions`, `RevealOptions`, `ConcealOptions`, `Haptic`, `HapticOptions`, `HapticStyle`, `ConfettiOptions`, `ParticleOptions` and the rest exported from the package.
