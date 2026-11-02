import { createWebRuntime, type WebRuntime } from '../../src/web/runtime.js'
import type { WebReadableValue, WebMotionValue, WebBinding } from '../../src/web/value.js'
import type { WebScrollLink, WebScrollValue } from '../../src/web/scroll.js'
import type { PlaybackAnimation } from '../../src/web/types.js'
const makeTarget = () => {
  const element = document.createElement('button')
  element.className = 'test-target'
  element.textContent = 'Target'
  document.body.append(element)
  return element
}
const makeSource = () => {
  const element = document.createElement('div')
  element.className = 'test-source'
  element.tabIndex = 0
  const content = document.createElement('div')
  content.className = 'test-content'
  element.append(content)
  document.body.append(element)
  return element
}
declare global {
  var rt: WebRuntime
  var target: HTMLElement
  var source: HTMLElement
  var value: WebMotionValue
  var mapped: WebReadableValue
  var linked: WebScrollLink
  var scrollInput: WebScrollValue
  var animation: PlaybackAnimation
  var lease: WebBinding
  var lab: {
    createWebRuntime: typeof createWebRuntime
    makeTarget: typeof makeTarget
    makeSource: typeof makeSource
  }
}
Object.assign(window, { lab: { createWebRuntime, makeTarget, makeSource } })
if (!location.search.includes('test')) {
  const motion = createWebRuntime(document, { reducedMotion: 'never' })
  const card = document.querySelector<HTMLElement>('#mapped')!
  const input = motion.motionValue(35),
    follower = motion.springValue(input, { stiffness: 150, damping: 20 })
  motion.bind(card, {
    x: follower.to([0, 100], [0, 160]),
    scale: follower.to([0, 100], [0.8, 1.2]),
    opacity: follower.to([0, 100], [0.4, 1]),
  })
  motion.press(card)
  motion.observeGeometry(card)
  const slider = document.querySelector<HTMLInputElement>('#progress')!
  slider.addEventListener('input', () => input.set(Number(slider.value)))
  let large = false
  document.querySelector('#resize')!.addEventListener('click', () => {
    large = !large
    card.textContent = large ? 'A longer responsive label' : 'Hold me'
    card.style.width = large ? '190px' : '120px'
    document.querySelector('#status')!.textContent =
      'The same mapped values and press survive the new surface size.'
  })
  document.querySelector('#retarget')!.addEventListener('click', () => {
    input.set(input.get() > 50 ? 15 : 85)
    slider.value = String(input.get())
  })
  const scroll = motion.scrollLinked(
    document.querySelector<HTMLElement>('#scroller')!,
    document.querySelector<HTMLElement>('#scroll-card')!,
    { x: [0, 120], rotate: [0, 12], scale: [1, 1.12], opacity: [1, 0.55] },
    { range: [0, 600] },
  )
  motion.press(document.querySelector<HTMLElement>('#scroll-card')!)
  document.querySelector('#cleanup')!.addEventListener('click', () => {
    motion.dispose()
    document.querySelector('#status')!.textContent =
      'Disposed: values, effects, geometry observers and scroll listeners released.'
  })
  document.querySelector('#scroller')!.addEventListener(
    'scroll',
    () => {
      document.querySelector('#status')!.textContent =
        `Scroll playback: ${scroll.execution}. Reverse the scroll to reverse the motion.`
    },
    { passive: true },
  )
  window.addEventListener('pagehide', () => motion.dispose(), { once: true })
}
