import { Color, type Label } from '@nativescript/core'
import type { TextPaint, TextPainter } from './native.js'
import type { Track } from '../track.js'

export function iosGradientText(view: Label, paint: TextPaint): TextPainter {
  const native = view.nativeViewProtected as UILabel
  const fill = CAGradientLayer.new(),
    root = CALayer.new(),
    band = CAGradientLayer.new()
  root.name = 'jolt:text-sheen'
  fill.name = 'jolt:text-fill'
  let original = native.textColor,
    key = '',
    bytes = 0,
    program: Track | undefined
  let heldTime = 0,
    held = false
  const transaction = (run: () => void) => {
    CATransaction.begin()
    CATransaction.setDisableActions(true)
    try {
      run()
    } finally {
      CATransaction.commit()
    }
  }
  native.layer.addSublayer(fill)
  native.layer.addSublayer(root)
  root.addSublayer(band)
  const stop = () =>
    transaction(() => {
      program = undefined
      band.removeAllAnimations()
      root.hidden = true
      root.speed = 1
      root.timeOffset = 0
      root.beginTime = 0
    })
  const control = (time: number, paused: boolean) => {
    heldTime = time
    held = paused
    if (!program) return
    transaction(() => {
      root.speed = paused ? 0 : 1
      root.timeOffset = paused ? time / 1000 : 0
      root.beginTime = paused
        ? 0
        : native.layer.convertTimeFromLayer(CACurrentMediaTime(), null) - time / 1000
    })
  }
  const play = (track: Track) => {
    stop()
    program = track
    transaction(() => {
      root.hidden = false
      root.beginTime = native.layer.convertTimeFromLayer(CACurrentMediaTime(), null)
      const width = native.bounds.size.width,
        span = width * (1 + paint.width)
      const animation = CAKeyframeAnimation.animationWithKeyPath(
        'transform.translation.x',
      )
      animation.values = NSArray.arrayWithArray(track.values.map((value) => value * span))
      animation.keyTimes = NSArray.arrayWithArray([...track.times])
      animation.duration = track.duration / 1000
      animation.beginTime = Math.max(0.000001, track.delay / 1000)
      animation.fillMode = kCAFillModeBoth
      animation.removedOnCompletion = false
      animation.autoreverses = track.reverse
      animation.repeatCount =
        track.repeat === Infinity
          ? Infinity
          : track.reverse
            ? (track.repeat + 1) / 2
            : track.repeat + 1
      band.addAnimationForKey(animation, 'jolt:text-sheen')
    })
  }
  const refresh = () => {
    const { width, height } = native.bounds.size
    if (width <= 0 || height <= 0) return
    const next = `${width}:${height}:${native.text}:${native.font}:${native.textAlignment}:${native.numberOfLines}:${view.letterSpacing}:${view.lineHeight}`
    if (!native.textColor.isEqual(UIColor.clearColor)) original = native.textColor
    if (next === key && native.textColor.isEqual(UIColor.clearColor)) return
    const scale = Math.min(
      UIScreen.mainScreen.scale,
      Math.sqrt(4194304 / (width * height)),
    )
    if (scale < 0.25)
      throw new RangeError('Gradient text exceeds the glyph texture budget.')
    native.textColor = UIColor.whiteColor
    let image: UIImage | null = null
    UIGraphicsBeginImageContextWithOptions(native.bounds.size, false, scale)
    try {
      native.drawTextInRect(native.bounds)
      image = UIGraphicsGetImageFromCurrentImageContext()
    } finally {
      UIGraphicsEndImageContext()
      native.textColor = UIColor.clearColor
    }
    if (!image) throw new Error('Could not create the native glyph mask.')
    key = next
    bytes = Math.ceil(width * scale) * Math.ceil(height * scale) * 4
    const saved = program,
      time = heldTime,
      paused = held
    transaction(() => {
      const mask = () => {
        const layer = CALayer.new()
        layer.frame = native.bounds
        layer.contents = image!.CGImage
        layer.contentsScale = scale
        return layer
      }
      fill.frame = native.bounds
      fill.mask = mask()
      root.frame = native.bounds
      root.mask = mask()
      root.hidden = !program
      fill.colors = NSArray.arrayWithArray(
        paint.colors.map((color) => new Color(color).ios.CGColor),
      )
      fill.locations = NSArray.arrayWithArray(paint.stops)
      const angle = (paint.angle * Math.PI) / 180,
        dx = Math.cos(angle) / 2,
        dy = Math.sin(angle) / 2
      fill.startPoint = CGPointMake(0.5 - dx, 0.5 - dy)
      fill.endPoint = CGPointMake(0.5 + dx, 0.5 + dy)
      band.frame = CGRectMake(-width * paint.width, 0, width * paint.width, height)
      const clear = new Color(paint.sheen & 0xffffff).ios.CGColor
      band.colors = NSArray.arrayWithArray([
        clear,
        new Color(paint.sheen).ios.CGColor,
        clear,
      ])
      band.locations = NSArray.arrayWithArray([0, 0.5, 1])
      band.startPoint = CGPointMake(0, 0.5)
      band.endPoint = CGPointMake(1, 0.5)
    })
    if (saved) {
      play(saved)
      control(time, paused)
    }
  }
  try {
    refresh()
  } catch (error) {
    fill.removeFromSuperlayer()
    root.removeFromSuperlayer()
    native.textColor = original
    throw error
  }
  return {
    refresh,
    play,
    control,
    stop,
    bytes: () => bytes,
    dispose() {
      stop()
      fill.removeFromSuperlayer()
      root.removeFromSuperlayer()
      fill.mask = null
      root.mask = null
      bytes = 0
      if (native.textColor.isEqual(UIColor.clearColor)) native.textColor = original
    },
  }
}
