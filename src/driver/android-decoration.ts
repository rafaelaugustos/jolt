import { Utils, type View } from '@nativescript/core'
import {
  isWritingDecoration,
  radiusKeys,
  widthKeys,
  validateDecorationTarget,
  type DecorationProperty,
} from '../decoration.js'
import type { Track } from '../track.js'
interface NativeTarget {
  getValue(): number
  setValue(value: number): void
  isSupported(): boolean
  acquire(): void
  release(): void
}
interface Handle {
  cancel(): void
  elapsed(): number
  target: NativeTarget
}
const playing = new WeakMap<View, Map<DecorationProperty, Handle>>()
const ids = { borderRadius: 0, borderWidth: 1, elevation: 2, translationZ: 3 } as const
export function syncAndroidDecoration(view: View) {
  for (const handle of playing.get(view)?.values() ?? [])
    handle.target.setValue(handle.target.getValue())
}
export const presentedAndroidDecoration = (view: View, property: DecorationProperty) => {
  const target = playing.get(view)?.get(property)?.target
  return target ? target.getValue() / Utils.layout.getDisplayDensity() : undefined
}
export function playAndroidDecoration(
  view: View,
  track: Track,
  onEnd: (finished?: boolean) => void,
): Handle {
  const property = track.property as keyof typeof ids
  const density = Utils.layout.getDisplayDensity()
  const bridge = globalThis as unknown as {
    org: {
      rafaelaugusto: {
        jolt: {
          DecorationTarget: new (
            view: android.view.View,
            property: number,
            value: number,
            borderColor: number,
          ) => NativeTarget
        }
      }
    }
  }
  let target: NativeTarget
  try {
    target = new bridge.org.rafaelaugusto.jolt.DecorationTarget(
      view.nativeViewProtected,
      ids[property],
      track.values[0]! * density,
      view.borderTopColor?.argb ?? 0,
    )
  } catch {
    onEnd(false)
    return {
      cancel() {},
      elapsed: () => 0,
      target: {
        getValue: () => track.to * density,
        setValue() {},
        isSupported: () => false,
        acquire() {},
        release() {},
      },
    }
  }
  const frames = Array.create(android.animation.Keyframe, track.values.length)
  track.values.forEach((value, index) => {
    frames[index] = android.animation.Keyframe.ofFloat(
      track.times[index]!,
      value * density,
    )
  })
  const holders = Array.create(android.animation.PropertyValuesHolder, 1)
  holders[0] = android.animation.PropertyValuesHolder.ofKeyframe('value', frames)
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
    started = false
  const changes = [
    ...radiusKeys,
    ...widthKeys,
    'clipPath',
    'cornerShape',
    'boxShadow',
    'androidElevation',
  ].map((name) => `${name}Change`)
  const cleanup = () => {
    if (stopped) return
    stopped = true
    view.off('unloaded', cancel)
    for (const event of changes) view.style.off(event, external)
    target.release()
    if (playing.get(view)?.get(property) === handle) playing.get(view)?.delete(property)
  }
  const cancel = () => {
    if (!stopped) {
      cleanup()
      animator.cancel()
      onEnd(false)
    }
  }
  const external = (event: { eventName: string }) => {
    if (isWritingDecoration(view)) return
    const own =
      property === 'borderRadius'
        ? radiusKeys
        : property === 'borderWidth'
          ? widthKeys
          : property === 'elevation'
            ? ['androidElevation']
            : []
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
  const handle: Handle = {
    target,
    elapsed: () => (started ? track.delay + animator.getCurrentPlayTime() : 0),
    cancel() {
      cleanup()
      animator.cancel()
    },
  }
  const entries = playing.get(view) ?? new Map<DecorationProperty, Handle>()
  playing.set(view, entries)
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
  for (const event of changes) view.style.on(event, external)
  if (target.isSupported()) {
    target.acquire()
    target.setValue(track.values[0]! * density)
    animator.start()
  } else {
    cleanup()
    onEnd(false)
  }
  return handle
}
