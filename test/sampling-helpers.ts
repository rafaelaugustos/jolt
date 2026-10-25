import type { Track } from '../src/track.js'

/** Reconstruct the actual piecewise-linear representation, independently of the solver. */
export function sampledPosition(
  track: Pick<Track, 'times' | 'values' | 'duration'>,
  time: number,
) {
  const p = time / track.duration
  let i = 0
  while (i < track.times.length - 2 && p > track.times[i + 1]!) i++
  const span = track.times[i + 1]! - track.times[i]!
  return span > 0
    ? track.values[i]! +
        ((track.values[i + 1]! - track.values[i]!) * (p - track.times[i]!)) / span
    : track.values[i + 1]!
}
export function maximumSampleError(track: Track, step = 0.1) {
  let error = 0
  for (let t = 0; t < track.duration; t += step)
    error = Math.max(error, Math.abs(sampledPosition(track, t) - track.valueAt(t)))
  return error
}
