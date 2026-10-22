import { clampDecoration, isDecorationProperty } from './decoration.js'
import { linear } from './easing.js'
import { solveDecay } from './decay.js'
import { solveDragRelease } from './drag-physics.js'
import { precision, type Property } from './properties.js'
import { solveSpring, springPhysics } from './spring.js'
import type { Curve, RepeatDelayRange, ResolvedTransition } from './transition.js'
import { colorMixer, isColorProperty, type ColorProperty } from './color.js'
import { reducedMotion, timeScale } from './config.js'

/**
 * One property animated over time. The curve is computed here and sampled,
 * so the platform plays plain keyframes and nothing runs in JavaScript per frame.
 */
export interface Track {
  readonly property: Property
  readonly delay: number
  /** One iteration, in milliseconds. */
  readonly duration: number
  readonly repeat: number
  readonly reverse: boolean
  /** Offsets from 0 to 1 within one iteration, paired with `values`. */
  readonly times: readonly number[]
  readonly values: readonly number[]
  /** Where the property is left once the track is over. */
  readonly to: number
  /** Milliseconds from the start until the end of the last iteration. */
  readonly end: number
  /** When it looks done: a spring is close to its target and stays there, long before it settles. */
  readonly arrival: number
  valueAt(elapsed: number): number
  /** Units per second. */
  velocityAt(elapsed: number): number
}

interface Motion {
  duration: number
  position(time: number): number
  velocity(time: number): number
  times: number[]
  values: number[]
}

const SAMPLES_PER_SECOND = 60
const MAX_DECAY_SAMPLES = 6000
const ARRIVAL_TOLERANCE = 0.05

export function createTrack(
  property: Property,
  keyframes: readonly number[],
  transition: ResolvedTransition,
  velocity: number,
): Track {
  if (isColorProperty(property)) return colorTrack(property, keyframes, transition)
  const { curve } = transition
  if (property !== 'opacity' && reducedMotion())
    return instantTrack(
      property,
      restingValue(property, keyframes, curve, transition.repeat, transition.reverse),
    )
  const slowdown = 1 / timeScale()
  const delay = transition.delay * slowdown
  const played = slow(
    curve.type === 'spring'
      ? spring(property, keyframes, curve, velocity * slowdown, slowdown)
      : curve.type === 'drag'
        ? dragMotion(keyframes[0]!, curve, slowdown)
        : curve.type === 'decay'
          ? decay(property, keyframes[0]!, curve, slowdown)
          : tween(keyframes, curve, slowdown),
    slowdown,
  )
  const { motion, repeat, reverse } = pauseBetweenRepeats(
    played,
    transition.repeat,
    transition.reverse,
    transition.repeatDelay ?? 0,
    slowdown,
    transition.seed,
  )
  const { duration } = motion
  const first = motion.values[0]!
  const last = motion.values.at(-1)!
  const finite = Number.isFinite(repeat)
  const endsBackwards = reverse && finite && repeat % 2 === 1
  const end = delay + (duration === 0 ? 0 : duration * (repeat + 1))

  const localTime = (elapsed: number): [time: number, direction: number] => {
    const time = elapsed - delay
    if (time <= 0) return [0, 1]
    if (time >= end - delay) return [endsBackwards ? 0 : duration, 1]
    const iteration = Math.floor(time / duration)
    const local = time - iteration * duration
    return reverse && iteration % 2 === 1 ? [duration - local, -1] : [local, 1]
  }

  const track: Track = {
    property,
    delay,
    duration,
    repeat,
    reverse,
    times: motion.times,
    values: motion.values,
    to: !finite || endsBackwards ? first : last,
    end,
    arrival:
      (curve.type === 'spring' ||
        curve.type === 'drag' ||
        (curve.type === 'decay' && curve.snap !== undefined)) &&
      transition.repeat === 0
        ? delay + arrival(motion)
        : end,
    valueAt: (elapsed) => motion.position(localTime(elapsed)[0]),
    velocityAt: (elapsed) => {
      if (elapsed <= delay || elapsed >= end) return 0
      const [time, direction] = localTime(elapsed)
      return motion.velocity(time) * direction
    },
  }
  if (!isDecorationProperty(property)) return track
  return {
    ...track,
    values: track.values.map((value) => clampDecoration(property, value)),
    to: clampDecoration(property, track.to),
    valueAt: (elapsed) => clampDecoration(property, track.valueAt(elapsed)),
  }
}

