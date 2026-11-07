import { createApp, defineComponent, h, KeepAlive, nextTick, ref } from 'vue'
import {
  createWebRuntime,
  cubicBezier,
  origamiSpring,
  springs,
  presets,
} from '../../src/web/public.js'
import { useShape, useReducedMotion } from '../../src/web/vue/index.js'
import { companionRig } from '../../demo/src/composition-recipe.js'

const runtime = createWebRuntime(document, { reducedMotion: 'never' })
export function button(container: string, label: string, action: () => unknown) {
  const b = document.createElement('button')
  b.textContent = label
  b.onclick = () => {
    void action()
  }
  document.querySelector(container)!.append(b)
  return b
}
const shown = ref(true),
  generation = ref(0),
  created: ReturnType<typeof useShape>[] = []
let drawing: ReturnType<typeof useShape>
const Child = defineComponent({
  setup() {
    const localDrawing = useShape(
      {
        d: 'M15 65 C15 10 85 10 85 65 L50 90 Z',
        viewBox: [0, 0, 100, 100],
        stroke: '#b9a7ff',
        fill: '#4e3d77',
        strokeWidth: 3,
      },
      { runtime },
    )
    drawing = localDrawing
    created.push(localDrawing)
    return () =>
      h('div', {
        class: 'shape-host',
        ref: localDrawing.ref,
        'aria-label': 'Retained drawing',
      })
  },
})
const app = createApp({
  render: () =>
    h(KeepAlive, null, {
      default: () =>
        shown.value ? h(Child, { key: generation.value }) : h('span', 'Component cached'),
    }),
})
app.mount('#vue-stage')
const lifecycle = {
  get drawing() {
    return drawing!.current
  },
  get created() {
    return created.length
  },
  async cache() {
    shown.value = !shown.value
    await nextTick()
    report()
  },
  async replace() {
    generation.value++
    await nextTick()
    report()
  },
  unmount() {
    app.unmount()
    report()
  },
  draw() {
    const s = drawing!.current!
    s.set({ strokeEnd: 0 })
    return s.animate({ strokeEnd: 1 }, { duration: 2200, ease: 'linear' })
  },
  pause() {
    drawing!.current?.suspend()
    report()
  },
  resume() {
    drawing!.current?.resume()
    report()
  },
}
function report() {
  document.querySelector('#lifecycle-status')!.textContent =
    `Created: ${created.length} · ${drawing?.current ? (shown.value ? (drawing.current.suspended ? 'Paused' : 'Visible') : 'Cached') : 'Disposed'}`
}
for (const [label, action] of [
  ['Draw', lifecycle.draw],
  ['Pause', lifecycle.pause],
  ['Resume', lifecycle.resume],
  ['Cache / restore', lifecycle.cache],
  ['Replace', lifecycle.replace],
  ['Unmount', lifecycle.unmount],
] as const)
  button('#lifecycle-controls', label, action)
report()

const card = document.querySelector<HTMLElement>('#behavior-card')!
const behavior = runtime.motionBehaviors(
  {
    rest: {
      priority: -1,
      run: async ({ scope, wait }) => {
        await wait(
          scope.animate(card, { x: 0, rotate: 0, scale: 1 }, { duration: 600 }).finished,
        )
      },
    },
    touch: {
      run: async ({ scope, wait }) => {
        await wait(
          scope.animate(card, { x: -100, rotate: -25 }, { duration: 2200 }).finished,
        )
      },
    },
    dress: {
      priority: 2,
      run: async ({ scope, wait }) => {
        await wait(
          scope.animate(card, { x: 100, rotate: 25 }, { duration: 1800 }).finished,
        )
      },
    },
    eat: {
      priority: 3,
      blocks: ['touch', 'dress'],
      run: async ({ scope, wait }) => {
        await wait(
          scope.animate(card, { x: 0, scale: 1.35, rotate: 0 }, { duration: 2200 })
            .finished,
        )
      },
    },
  },
  { rest: 'rest' },
)
for (const name of ['touch', 'dress', 'eat'] as const)
  button('#behavior-controls', name[0]!.toUpperCase() + name.slice(1), () => {
    const run = behavior.request(name)
    document.querySelector('#behavior-status')!.textContent =
      `Requested ${name} · active: ${behavior.current ?? 'rest'}`
    void run.finished.then((result) => {
      document.querySelector('#behavior-status')!.textContent =
        `${name}: ${result.status} · active: ${behavior.current ?? 'rest'}`
    })
  })
