import {
  androidPlayback,
  androidClockFactory,
  type AndroidPlayback,
} from './android-playback.js'
import { isDecorationProperty } from '../decoration.js'
import {
  syncAndroidDecoration,
  playAndroidDecoration,
  presentedAndroidDecoration,
} from './android-decoration.js'
import { Utils, type View } from '@nativescript/core'
import type { NumericProperty } from '../properties.js'
import type { Driver } from './index.js'
import { isColorProperty } from '../color.js'
import {
  playAndroidColor,
  presentedAndroidColor,
  syncAndroidColor,
} from './android-color.js'

type NativeView = android.view.View

type Handle = AndroidPlayback

/** Own only layers we create; keep app-configured hardware/software layers and paints intact. */
function fadeLayer(view: View, nativeView: NativeView): (() => void) | undefined {
  const { View, ViewGroup } = android.view
  if (
    !view.isLoaded ||
    view.nativeViewProtected !== nativeView ||
    !(nativeView instanceof ViewGroup) ||
    nativeView.getChildCount() === 0 ||
    !nativeView.isHardwareAccelerated() ||
    nativeView.getLayerType() !== View.LAYER_TYPE_NONE
  )
    return undefined

  // Do not cache an entire oversized scrolling/content tree into a GPU texture.
  const { widthPixels, heightPixels } = nativeView.getResources().getDisplayMetrics()
  const width = nativeView.getWidth()
  const height = nativeView.getHeight()
  if (width <= 0 || height <= 0 || width > widthPixels || height > heightPixels)
    return undefined

  nativeView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
  let active = true
  const restore = () => {
    if (!active) return
    active = false
    view.off('unloaded', restore)
    if (nativeView.getLayerType() === View.LAYER_TYPE_HARDWARE) {
      nativeView.setLayerType(View.LAYER_TYPE_NONE, null)
    }
  }
  view.on('unloaded', restore)
  return restore
}

const accessors: Record<
  NumericProperty,
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

const unit = (property: NumericProperty) =>
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
  } satisfies Record<NumericProperty, unknown>
  const clock = androidClockFactory()
  const interpolator = new android.view.animation.LinearInterpolator()

  return {
    now: () => android.os.SystemClock.uptimeMillis(),
    clock,
    control(_view, handle, elapsed, paused, command) {
      ;(handle as Handle).control(elapsed, paused, command)
    },

    play(view, track, _startedAt, onEnd) {
      if (isDecorationProperty(track.property))
        return playAndroidDecoration(view, track, onEnd)
      if (isColorProperty(track.property)) return playAndroidColor(view, track, onEnd)
      const nativeView = view.nativeViewProtected as NativeView
      const scale = unit(track.property)

      if (track.property === 'rotateX' || track.property === 'rotateY') {
        nativeView.setCameraDistance(
          (view.perspective || 300) * Utils.layout.getDisplayDensity(),
        )
      }

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
      let restoreLayer: (() => void) | undefined
      const releaseLayer = () => {
        restoreLayer?.()
        restoreLayer = undefined
      }
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
      accessors[track.property].set(nativeView, track.values[0]! * scale)
      return androidPlayback(
        animator,
        track,
        onEnd,
        () => {
          if (
            track.property === 'opacity' &&
            track.values.some((value) => value !== track.values[0])
          )
            restoreLayer = fadeLayer(view, nativeView)
        },
        releaseLayer,
      )
    },

    stop(_view, handle) {
      ;(handle as Handle).cancel()
    },

    sync(view) {
      syncAndroidDecoration(view)
      syncAndroidColor(view)
    },

    elapsed: (handle) => (handle as Handle).elapsed(),

    presented(view, property) {
      if (isDecorationProperty(property))
        return presentedAndroidDecoration(view, property)
      if (isColorProperty(property)) return presentedAndroidColor(view, property)
      const nativeView = view.nativeViewProtected as NativeView | undefined
      return nativeView ? accessors[property].get(nativeView) / unit(property) : undefined
    },

    after(ms, callback) {
      // A native marker follows animator duration scale, including changes during playback.
      // Only completion crosses the bridge; there is no JavaScript update listener.
      const values = Array.create('float', 2)
      values[0] = 0
      values[1] = 1
      const marker = android.animation.ValueAnimator.ofFloat(values)
      marker.setDuration(ms)
      let active = true
      marker.addListener(
        new android.animation.Animator.AnimatorListener({
          onAnimationStart() {},
          onAnimationRepeat() {},
          onAnimationCancel() {
            active = false
          },
          onAnimationEnd() {
            if (!active) return
            active = false
            callback()
          },
        }),
      )
      marker.start()
      return () => {
        active = false
        marker.cancel()
      }
    },

    reducedMotion() {
      // Remove animations sets the animator duration scale to zero.
      if (android.os.Build.VERSION.SDK_INT >= 26)
        return !android.animation.ValueAnimator.areAnimatorsEnabled()
      const { Global } = android.provider.Settings
      return (
        Global.getFloat(
          Utils.android.getApplicationContext().getContentResolver(),
          Global.ANIMATOR_DURATION_SCALE,
          1,
        ) === 0
      )
    },
  }
}