/** Already at its end: the engine writes the value and plays nothing. */
export function instantTrack(property: Property, value: number): Track {
  const to = isDecorationProperty(property) ? clampDecoration(property, value) : value
  return {
    property,
    delay: 0,
    duration: 0,
    repeat: 0,
    reverse: false,
    times: [0, 1],
    values: [to, to],
    to,
    end: 0,
    arrival: 0,
    valueAt: () => to,
    velocityAt: () => 0,
  }
}

function restingValue(
  property: Property,
  keyframes: readonly number[],
  curve: Curve,
  repeat: number,
  reverse: boolean,
) {
  const first = keyframes[0]!
  if (!Number.isFinite(repeat) || (reverse && repeat % 2 === 1)) return first
  if (curve.type === 'drag') return solveDragRelease(first, curve).to
  if (curve.type !== 'decay') return keyframes.at(-1)!
  const landing = solveDecay(
    first,
    curve.velocity,
    curve.friction,
    precision[property],
  ).to
  return curve.snap ? closest(curve.snap, landing) : landing
}

function closest(stops: readonly number[], target: number) {
  return stops.reduce((best, stop) =>
    Math.abs(stop - target) < Math.abs(best - target) ? stop : best,
  )
}

function colorTrack(
  property: ColorProperty,
  colors: readonly number[],
  transition: ResolvedTransition,
): Track {
  const progress = createTrack(
    'opacity',
    colors.map((_, i) => i),
    transition,
    0,
  )
  const mixes = colors.slice(1).map((color, i) => colorMixer(colors[i]!, color))
  const colorAt = (position: number) => {
    const p = Math.max(0, Math.min(colors.length - 1, position))
    const segment = Math.min(mixes.length - 1, Math.floor(p))
    return mixes[segment]!(p - segment)
  }
  // Linear timing still needs intermediate colors: native RGB interpolation is
  // only the short bridge between these perceptually spaced samples.
  const steps = Math.max(
    1,
    Math.min(
      MAX_DECAY_SAMPLES,
      Math.ceil((progress.duration / 1000) * SAMPLES_PER_SECOND),
    ),
  )
  const times = [
    ...new Set([
      ...progress.times,
      ...Array.from({ length: steps + 1 }, (_, i) => i / steps),
    ]),
  ].sort((a, b) => a - b)
  return {
    ...progress,
    property,
    times,
    values: times.map((time) =>
      colorAt(
        time === 0
          ? progress.values[0]!
          : time === 1
            ? progress.values.at(-1)!
            : progress.valueAt(progress.delay + time * progress.duration),
      ),
    ),
    to: colorAt(progress.to),
    valueAt: (elapsed) => colorAt(progress.valueAt(elapsed)),
    // Packed colors have no scalar velocity to carry into another spring.
    velocityAt: () => 0,
  }
}

/** An endless loop with drawn pauses plays this many of them, then starts over. */
const DRAWN_CYCLES = 16

/**
 * Holds the end value for `delay` ms before each repeat, inside the keyframes, so both
 * platforms play it natively. Finite repeats are laid out one after another, with no
 * wait after the last; endless ones loop a cycle that waits at each turn,
 * or DRAWN_CYCLES cycles when the waits are drawn from a range.
 */
