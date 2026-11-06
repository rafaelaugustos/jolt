import type { Label } from '@nativescript/core'
import type { TextPaint, TextPainter } from './native.js'
const floats = (values: readonly number[]) => {
  const result = Array.create('float', values.length)
  values.forEach((value, index) => {
    result[index] = value
  })
  return result
}
export function androidGradientText(view: Label, paint: TextPaint): TextPainter {
  if (
    typeof org === 'undefined' ||
    typeof org.rafaelaugusto.jolt.TextGradient !== 'function'
  )
    throw new Error('Rebuild Android to install native gradient text.')
  const native = new org.rafaelaugusto.jolt.TextGradient(
    view.nativeViewProtected,
    JSON.stringify(paint),
  )
  return {
    refresh: () => native.refresh(),
    play: (track) =>
      native.play(
        floats(track.times),
        floats(track.values),
        track.duration,
        track.delay,
        track.repeat === Infinity ? -1 : track.repeat,
        track.reverse,
      ),
    control: (time, paused) => native.control(time, paused),
    stop: () => native.stop(),
    dispose: () => native.dispose(),
    bytes: () => native.maskBytes(),
  }
}
