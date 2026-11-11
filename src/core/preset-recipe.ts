import { presets } from './presets.js'
import type { Transition } from './transition.js'

/** The finite two-endpoint recipes supported by all three execution adapters. */
export type PortablePresetName =
  | 'fadeIn'
  | 'fadeInUp'
  | 'fadeInDown'
  | 'fadeInLeft'
  | 'fadeInRight'
  | 'zoomIn'
  | 'popIn'
  | 'flipInX'
  | 'flipInY'
  | 'fadeOut'
  | 'fadeOutUp'
  | 'fadeOutDown'
  | 'fadeOutLeft'
  | 'fadeOutRight'
  | 'zoomOut'
export interface PresetParameters {
  /** Points on Apple, DIP in NativeScript, CSS pixels on Web. */
  distance?: number
  scale?: number
  direction?: 'up' | 'down' | 'left' | 'right'
  /** Override all channels with a finite tween in milliseconds (including zero). */
  duration?: number
}
type Channel = 'x' | 'y' | 'scale' | 'rotateX' | 'rotateY' | 'opacity'
export interface PresetRecipe {
  keyframes: Partial<Record<Channel, number | readonly number[]>>
  transition: Transition & Partial<Record<Channel, Transition>>
}
const names = new Set<string>([
  'fadeIn',
  'fadeInUp',
  'fadeInDown',
  'fadeInLeft',
  'fadeInRight',
  'zoomIn',
  'popIn',
  'flipInX',
  'flipInY',
  'fadeOut',
  'fadeOutUp',
  'fadeOutDown',
  'fadeOutLeft',
  'fadeOutRight',
  'zoomOut',
])

/** Pure recipe construction; registration and resource ownership stay in the runtime. */
export function createPreset(
  name: PortablePresetName,
  parameters: PresetParameters = {},
): PresetRecipe {
  if (!names.has(name)) throw new TypeError('Expected a portable finite preset name.')
  if (!parameters || typeof parameters !== 'object' || Array.isArray(parameters))
    throw new TypeError('Preset parameters must be an object.')
  for (const [key, value] of Object.entries(parameters)) {
    if (!['distance', 'scale', 'direction', 'duration'].includes(key))
      throw new TypeError(`Unknown preset parameter "${key}".`)
    if (value === undefined) continue
    if (key === 'direction') {
      if (!['up', 'down', 'left', 'right'].includes(value as string))
        throw new TypeError('Invalid preset direction.')
    } else if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      value > (key === 'duration' ? 60_000 : key === 'scale' ? 100 : 1_000_000)
    )
      throw new RangeError(`Invalid preset ${key}.`)
  }
  const original = presets[name] as PresetRecipe
  const keyframes = Object.fromEntries(
    Object.entries(original.keyframes).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value] : value,
    ]),
  ) as PresetRecipe['keyframes']
  const transition = { ...original.transition } as PresetRecipe['transition']
  for (const channel of ['x', 'y', 'scale', 'rotateX', 'rotateY', 'opacity'] as const)
    if (transition[channel]) transition[channel] = { ...transition[channel] }
  const entering = !name.includes('Out')
  const direction = parameters.direction
  if (direction) {
    delete keyframes.x
    delete keyframes.y
    const horizontal = direction === 'left' || direction === 'right'
    const sign = direction === 'left' || direction === 'up' ? -1 : 1
    const amount = (parameters.distance ?? 24) * sign * (!horizontal && entering ? -1 : 1)
    keyframes[horizontal ? 'x' : 'y'] = entering ? [amount, 0] : amount
  } else if (parameters.distance !== undefined) {
    for (const channel of ['x', 'y'] as const) {
      const value = keyframes[channel]
      if (typeof value === 'number')
        keyframes[channel] = Math.sign(value) * parameters.distance
      else if (value)
        keyframes[channel] = value.map((n) => Math.sign(n) * parameters.distance!)
    }
  }
  if (parameters.scale !== undefined)
    keyframes.scale = entering ? [parameters.scale, 1] : parameters.scale
  if (parameters.duration !== undefined)
    return {
      keyframes,
      transition: {
        type: 'tween',
        duration: parameters.duration,
        ease: entering ? 'easeOut' : 'easeIn',
      },
    }
  return { keyframes, transition }
}
