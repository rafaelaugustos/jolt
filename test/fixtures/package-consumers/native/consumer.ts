import { Label } from '@nativescript/core'
import { animate, motionValue, type PlaybackAnimation } from '@rafaelaugusto/jolt'
import { mapKitCoordinate } from '@rafaelaugusto/jolt/native'
import { useMotionScope, vPress } from '@rafaelaugusto/jolt/vue'

const animation: PlaybackAnimation = animate(new Label(), { x: 100 }, 'snappy')
animation.pause()
animation.progress = 0.5
animate(motionValue(0), 100)
mapKitCoordinate({}).animate({ latitude: 1, longitude: 2 })
void [useMotionScope, vPress]
// @ts-expect-error Existing native coordinate contract is preserved.
mapKitCoordinate({}).set({ latitude: 1 })
