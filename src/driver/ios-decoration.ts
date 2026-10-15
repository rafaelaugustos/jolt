import type { View } from '@nativescript/core'
import {
  dip,
  isWritingDecoration,
  radiusKeys,
  widthKeys,
  validateDecorationTarget,
  type DecorationProperty,
} from '../decoration.js'
import type { Track } from '../track.js'

type NativeView = UIView & { outerShadowContainerLayer?: CALayer }
type Binding = { layer: CALayer; path: string; values: unknown[] }
interface Handle {
  track: Track
  stop(): void
  presented(): number
  attach(): void
}
const playing = new WeakMap<View, Map<DecorationProperty, Handle>>()
const paths = {
  borderRadius: 'cornerRadius',
  borderWidth: 'borderWidth',
  shadowOpacity: 'shadowOpacity',
  shadowRadius: 'shadowRadius',
  shadowOffsetX: 'shadowOffset.width',
  shadowOffsetY: 'shadowOffset.height',
} as const

export function syncIOSDecoration(view: View, excluding?: string) {
  for (const [property, handle] of playing.get(view) ?? [])
    if (property !== excluding) handle.attach()
}
export const presentedIOSDecoration = (view: View, property: DecorationProperty) =>
  playing.get(view)?.get(property)?.presented()

/** Animate Core's uniform border and its separate outer-shadow layers. */
export function playIOSDecoration(
  view: View,
  track: Track,
  startedAt: number,
  onEnd: (finished?: boolean) => void,
): Handle {
  const property = track.property as Exclude<
    DecorationProperty,
    'elevation' | 'translationZ'
  >
  const native = view.nativeViewProtected as NativeView
  const key = `jolt:${property}`
  let bindings: Binding[] = []
  let stopped = false
  let queued = false
  let generation = 0
  const entries = playing.get(view) ?? new Map<DecorationProperty, Handle>()
  playing.set(view, entries)
  const cleanup = () => {
    if (stopped) return
    stopped = true
    generation++
    view.off('unloaded', cancel)
    view.off('layoutChanged', refresh)
    view.style.off('backgroundInternalChange', refresh)
    for (const event of changes) view.style.off(event, external)
    for (const binding of bindings) binding.layer.removeAnimationForKey(key)
    if (entries.get(property) === handle) entries.delete(property)
  }
  const cancel = () => {
    if (!stopped) {
      cleanup()
      onEnd(false)
    }
  }
  const refresh = () => {
    if (stopped || queued) return
    queued = true
    void Promise.resolve().then(() => {
      queued = false
      if (!stopped && view.nativeViewProtected === native) handle.attach()
    })
  }
  const external = (event: { eventName: string }) => {
    if (isWritingDecoration(view)) return
    const own =
      property === 'borderRadius'
        ? radiusKeys
        : property === 'borderWidth'
          ? widthKeys
          : ['boxShadow']
    void Promise.resolve().then(() => {
      if (stopped) return
      if (own.some((name) => event.eventName === `${name}Change`)) return cancel()
      try {
        validateDecorationTarget(view, property)
      } catch {
        cancel()
      }
    })
  }
  const changes = [
    ...radiusKeys,
    ...widthKeys,
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'clipPath',
    'cornerShape',
    'boxShadow',
  ].map((name) => `${name}Change`)
  const handle: Handle = {
    track,
    stop: cancel,
    presented() {
      const binding = bindings[0]
      const layer = binding?.layer.presentationLayer()
      if (!layer) return track.valueAt(CACurrentMediaTime() * 1000 - startedAt)
      if (property === 'shadowOffsetX') return layer.shadowOffset.width
      if (property === 'shadowOffsetY') return layer.shadowOffset.height
      return (layer as unknown as Record<string, number>)[paths[property]]!
    },
    attach() {
      if (stopped) return
      const instance = ++generation
      for (const binding of bindings) binding.layer.removeAnimationForKey(key)
      bindings = []
      // Path clipping and spread are nonlinear. Sample even a linear radius
      // tween so its shadow and inner cutout follow the capped native corner.
      const steps = Math.max(1, Math.min(6000, Math.ceil((track.duration * 60) / 1000)))
      const times =
        property === 'borderRadius'
          ? [
              ...new Set([
                ...track.times,
                ...Array.from({ length: steps + 1 }, (_, i) => i / steps),
              ]),
            ].sort((a, b) => a - b)
          : [...track.times]
      const values =
        property === 'borderRadius'
          ? times.map((time) =>
              time === 1
                ? track.values.at(-1)!
                : track.valueAt(track.delay + time * track.duration),
            )
          : [...track.values]
      if (property === 'borderRadius' || property === 'borderWidth') {
        bindings.push({
          layer: native.layer,
          path: paths[property],
          values:
            property === 'borderRadius' && native.bounds?.size
              ? values.map((value) =>
                  Math.min(
                    value,
                    native.bounds.size.width / 2,
                    native.bounds.size.height / 2,
                  ),
                )
              : values,
        })
        if (property === 'borderRadius') {
          const shadows = view.boxShadow
          const layers = native.outerShadowContainerLayer?.sublayers
          if (Array.isArray(shadows) && layers) {
            for (let i = 0; i < Math.min(shadows.length, layers.count); i++) {
              const layer = layers.objectAtIndex(i)
              const spread = dip(shadows[i]!.spreadRadius)
              bindings.push({
                layer,
                path: 'shadowPath',
                values: values.map((radius) =>
                  roundedPath(native.bounds, radius, spread),
                ),
              })
              if (layer.mask)
                bindings.push({
                  layer: layer.mask,
                  path: 'path',
                  values: values.map((radius) =>
                    shadowMask(native.bounds, radius, maskExtent(view, entries)),
                  ),
                })
            }
          }
        }
      } else {
        const layer = native.outerShadowContainerLayer?.sublayers?.firstObject
        if (!layer) return cancel()
        bindings.push({ layer, path: paths[property], values: [...track.values] })
        // Core's mask bounds are sized for the final blur/offset. Give intermediate
        // samples room too. Radius owns the animated inner edge when it is active.
        if (layer.mask && !entries.has('borderRadius')) {
          CATransaction.begin()
          CATransaction.setDisableActions(true)
          ;(layer.mask as CAShapeLayer).path = shadowMask(
            native.bounds,
            native.layer.cornerRadius,
            maskExtent(view, entries),
          )
          CATransaction.commit()
        }
      }
      CATransaction.begin()
      CATransaction.setDisableActions(true)
      if (track.repeat !== Infinity)
        CATransaction.setCompletionBlock(() => {
          if (stopped || generation !== instance) return
          cleanup()
          onEnd()
        })
      // Core treats a zero-alpha shadow as opaque. Commit the native endpoint
      // explicitly too; otherwise a fade to zero would flash back on completion.
      const paint = bindings[0]!.layer
      if (property === 'shadowOpacity') paint.shadowOpacity = track.to
      else if (property === 'shadowRadius') paint.shadowRadius = track.to
      else if (property === 'shadowOffsetX')
        paint.shadowOffset = CGSizeMake(track.to, paint.shadowOffset.height)
      else if (property === 'shadowOffsetY')
        paint.shadowOffset = CGSizeMake(paint.shadowOffset.width, track.to)
      for (const { layer, path, values } of bindings) {
        const animation = CAKeyframeAnimation.animationWithKeyPath(path)
        animation.values = NSArray.arrayWithArray(values)
        animation.keyTimes = NSArray.arrayWithArray(times)
        animation.duration = Math.max(1, track.duration) / 1000
        animation.beginTime = (startedAt + track.delay) / 1000
        animation.fillMode = kCAFillModeBackwards
        animation.removedOnCompletion = track.repeat !== Infinity
        if (track.repeat > 0) {
          animation.autoreverses = track.reverse
          animation.repeatCount = track.reverse
            ? (track.repeat + 1) / 2
            : track.repeat + 1
        }
        if (animation.respondsToSelector('setPreferredFrameRateRange:')) {
          const max = Math.min(
            120,
            native.window?.screen.maximumFramesPerSecond ??
              UIScreen.mainScreen.maximumFramesPerSecond,
          )
          animation.preferredFrameRateRange = CAFrameRateRangeMake(
            Math.min(80, max),
            max,
            max,
          )
        }
        layer.addAnimationForKey(animation, key)
      }
      CATransaction.commit()
    },
  }
  entries.set(property, handle)
  view.on('unloaded', cancel)
  view.on('layoutChanged', refresh)
  view.style.on('backgroundInternalChange', refresh)
  for (const event of changes) view.style.on(event, external)
  // All model endpoints have been committed before driver.play(). Each handle
  // follows the same timeline even if Core redraws its layers during layout.
  for (const active of entries.values()) active.attach()
  return handle
}

