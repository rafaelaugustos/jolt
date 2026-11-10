import { createWebRuntime } from '@rafaelaugusto/jolt/web'
import { createMotionInspector } from '@rafaelaugusto/jolt/web/inspector'
import { animate, press, createActions } from '@rafaelaugusto/jolt/web/svelte'
import { replaySensor } from '@rafaelaugusto/jolt/web/testing'

const runtime = createWebRuntime(document)
const owners = new Set()
const node = document.querySelector('[data-card]')
const inspector = createMotionInspector(document, runtime, {
  development: true,
  capacity: 32,
})
inspector.watch(node, 'card')
const samples = [
  { time: 0, values: [-1, 0, 0] },
  { time: 350, values: [1, 0, 0] },
  { time: 700, values: [-0.5, 0, 0] },
  { time: 1100, values: [0, 0, 0] },
]
let source, replay, drawing, binding
const plot = () => {
  document.querySelector('[data-plot]').innerHTML = inspector.plot('card', 'x')
}
function make(kind = 'acceleration', options = {}) {
  const source = runtime.sensor(kind, options),
    off = source.x.subscribe(() => {})
  owners.add(source)
  return { source, off }
}
function reset() {
  replay?.dispose()
  binding?.dispose()
  drawing?.dispose()
  source?.dispose()
  source = undefined
  replay = undefined
  binding = undefined
  drawing = undefined
}
document.querySelector('[data-replay]').onclick = () => {
  reset()
  inspector.clearSamples()
  source = runtime.sensor('acceleration', { reducedMotion: 'continue' })
  drawing = runtime.springValue(source.x.to([-1, 1], [-110, 110]), {
    stiffness: 180,
    damping: 26,
  })
  binding = runtime.bind(node, { x: drawing })
  replay = replaySensor(source, samples)
  document.querySelector('[data-status]').textContent =
    'Synthetic replay · m/s² · no physical sensor claim'
  inspector.sample('card', 'x', -110, 'start')
  plot()
  void replay.finished.then((completed) => {
    if (!completed) return
    inspector.sample('card', 'x', 0, 'complete')
    plot()
    document.querySelector('[data-status]').textContent =
      'Replay complete · last sample remains synthetic'
  })
}
document.querySelector('[data-pause]').onclick = () => {
  replay?.pause()
  inspector.sample('card', 'x', null, 'pause')
  plot()
}
document.querySelector('[data-resume]').onclick = () => {
  replay?.play()
  inspector.sample('card', 'x', null, 'play')
  plot()
}
document.querySelector('[data-sample]').onclick = () => {
  inspector.sample('card', 'x', null)
  plot()
}
document.querySelector('[data-interrupt]').onclick = () => {
  reset()
  runtime.animate(node, { x: 110 }, { duration: 700, ease: 'easeOut' })
  inspector.sample('card', 'x', 110, 'replace')
  plot()
}
document.querySelector('[data-dispose]').onclick = () => {
  reset()
  inspector.sample('card', 'x', null, 'stop')
  plot()
  document.querySelector('[data-status]').textContent =
    'Replay and sensor resources disposed'
}
document.querySelector('[data-preset]').onclick = () => {
  reset()
  runtime.set(node, { x: 0, y: 0, scale: 1, opacity: 1 })
  runtime.animate(node, 'popIn')
  document.querySelector('[data-status]').textContent =
    'Shared popIn recipe · CSS pixels and browser execution'
}
window.tools = {
  animate,
  press,
  createActions,
  runtime,
  inspector,
  node,
  make,
  replaySensor,
  samples,
  reset,
  dispose() {
    reset()
    for (const source of owners) source.dispose()
    inspector.dispose()
    runtime.dispose()
  },
  event(x) {
    const e = new Event('devicemotion')
    Object.defineProperties(e, {
      accelerationIncludingGravity: { value: { x, y: 0, z: 0 } },
      acceleration: { value: { x: 0, y: 0, z: 0 } },
      rotationRate: { value: { alpha: 0, beta: 0, gamma: 0 } },
    })
    window.dispatchEvent(e)
  },
}
