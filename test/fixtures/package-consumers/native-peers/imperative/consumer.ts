import { Label } from '@nativescript/core'
import { animate, press, motionScope, type PlaybackAnimation } from '@rafaelaugusto/jolt'
import { mapKitCoordinate } from '@rafaelaugusto/jolt/native'

const scope = motionScope()
const view = new Label()
const animation: PlaybackAnimation = scope.animate(view, { x: 40 }, { duration: 300 })
animation.pause()
animation.play()
scope.use(() => press(view, { scale: 0.95 }))
animate(view, { opacity: 1 })
mapKitCoordinate({}).set({ latitude: 1, longitude: 2 })
// Component/route disposal owns this scope, independently of a framework binding.
scope.dispose()
