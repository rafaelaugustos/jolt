import {
  animate,
  definePreset,
  sequence,
  type Preset,
  type PresetName,
  type Target,
} from '@rafaelaugusto/jolt'

declare module '@rafaelaugusto/jolt' {
  interface Presets {
    typedCardIn: true
  }
}

// Checked by tsc, without starting animations or registering presets at runtime.
export function customPresetTypes(view: Target) {
  const preset: Preset = {
    keyframes: { opacity: [0, 1], y: [40, 0] },
    transition: { type: 'spring', bounce: 0.2, opacity: { duration: 150 } },
  }
  const name: PresetName = 'typedCardIn'
  definePreset(name, preset)
  animate(view, name)
  animate(view, 'fadeIn')
  sequence([[view, name]])

  // @ts-expect-error Custom names must be declared in Presets.
  definePreset('typoCardIn', preset)
  // @ts-expect-error Unknown names must not widen PresetName to string.
  animate(view, 'typoCardIn')
  // @ts-expect-error Sequence steps use the same preset names.
  sequence([[view, 'typoCardIn']])

  definePreset(name, {
    // @ts-expect-error Custom presets only accept supported properties.
    keyframes: { width: 100 },
    transition: { duration: 200 },
  })
  definePreset(name, {
    keyframes: { opacity: [0, 1] },
    // @ts-expect-error Custom presets only accept supported easing names.
    transition: { ease: 'notAnEasing' },
  })
}
