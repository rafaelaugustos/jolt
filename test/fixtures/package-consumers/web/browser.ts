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
  // @ts-expect-error Stroke drawing requires SVG geometry, not an HTML surface.
  context.drawPath(surface)
  const readonly = context.motionValue(0).to([0, 1], [0, 100])
  // @ts-expect-error Derived values are readonly.
  readonly.set(1)
  // @ts-expect-error Derived inputs cannot be animated as mutable motion values.
  context.animate(readonly, 1)
  const states = context.motionStates({ card: surface }, { open: { card: { x: 20 } } })
  states.to('open', { card: { duration: 100, ease: 'linear' } })
  // @ts-expect-error Named state inference excludes undeclared states.
  states.to('closed')
  // @ts-expect-error Only declared surface slots may attach.
  states.attach('badge', surface)
  // @ts-expect-error State endpoints cannot be keyframe arrays.
  context.motionStates({ card: surface }, { open: { card: { x: [0, 100] } } })
  // @ts-expect-error Timeline factories must return playable animation handles.
  context.timeline([() => context.sequence([])])
  // @ts-expect-error Scroll requires explicit numeric keyframes.
  context.scrollLinked(document, surface, { x: 20 }, { range: [0, 100] })
}
void typeBoundary

document.getElementById('lifecycle')!.addEventListener('click', async () => {
  const diagnostics = motion.diagnostics({ development: true })
  const owner = motion.scope()
  const region = document.createElement('div'),
    probe = document.createElement('div')
  region.style.cssText = 'width:200px;height:80px'
  probe.style.cssText = 'width:40px;height:40px;background:orange'
  region.append(probe)
  document.body.append(region)
  const pointer = owner.pointerFollow(region, { spring: false })
  owner.bind(probe, { x: pointer.x })
  const entrance = owner.viewportEnter(probe, {
    keyframes: { opacity: [1, 1] },
    transition: { duration: 10 },
  })
  entrance.dispose()
  const shared = owner.sharedLayout(region, { transition: { duration: 40 } })
  shared.attach(probe, 'probe')
  const result = await shared.transition(() => {
    probe.style.marginLeft = '80px'
  }).finished
  owner.dispose()
  motion.release(probe)
  region.remove()
  document.getElementById('lifecycle-result')!.textContent =
    `${result.status}:${diagnostics.snapshot().resources.scopes}`
  diagnostics.dispose()
})

const input = motion.motionValue(0)
const follower = motion.springValue(input.to([0, 100], [0, 100]), {
  stiffness: 200,
  damping: 26,
})
const dynamic = document.getElementById('dynamic-card')!
const binding = motion.bind(dynamic, { x: follower })
const geometry = motion.observeGeometry(dynamic)
motion.refresh(dynamic)
const itemOwner = motion.scope()
const item = document.createElement('button')
document.body.append(item)
const collection = itemOwner.animateItems([{ key: 'first', target: item }], 'fadeInUp', {
  once: true,
})
collection.update([{ key: 'replacement', target: item }])
collection.forget('replacement')
itemOwner.dispose()
if (!collection.disposed) throw new Error('Packed collection scope leaked')
motion.release(item)
item.remove()
const horizontal = motion.scrollValue(document, { axis: 'x' })
horizontal.refresh()
horizontal.dispose()
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

document.getElementById('orchestration')!.addEventListener('click', async () => {
  const scope = motion.scope(),
    probe = document.createElement('div')
  probe.style.cssText = 'width:60px;height:60px;background:gold'
  document.body.append(probe)
  const value = scope.motionValue(0)
  scope.bind(probe, { x: value })
  const valueAnimation = scope.animate(value, [0, 40, 80], {
    duration: 100,
    ease: 'linear',
  })
  const progress = scope.playbackProgress(valueAnimation)
  const sequence = scope.sequence([
    () => valueAnimation,
    () => scope.decay(probe, { y: 100 }, { snap: [30] }),
  ])
  const sequenceDone = await sequence.finished
  const states = scope.motionStates(
    { card: probe },
    { open: { card: { scale: 1.2 } }, closed: { card: { scale: 1 } } },
    { transition: { duration: 40 } },
  )
  const group = scope.timeline([
    { at: 0, run: () => scope.animate(probe, { opacity: 1 }, { duration: 40 }) },
    [value, 80, { duration: 0 }],
  ])
  group.pause()
  group.play()
  const groupDone = await group.finished
  const stateDone = await states.to('open').finished
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const path = document.createElementNS(svg.namespaceURI, 'path') as SVGPathElement
  path.setAttribute('d', 'M0 0 L100 50')
  path.setAttribute('stroke', 'red')
  svg.append(path)
  document.body.append(svg)
  const drawing = scope.drawPath(path, { progress: 0 })
  const strokeDone = await drawing.animate(1, { duration: 40 }).finished
  document.getElementById('orchestration-result')!.textContent =
    `${sequenceDone}:${groupDone}:${stateDone}:${value.get()}:${progress.get()}:${strokeDone}`
  scope.dispose()
  svg.remove()
  motion.release(probe)
  probe.remove()
})

