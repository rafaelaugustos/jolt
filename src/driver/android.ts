import { Utils, type View } from '@nativescript/core'
import type { Property } from '../properties.js'
import { after, type Driver } from './index.js'

type NativeView = android.view.View

const accessors: Record<
  Property,
  { get(view: NativeView): number; set(view: NativeView, value: number): void }
> = {
  opacity: { get: (v) => v.getAlpha(), set: (v, value) => v.setAlpha(value) },
  x: { get: (v) => v.getTranslationX(), set: (v, value) => v.setTranslationX(value) },
  y: { get: (v) => v.getTranslationY(), set: (v, value) => v.setTranslationY(value) },
  scaleX: { get: (v) => v.getScaleX(), set: (v, value) => v.setScaleX(value) },
  scaleY: { get: (v) => v.getScaleY(), set: (v, value) => v.setScaleY(value) },
  rotate: { get: (v) => v.getRotation(), set: (v, value) => v.setRotation(value) },
  rotateX: { get: (v) => v.getRotationX(), set: (v, value) => v.setRotationX(value) },
  rotateY: { get: (v) => v.getRotationY(), set: (v, value) => v.setRotationY(value) },
}

const unit = (property: Property) =>
  property === 'x' || property === 'y' ? Utils.layout.getDisplayDensity() : 1

export function createAndroidDriver(): Driver {
  const { View } = android.view
  const nativeProperties = {
    opacity: View.ALPHA,
    x: View.TRANSLATION_X,
    y: View.TRANSLATION_Y,
    scaleX: View.SCALE_X,
    scaleY: View.SCALE_Y,
    rotate: View.ROTATION,
    rotateX: View.ROTATION_X,
    rotateY: View.ROTATION_Y,
  } satisfies Record<Property, unknown>
  const interpolator = new android.view.animation.LinearInterpolator()

  return {
    now: () => android.os.SystemClock.uptimeMillis(),

    play(view, track, _startedAt, onEnd) {
      const nativeView = view.nativeViewProtected as NativeView
      const scale = unit(track.property)

      const keyframes = Array.create(android.animation.Keyframe, track.values.length)
      track.values.forEach((value, i) => {
        keyframes[i] = android.animation.Keyframe.ofFloat(track.times[i]!, value * scale)
      })
      const holders = Array.create(android.animation.PropertyValuesHolder, 1)
      holders[0] = android.animation.PropertyValuesHolder.ofKeyframe(
        nativeProperties[track.property],
        keyframes,
      )

      const animator = android.animation.ObjectAnimator.ofPropertyValuesHolder(
        nativeView,
        holders,
      )
      animator.setDuration(Math.max(track.duration, 1))
      animator.setStartDelay(track.delay)
      animator.setInterpolator(interpolator)
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
      animator.addListener(
        new android.animation.Animator.AnimatorListener({
          onAnimationStart() {},
          onAnimationRepeat() {},
          onAnimationCancel() {},
          onAnimationEnd() {
            onEnd()
          },
        }),
      )

      accessors[track.property].set(nativeView, track.values[0]! * scale)
      animator.start()
      return animator
    },

    stop(_view, handle) {
      ;(handle as android.animation.ObjectAnimator).cancel()
    },

    presented(view, property) {
      const nativeView = view.nativeViewProtected as NativeView | undefined
      return nativeView ? accessors[property].get(nativeView) / unit(property) : undefined
    },

    after,
  }
}
