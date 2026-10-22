import type { View } from '@nativescript/core'
import type { Haptic } from './haptics.js'
import type { SpringName, Transition } from './transition.js'
import type { ColorKeyframes } from './color.js'

/** A value to animate to, or keyframes. `null` stands for the value the view has when the animation starts. */
export type KeyframeValue = number | readonly (number | null)[]

export interface Keyframes {
  /** One continuous SVG path, expressed as translation coordinates in DIPs. */
  path?: string
  /** Face the path's forward tangent (+X artwork). Requires path. */
  orient?: boolean
  backgroundColor?: ColorKeyframes
  /** Uniform starting edge colors; widths and radii may differ. */
  borderColor?: ColorKeyframes
  color?: ColorKeyframes
  /** Uniform circular corners, in DIPs. */
  borderRadius?: KeyframeValue
  /** Uniform visual border width, in DIPs. Content layout uses the final width. */
  borderWidth?: KeyframeValue
  /** iOS: opacity of one existing boxShadow, from 0 to 1. */
  shadowOpacity?: KeyframeValue
  /** iOS: native blur radius in DIPs (half Core's boxShadow blurRadius). */
  shadowRadius?: KeyframeValue
  /** iOS: offset of one existing boxShadow, in DIPs. */
  shadowOffsetX?: KeyframeValue
  shadowOffsetY?: KeyframeValue
  /** Android: base elevation in DIPs. */
  elevation?: KeyframeValue
  /** Android: dynamic Z offset in DIPs. Native state changes may replace it. */
  translationZ?: KeyframeValue
  opacity?: KeyframeValue
  /** Same as `translateX`, in DIPs. */
  x?: KeyframeValue
  /** Same as `translateY`, in DIPs. */
  y?: KeyframeValue
  /** Sets `scaleX` and `scaleY` together. */
  scale?: KeyframeValue
  scaleX?: KeyframeValue
  scaleY?: KeyframeValue
  /** Degrees. */
  rotate?: KeyframeValue
  rotateX?: KeyframeValue
  rotateY?: KeyframeValue
}

/** Properties that can be timed or stopped independently. A path owns x/y and optionally rotate. */
export type KeyframeProperty = Exclude<keyof Keyframes, 'path' | 'orient'>

/** One value per property, as `set()` applies them. */
export type Values = {
  [K in KeyframeProperty]?: Exclude<Keyframes[K], readonly unknown[]>
}

/** A view, or anything that holds one: a NativeScript-Vue element, an Angular `ElementRef`. */
export type Target =
  View | { readonly nativeView: View } | { readonly nativeElement: View }

/** Translation velocities in DIPs per second. Omitted axes keep their current motion. */
export interface DecayVelocity {
  x?: number
  y?: number
}

export interface DecayOptions {
  /** Velocity multiplier per millisecond, between 0 and 1 exclusively. Defaults to 0.998. */
  friction?: number
  /** Spring to the closest stop to the projected landing, shared or set per axis. */
  snap?: readonly number[] | { x?: readonly number[]; y?: readonly number[] }
}

export interface Stagger {
  /** Milliseconds between one target and the next. */
  each: number
  /** Which target starts first. */
  from?: 'first' | 'last' | 'center' | number
}

export type AnimateOptions = Transition & {
  [K in KeyframeProperty | 'path']?: Transition | SpringName
} & {
  /** Offset translations/rotations and multiply scale/opacity by their values at the start. */
  relative?: boolean
  /** With several targets, delays each one by this much more than the previous. */
  stagger?: number | Stagger
  /** iOS impact feedback at arrival, or at explicit points in a finite animation. */
  haptic?: Haptic
  /**
   * Plays on a named layer, on top of the property's other animations instead of replacing
   * them. Translations and rotations add; scale and opacity multiply.
   */
  layer?: string
}