function pauseBetweenRepeats(
  motion: Motion,
  repeat: number,
  reverse: boolean,
  delay: number | RepeatDelayRange,
  slowdown: number,
  seed = Math.random(),
): { motion: Motion; repeat: number; reverse: boolean } {
  const [shortest, longest] = typeof delay === 'number' ? [delay, delay] : delay
  if (longest <= 0 || repeat <= 0 || motion.duration === 0)
    return { motion, repeat, reverse }
  const draw = random(seed)
  const pause = () => (shortest + draw() * (longest - shortest)) * slowdown
  type Segment = { kind: 'forward' | 'backward' | 'hold'; duration: number }
  const play = (backward: boolean): Segment => ({
    kind: backward ? 'backward' : 'forward',
    duration: motion.duration,
  })
  const hold = (): Segment => ({ kind: 'hold', duration: pause() })
  const segments: Segment[] = []
  if (Number.isFinite(repeat))
    for (let i = 0; i <= repeat; i++) {
      if (i > 0) segments.push(hold())
      segments.push(play(reverse && i % 2 === 1))
    }
  else {
    const cycles = shortest === longest ? (reverse ? 2 : 1) : DRAWN_CYCLES
    for (let i = 0; i < cycles; i++) segments.push(play(reverse && i % 2 === 1), hold())
  }

  const total = segments.reduce((sum, segment) => sum + segment.duration, 0)
  const starts = segments.map((_, i) =>
    segments.slice(0, i).reduce((sum, segment) => sum + segment.duration, 0),
  )
  const last = motion.values.length - 1
  const endOf = (i: number) => {
    const segment = segments[i]!
    if (segment.kind === 'forward') return motion.values[last]!
    if (segment.kind === 'backward') return motion.values[0]!
    return endOf(i - 1)
  }

  const times: number[] = []
  const values: number[] = []
  segments.forEach((segment, i) => {
    const start = starts[i]!
    if (segment.kind === 'hold') {
      const held = endOf(i - 1)
      const next = segments[i + 1]
      const jumps =
        next !== undefined &&
        (next.kind === 'forward' ? motion.values[0] : motion.values[last]) !== held
      // A loop jumps back to its start at the end of the hold, not across it.
      const jump = jumps ? Math.min(1, segment.duration / 10) : 0
      times.push((start + segment.duration - jump) / total)
      values.push(held)
      return
    }
    for (let k = 0; k <= last; k++) {
      const index = segment.kind === 'forward' ? k : last - k
      const offset = motion.times[index]!
      const time = segment.kind === 'forward' ? offset : 1 - offset
      if (k === 0 && i > 0 && values.at(-1) === motion.values[index]) continue
      times.push((start + time * motion.duration) / total)
      values.push(motion.values[index]!)
    }
  })

  const locate = (time: number) => {
    let i = 0
    while (i < segments.length - 1 && time >= starts[i + 1]!) i++
    return [i, time - starts[i]!] as const
  }
  return {
    motion: {
      duration: total,
      times,
      values,
      position: (time) => {
        const [i, local] = locate(Math.max(0, Math.min(total, time)))
        const segment = segments[i]!
        if (segment.kind === 'hold') return endOf(i - 1)
        return motion.position(
          segment.kind === 'forward' ? local : motion.duration - local,
        )
      },
      velocity: (time) => {
        const [i, local] = locate(Math.max(0, Math.min(total, time)))
        const segment = segments[i]!
        if (segment.kind === 'hold') return 0
        return segment.kind === 'forward'
          ? motion.velocity(local)
          : -motion.velocity(motion.duration - local)
      },
    },
    repeat: Number.isFinite(repeat) ? 0 : Infinity,
    reverse: false,
  }
}

/** Mulberry32: the same seed draws the same pauses for every track of one animation. */
function random(seed: number) {
  let state = Math.floor(seed * 2 ** 32) >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = Math.imul(state ^ (state >>> 15), state | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32
  }
}

/** Plays the same trajectory over a longer or shorter time. */
function slow(motion: Motion, factor: number): Motion {
  if (factor === 1) return motion
  return {
    ...motion,
    duration: motion.duration * factor,
    position: (time) => motion.position(time / factor),
    velocity: (time) => motion.velocity(time / factor) / factor,
  }
}

/** Keyframes per second of playback, so slowed curves stay smooth. */
function samples(duration: number, density: number) {
  return Math.max(
    1,
    Math.min(
      MAX_DECAY_SAMPLES,
      Math.ceil(((duration * density) / 1000) * SAMPLES_PER_SECOND),
    ),
  )
}

function dragMotion(
  from: number,
  curve: Extract<Curve, { type: 'drag' }>,
  density: number,
): Motion {
  const motion = solveDragRelease(from, curve)
  const steps = samples(motion.duration, density)
  const times = Array.from({ length: steps + 1 }, (_, i) => i / steps)
  return {
    ...motion,
    times,
    values: times.map((time) => motion.position(time * motion.duration)),
  }
}

