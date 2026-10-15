import { Label } from '@nativescript/core'
import {
  animate,
  definePreset,
  sequence,
  scrollLinked,
  stop,
  type Keyframes,
  type KeyframeProperty,
} from '../src/index.js'
declare module '@rafaelaugusto/jolt' {
  interface Presets {
    typedFlightPath: true
  }
}
export function pathTypes(view: Label, scroll: import('@nativescript/core').ScrollView) {
  const keyframes: Keyframes = { path: 'M0 0 C80 -120 200 -120 280 0', orient: true }
  animate(view, keyframes, { duration: 1200 })
  animate([view], keyframes, { path: 'bouncy', stagger: 100, relative: true })
  sequence([[view, keyframes, { at: '<', path: { duration: 500, ease: 'linear' } }]])
  scrollLinked(scroll, view, keyframes, { range: [0, 120] })
  definePreset('typedFlightPath', { keyframes, transition: { duration: 1000 } })
  const properties: readonly KeyframeProperty[] = ['x', 'y', 'rotate']
  stop(view, properties)
  // @ts-expect-error orient is a boolean, not a transition.
  animate(view, { path: 'M0 0 L1 1', orient: 'auto' })
  animate(view, {
    // @ts-expect-error SVG path data is a string.
    path: [
      [0, 0],
      [1, 1],
    ],
  })
  // @ts-expect-error orient is not independently timed.
  animate(view, keyframes, { orient: { duration: 1000 } })
  // @ts-expect-error Stop generated x/y/rotate tracks, not a virtual path property.
  stop(view, ['path'])
}
