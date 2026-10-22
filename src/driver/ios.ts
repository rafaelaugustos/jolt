import { iosPlayback } from './ios-playback.js'
import { isDecorationProperty } from '../decoration.js'
import {
  playIOSDecoration,
  presentedIOSDecoration,
  syncIOSDecoration,
} from './ios-decoration.js'
import { Application, type View } from '@nativescript/core'
import { stopView } from '../engine.js'
import type { NumericProperty } from '../properties.js'
import { isColorProperty } from '../color.js'
import { playIOSColor, presentedIOSColor } from './ios-color.js'
import { after, type Driver } from './index.js'
import { hasInteractionSurface } from '../interaction-surface.js'
import { retainInteractiveLayout } from './ios-layout.js'
import { frame } from './frame.js'

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
    frame,

    play(view, track, startedAt, onEnd): Handle {
      if (isDecorationProperty(track.property))
        return playIOSDecoration(view, track, startedAt, onEnd)
      if (isColorProperty(track.property))
        return playIOSColor(view, track, startedAt, onEnd)
      const layers = layersOf(view)
      const key = `jolt:${track.property}`
      const rotation = track.property.startsWith('rotate')
      if (hasInteractionSurface(view)) {
        if (typeof JoltInteractiveAnimation === 'undefined')
          throw new Error('Rebuild the iOS app to enable Jolt interaction surfaces.')
        if (track.property === 'rotateX' || track.property === 'rotateY')
          ensurePerspective(view, layers)
        const releaseLayout = retainInteractiveLayout(view)
        const suspend = () => stopView(view, [track.property])
        const completed = (finished: boolean) => {
          Application.off(Application.suspendEvent, suspend)
          releaseLayout()
          onEnd(finished)
        }
        let native: JoltInteractiveAnimation
        try {
          native =
            JoltInteractiveAnimation.startViewLayersKeyPathValuesTimesDurationDelayRepeatReverseFinalValueStartedAtCompletion(
              view.nativeViewProtected,
              NSArray.arrayWithArray(layers),
              keyPaths[track.property as NumericProperty],
              NSArray.arrayWithArray(
                track.values.map((value) => (rotation ? radians(value) : value)),
              ),
              NSArray.arrayWithArray(track.times as number[]),
              track.duration,
              track.delay,
              track.repeat,
              track.reverse,
              rotation ? radians(track.to) : track.to,
              startedAt,
              completed,
            )
        } catch (error) {
          releaseLayout()
          throw error
        }
        Application.on(Application.suspendEvent, suspend)
        return {
          elapsed: () => native.elapsed,
          control: (time, paused) => native.controlPaused(time, paused),
          stop: () => native.cancel(),
        }
      }
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

    sync(view, excluding) {
      syncIOSDecoration(view, excluding)
      if (view.nativeViewProtected && typeof JoltInteractiveAnimation !== 'undefined')
        JoltInteractiveAnimation.syncViewExcluding(
          view.nativeViewProtected,
          excluding ? (keyPaths[excluding as NumericProperty] ?? null) : null,
        )
    },

    presented(view, property) {
      if (isDecorationProperty(property)) return presentedIOSDecoration(view, property)
      if (isColorProperty(property)) return presentedIOSColor(view, property)
      if (!view.nativeViewProtected || typeof JoltInteractiveAnimation === 'undefined')
        return undefined
      const value = JoltInteractiveAnimation.valueForViewKeyPath(
        view.nativeViewProtected,
        keyPaths[property],
      )
      if (value === null || value === undefined) return undefined
      return property.startsWith('rotate') ? (value * 180) / Math.PI : Number(value)
    },

    layoutFrame(view) {
      const native = view.nativeViewProtected as UIView | undefined
      if (!native) return undefined
      const { width, height } = native.bounds.size
      const { position, anchorPoint } = native.layer
      return {
        x: position.x - width * anchorPoint.x,
        y: position.y - height * anchorPoint.y,
        width,
        height,
      }
    },

    afterLayout(view, callback) {
      const original = view.layout
      const descriptor = Object.getOwnPropertyDescriptor(view, 'layout')
      let active = true
      const detach = () => {
        active = false
        if (view.layout !== wrapper) return
        if (descriptor) Object.defineProperty(view, 'layout', descriptor)
        else delete (view as Partial<View>).layout
      }
      const wrapper: View['layout'] = function (this: View, ...args) {
        original.apply(this, args)
        if (active) {
          detach()
          callback()
        }
      }
      view.layout = wrapper
      return detach
    },

    after,

    reducedMotion: () => UIAccessibilityIsReduceMotionEnabled(),

    watchReducedMotion(callback) {
      const name = UIAccessibilityReduceMotionStatusDidChangeNotification
      const observer = Application.ios.addNotificationObserver(name, callback)
      return () => Application.ios.removeNotificationObserver(observer, name)
    },
  }
}