const interactionButton = document.createElement('button')
interactionButton.id = 'interactions'
interactionButton.textContent = 'Gestures, zoom, header and reorder'
const interactionResult = document.createElement('output')
interactionResult.id = 'interactions-result'
document.body.append(interactionButton, interactionResult)
interactionButton.onclick = async () => {
  const owner = motion.scope(),
    region = document.createElement('div')
  region.style.cssText = 'position:relative;width:300px;height:200px;overflow:auto'
  document.body.append(region)
  try {
    const value = owner.motionValue(0)
    const drag = owner.drag(region, {
      axis: 'x',
      value,
      release: 'decay',
      rubberband: true,
    })
    drag.pause()
    drag.play()
    drag.dispose()
    const gesture = owner.gestures(region, { pan: true, pinch: true, rotate: true })
    gesture.jumpTo({ x: 25, scale: 1.2 })
    gesture.pause()
    gesture.play()
    const gesturesWork = gesture.position.x === 25 && gesture.position.scale === 1.2
    gesture.dispose()
    const image = document.createElement('img')
    image.style.cssText = 'display:block;width:100%;height:100%;object-fit:contain'
    image.src =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="blue"/></svg>',
      )
    region.append(image)
    await image.decode()
    const zoom = owner.zoomable(image)
    zoom.zoomTo(2, undefined, false)
    const zoomWorks = zoom.ready && zoom.state.scale === 2
    zoom.dispose()
    image.remove()
    const heading = document.createElement('div')
    heading.style.cssText = 'position:absolute;height:100px;width:200px'
    region.append(heading)
    const header = owner.scrollHeader(region, {
      header: heading,
      expanded: 100,
      minimum: 40,
    })
    const headerWorks = header.geometry.range === 60
    header.dispose()
    heading.remove()
    let keys = ['one', 'two', 'three']
    for (const key of keys) {
      const row = document.createElement('div')
      row.dataset.key = key
      row.style.cssText = 'height:40px'
      row.textContent = key
      region.append(row)
    }
    const reorder = owner.reorder(region, {
      items: () =>
        keys.map((key) => ({
          key,
          target: region.querySelector<HTMLElement>(`[data-key="${key}"]`)!,
        })),
      onCommit(move) {
        keys.splice(move.fromIndex, 1)
        keys.splice(move.toIndex, 0, move.key)
        for (const key of keys)
          region.append(region.querySelector(`[data-key="${key}"]`)!)
      },
    })
    const moved = reorder.moveDown('one')
    owner.dispose()
    interactionResult.textContent = String(
      gesturesWork &&
        zoomWorks &&
        headerWorks &&
        moved &&
        keys[1] === 'one' &&
        value.disposed,
    )
  } finally {
    owner.dispose()
    region.remove()
  }
}

// Exercise the exported types and actual packed runtime for the visual effects.
document.getElementById('effects')!.onclick = async () => {
  const target = document.getElementById('effect-card')!
  const scope = motion.scope()
  const color = scope.motionValue(0).to([0, 1], ['red', 'blue'])
  const gradient = scope.gradient(target, { type: 'radial', colors: [color, 'white'] })
  const paint = await gradient.animate({ radius: 0.8 }, { duration: 50 })
  const shimmer = scope.shimmer(target)
  const loader = scope.loader(target, { style: 'ring' })
  shimmer.pause()
  shimmer.play()
  loader.pause()
  loader.play()
  shimmer()
  loader.dispose()
  const hidden = await scope.conceal(target, { duration: 30 })
  const shown = await scope.reveal(target, { duration: 30 })
  const text = await scope.animateText(target, { duration: 30, stagger: 1 })
  const roll = await scope.rollTo(target, 123, { duration: 30 })
  scope.dispose()
  document.getElementById('effects-result')!.textContent =
    `${paint && hidden && shown && text && roll}:${target.querySelectorAll('[data-jolt-effect]').length}:${target.textContent}`
}
