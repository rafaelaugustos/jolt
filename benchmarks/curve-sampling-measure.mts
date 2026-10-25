import { createTrack, type Track } from '../src/track.js'
import { resolveTransition } from '../src/transition.js'
import { configure } from '../src/config.js'
import { samplingCases } from './curve-sampling-cases.js'
import { performance } from 'node:perf_hooks'

configure({ reducedMotion: 'never', timeScale: 1 })
const median = (values: number[]) =>
  values.sort((a, b) => a - b)[Math.floor(values.length / 2)]!
export function denseError(track: Track) {
  let max = 0,
    segment = 0
  const steps = Math.ceil(track.duration / 0.1)
  for (let i = 0; i <= steps; i++) {
    const p = i / steps
    while (segment < track.times.length - 2 && track.times[segment + 1]! < p) segment++
    const fraction =
      (p - track.times[segment]!) / (track.times[segment + 1]! - track.times[segment]!)
    const actual =
      track.values[segment]! +
      fraction * (track.values[segment + 1]! - track.values[segment]!)
    max = Math.max(max, Math.abs(actual - track.valueAt(p * track.duration)))
  }
  return max
}
const results = samplingCases.map((c) => {
  const resolved = resolveTransition(c.transition, c.property, c.frames.length)
  const make = () => createTrack(c.property, c.frames, resolved, c.velocity ?? 0)
  for (let i = 0; i < 300; i++) make()
  const measurements = []
  let count = 0
  for (let round = 0; round < 7; round++) {
    const start = performance.now()
    for (let i = 0; i < 500; i++) count += make().values.length
    measurements.push((performance.now() - start) / 500)
  }
  const heap = []
  const heapRound = () => {
    global.gc!()
    const before = process.memoryUsage().heapUsed
    const retained = Array.from({ length: 1000 }, make)
    ;(globalThis as any).__joltSamplingRetained = retained
    global.gc!()
    heap.push((process.memoryUsage().heapUsed - before) / retained.length)
    count += retained[0]!.values.length
    ;(globalThis as any).__joltSamplingRetained = null
  }
  for (let round = 0; round < 3; round++) heapRound()
  const track = make()
  return {
    name: c.name,
    property: c.property,
    configuration: {
      frames: c.frames,
      transition: c.transition,
      velocity: c.velocity ?? 0,
    },
    durationMs: track.duration,
    arrivalMs: track.arrival,
    initialVelocity: track.velocityAt(0),
    keyframes: track.values.length,
    scalarPayloadBytes: track.values.length * 16,
    maxError: denseError(track),
    preparationMedianMs: median(measurements),
    retainedHeapBytesPerTrack: median(heap),
    checksum: count,
  }
})
console.log(
  JSON.stringify(
    {
      node: process.version,
      referenceStepMs: 0.1,
      notes:
        'Host numerical and retained-JS-heap measurements with GC; not native allocation or display frame-rate measurements. Timing excludes transition resolution.',
      results,
    },
    null,
    2,
  ),
)
