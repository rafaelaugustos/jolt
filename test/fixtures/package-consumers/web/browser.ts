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
  const readonly = context.motionValue(0).to([0, 1], [0, 100])
  // @ts-expect-error Derived values are readonly.
  readonly.set(1)
  // @ts-expect-error Scroll requires explicit numeric keyframes.
  context.scrollLinked(document, surface, { x: 20 }, { range: [0, 100] })
}
void typeBoundary

const input = motion.motionValue(0)
const follower = motion.springValue(input.to([0, 100], [0, 100]), {
  stiffness: 200,
  damping: 26,
})
const dynamic = document.getElementById('dynamic-card')!
const binding = motion.bind(dynamic, { x: follower })
const geometry = motion.observeGeometry(dynamic)
motion.refresh(dynamic)
const scroll = motion.scrollValue(document)
const progress = scroll.to([0, 500], [0, 1])
scroll.refresh()
if (!Number.isFinite(progress.get())) throw new Error('Invalid packed scroll value')
scroll.dispose()
const scrollProbe = document.createElement('div')
document.body.append(scrollProbe)
const linked = motion.scrollLinked(
  document,
  scrollProbe,
  { opacity: [0, 1] },
  { range: [0, 500] },
)
linked.refresh()
linked.dispose()
motion.release(scrollProbe)
scrollProbe.remove()
let drag: ReturnType<typeof motion.drag> | undefined
const dynamicResult = document.getElementById('dynamic-result')!
document.getElementById('dynamic')!.addEventListener('click', () => {
  input.set(40)
  const stop = follower.subscribe((value) => {
    if (Math.abs(value - 40) > 0.001 || follower.moving) return
    stop()
    binding.dispose()
    drag = motion.drag(dynamic, { axis: 'x', snap: { x: [100] } })
    dynamicResult.textContent = 'ready'
  })
})
document.getElementById('dynamic-dispose')!.addEventListener('click', () => {
  drag?.dispose()
  geometry.dispose()
  motion.release(dynamic)
  input.dispose()
  follower.dispose()
  dynamicResult.textContent = 'disposed'
})

document.getElementById('visual')!.addEventListener('click', async () => {
  const group = document.getElementById('visual-group')!
  const first = group.firstElementChild as HTMLElement
  const value = motion.motionValue(0)
  const color = value.to([0, 1], ['#ff0000', '#0000ff'])
  const live = motion.bind(first, { backgroundColor: color })
  const scene = motion.seekableTimeline(
    [
      { value, keyframes: [0, 1], transition: { duration: 100, ease: 'linear' } },
      {
        target: first,
        keyframes: {
          borderTopLeftRadius: ['0px', '24px 12px'],
          borderRightWidth: [0, 8],
        },
        transition: { duration: 100 },
      },
    ],
    { paused: true },
  )
  scene.progress = 1
  scene.play()
  const completed = await scene.finished
  const sized = await motion.animateSize(
    first,
    { width: 180, height: 'auto' },
    { duration: 50 },
  ).finished
  const layout = await motion.animateLayout(group, () => group.append(first), {
    duration: 60,
  }).finished
  document.getElementById('visual-result')!.textContent = JSON.stringify({
    completed,
    sized,
    layout,
    color: getComputedStyle(first).backgroundColor,
    radius: getComputedStyle(first).borderTopLeftRadius,
    width: first.style.width,
    value: value.get(),
  })
  live.dispose()
  color.dispose()
  value.dispose()
  motion.release(first)
})
