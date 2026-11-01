import {
  createWebRuntime,
  type WebRuntime,
  type PlaybackAnimation,
} from '../../src/web/index.js'
import { createTrack, resolveTransition } from '../../src/core/index.js'

const makeTarget = (css = '') => {
  const target = document.createElement('div')
  target.className = 'test-target'
  target.style.cssText = css
  document.body.append(target)
  return target
}
declare global {
  var lab: Window['lab']
  var rt: WebRuntime
  var target: HTMLElement
  var handles: Record<string, PlaybackAnimation>
  interface Window {
    lab: {
      createWebRuntime: typeof createWebRuntime
      makeTarget: typeof makeTarget
      createTrack: typeof createTrack
      resolveTransition: typeof resolveTransition
    }
    rt: WebRuntime
    target: HTMLElement
    handles: Record<string, PlaybackAnimation>
  }
}
window.lab = { createWebRuntime, makeTarget, createTrack, resolveTransition }

const runtime = createWebRuntime(document)
const card = document.querySelector<HTMLElement>('#card')!
const status = document.querySelector<HTMLElement>('#status')!
let handle: PlaybackAnimation | undefined
let reduced = false
let base = 1
let press = 1
const spring = { type: 'spring' as const, duration: 700, bounce: 0.2 }
const actions: Record<string, () => void> = {
  move() {
    handle = runtime.animate(
      card,
      { x: 250, y: 70, opacity: [0.35, 1] },
      {
        ...spring,
        duration: 1600,
        y: { ...spring, duration: 2400 },
        opacity: { duration: 500 },
      },
    )
    status.textContent = 'Independent x/y and opacity. The browser owns playback.'
  },
  interrupt() {
    handle = runtime.animate(card, { x: 30 }, spring)
    status.textContent =
      'Retarget x from the command-time position and velocity. y continues.'
  },
  scale() {
    base = 1.1
    runtime.animate(card, { scale: base }, spring)
    status.textContent = 'Application scale: 1.1.'
  },
  press() {
    press = 0.96
    runtime.animate(card, { scale: press }, { ...spring, layer: 'press' })
    status.textContent = `Press contribution: ${base} × 0.96 = ${Number((base * press).toFixed(3))}.`
  },
  grow() {
    base = 1.2
    runtime.animate(card, { scale: base }, spring)
    status.textContent = `Base changes while held: 1.2 × ${press} = ${Number((base * press).toFixed(3))}.`
  },
  release() {
    press = 1
    runtime.animate(card, { scale: press }, { ...spring, layer: 'press' })
    status.textContent = `Release keeps the application scale: ${base}.`
  },
  pause() {
    handle?.pause()
    status.textContent = 'Only the selected animation is paused.'
  },
  seek() {
    if (handle) {
      handle.pause()
      handle.progress = 0.5
    }
    status.textContent = 'Paused at 50%. The same source timeline can resume.'
  },
  play() {
    handle?.play()
    status.textContent = 'Playback resumed.'
  },
  repeat() {
    handle = runtime.animate(
      card,
      { x: [30, 250], rotate: [0, 12] },
      {
        duration: 1200,
        ease: 'easeInOut',
        repeat: 1,
        repeatType: 'reverse',
        repeatDelay: 150,
      },
    )
    status.textContent = 'Finite reverse repeat, including its hold.'
  },
  preference() {
    reduced = !reduced
    runtime.configure({ reducedMotion: reduced ? 'always' : 'user' })
    status.textContent = reduced
      ? 'Reduced motion: active transforms finish; opacity can continue.'
      : 'Reduced motion follows the browser preference.'
  },
  reset() {
    runtime.release(card)
    base = press = 1
    status.textContent = 'Original styles restored. The surface can be animated again.'
  },
}
for (const [id, action] of Object.entries(actions))
  document.getElementById(id)!.addEventListener('click', action)
