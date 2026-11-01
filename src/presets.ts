import type { AnimateOptions, Keyframes } from './types.js'

export interface Preset {
  keyframes: Keyframes
  transition: AnimateOptions
}

/** Add custom preset names through module augmentation, with `true` as each value. */
export interface Presets {}

export { presets } from './core/presets.js'
import { presets } from './core/presets.js'

export type PresetName = keyof typeof presets | Extract<keyof Presets, string>

const customPresets = new Map<string, Preset>()

/** Registers a custom preset. Registering it again replaces it for future animations. */
export function definePreset(name: PresetName, preset: Preset): void {
  if (Object.hasOwn(presets, name)) {
    throw new Error(`Preset "${name}" is built in and cannot be replaced.`)
  }
  customPresets.set(name, preset)
}

export function getPreset(name: PresetName): Preset {
  const preset =
    customPresets.get(name) ??
    (Object.hasOwn(presets, name) ? presets[name as keyof typeof presets] : undefined)
  if (!preset) throw new Error(`Unknown preset "${name}".`)
  return preset
}
