import { isIOS, type View } from '@nativescript/core'
import type { Track } from '../track.js'
import type { BlurOptions, BlurSnapshot } from './types.js'

export interface BlurPainter {
  paint(amount: number): void
  play(track: Track): void
  control(time: number, paused: boolean): void
  resize(): void
  snapshot(): BlurSnapshot
  dispose(): void
}
type Factory = (view: View, options: Required<BlurOptions>) => BlurPainter
let override: Factory | undefined
/** Internal seam for lifecycle tests. */
export function setBlurFactory(value: Factory | undefined) {
  override = value
}
export const createBlur: Factory = (view, options) => {
  if (override) return override(view, options)
  let native: {
    paint(value: number): void
    play(program: string): void
    resize(): void
    snapshot(): string
    dispose(): void
  }
  let control: (time: number, paused: boolean) => void
  if (isIOS) {
    if (typeof JoltBlur === 'undefined')
      throw new Error('Rebuild the native app to install animated blur.')
    const effect = JoltBlur.attachOptions(
      view.nativeViewProtected,
      JSON.stringify(options),
    )
    native = effect
    control = (time, paused) => effect.controlPaused(time, paused)
  } else {
    if (
      typeof org === 'undefined' ||
      typeof org.rafaelaugusto.jolt.BlurEffect !== 'function'
    )
      throw new Error('Rebuild the native app to install animated blur.')
    const effect = new org.rafaelaugusto.jolt.BlurEffect(
      view.nativeViewProtected,
      options.radius,
    )
    native = effect
    control = (time, paused) => effect.control(time, paused)
  }
  native.paint(options.amount)
  return {
    paint: (amount) => native.paint(amount),
    play: (track) =>
      native.play(
        JSON.stringify({
          times: track.times,
          values: track.values,
          duration: track.duration,
          delay: track.delay,
          repeat: track.repeat === Infinity ? -1 : track.repeat,
          reverse: track.reverse,
        }),
      ),
    control,
    resize: () => native.resize(),
    snapshot: () => JSON.parse(native.snapshot()),
    dispose: () => native.dispose(),
  }
}
