import type { View } from '@nativescript/core'
import type { Property } from '../properties.js'
import { after, type Driver } from './index.js'

interface Handle {
  layers: CALayer[]
  key: string
  onStop?: () => void
}

const keyPaths: Record<Property, string> = {
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
      const layers = layersOf(view)
      const key = `jolt:${track.property}`
      const rotation = track.property.startsWith('rotate')
      const infinite = track.repeat === Infinity
      if (track.property === 'rotateX' || track.property === 'rotateY') {
        ensurePerspective(view, layers)
      }

      const animation = CAKeyframeAnimation.animationWithKeyPath(keyPaths[track.property])
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
      animation.beginTime = (startedAt + track.delay) / 1000
      animation.fillMode = kCAFillModeBackwards
      // Keep infinite loops when iOS removes animations on backgrounding.
      // They are removed explicitly when stopped or replaced.
      animation.removedOnCompletion = !infinite
      if (track.repeat > 0) {
        animation.autoreverses = track.reverse
        animation.repeatCount = track.reverse ? (track.repeat + 1) / 2 : track.repeat + 1
      }

      CATransaction.begin()
      // iOS completes the transaction on backgrounding even if the loop is retained.
      if (!infinite) CATransaction.setCompletionBlock(onEnd)
      for (const layer of layers) layer.addAnimationForKey(animation, key)
      CATransaction.commit()

      return { layers, key, onStop: infinite ? onEnd : undefined }
    },

    stop(_view, handle) {
      const playing = handle as Handle
      const { layers, key, onStop } = playing
      playing.onStop = undefined
      for (const layer of layers) layer.removeAnimationForKey(key)
      onStop?.()
    },

    presented: () => undefined,

    after,
  }
}
