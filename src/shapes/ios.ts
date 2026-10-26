import { Color, type View } from '@nativescript/core'
import { getDriver } from '../driver/index.js'
import type { Track } from '../track.js'
import type { ShapeFactory } from './native.js'
import { mixFrame, type ShapeFrame } from './types.js'

export const iosShape: ShapeFactory = (view: View, style, initial) => {
  const native = view.nativeViewProtected as UIView
  const root = CALayer.new(),
    layer = CAShapeLayer.new()
  let marker = CALayer.new()
  root.name = 'jolt:shape'
  root.masksToBounds = true
  layer.name = 'jolt:shape:path'
  marker.name = 'jolt:shape:progress'
  layer.fillColor = new Color(style.fill).ios.CGColor
  layer.strokeColor = new Color(style.stroke).ios.CGColor
  layer.lineWidth = style.width
  layer.lineCap = style.cap
  layer.lineJoin = style.join
  layer.fillRule = style.rule === 'evenodd' ? kCAFillRuleEvenOdd : kCAFillRuleNonZero
  layer.contentsScale = UIScreen.mainScreen.scale
  root.addSublayer(layer)
  root.addSublayer(marker)
  native.layer.addSublayer(root)
  let current = initial,
    program:
      | {
          from: ShapeFrame
          to: ShapeFrame
          track: Track
          start: number
          offset: number
          paused: boolean
        }
      | undefined
  const transaction = (fn: () => void) => {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      fn()
    } finally {
      CATransaction.commit()
    }
  }
  const path = (frame: ShapeFrame) => {
    const p = UIBezierPath.bezierPath(),
      v = frame.path.points
    let i = 0
    for (const op of frame.path.commands) {
      if (op === 'M') {
        p.moveToPoint(CGPointMake(v[i]!, v[i + 1]!))
        i += 2
      }
      if (op === 'L') {
        p.addLineToPoint(CGPointMake(v[i]!, v[i + 1]!))
        i += 2
      }
      if (op === 'C') {
        p.addCurveToPointControlPoint1ControlPoint2(
          CGPointMake(v[i + 4]!, v[i + 5]!),
          CGPointMake(v[i]!, v[i + 1]!),
          CGPointMake(v[i + 2]!, v[i + 3]!),
        )
        i += 6
      }
      if (op === 'Q') {
        p.addQuadCurveToPointControlPoint(
          CGPointMake(v[i + 2]!, v[i + 3]!),
          CGPointMake(v[i]!, v[i + 1]!),
        )
        i += 4
      }
      if (op === 'Z') p.closePath()
    }
    return p.CGPath
  }
  const resize = () =>
    transaction(() => {
      const { width, height } = view.getActualSize(),
        [x, y, w, h] = style.viewBox
      root.frame = CGRectMake(0, 0, Math.max(0, width), Math.max(0, height))
      layer.bounds = CGRectMake(x, y, w, h)
      layer.position = CGPointMake(width / 2, height / 2)
      const scale = Math.max(0, Math.min(width / w, height / h))
      layer.transform = CATransform3DMakeScale(scale, scale, 1)
    })
  const paint = (frame: ShapeFrame) =>
    transaction(() => {
      program = undefined
      current = frame
      root.speed = 1
      root.beginTime = 0
      root.timeOffset = 0
      layer.removeAllAnimations()
      marker.removeAllAnimations()
      layer.path = path(frame)
      layer.strokeStart = frame.start
      layer.strokeEnd = frame.end
    })
  resize()
  paint(initial)
  return {
    paint,
    resize,
    read() {
      if (!program) return current
      const { from, to, track, paused, offset, start } = program
      const presented = marker.presentationLayer()
      const progress =
        !paused && presented
          ? Number(presented.valueForKeyPath('transform.translation.x'))
          : track.valueAt(offset + (paused ? 0 : getDriver().now() - start))
      const frame = mixFrame(from, to, progress)
      // Trim diagnostics read the actual shape layer, except before a pending pause transaction is drawn.
      const shown = layer.presentationLayer() as CAShapeLayer | null
      if (shown && !paused) {
        frame.start = shown.strokeStart
        frame.end = shown.strokeEnd
      }
      return frame
    },
    play(from, to, track) {
      paint(mixFrame(from, to, track.to))
      // A new marker cannot expose the previous program's cached presentation
      // when several retargets happen before the next render transaction.
      marker.removeFromSuperlayer()
      marker = CALayer.new()
      marker.name = 'jolt:shape:progress'
      root.addSublayer(marker)
      program = { from, to, track, paused: false, offset: 0, start: getDriver().now() }
      transaction(() => {
        root.beginTime = native.layer.convertTimeFromLayer(CACurrentMediaTime(), null)
        const frames = track.values.map((t) => mixFrame(from, to, t))
        const add = (target: CALayer, key: string, values: unknown[]) => {
          const a = CAKeyframeAnimation.animationWithKeyPath(key)
          a.values = NSArray.arrayWithArray(values)
          a.keyTimes = NSArray.arrayWithArray([...track.times])
          a.duration = track.duration / 1000
          a.beginTime = Math.max(0.000001, track.delay / 1000)
          a.fillMode = kCAFillModeBoth
          a.removedOnCompletion = false
          a.autoreverses = track.reverse
          a.repeatCount =
            track.repeat === Infinity
              ? Infinity
              : track.reverse
                ? (track.repeat + 1) / 2
                : track.repeat + 1
          target.addAnimationForKey(a, 'jolt:shape:' + key)
        }
        marker.setValueForKeyPath(track.to, 'transform.translation.x')
        add(layer, 'path', frames.map(path))
        add(
          layer,
          'strokeStart',
          frames.map((f) => f.start),
        )
        add(
          layer,
          'strokeEnd',
          frames.map((f) => f.end),
        )
        add(marker, 'transform.translation.x', [...track.values])
      })
    },
    control(time, paused) {
      if (!program) return
      program.offset = time
      program.start = getDriver().now()
      program.paused = paused
      transaction(() => {
        root.speed = paused ? 0 : 1
        root.timeOffset = paused ? time / 1000 : 0
        root.beginTime = paused
          ? 0
          : native.layer.convertTimeFromLayer(CACurrentMediaTime(), null) - time / 1000
      })
    },
    animations: () =>
      (layer.animationKeys()?.count ?? 0) + (marker.animationKeys()?.count ?? 0),
    bounds() {
      const shown = (layer.presentationLayer() as CAShapeLayer | null) ?? layer
      const b = CGPathGetBoundingBox(shown.path)
      return [b.origin.x, b.origin.y, b.size.width, b.size.height]
    },
    dispose() {
      program = undefined
      layer.removeAllAnimations()
      marker.removeAllAnimations()
      root.removeFromSuperlayer()
    },
  }
}
