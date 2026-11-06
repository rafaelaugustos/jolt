import { animate } from '../src/animate.js'
import { configure } from '../src/config.js'
import { setDriver, type Driver } from '../src/driver/index.js'
import type { Track } from '../src/track.js'
import { View } from '../test/shims/core.js'
import type { View as NativeView } from '@nativescript/core'
import { setImmediate } from 'node:timers/promises'

type Handle = { track: Track; done: () => void }
const tracks: WeakRef<Track>[] = []
const views: WeakRef<NativeView>[] = []
const active = new Set<Handle>()
const driver: Driver = {
  now: () => 1000,
  frame: () => () => {},
  after: () => () => {},
  play(_view, track, _start, done) {
    tracks.push(new WeakRef(track))
    const handle = { track, done }
    active.add(handle)
    return handle
  },
  stop(_view, value) {
    const handle = value as Handle
    active.delete(handle)
    handle.done()
  },
  presented: () => undefined,
}
setDriver(driver)
configure({ reducedMotion: 'never', timeScale: 1 })
const retained: ReturnType<typeof animate>[] = []
async function collect() {
  // WeakRefs keep their target alive until the end of the current job.
  await setImmediate()
  global.gc!()
  await setImmediate()
  global.gc!()
  return process.memoryUsage().heapUsed
}
function batch(count: number, complete: boolean) {
  for (let i = 0; i < count; i++) {
    const view = new View() as unknown as NativeView
    views.push(new WeakRef(view))
    const animation = animate(
      view,
      { x: [0, 200, 0], scale: [1, 1.5, 1] },
      {
        duration: 4000,
        ease: 'easeInOut',
      },
    )
    if (complete) {
      for (const handle of [...active]) {
        active.delete(handle)
        handle.done()
      }
    } else animation.stop()
    retained.push(animation)
  }
}
batch(100, false)
retained.length = 0
tracks.length = 0
views.length = 0
const before = await collect()
const rounds = []
for (let round = 0; round < 4; round++) {
  batch(250, round % 2 === 0)
  const heapUsed = await collect()
  rounds.push({
    round,
    handles: retained.length,
    heapUsed,
    liveTracks: tracks.filter((ref) => ref.deref() !== undefined).length,
    liveViews: views.filter((ref) => ref.deref() !== undefined).length,
  })
}
if (active.size) throw Error('The driver still owns an active track')
const liveTracks = rounds.at(-1)!.liveTracks
const liveViews = rounds.at(-1)!.liveViews
// The source comparison intentionally measures the old retention behavior too.
if (!process.env.JOLT_RETENTION_BASELINE && liveTracks !== 0)
  throw Error(`${liveTracks} settled tracks remain reachable through finished handles`)
if (!process.env.JOLT_RETENTION_BASELINE && liveViews !== 0)
  throw Error(`${liveViews} settled views remain reachable through finished handles`)
for (const animation of retained) {
  const result = await animation
  animation.pause()
  animation.play()
  animation.stop()
  if (result !== true && result !== false) throw Error('Settled promise changed')
}
retained.length = 0
const released = await collect()
console.log(
  JSON.stringify(
    {
      node: process.version,
      before,
      rounds,
      released,
      notes:
        'Host JS heap with a non-retaining fake driver and explicit GC. Each animation owns a distinct view. Natural completion and cancellation alternate. Not Android PSS or native memory.',
    },
    null,
    2,
  ),
)
