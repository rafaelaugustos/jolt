import type { PlaybackAnimation } from '../playback.js'
import type { SpringName, Transition } from '../transition.js'

export interface BlurOptions {
  /** Initial intensity, 0..1. Defaults to 0 (clear). */
  amount?: number
  /** Android maximum radius in DIPs, 1..64. Defaults to 24. iOS uses a system material. */
  radius?: number
  /** iOS material. Defaults to system. Android ignores this option. */
  style?: 'system' | 'light' | 'dark'
}
export interface BlurSnapshot {
  amount: number
  /** iOS animator fraction or Android radius/maxRadius; 0 for the unsupported fallback. */
  appliedAmount: number
  backend: 'ios-material' | 'android-render-effect' | 'none'
  attached: boolean
  nativeAnimations: number
  frames: number
  width: number
  height: number
}
export interface Blur {
  readonly disposed: boolean
  /** Retarget from the displayed amount. One owner per view. */
  animate(amount: number, transition?: Transition | SpringName): PlaybackAnimation
  set(amount: number): void
  stop(): void
  snapshot(): BlurSnapshot
  /** Remove the owned effect and lifecycle listeners. */
  dispose(): void
}
