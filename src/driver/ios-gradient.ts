import { Color, type View } from '@nativescript/core'
import {
  gradientPoints,
  type GradientFrame,
  type GradientPainter,
  type GradientType,
} from '../gradient.js'

const keys = ['colors', 'locations', 'startPoint', 'endPoint'] as const

/** A CAGradientLayer at the back of the view's layer: above its background, below its children. */
export function iosGradient(view: View, type: GradientType): GradientPainter {
  const layer = CAGradientLayer.new()
  layer.type =
    type === 'linear'
      ? kCAGradientLayerAxial
      : type === 'radial'
        ? kCAGradientLayerRadial
        : kCAGradientLayerConic
  let current: GradientFrame | undefined
  let generation = 0

  const native = () => view.nativeViewProtected as UIView | undefined
  const size = () => {
    const bounds = native()?.layer.bounds
    return { width: bounds?.size.width ?? 0, height: bounds?.size.height ?? 0 }
  }
  const values = (frame: GradientFrame) => {
    const { width, height } = size()
    const { start, end: toward } = gradientPoints(type, frame, width, height)
    // Core Animation starts a conic gradient on the side opposite its end point.
    const end =
      type === 'conic' ? { x: 2 * start.x - toward.x, y: 2 * start.y - toward.y } : toward
    return {
      colors: NSArray.arrayWithArray(
        frame.colors.map((argb) => new Color(argb).ios.CGColor),
      ),
      locations: NSArray.arrayWithArray(frame.stops),
      startPoint: NSValue.valueWithCGPoint(CGPointMake(start.x, start.y)),
      endPoint: NSValue.valueWithCGPoint(CGPointMake(end.x, end.y)),
    }
  }
  const attach = () => {
    const host = native()
    if (!host) return
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    if (layer.superlayer !== host.layer) host.layer.insertSublayerAtIndex(layer, 0)
    layer.frame = host.layer.bounds
    layer.cornerRadius =
      typeof view.borderRadius === 'number' ? view.borderRadius : host.layer.cornerRadius
    if (current) {
      const model = values(current)
      layer.colors = model.colors
      layer.locations = model.locations
      layer.startPoint = model.startPoint.CGPointValue
      layer.endPoint = model.endPoint.CGPointValue
    }
    CATransaction.commit()
  }
  view.on('loaded', attach)
  view.on('layoutChanged', attach)
  view.style.on('borderTopLeftRadiusChange', attach)

  return {
    paint(frame) {
      layer.speed = 1
      layer.timeOffset = 0
      layer.beginTime = 0
      current = frame
      generation++
      for (const key of keys) layer.removeAnimationForKey(`jolt:gradient:${key}`)
      attach()
    },
    play(frames, times, timing, onEnd) {
      const instance = ++generation
      current = frames[frames.length - 1]!
      attach()
      const sampled = frames.map(values)
      const now = CACurrentMediaTime()
      const parentTime = () =>
        layer.superlayer?.convertTimeFromLayer(CACurrentMediaTime(), null) ??
        CACurrentMediaTime()
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      layer.speed = 1
      layer.timeOffset = 0
      layer.beginTime = layer.superlayer?.convertTimeFromLayer(now, null) ?? now
      if (timing.repeat !== Infinity)
        CATransaction.setCompletionBlock(() => {
          if (instance === generation) onEnd(true)
        })
      for (const key of keys) {
        const animation = CAKeyframeAnimation.animationWithKeyPath(key)
        animation.values = NSArray.arrayWithArray(sampled.map((value) => value[key]))
        animation.keyTimes = NSArray.arrayWithArray(times as number[])
        animation.duration = Math.max(timing.duration, 1) / 1000
        animation.beginTime = Math.max(0.000001, timing.delay / 1000)
        animation.fillMode = kCAFillModeBackwards
        if (timing.repeat > 0) {
          animation.autoreverses = timing.reverse
          animation.repeatCount = timing.reverse
            ? (timing.repeat + 1) / 2
            : timing.repeat + 1
        }
        layer.addAnimationForKey(animation, `jolt:gradient:${key}`)
      }
      CATransaction.commit()
      return {
        control(elapsed, paused) {
          if (instance !== generation) return
          CATransaction.begin()
          CATransaction.setDisableActions(true)
          layer.speed = paused ? 0 : 1
          layer.timeOffset = paused ? elapsed / 1000 : 0
          layer.beginTime = paused ? 0 : parentTime() - elapsed / 1000
          CATransaction.commit()
        },
        cancel() {
          if (instance !== generation) return
          generation++
          for (const key of keys) layer.removeAnimationForKey(`jolt:gradient:${key}`)
          onEnd(false)
        },
      }
    },
    remove() {
      generation++
      view.off('loaded', attach)
      view.off('layoutChanged', attach)
      view.style.off('borderTopLeftRadiusChange', attach)
      layer.removeAllAnimations()
      layer.removeFromSuperlayer()
    },
  }
}
