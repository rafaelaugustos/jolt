import { Label } from '@nativescript/core'
import {
  animate,
  motionValue,
  playbackProgress,
  timeline,
  type DerivedValue,
  type PlaybackAnimation,
} from '../src/index.js'
import { mapKitCoordinate, sceneKitPose } from '../src/native/index.js'

const value = motionValue(0)
const controlled: PlaybackAnimation = animate(value, 1)
const progress: DerivedValue = playbackProgress(controlled)
progress.to([0, 1], [100, 0]).subscribe((distance, time) => {
  void [distance, time]
})
// @ts-expect-error Progress is read-only.
progress.set(0.5)
// @ts-expect-error An observed source cannot own an animation.
animate(progress, 1)
const scene = timeline([
  [value, 1],
  [new Label(), { opacity: 1 }, { at: 0 }],
])
scene.pause()
// @ts-expect-error A side-effectful timeline has no aggregate seek setter.
scene.progress = 0.5
// @ts-expect-error Callbacks must return a playable handle.
timeline([() => ({ stop() {}, finished: Promise.resolve(true) })])
const coordinate = mapKitCoordinate({})
coordinate.animate({ latitude: 1, longitude: 2 }).pause()
// @ts-expect-error A coordinate needs both geographic components.
coordinate.set({ latitude: 1 })
// @ts-expect-error A camera orientation is a quaternion with four components.
sceneKitPose({}).set({ position: [0, 1, 2], orientation: [0, 0, 0] })