function decay(
  property: Property,
  from: number,
  curve: Extract<Curve, { type: 'decay' }>,
  density: number,
): Motion {
  const motion = solveDecay(from, curve.velocity, curve.friction, precision[property])
  if (curve.snap) {
    return spring(
      property,
      [from, closest(curve.snap, motion.to)],
      { type: 'spring', physics: springPhysics({}), velocity: curve.velocity },
      0,
      density,
    )
  }

  const steps = samples(motion.duration, density)
  const times: number[] = []
  const values: number[] = []
  for (let i = 0; i <= steps; i++) {
    times.push(i / steps)
    values.push(motion.position((i / steps) * motion.duration))
  }
  return { ...motion, times, values }
}

function arrival({ times, values, duration }: Motion) {
  const target = values.at(-1)!
  const tolerance =
    Math.max(...values.map((value) => Math.abs(value - target))) * ARRIVAL_TOLERANCE
  let i = values.length - 1
  while (i > 0 && Math.abs(values[i - 1]! - target) <= tolerance) i--
  return times[i]! * duration
}

function spring(
  property: Property,
  [from, to]: readonly number[],
  curve: Extract<Curve, { type: 'spring' }>,
  velocity: number,
  density: number,
): Motion {
  const motion = solveSpring(
    curve.physics,
    from!,
    to!,
    curve.velocity ?? velocity,
    precision[property],
  )
  const steps = samples(motion.duration, density)
  const times: number[] = []
  const values: number[] = []
  for (let i = 0; i <= steps; i++) {
    times.push(i / steps)
    values.push(i === steps ? to! : motion.position((i / steps) * motion.duration))
  }
  return { ...motion, times, values }
}

function tween(
  keyframes: readonly number[],
  curve: Extract<Curve, { type: 'tween' }>,
  density: number,
): Motion {
  if (curve.track && curve.track !== linear) return easedTrack(keyframes, curve, density)
  const { duration, ease } = curve
  const offsets = curve.times ?? keyframes.map((_, i) => i / (keyframes.length - 1))

  const position = (time: number) => {
    const progress = duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 1
    let i = 0
    while (i < offsets.length - 2 && progress > offsets[i + 1]!) i++
    const start = offsets[i]!
    const span = offsets[i + 1]! - start
    const local = span > 0 ? (progress - start) / span : 1
    const from = keyframes[i]!
    return from + (keyframes[i + 1]! - from) * ease[i]!(local)
  }

  const times = [0]
  const values = [keyframes[0]!]
  for (let i = 0; i < keyframes.length - 1; i++) {
    const start = offsets[i]!
    const span = offsets[i + 1]! - start
    const from = keyframes[i]!
    const to = keyframes[i + 1]!
    const easing = ease[i]!
    const steps = easing === linear || from === to ? 1 : samples(span * duration, density)
    for (let step = 1; step <= steps; step++) {
      times.push(start + (span * step) / steps)
      values.push(step === steps ? to : from + (to - from) * easing(step / steps))
    }
  }

  return {
    duration,
    position,
    velocity: (time) => (position(time + 0.5) - position(time - 0.5)) * 1000,
    times,
    values,
  }
}

/** One easing over the whole timeline, then straight lines between keyframes, sampled evenly in time. */
function easedTrack(
  keyframes: readonly number[],
  curve: Extract<Curve, { type: 'tween' }>,
  density: number,
): Motion {
  const { duration, track: ease = linear } = curve
  const offsets = curve.times ?? keyframes.map((_, i) => i / (keyframes.length - 1))
  const last = keyframes.length - 1

  // Like `interpolate`, an easing past 0 or 1 extends the first or last segment.
  const at = (progress: number) => {
    let i = 0
    while (i < last - 1 && progress > offsets[i + 1]!) i++
    const start = offsets[i]!
    const span = offsets[i + 1]! - start
    const from = keyframes[i]!
    const to = keyframes[i + 1]!
    if (span <= 0) return progress < start ? from : to
    return from + ((to - from) * (progress - start)) / span
  }
  const position = (time: number) =>
    at(ease(duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 1))

  const steps = samples(duration, density)
  const times = Array.from({ length: steps + 1 }, (_, i) => i / steps)
  return {
    duration,
    position,
    velocity: (time) => (position(time + 0.5) - position(time - 0.5)) * 1000,
    times,
    values: times.map((time, i) =>
      i === steps ? keyframes[last]! : position(time * duration),
    ),
  }
}
