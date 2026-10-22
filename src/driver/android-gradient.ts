import { Utils, type View } from '@nativescript/core'
import type { GradientFrame, GradientPainter, GradientType } from '../gradient.js'

const floats = (values: readonly number[]) => {
  const array = Array.create('float', values.length)
  values.forEach((value, i) => (array[i] = value))
  return array
}
const ints = (values: readonly number[]) => {
  const array = Array.create('int', values.length)
  values.forEach((value, i) => (array[i] = value | 0))
  return array
}

/** A gradient drawable stacked on the view's own background: above its color, below its children. */
export function androidGradient(
  view: View,
  type: GradientType,
): GradientPainter | undefined {
  let layer: org.rafaelaugusto.jolt.GradientLayer
  try {
    layer = new org.rafaelaugusto.jolt.GradientLayer(
      type === 'linear' ? 0 : type === 'radial' ? 1 : 2,
    )
  } catch {
    // A JS-only update cannot install the native plugin.
    return undefined
  }
  let stack: android.graphics.drawable.LayerDrawable | undefined
  let queued = false

  const wrap = () => {
    const native = view.nativeViewProtected as android.view.View | undefined
    if (!native) return
    const corner = typeof view.borderRadius === 'number' ? view.borderRadius : 0
    layer.setCorner(corner * Utils.layout.getDisplayDensity())
    const background = native.getBackground()
    if (stack && background === stack) return
    const layers = Array.create(android.graphics.drawable.Drawable, 2)
    layers[0] = background ?? new android.graphics.drawable.ColorDrawable(0)
    layers[1] = layer
    stack = new android.graphics.drawable.LayerDrawable(layers)
    native.setBackground(stack)
  }
  // Core replaces the background drawable when its style changes; stack on the new one.
  const rewrap = () => {
    if (queued) return
    queued = true
    void Promise.resolve().then(() => {
      queued = false
      wrap()
    })
  }
  view.on('loaded', wrap)
  view.style.on('backgroundInternalChange', rewrap)
  view.style.on('borderTopLeftRadiusChange', rewrap)
  wrap()

  return {
    paint(frame: GradientFrame) {
      layer.paint(
        ints(frame.colors),
        floats(frame.stops),
        frame.angle,
        frame.x,
        frame.y,
        frame.radius,
      )
    },
    play(frames, times, timing, onEnd) {
      let active = true
      layer.play(
        floats(times),
        ints(frames.flatMap((frame) => frame.colors)),
        floats(frames.flatMap((frame) => frame.stops)),
        floats(frames.flatMap((frame) => [frame.angle, frame.x, frame.y, frame.radius])),
        Math.round(timing.duration),
        Math.round(timing.delay),
        timing.repeat === Infinity ? -1 : timing.repeat,
        timing.reverse,
        new org.rafaelaugusto.jolt.GradientLayer.Listener({
          onEnd: (finished: boolean) => {
            if (!active) return
            active = false
            onEnd(finished)
          },
        }),
      )
      return {
        cancel() {
          if (!active) return
          active = false
          layer.cancel()
          onEnd(false)
        },
      }
    },
    remove() {
      view.off('loaded', wrap)
      view.style.off('backgroundInternalChange', rewrap)
      view.style.off('borderTopLeftRadiusChange', rewrap)
      layer.cancel()
      const native = view.nativeViewProtected as android.view.View | undefined
      if (native && stack && native.getBackground() === stack)
        native.setBackground(stack.getDrawable(0))
      stack = undefined
    },
  }
}
