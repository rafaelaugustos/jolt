import type { View } from '@nativescript/core'
import {
  animate,
  gradient,
  motionValue,
  playbackProgress,
  type GradientBindings,
  type GradientOptions,
} from '../src/index.js'
import type { GradientValue } from '../src/vue/index.js'
declare const view: View
const value = motionValue(0)
const tint = value.to([0, 1], ['red', 'blue'])
const options: GradientOptions = {
  type: 'conic',
  colors: ['white', tint],
  angle: value,
  center: { x: value },
  radius: value,
  stops: [value, 1],
}
const directive: GradientValue = [options, { duration: 400 }]
const glow = gradient(view, options)
const bindings: GradientBindings = { center: { y: value }, colors: [tint, 'white'] }
const release: () => void = glow.bind(bindings)
release()
glow.bind({ angle: playbackProgress(animate(value, 1)).to([0, 1], [0, 360]) })
glow.suspend()
glow.resume()
// @ts-expect-error angle requires numbers, not a color value
glow.bind({ angle: tint })
// @ts-expect-error colors require mapped color values
glow.bind({ colors: [value, 'white'] })
// @ts-expect-error stops require numeric values
glow.bind({ stops: [tint, 1] })
// @ts-expect-error animate keeps concrete target values; bind follows sources
glow.animate({ angle: value })
// @ts-expect-error gradient type is structural, not a binding component
glow.bind({ type: 'radial' })
void directive
