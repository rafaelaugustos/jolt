import { createHash } from 'node:crypto'

// Quantize platform math noise, while retaining every sampled offset and value.
const number = (value) =>
  Number.isFinite(value) ? Number(value.toPrecision(10)) : String(value)

/** @param {import('../../src/track.js').Track} track */
export function describeTrack(track) {
  const positions = [
    -1,
    0,
    track.delay - 0.001,
    track.delay,
    track.delay + 0.001,
    ...[0.1, 0.25, 0.5, 0.75, 0.999, 1, 1.001, 1.5, 2, 3.5].map(
      (p) => track.delay + track.duration * p,
    ),
    track.arrival,
    ...(Number.isFinite(track.end) ? [track.end - 0.001, track.end, track.end + 1] : []),
  ].filter(Number.isFinite)
  return {
    property: track.property,
    delay: number(track.delay),
    duration: number(track.duration),
    end: number(track.end),
    arrival: number(track.arrival),
    to: number(track.to),
    repeat: number(track.repeat),
    reverse: track.reverse,
    sampling: JSON.parse(
      JSON.stringify(track.sampling ?? null, (_, value) =>
        typeof value === 'number' ? number(value) : value,
      ),
    ),
    keyframeCount: track.times.length,
    keyframesSHA256: createHash('sha256')
      .update(
        JSON.stringify(
          track.times.map((time, i) => [number(time), number(track.values[i])]),
        ),
      )
      .digest('hex'),
    probes: positions.map((time) => [
      number(time),
      number(track.valueAt(time)),
      number(track.velocityAt(time)),
    ]),
  }
}
