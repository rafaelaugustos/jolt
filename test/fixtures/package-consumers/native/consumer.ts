import { Label } from '@nativescript/core'
import { animate, motionValue, type PlaybackAnimation } from '@rafaelaugusto/jolt'
import { mapKitCoordinate } from '@rafaelaugusto/jolt/native'
import { useMotionScope, vPress } from '@rafaelaugusto/jolt/vue'
import { useAnimate, usePress } from '@rafaelaugusto/jolt/react'
import {
  animate as svelteAnimate,
  press as sveltePress,
} from '@rafaelaugusto/jolt/svelte'
import { animate as solidAnimate, press as solidPress } from '@rafaelaugusto/jolt/solid'
import {
  JoltAnimateDirective,
  JoltPressDirective,
  JoltIfDirective,
} from '@rafaelaugusto/jolt/angular'
import { createRef } from 'react'

function ReactConsumer() {
  const ref = createRef<{ nativeView: Label }>()
  const play = useAnimate(ref, [{ x: 10 }, 'snappy'])
  usePress(ref, { scale: 0.95 })
  play('fadeIn')
  // @ts-expect-error Native framework bindings reject DOM refs.
  useAnimate(createRef<{ tagName: string }>())
  return ref
}
const svelte = svelteAnimate({ nativeView: new Label() }, 'fadeIn')
svelte.update([{ x: 20 }, { duration: 500 }])
svelte.destroy()
sveltePress(new Label()).destroy()
solidAnimate(new Label(), () => [{ opacity: 1 }, 'snappy'])
solidPress(new Label(), () => ({ scale: 0.95 }))
void [ReactConsumer, JoltAnimateDirective, JoltPressDirective, JoltIfDirective]
// @ts-expect-error Unknown presets do not pass through the new actions.
svelteAnimate(new Label(), 'not-a-preset')

const animation: PlaybackAnimation = animate(new Label(), { x: 100 }, 'snappy')
animation.pause()
animation.progress = 0.5
animate(motionValue(0), 100)
mapKitCoordinate({}).animate({ latitude: 1, longitude: 2 })
void [useMotionScope, vPress]
// @ts-expect-error Existing native coordinate contract is preserved.
mapKitCoordinate({}).set({ latitude: 1 })
