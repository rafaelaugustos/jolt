import { createWebRuntime, type WebPress } from '../../src/web/public.js'
import { createWebRuntime as createInternalRuntime } from '../../src/web/runtime.js'

const button = document.querySelector<HTMLButtonElement>('#card')!
const status = document.querySelector<HTMLElement>('#status')!
const motion = createWebRuntime(document)
let feedback: WebPress
let clicks = 0
let base = 1.1
const render = (message: string) => {
  status.textContent = `${message}\nApplication scale: ${base.toFixed(1)} · Native clicks: ${clicks}`
}
const reset = () => {
  motion.release(button)
  button.disabled = false
  base = 1.1
  motion.set(button, { scale: base })
  feedback = motion.press(button)
  render('Hold the button, then press G to retarget the application.')
}
reset()
button.addEventListener('click', () => {
  clicks++
  render('Native button activation')
})
const displayedScale = () =>
  new DOMMatrix(getComputedStyle(button).transform).a.toFixed(3)
const showFeedback = () =>
  queueMicrotask(() => {
    const current = feedback,
      animation = current.animation
    if (!animation) return
    render(
      current.pressed
        ? 'Pressed · contribution 0.96'
        : 'Released · returning to application scale',
    )
    void animation.finished.then((done) => {
      if (done && feedback === current && current.animation === animation)
        render(
          `${current.pressed ? 'Pressed' : 'Released'} · visual scale ${displayedScale()}`,
        )
    })
  })
button.addEventListener('pointerdown', showFeedback)
button.addEventListener('pointerleave', showFeedback)
window.addEventListener('pointerup', showFeedback)
window.addEventListener('pointercancel', showFeedback)
for (const event of ['keydown', 'keyup'] as const)
  button.addEventListener(event, (e) => {
    if ([' ', 'Enter'].includes(e.key)) showFeedback()
  })
document.querySelector('#reset')!.addEventListener('click', reset)
window.addEventListener('keydown', (event) => {
  if (event.repeat) return
  if (event.key.toLowerCase() === 'g') {
    base = 1.2
    void motion.animate(button, { scale: base }, 'snappy').finished.then(() => {
      render(`Application retargeted · visual scale ${displayedScale()}`)
    })
  }
  if (event.key.toLowerCase() === 'd') {
    feedback.dispose()
    render('Feedback disposed · application scale preserved')
  }
  if (event.key.toLowerCase() === 'l') {
    feedback.update({ loading: true })
    render('Loading · feedback cancelled; app owns activation policy')
  }
})

const lab = {
  createWebRuntime: createInternalRuntime,
  createPublicRuntime: createWebRuntime,
}
declare global {
  var pressLab: typeof lab
}
globalThis.pressLab = lab
