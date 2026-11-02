import type { Spring, Tween, SpringName } from '../core/transition.js'
import type { PlaybackAnimation } from '../core/playback.js'

import {
  properties,
  type Property,
  type KeyframeProperty,
  type Scalar,
} from './properties.js'
export { properties }
export type { Property, KeyframeProperty, Scalar } from './properties.js'
export type KeyframeValue = Scalar | readonly (Scalar | null)[]
export type Keyframes = Partial<Record<KeyframeProperty, KeyframeValue>>
export type Values = Partial<Record<KeyframeProperty, Scalar>>
export type Transition = Tween | Spring
export type Stagger = { each: number; from?: 'first' | 'last' | 'center' | number }
export type AnimateOptions = Transition &
  Partial<Record<KeyframeProperty, Transition | SpringName>> & {
    stagger?: number | Stagger
    relative?: boolean
    layer?: string
  }
export interface Preset {
  keyframes: Keyframes
  transition?: AnimateOptions
}
export interface WebConfig {
  /** Applied to future tracks, matching the native configuration contract. */
  timeScale?: number
  /** Transforms jump to their final values; opacity continues to animate. */
  reducedMotion?: 'user' | 'always' | 'never'
}
export interface RuntimeOptions extends WebConfig {
  /** Maximum prepared keyframes per target. Rejected transactions retain prior motion. */
  maxKeyframes?: number
}
export type { PlaybackAnimation, SpringName }

export const multiplicative = (property: Property) =>
  property === 'opacity' || property.startsWith('scale')
export const identity = (property: Property) => (multiplicative(property) ? 1 : 0)
export const keyOf = (property: Property, layer?: string) =>
  JSON.stringify([property, layer ?? null])

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never
