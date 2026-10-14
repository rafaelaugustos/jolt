import { createTrack } from '../dist/track.js'
import { resolveTransition } from '../dist/transition.js'

// Numerical interpolation error, not a device frame-rate or visual-quality measurement.
const cases = [
  { name: 'gentle, 300 DIP', distance: 300, duration: 600, bounce: 0 },
  { name: 'bouncy, 300 DIP', distance: 300, duration: 550, bounce: 0.4 },
  { name: 'fast, 300 DIP', distance: 300, duration: 200, bounce: 0.4 },
  { name: 'fast, 24 DIP', distance: 24, duration: 200, bounce: 0.4 },
  {
    name: 'interrupted, 300 DIP',
    distance: 300,
    duration: 400,
    bounce: 0.3,
    velocity: 3000,
  },
]

function maximumError(track, times, values) {
  let segment = 0
  let maximum = 0
  for (let time = 0; time < track.duration; time += 0.1) {
    const progress = time / track.duration
    while (segment < times.length - 2 && progress > times[segment + 1]) segment++
    const fraction = (progress - times[segment]) / (times[segment + 1] - times[segment])
    const interpolated =
      values[segment] + fraction * (values[segment + 1] - values[segment])
    maximum = Math.max(maximum, Math.abs(interpolated - track.valueAt(time)))
  }
  return maximum
}

const results = cases.map(({ name, distance, velocity = 0, ...spring }) => {
  const track = createTrack(
    'x',
    [0, distance],
    resolveTransition({ type: 'spring', ...spring }, 'x', 2),
    velocity,
  )
  const steps = Math.max(1, Math.ceil((track.duration / 1000) * 120))
  const times = Array.from({ length: steps + 1 }, (_, i) => i / steps)
  const values = times.map((time) => track.valueAt(time * track.duration))
  return {
    name,
    configuration: { distance, velocity, ...spring },
    settledDurationMs: track.duration,
    current: {
      samples: track.values.length,
      maximumErrorDIP: maximumError(track, track.times, track.values),
    },
    at120SamplesPerSecond: {
      samples: values.length,
      maximumErrorDIP: maximumError(track, times, values),
    },
  }
})

console.log(JSON.stringify({ referenceStepMs: 0.1, results }, null, 2))
