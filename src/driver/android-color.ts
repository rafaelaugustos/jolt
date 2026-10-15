import { type View } from '@nativescript/core'
import { readColor, type ColorProperty } from '../color.js'
import type { Track } from '../track.js'

interface NativeTarget {
  getColor(): number
  setColor(value: number): void
  isSupported(): boolean
}
interface ColorHandle {
  cancel(): void
  elapsed(): number
  target: NativeTarget
}
const playing = new WeakMap<View, Map<ColorProperty, ColorHandle>>()

export function syncAndroidColor(view: View) {
  for (const handle of playing.get(view)?.values() ?? [])
    handle.target.setColor(handle.target.getColor())
}

export function presentedAndroidColor(view: View, property: ColorProperty): number {
  const active = playing.get(view)?.get(property)
  if (active) return active.target.getColor() >>> 0
  if (property === 'color' && view.nativeViewProtected instanceof android.widget.TextView)
    return view.nativeViewProtected.getCurrentTextColor() >>> 0
  return readColor(view, property)
}

export function playAndroidColor(
  view: View,
  track: Track,
  onEnd: (finished?: boolean) => void,
): ColorHandle {
  const property = track.property as ColorProperty
  const changes =
    property === 'borderColor'
      ? [
          'borderTopColorChange',
          'borderRightColorChange',
          'borderBottomColorChange',
          'borderLeftColorChange',
        ]
      : [`${property}Change`]
  const bridge = globalThis as unknown as {
    org: {
      rafaelaugusto: {
        jolt: {
          ColorTarget: new (
            view: android.view.View,
            property: number,
            color: number,
          ) => NativeTarget
        }
      }
    }
  }
  let target: NativeTarget
  try {
    target = new bridge.org.rafaelaugusto.jolt.ColorTarget(
      view.nativeViewProtected,
      property === 'backgroundColor' ? 0 : property === 'borderColor' ? 1 : 2,
      track.values[0]! | 0,
    )
  } catch {
    // A JS-only update cannot install the native plugin. Keep the final model.
    onEnd(false)
    return {
      cancel() {},
      elapsed: () => 0,
      target: {
        getColor: () => readColor(view, property),
        setColor() {},
        isSupported: () => false,
      },
    }
  }
  const frames = Array.create(android.animation.Keyframe, track.values.length)
  track.values.forEach((value, index) => {
    frames[index] = android.animation.Keyframe.ofInt(track.times[index]!, value | 0)
  })
  const holder = android.animation.PropertyValuesHolder.ofKeyframe('color', frames)
  holder.setEvaluator(new android.animation.ArgbEvaluator())
  const holders = Array.create(android.animation.PropertyValuesHolder, 1)
  holders[0] = holder
  const animator = android.animation.ObjectAnimator.ofPropertyValuesHolder(
    target as unknown as java.lang.Object,
    holders,
  )
  animator.setDuration(Math.max(track.duration, 1))
  animator.setStartDelay(track.delay)
  animator.setInterpolator(new android.view.animation.LinearInterpolator())
  if (track.repeat > 0) {
    animator.setRepeatCount(
      Number.isFinite(track.repeat)
        ? track.repeat
        : android.animation.ValueAnimator.INFINITE,
    )
    animator.setRepeatMode(
      track.reverse
        ? android.animation.ValueAnimator.REVERSE
        : android.animation.ValueAnimator.RESTART,
    )
  }
  let stopped = false,
    started = false,
    queued = false
  const cleanup = () => {
    if (stopped) return
    stopped = true
    view.off('unloaded', cancel)
    if (property === 'color') {
      view.off('textChange', invalidate)
      view.off('formattedTextChange', invalidate)
    }
    for (const name of changes) view.style.off(name, invalidate)
    if (playing.get(view)?.get(property) === handle) playing.get(view)?.delete(property)
  }
  const cancel = () => {
    if (stopped) return
    cleanup()
    animator.cancel()
    onEnd(false)
  }
  const invalidate = () => {
    if (stopped || queued) return
    queued = true
    void Promise.resolve().then(() => {
      queued = false
      if (!stopped) cancel()
    })
  }
  const handle: ColorHandle = {
    target,
    elapsed: () => (started ? track.delay + animator.getCurrentPlayTime() : 0),
    cancel() {
      cleanup()
      animator.cancel()
    },
  }
  let entries = playing.get(view)
  if (!entries) playing.set(view, (entries = new Map()))
  entries.set(property, handle)
  animator.addListener(
    new android.animation.Animator.AnimatorListener({
      onAnimationStart() {
        started = true
      },
      onAnimationRepeat() {},
      onAnimationCancel() {},
      onAnimationEnd() {
        if (!stopped) {
          cleanup()
          onEnd()
        }
      },
    }),
  )
  view.on('unloaded', cancel)
  if (property === 'color') {
    view.on('textChange', invalidate)
    view.on('formattedTextChange', invalidate)
  }
  for (const name of changes) view.style.on(name, invalidate)
  if (target.isSupported()) {
    target.setColor(track.values[0]! | 0)
    animator.start()
  } else {
    cleanup()
    onEnd(false)
  }
  return handle
}
