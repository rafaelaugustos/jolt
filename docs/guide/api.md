# API

## Animating

- `animate(target, keyframes | preset, transition?)` — [paths](./paths), [colors](./colors), [corners, borders and shadows](./decorations)
- [`interactionSurface(target)`](./interaction-surface) — opt into native touch geometry for an animated subtree.
- [`animateLayout(container, change?, options?)`](./layout) — animate the next layout of a container’s direct children.
- [`motionScope()`](./motion-controllers) — own animation handles, subscriptions and component lifecycle.
- [`motionStates(targets, definitions, options?)`](./motion-controllers#named-visual-states) — coordinated, interruptible named visual states.
- [`decay(target, velocity, options?)`](./decay)
- `stop(target, properties?)`
- [`set(target, values)`](./interrupting#setting-values-without-animating) — applies values at once and stops what animates them.
- [`sequence(steps)`](./sequences) — overlapping steps and fixed positions.
- `press(target, pressed?, transition?)`
- [`drag(target, options?)`](./drag)
- [`scrollLinked(scrollView, target, keyframes, { range, axis? })`](./scroll-linked) — returns a cleanup function.
- [`animateItems(list, keyframes | preset, options?)`](./lists) — rows as they appear, with `once`; returns a cleanup function.
- [`followKeyboard(target, options?)`](./keyboard) — moves a view with the keyboard on iOS and Android 11+; returns a cleanup function.
- [`onKeyboard(callback)`](./keyboard#keyboard-state) — how much of the window the keyboard covers, with its timing; returns a cleanup function.
- [`symbolEffect(image, effect, options?)`](./symbol-effects) — iOS SF Symbols.
- [`shimmer(target, options?)`](./shimmer) — iOS loading placeholders; returns a cleanup function.
- [`liquid(image, options?)`](./liquid) — iOS texture deformation; returns a `LiquidEffect` with `pause()`, `resume()` and `stop()`.
- [`imageEffect(image, name, options?)`](./image-effects) — native ripple, touch distortion and deterministic dissolve; playback controls and explicit compatibility fallback.
- [`zoomable(image, options?)`](./photo-zoom) — native photo pinch, double-tap zoom, bounded pan and optional dismissal intents.
- [`loader(target, options?)`](./loaders) — iOS dots, bars and ring indicators; returns a cleanup function.
- [`reveal(target, options?)`, `conceal(target, options?)`](./reveal) — iOS circular visibility transitions; return an `Animation`.
- [`animateText(label, options?)`](./text) — letter-by-letter or word-by-word entrances on iOS and Android; returns an `Animation`.
- [`animateText(label, options?)`](./text) — iOS letter-by-letter or word-by-word entrances; returns an `Animation`.
- [`rollTo(label, value, options?)`](./rolling) — rolling digits on iOS and Android; returns an `Animation`.
- [`confetti(target, options?)`, `particles(target, options?)`](./particles) — iOS particle effects; return cleanup functions.

`target` is a view or anything holding one (a template ref, an `ElementRef`). `animate()`, `decay()`, `stop()`, `set()` and sequence steps also accept arrays of targets.

`animate()` options also accept [`haptic`](./haptics): `light`, `medium`, `heavy`, `{ style, times }`, or `false`. Feedback is iOS only.

## Animations

What `animate()`, `decay()`, `sequence()` and the steps of a sequence return: `await` it, read `finished`, or call `stop()`. It resolves with `true` when it played to the end and `false` when it was stopped or taken over, and cancellation never rejects. Sequence setup/callback errors can reject `finished` after canceling its other work.

`animate()` and `decay()` return [`PlaybackAnimation`](./playback): the base lifecycle plus `pause()`, `play()`, writable `progress`, and readonly `paused`/`duration`. Sequence and effect handles keep the base `Animation` contract.

## Transitions

- **Springs**: `'smooth' | 'snappy' | 'bouncy'`, `{ bounce, duration, velocity }` or `{ stiffness, damping, mass, velocity }`.
- **Tweens**: `{ duration, ease, times }`.
- **Timing**: `delay`, `repeat`, `repeatType: 'loop' | 'reverse'`, `stagger: number | { each, from }`.
- **Per property**: any property name mapped to its own transition.
- **Relative keyframes**: `{ relative: true }` adds translation/rotation offsets and multiplies scale/opacity by their starting values.

## Helpers

`definePreset(name, preset)`, `presets`, `springs`, `cubicBezier`. See [custom presets](./presets#custom-presets) for registration and typed names.

## Vue

`@rafaelaugusto/jolt/vue` is a separate entry point for NativeScript-Vue 3: `vAnimate` (`v-animate`), `vPress` (`v-press`), `JoltTransition`, `transitionHooks(props)`, `useMotionScope()`, `useReducedMotion()`, `useKeyboard()` and `install(app)`, also the default export for `app.use()`. Types: `AnimateValue`, `PressValue`, `TransitionProps`. See the [Vue guide](./vue).

## Types

`Step`, `SequenceOptions`, `SequencePosition`, `JoltConfig`, `KeyframeProperty`, `ScrollLinkedOptions`, `KeyboardOptions`, `ItemsOptions`, `ColorValue`, `ColorKeyframes`, `Keyframes`, `Transition`, `Spring`, `Tween`, `Preset`, `Presets`, `PresetName`, `SpringName`, `Easing`, `Animation`, `Target`, `DecayVelocity`, `DecayOptions`, `SymbolEffect`, `SymbolEffectName`, `SymbolEffectOptions`, `ShimmerOptions`, `LiquidOptions`, `LiquidEffect`, `LoaderOptions`, `LoaderStyle`, `TextOptions`, `RollOptions`, `RevealOptions`, `ConcealOptions`, `Haptic`, `HapticOptions`, `HapticStyle`, `ConfettiOptions`, `ParticleOptions` and the rest exported from the package.
[`configure({ timeScale })`](./configure) sets global playback speed for animations started afterwards.
[`configure({ timeScale, reducedMotion })`](./configure) sets the global playback speed and the reduced-motion preference (`'user'`, `'always'` or `'never'`) for animations started afterwards. [`reducedMotion()` and `onReducedMotion(callback)`](./configure#reading-the-preference) read and watch that preference.

## Types