button('#behavior-controls', 'Pause', () => behavior.pause())
button('#behavior-controls', 'Resume', () => behavior.play())
button('#behavior-controls', 'Cancel', () => behavior.cancel())
const textTarget = document.querySelector<HTMLElement>('#gradient-title')!
textTarget.textContent = 'A little more wonder'
const text = runtime.gradientText(textTarget, {
  colors: ['#b5a4ff', '#58dce4', '#f7a4d9'],
  angle: 10,
  sheen: { width: 0.3 },
})
button('#text-controls', 'Shine', () => text.play({ duration: 2000, ease: 'linear' }))
button('#text-controls', 'Pause', () => text.suspend())
button('#text-controls', 'Resume', () => text.resume())
button('#text-controls', 'Stop', () => text.stop())
button('#text-controls', 'Replace text', () => {
  textTarget.textContent =
    textTarget.textContent === 'A little more wonder'
      ? 'Made to move, together'
      : 'A little more wonder'
  text.refresh()
})
const preferenceApp = createApp({
  setup() {
    const reduced = useReducedMotion(runtime)
    return () => h('span', `Effective reduced motion: ${reduced.value ? 'on' : 'off'}`)
  },
})
preferenceApp.mount('#preference-status')
button('#preference-controls', 'Follow system', () =>
  runtime.configure({ reducedMotion: 'user' }),
)
button('#preference-controls', 'Reduce motion', () =>
  runtime.configure({ reducedMotion: 'always' }),
)
button('#preference-controls', 'Full motion', () =>
  runtime.configure({ reducedMotion: 'never' }),
)
button('#preference-controls', 'Animate', () =>
  runtime.animate(
    document.querySelector<HTMLElement>('#preference-card')!,
    { x: [-120, 120, 0], rotate: [-20, 20, 0] },
    { duration: 1800, ease: cubicBezier(0.25, 0.1, 0.25, 1) },
  ),
)
const rigTargets = Object.fromEntries(
  ['body', 'head', 'hand'].map((name) => [
    name,
    document.querySelector<HTMLElement>(`#rig-${name}`)!,
  ]),
)
const rig = runtime.rig2d(companionRig, rigTargets)
const flower = document.querySelector<HTMLElement>('#rig-flower')!
rig.accessory('grip', flower)
for (const pose of ['wave', 'reach', 'rest'])
  button('#rig-controls', pose[0]!.toUpperCase() + pose.slice(1), () => {
    const animation = rig.to(pose, 'bouncy')
    document.querySelector('#rig-status')!.textContent = `Pose: ${pose}`
    return animation
  })
button('#rig-controls', 'Blend', () =>
  rig.blend(
    [
      { pose: 'wave', weight: 0.5 },
      { pose: 'reach', weight: 0.5 },
    ],
    { duration: 1000 },
  ),
)
button('#rig-controls', 'Pause', () => rig.pause())
button('#rig-controls', 'Resume', () => rig.play())
let flowerAttached = true
button('#rig-controls', 'Attach / detach flower', () => {
  flowerAttached = !flowerAttached
  rig.accessory('grip', flowerAttached ? flower : null)
  document.querySelector('#rig-status')!.textContent = flowerAttached
    ? 'Flower attached'
    : 'Flower detached'
})
const vectorScope = runtime.scope()
let vector: ReturnType<typeof runtime.sensor> | undefined
let vectorOff: (() => void) | undefined
const vectorOutput = document.querySelector<HTMLOutputElement>('#sensor-status')!
const vectorCard = document.querySelector<HTMLElement>('#sensor-card')!
let vectorBinding: { dispose(): void } | undefined
const sensorReport = () => {
  if (vector) {
    const state = vector.snapshot()
    vectorOutput.textContent = `${vector.kind} · ${state.status} · ${state.samples} samples · [${state.values.map((n) => n.toFixed(2)).join(', ')}] ${state.unit}${state.reason ? ' · ' + state.reason : ''}`
  }
}
const selectVector = (
  kind: 'acceleration' | 'linearAcceleration' | 'gyroscope' | 'magneticField',
) => {
  vectorScope.reset()
  vectorOff?.()
  vector?.dispose()
  vector = vectorScope.sensor(kind, {
    coordinates: 'device',
    onStatus: () => queueMicrotask(sensorReport),
  })
  vectorBinding = vectorScope.bind(vectorCard, {
    rotate: vectorScope.map(vector.z, [-4, 4], [-60, 60]),
  })
  vectorOff = vector.z.subscribe(sensorReport)
  sensorReport()
}
button('#sensor-controls', 'Enable real sensor', () => {
  selectVector('gyroscope')
  return vector!.requestPermission()
})
button('#sensor-controls', 'Use injected events', () => {
  Object.defineProperty(window, 'DeviceMotionEvent', {
    configurable: true,
    value: function () {},
  })
  document.querySelector('#sensor-caption')!.textContent =
    'Injected DeviceMotion events · contract demonstration · no hardware measurement'
  selectVector('gyroscope')
})
let sample = 0
button('#sensor-controls', 'Inject sample', () => {
  const sign = ++sample % 2 ? 1 : -1
  window.dispatchEvent(
    Object.assign(new Event('devicemotion'), {
      accelerationIncludingGravity: { x: sign * 2, y: 0, z: 9.8 },
      acceleration: { x: sign * 2, y: 0, z: sign * 3 },
      rotationRate: { alpha: sign * 180, beta: 90, gamma: 0 },
    }),
  )
  sensorReport()
})
for (const kind of [
  'acceleration',
  'linearAcceleration',
  'gyroscope',
  'magneticField',
] as const)
  button('#sensor-controls', kind, () => selectVector(kind))
button('#sensor-controls', 'Pause', () => {
  vector?.pause()
  sensorReport()
})
button('#sensor-controls', 'Resume', () => {
  vector?.play()
  sensorReport()
})
button('#sensor-controls', 'Dispose', () => {
  vectorBinding?.dispose()
  vectorOff?.()
  vector?.dispose()
  sensorReport()
})
const api = {
  runtime,
  lifecycle,
  behavior,
  card,
  created,
  text,
  textTarget,
  preferenceApp,
  rig,
  rigTargets,
  flower,
  helpers: { createWebRuntime, cubicBezier, origamiSpring, springs, presets },
}
declare global {
  interface Window {
    composition: typeof api
  }
}
window.composition = api
const scene = new URL(location.href).searchParams.get('scene')
if (scene && scene !== 'rig') rig.dispose()
if (scene)
  document
    .querySelectorAll<HTMLElement>('[data-scene]')
    .forEach((el) => el.classList.toggle('hidden', el.dataset.scene !== scene))
