import { iosPlayback } from './ios-playback.js'
import { isDecorationProperty } from '../decoration.js'
import {
  playIOSDecoration,
  presentedIOSDecoration,
  syncIOSDecoration,
} from './ios-decoration.js'
import type { View } from '@nativescript/core'
import type { NumericProperty } from '../properties.js'
import { isColorProperty } from '../color.js'
import { playIOSColor, presentedIOSColor } from './ios-color.js'
import { after, type Driver } from './index.js'

interface Handle {
  stop(): void
  elapsed(): number
  control(elapsed: number, paused: boolean): void
}

const keyPaths: Record<NumericProperty, string> = {
  opacity: 'opacity',
  x: 'transform.translation.x',
  y: 'transform.translation.y',
  scaleX: 'transform.scale.x',
  scaleY: 'transform.scale.y',
  rotate: 'transform.rotation.z',
  rotateX: 'transform.rotation.x',
  rotateY: 'transform.rotation.y',
}

const radians = (degrees: number) => (degrees * Math.PI) / 180

function layersOf(view: View): CALayer[] {
  const nativeView = view.nativeViewProtected as UIView & {
    outerShadowContainerLayer?: CALayer
  }
  return nativeView.outerShadowContainerLayer
    ? [nativeView.layer, nativeView.outerShadowContainerLayer]
    : [nativeView.layer]
}

/** A 3D rotation only looks 3D with perspective, which core leaves out once the rotation ends at 0. */
function ensurePerspective(view: View, layers: CALayer[]) {
  CATransaction.begin()
  CATransaction.setDisableActions(true)
  for (const layer of layers) {
    const transform = layer.transform
    if (transform.m34 === 0) {
      transform.m34 = -1 / (view.perspective || 300)
      layer.transform = transform
    }
  }
  CATransaction.commit()
}

export function createIOSDriver(): Driver {
  return {
    now: () => CACurrentMediaTime() * 1000,

    play(view, track, startedAt, onEnd): Handle {
      if (isDecorationProperty(track.property))
        return playIOSDecoration(view, track, startedAt, onEnd)
      if (isColorProperty(track.property))
        return playIOSColor(view, track, startedAt, onEnd)
      const layers = layersOf(view)
      const key = `jolt:${track.property}`
      const rotation = track.property.startsWith('rotate')
      const infinite = track.repeat === Infinity
      if (track.property === 'rotateX' || track.property === 'rotateY') {
        ensurePerspective(view, layers)
      }

      const timing = iosPlayback(track, startedAt)
      let stopped = false,
        generation = 0
      const attach = () => {
        const instance = ++generation
        const animation = CAKeyframeAnimation.animationWithKeyPath(
          keyPaths[track.property as NumericProperty],
        )
        // iOS 15+. The app must opt in through CADisableMinimumFrameDurationOnPhone.
        if (animation.respondsToSelector('setPreferredFrameRateRange:')) {
          const nativeView = view.nativeViewProtected as UIView
          const screen = nativeView.window?.screen ?? UIScreen.mainScreen
          const maximum = Math.min(120, screen.maximumFramesPerSecond)
          animation.preferredFrameRateRange = CAFrameRateRangeMake(
            Math.min(80, maximum),
            maximum,
            maximum,
          )
        }
        animation.values = NSArray.arrayWithArray(
          track.values.map((value) => (rotation ? radians(value) : value)),
        )
        animation.keyTimes = NSArray.arrayWithArray(track.times as number[])
        animation.duration = Math.max(track.duration, 1) / 1000
        // Keep infinite loops when iOS removes animations on backgrounding.
        // They are removed explicitly when stopped or replaced.
        if (track.repeat > 0) {
          animation.autoreverses = track.reverse
          animation.repeatCount = track.reverse
            ? (track.repeat + 1) / 2
            : track.repeat + 1
        }

        CATransaction.begin()
        if (!timing.paused && !infinite)
          CATransaction.setCompletionBlock(() => {
            if (stopped || instance !== generation) return
            stopped = true
            onEnd()
          })
        for (const layer of layers) {
          timing.configure(animation, layer)
          layer.addAnimationForKey(animation, key)
        }
        CATransaction.commit()
      }
      attach()
      return {
        elapsed: timing.elapsed,
        control(time, paused) {
          if (!stopped) {
            timing.control(time, paused)
            attach()
          }
        },
        stop() {
          if (stopped) return
          stopped = true
          generation++
          for (const layer of layers) layer.removeAnimationForKey(key)
          onEnd(false)
        },
      }
    },

    stop(_view, handle) {
      ;(handle as Handle).stop()
    },
    control(_view, handle, elapsed, paused) {
      ;(handle as Handle).control(elapsed, paused)
    },
    elapsed: (handle) => (handle as Handle).elapsed(),

    sync: syncIOSDecoration,

    presented: (view, property) =>
      isDecorationProperty(property)
        ? presentedIOSDecoration(view, property)
        : isColorProperty(property)
          ? presentedIOSColor(view, property)
          : undefined,

    after,

    reducedMotion: () => UIAccessibilityIsReduceMotionEnabled(),
  }
}
