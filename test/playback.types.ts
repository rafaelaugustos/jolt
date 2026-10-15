import { Label } from '@nativescript/core'
import {
  animate,
  animateText,
  decay,
  type Animation,
  type PlaybackAnimation,
} from '../src/index.js'
const view = new Label()
const animation: PlaybackAnimation = animate(view, { rotateY: 90 })
animation.pause()
animation.progress = 0.4
animation.play()
const paused: boolean = animation.paused
const duration: number = animation.duration
const base: Animation = animation
const release: PlaybackAnimation = decay(view, { x: 100 })
const grouped: PlaybackAnimation = animate([view], { x: 100 }, { stagger: 40 })
// @ts-expect-error Progress is normalized numeric time.
animation.progress = '40%'
const text: Animation = animateText(view)
// @ts-expect-error Effect-specific animations expose the base lifecycle.
text.pause()
void [paused, duration, base, release, grouped]
