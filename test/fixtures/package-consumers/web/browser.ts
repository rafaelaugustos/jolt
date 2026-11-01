import {
  createWebRuntime,
  type WebAnimation,
  type WebRuntime,
} from '@rafaelaugusto/jolt/web'

const surface = document.getElementById('card')!
const motion: WebRuntime = createWebRuntime(document, { reducedMotion: 'never' })
const animation: WebAnimation = motion.animate(
  surface,
  { x: [0, 100], opacity: [0.5, 1] },
  { duration: 150, ease: 'linear' },
)
const result = document.getElementById('result')!
void animation.finished.then((completed) => {
  const matrix = new DOMMatrix(getComputedStyle(surface).transform)
  result.textContent = JSON.stringify({
    completed,
    x: matrix.e,
    opacity: Number(getComputedStyle(surface).opacity),
    methods: Object.keys(motion).sort(),
  })
  motion.set(surface, { scale: 1.1 })
  const feedback = motion.press(surface, { scale: 0.96 })
  feedback.update({ loading: false })
  window.addEventListener('pagehide', () => motion.dispose(), { once: true })
})

// Check the experimental facade without publishing implementation/driver APIs.
function typeBoundary(context: WebRuntime) {
  // @ts-expect-error Diagnostics are internal, not part of the package API.
  context.inspect(surface)
  // @ts-expect-error Native-only properties are not Web capabilities.
  context.animate(surface, { rotateX: 20 })
  // @ts-expect-error A target must be an actual HTMLElement.
  context.animate({ nativeView: {} }, { x: 10 })
}
void typeBoundary