function maskExtent(view: View, entries: Map<DecorationProperty, Handle>): number {
  const shadows = Array.isArray(view.boxShadow) ? view.boxShadow : []
  const maximum = (property: DecorationProperty, fallback: number) =>
    Math.max(
      Math.abs(fallback),
      ...(entries.get(property)?.track.values.map(Math.abs) ?? []),
    )
  return Math.max(
    1,
    ...shadows.map(
      (shadow) =>
        maximum('shadowRadius', dip(shadow.blurRadius) / 2) * 6 +
        Math.abs(dip(shadow.spreadRadius)) +
        maximum('shadowOffsetX', dip(shadow.offsetX)) +
        maximum('shadowOffsetY', dip(shadow.offsetY)) +
        1,
    ),
  )
}

/** Keep identical path topology at radius zero so CA can interpolate it. */
function roundedPath(bounds: CGRect, radius: number, spread = 0): interop.Pointer {
  const rect = CGRectInset(bounds, -spread, -spread)
  const r = Math.min(
    Math.max(0, Math.min(radius, bounds.size.width / 2, bounds.size.height / 2) + spread),
    Math.max(0, rect.size.width / 2),
    Math.max(0, rect.size.height / 2),
  )
  const x = rect.origin.x,
    y = rect.origin.y,
    right = x + rect.size.width,
    bottom = y + rect.size.height
  const k = r * 0.5522847498307936
  const path = CGPathCreateMutable()
  CGPathMoveToPoint(path, null, x + r, y)
  CGPathAddLineToPoint(path, null, right - r, y)
  CGPathAddCurveToPoint(path, null, right - r + k, y, right, y + r - k, right, y + r)
  CGPathAddLineToPoint(path, null, right, bottom - r)
  CGPathAddCurveToPoint(
    path,
    null,
    right,
    bottom - r + k,
    right - r + k,
    bottom,
    right - r,
    bottom,
  )
  CGPathAddLineToPoint(path, null, x + r, bottom)
  CGPathAddCurveToPoint(path, null, x + r - k, bottom, x, bottom - r + k, x, bottom - r)
  CGPathAddLineToPoint(path, null, x, y + r)
  CGPathAddCurveToPoint(path, null, x, y + r - k, x + r - k, y, x + r, y)
  CGPathCloseSubpath(path)
  return path
}
function shadowMask(bounds: CGRect, radius: number, extent: number): interop.Pointer {
  const path = CGPathCreateMutable()
  CGPathAddPath(path, null, roundedPath(bounds, radius))
  CGPathAddRect(path, null, CGRectInset(bounds, -extent, -extent))
  return path
}
