import { createWebRuntime } from '../../src/web/index.js'
import type { WebRuntime } from '../../src/web/runtime.js'
import type { WebMotionValue, WebReadableValue, WebBinding } from '../../src/web/value.js'
import type { WebSpringValue } from '../../src/web/spring-value.js'
import type { WebDrag } from '../../src/web/drag.js'
const makeTarget = (css = '') => {
  const target = document.createElement('button')
  target.className = 'test-target'
  target.textContent = 'Test'
  target.style.cssText = css
  document.body.append(target)
  return target
}
declare global {
  var rt: WebRuntime
  var target: HTMLElement
  var values: Record<string, WebMotionValue>
  var spring: WebSpringValue
  var binding: WebBinding
  var drag: WebDrag
  var lab: { createWebRuntime: typeof createWebRuntime; makeTarget: typeof makeTarget }
}
Object.assign(window, { lab: { createWebRuntime, makeTarget } })
const motion = createWebRuntime(document, { reducedMotion: 'never' })
const stage = document.querySelector<HTMLElement>('#follow-stage')!
const marker = document.querySelector<HTMLElement>('#marker')!,
  follower = document.querySelector<HTMLElement>('#follower')!
const x = motion.motionValue(0),
  y = motion.motionValue(0)
const sx = motion.springValue(x, { stiffness: 130, damping: 13 }),
  sy = motion.springValue(y, { stiffness: 130, damping: 13 })
motion.bind(marker, { x, y })
motion.bind(follower, { x: sx, y: sy })
let alternate = false,
  reduced = false
stage.addEventListener('pointermove', (event) => {
  const box = stage.getBoundingClientRect()
  x.set(Math.max(0, Math.min(260, event.clientX - box.left - 60)))
  y.set(Math.max(-50, Math.min(100, event.clientY - box.top - 100)))
})
const status = document.querySelector<HTMLElement>('#status')!
const card = document.querySelector<HTMLElement>('#card')!,
  parent = card.parentElement!
let feedback: ReturnType<typeof motion.press>, cardDrag: WebDrag
const mount = () => {
  parent.append(card)
  motion.set(card, { scale: 1.1 })
  feedback = motion.press(card)
  cardDrag = motion.drag(card, {
    bounds: { left: -120, right: 120, top: -45, bottom: 95 },
    snap: { x: [-100, 0, 100], y: [0] },
    spring: { stiffness: 180, damping: 19 },
  })
}
mount()
const actions: Record<string, () => void> = {
  retarget: () => {
    alternate = !alternate
    x.set(alternate ? 250 : 0)
    y.set(alternate ? 80 : 0)
    status.textContent = 'The same spring retains its velocity when its target changes.'
  },
  pause: () => {
    if (sx.paused) {
      sx.play()
      sy.play()
    } else {
      sx.pause()
      sy.pause()
    }
    status.textContent = sx.paused
      ? 'Follower paused. Its input can still move.'
      : 'Follower resumed from the held position and velocity.'
  },
  reduce: () => {
    reduced = !reduced
    motion.configure({ reducedMotion: reduced ? 'always' : 'never' })
    status.textContent = reduced
      ? 'Reduced motion: spring followers settle immediately. Drag still follows your pointer.'
      : 'Spring motion enabled.'
  },
  enter: () => {
    if (card.isConnected) {
      motion.set(card, { y: 70, opacity: 0 })
      motion.animate(card, { y: 0, opacity: 1 }, 'bouncy')
      status.textContent = 'Enter, press and drag use independent channels.'
    }
  },
  grow: () => {
    if (card.isConnected) {
      motion.animate(card, { scale: 1.2 }, 'snappy')
      status.textContent = 'Application base → 1.2; held press → 1.152; release → 1.2.'
    }
  },
  remove: () => {
    if (card.isConnected) {
      cardDrag.dispose()
      feedback.dispose()
      motion.release(card)
      card.remove()
      status.textContent = 'Surface removed. Its input and playback are disposed.'
    } else {
      mount()
      status.textContent =
        'New surface generation mounted; old handles cannot reclaim it.'
    }
  },
}
for (const [id, action] of Object.entries(actions))
  document.getElementById(id)!.addEventListener('click', action)
window.addEventListener('keydown', (event) => {
  if (event.key.toLowerCase() === 'g') actions.grow!()
})
window.addEventListener('pagehide', () => motion.dispose(), { once: true })
