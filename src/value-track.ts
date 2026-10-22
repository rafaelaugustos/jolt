import { instantTrack, type Track } from './track.js'

export interface ValuePart {
  readonly track: Track
  readonly elapsed: number
  readonly base: number
  readonly span: number
}

/** Compile scalar addition before any binding's mapping. The snapshot is independent of later edits. */
export function valueTrack(parts: readonly ValuePart[], rest: number) {
  const value = (time: number) =>
    parts.reduce(
      (sum, part) =>
        sum + part.base + part.span * part.track.valueAt(part.elapsed + time),
      rest,
    )
  let finite = 0
  const periods: number[] = []
  for (const { track, elapsed } of parts) {
    if (Number.isFinite(track.end)) finite = Math.max(finite, track.end - elapsed)
    else if (elapsed < track.delay) finite = Math.max(finite, track.delay - elapsed)
    else periods.push(Math.max(1, track.duration * (track.reverse ? 2 : 1)))
  }
  if (finite <= 0 && !periods.length)
    return { track: instantTrack('x', value(0)), windowed: false }
  const loop = finite <= 0 && periods.length ? commonPeriod(periods) : undefined
  // Bound finite compositions too: a minutes-long base must not undersample a short pulse.
  const duration = finite > 0 ? Math.min(finite, 4000) : (loop ?? 4000)
  const steps = Math.max(1, Math.min(6000, Math.ceil((duration * 60) / 1000)))
  const times = Array.from({ length: steps + 1 }, (_, i) => i / steps)
  const values = times.map((time) => value(time * duration))
  const endless = loop !== undefined
  const at = (time: number) =>
    value(
      endless
        ? ((time % duration) + duration) % duration
        : Math.min(duration, Math.max(0, time)),
    )
  const track: Track = {
    property: 'x',
    delay: 0,
    duration,
    repeat: endless ? Infinity : 0,
    reverse: false,
    times,
    values,
    to: endless ? values[0]! : values[steps]!,
    end: endless ? Infinity : duration,
    arrival: endless ? Infinity : duration,
    valueAt: at,
    velocityAt: (time) => (at(time + 0.5) - at(time - 0.5)) * 1000,
  }
  return {
    track,
    windowed:
      finite > duration ||
      (!endless && parts.some(({ track }) => !Number.isFinite(track.end))),
  }
}

function commonPeriod(periods: readonly number[]) {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
  let total = 1
  for (const period of periods) {
    if (!Number.isInteger(period)) return undefined
    total = (total / gcd(total, period)) * period
    if (total > 30000) return undefined
  }
  return total
}
