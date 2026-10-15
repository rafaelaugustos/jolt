import type { View } from '@nativescript/core'
import type { Haptic } from './haptics.js'
import type { SpringName, Transition } from './transition.js'

/** A value to animate to, or keyframes. `null` stands for the value the view has when the animation starts. */
export type KeyframeValue = number | readonly (number | null)[]

export interface Keyframes {
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

/** A view, or anything that holds one: a NativeScript-Vue element, an Angular `ElementRef`. */
export type Target =
  View | { readonly nativeView: View } | { readonly nativeElement: View }

export interface Stagger {
  /** Milliseconds between one target and the next. */
  each: number
  /** Which target starts first. */
  from?: 'first' | 'last' | 'center' | number
}

export type AnimateOptions = Transition & {
  [K in keyof Keyframes]?: Transition | SpringName
} & {
  /** Offset translations/rotations and multiply scale/opacity by their values at the start. */
  relative?: boolean
  /** With several targets, delays each one by this much more than the previous. */
  stagger?: number | Stagger
  /** iOS impact feedback at arrival, or at explicit points in a finite animation. */
  haptic?: Haptic
}
