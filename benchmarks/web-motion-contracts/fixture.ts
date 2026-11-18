import {
  createWebRuntime,
  gestureRelations,
  type GestureRelations,
  type WebGestures,
  type WebBottomSheet,
  type WebZoomable,
  type WebReorder,
  type WebPress,
} from '../../src/web/public.js'
const stage = document.querySelector<HTMLElement>('#stage')!,
  status = document.querySelector<HTMLElement>('#status')!
const element = (id: string) => document.getElementById(id)!
let runtime = createWebRuntime(document, { reducedMotion: 'never' })
let relations: GestureRelations | undefined
let outer: WebGestures | undefined,
  inner: WebGestures | undefined,
  sheet: WebBottomSheet | undefined,
  photo: WebZoomable | undefined,
  reorder: WebReorder<string> | undefined,
  press: WebPress | undefined
let source: ReturnType<typeof runtime.motionValue> | undefined,
  spring: ReturnType<typeof runtime.springValue> | undefined
let derivative: ReturnType<NonNullable<typeof spring>['mul']> | undefined,
  velocity: ReturnType<NonNullable<typeof derivative>['velocity']> | undefined
const log: string[] = []
let tick = 0
function record(name: string) {
  log.push(name)
  status.textContent = log.slice(-5).join(' → ')
}
const frame = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  )
async function setup(mode: string) {
  cancelAnimationFrame(tick)
  relations?.dispose()
  relations = undefined
  runtime.dispose()
  runtime = createWebRuntime(document, { reducedMotion: 'never' })
  outer = inner = undefined
  sheet = photo = reorder = press = undefined
  source = spring = derivative = velocity = undefined
  log.length = 0
  status.textContent = 'Ready · drag the purple surface'
  stage.innerHTML =
    '<div id="outer">Outer surface<div id="inner">Inner surface</div></div>'
  if (mode === 'inner' || mode === 'outer') {
    outer = runtime.gestures(element('outer'), {
      pan: { axis: mode === 'inner' ? 'y' : 'x' },
      onStart: () => record('outer start'),
      onCancel: () => record('outer cancel'),
      onEnd: () => record('outer end'),
    })
    inner = runtime.gestures(element('inner'), {
      pan: { axis: mode === 'inner' ? 'x' : 'y' },
      onStart: () => record('inner start'),
      onCancel: () => record('inner cancel'),
      onEnd: () => record('inner end'),
    })
    runtime.bind(element('outer'), { x: outer.x, y: outer.y })
    runtime.bind(element('inner'), { x: inner.x, y: inner.y })
    relations = gestureRelations([
      {
        gesture: mode === 'inner' ? inner : outer,
        other: mode === 'inner' ? outer : inner,
        relation: 'waitFor',
      },
    ])
    element('inner').textContent =
      mode === 'inner'
        ? 'Drag horizontally · inner waits for outer failure'
        : 'Drag horizontally · outer waits for inner failure'
  } else if (mode === 'press') {
    element('outer').textContent = ''
    element('outer').innerHTML = '<div id="inner">Press, then pan the carousel</div>'
    press = runtime.press(element('inner'), { scale: 0.9 })
    outer = runtime.gestures(element('outer'), {
      pan: { axis: 'x' },
      onStart: () => record('carousel start'),
      onEnd: () => record('carousel end'),
      onCancel: () => record('carousel cancel'),
    })
    runtime.bind(element('outer'), { x: outer.x })
    relations = gestureRelations([{ gesture: outer, other: press, relation: 'block' }])
  } else if (mode === 'photo') {
    stage.innerHTML =
      '<div id="panel"><div id="grip">Photo inside a sheet · pinch wins</div><div id="photo-space"><img id="photo" alt="Jolt mountain landscape"></div></div>'
    const img = element('photo') as HTMLImageElement
    img.src =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="500"><rect width="1000" height="500" fill="#315c91"/><circle cx="750" cy="100" r="60" fill="#ffd286"/><path d="M0 500L260 80 550 500M400 500L740 160 1000 500" fill="#8db6b5"/><text x="40" y="70" fill="white" font-size="40">Explore with Jolt</text></svg>',
      )
    await img.decode()
    sheet = runtime.bottomSheet(element('panel'), {
      host: stage,
      handle: element('grip'),
      snap: [180, 400],
      dismissible: false,
      keyboard: 'none',
    })
    photo = runtime.zoomable(img, { viewport: element('photo-space'), dismiss: false })
    await frame()
    relations = gestureRelations([
      { gesture: sheet, other: photo, relation: 'waitFor', otherKind: 'pan' },
      { gesture: photo, kind: 'pinch', other: sheet, relation: 'block' },
    ])
    sheet.open(400)
    status.textContent = 'At 1×: drag moves the sheet. Pinch: photo wins.'
  } else if (mode === 'reorder') {
    stage.innerHTML = '<div id="list"></div>'
    const list = element('list'),
      order = ['Alpha', 'Bravo', 'Charlie', 'Delta', 'Echo']
    for (const name of order) {
      const row = document.createElement('div')
      row.className = 'row'
      row.id = name
      row.textContent = name + ' · swipe or hold to reorder'
      list.append(row)
    }
    reorder = runtime.reorder(list, {
      items: () =>
        [...list.children].map((row) => ({ key: row.id, target: row as HTMLElement })),
      longPress: 350,
      onStart: () => record('reorder start'),
      onCancel: (event) => record('reorder cancel:' + event.reason),
      onCommit(move) {
        list.insertBefore(
          element(move.key),
          move.beforeKey ? element(move.beforeKey) : null,
        )
        record('reorder commit')
      },
    })
    inner = runtime.gestures(element('Alpha'), {
      pan: { axis: 'x' },
      onStart: () => record('swipe start'),
      onEnd: () => record('swipe end'),
      onCancel: () => record('swipe cancel'),
    })
    runtime.bind(element('Alpha'), { x: inner.x })
    relations = gestureRelations([
      { gesture: inner, other: reorder, relation: 'waitFor' },
    ])
  } else if (mode === 'velocity') {
    stage.innerHTML =
      '<div style="padding:24px"><button id="launch">Move</button> <button id="pause">Pause</button> <button id="resume">Resume</button> <button id="stop">Stop</button></div><div class="dot" id="dot"></div><div class="metrics" id="metrics"></div>'
    source = runtime.motionValue(0)
    spring = runtime.springValue(source, { stiffness: 15, damping: 1.2 })
    derivative = spring.mul(2)
    velocity = derivative.velocity()
    runtime.bind(element('dot'), { x: spring })
    element('launch').onclick = () => source!.set(source!.get() ? 0 : 500)
    element('pause').onclick = () => {
      spring!.pause()
      record('Paused · derivative is zero')
    }
    element('resume').onclick = () => {
      spring!.play()
      record('Resumed · momentum retained')
    }
    element('stop').onclick = () => {
      spring!.stop()
      record('Stopped')
    }
    const update = () => {
      element('metrics').textContent =
        `position ${spring!.get().toFixed(1)} · velocity ${spring!.getVelocity().toFixed(1)}\nscaled derivative ${velocity!.get().toFixed(1)}`
      tick = requestAnimationFrame(update)
    }
    update()
    status.textContent = 'Pause publishes zero velocity; resume retains momentum.'
  }
}
for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-mode]'))
  button.onclick = () => void setup(button.dataset.mode!)
export const demo = {
  setup,
  frame,
  dispose: () => {
    cancelAnimationFrame(tick)
    relations?.dispose()
    runtime.dispose()
  },
  snapshot: () => ({
    log: [...log],
    outer: outer?.position,
    inner: inner?.position,
    pressed: press?.pressed,
    photo: photo?.state,
    height: sheet?.visibleHeight,
    activeKey: reorder?.activeKey,
    order: [...(document.querySelector('#list')?.children ?? [])].map((node) => node.id),
    spring: spring?.get(),
    speed: spring?.getVelocity(),
    derivative: velocity?.get(),
  }),
}
Object.assign(window, { demo })
void setup('inner')
