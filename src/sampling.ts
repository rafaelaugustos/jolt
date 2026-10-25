/** Maximum linear interpolation error in property units, not screen pixels. */
export interface SamplingOptions {
  duration: number
  position(time: number): number
  tolerance: number
  /** Bound on linear interpolation error across this complete interval. */
  errorBound?(start: number, end: number): number
  /** Playback milliseconds per source millisecond. */
  slowdown?: number
  /** Unknown user functions retain at least 120 uniform intervals per second. */
  custom?: boolean
  /** Mandatory times in source milliseconds, including piecewise curve seams. */
  breakpoints?: readonly number[]
  /** Non-expansive property clamp and the values where its slope changes. */
  projection?: { apply(value: number): number; breaks: readonly number[] }
}

export const MAX_SAMPLE_INTERVALS = 6000
const MAX_EVALUATIONS = 24000
const MAX_DEPTH = 24
const MAX_INTERVAL_MS = 100
const PROBES = [0.25, 0.5, 0.75] as const
const NO_BREAKS: readonly number[] = []

export interface SampledCurve {
  times: number[]
  values: number[]
  sampling: {
    method: 'adaptive' | 'uniform-fallback'
    tolerance: number
    /** Only true when every accepted interval passed an analytical bound. */
    bounded: boolean
    evaluations: number
    reason?: 'sample-limit' | 'evaluation-limit' | 'invalid-bound'
  }
}

/** Curves are sampled only at setup. Work and output are bounded independently. */
export function sampleCurve(options: SamplingOptions): SampledCurve {
  const {
    duration,
    position,
    tolerance,
    errorBound,
    custom = false,
    slowdown = 1,
  } = options
  let evaluations = 0
  const project = options.projection?.apply ?? ((value: number) => value)
  const at = (time: number) => {
    evaluations++
    return position(time)
  }
  const maxInterval = (custom ? 1000 / 120 : MAX_INTERVAL_MS) / slowdown
  const seeds = Math.max(1, Math.ceil(duration / maxInterval))
  let reason: SampledCurve['sampling']['reason']
  const initial = at(0)
  const times = [0],
    values = [project(initial)]
  const append = (time: number, value: number) => {
    if (times.length >= MAX_SAMPLE_INTERVALS + 1) {
      reason = 'sample-limit'
      return
    }
    times.push(duration > 0 ? time / duration : 1)
    values.push(project(value))
  }
  const split = (a: number, b: number, va: number, vb: number, depth: number) => {
    if (reason) return
    if (evaluations >= MAX_EVALUATIONS) {
      reason = 'evaluation-limit'
      return
    }
    let accepted: boolean
    if (errorBound) {
      let bound = errorBound(a, b)
      // Clamping is non-expansive, but clamping a chord's endpoints can create a
      // different chord. Bound that extra error at each crossed clamp boundary.
      let clampError = 0
      for (const edge of options.projection?.breaks ?? NO_BREAKS) {
        const fraction = (edge - va) / (vb - va)
        if (fraction > 0 && fraction < 1)
          clampError = Math.max(
            clampError,
            Math.abs(
              project(edge) - (project(va) + (project(vb) - project(va)) * fraction),
            ),
          )
      }
      bound += clampError
      if (!Number.isFinite(bound) || bound < 0) {
        reason = 'invalid-bound'
        return
      }
      accepted = bound <= tolerance
    } else {
      // Three probes plus a safety margin, never a mathematical guarantee for a user function.
      let error = 0
      for (const fraction of PROBES)
        error = Math.max(
          error,
          Math.abs(
            project(at(a + (b - a) * fraction)) -
              (project(va) + (project(vb) - project(va)) * fraction),
          ),
        )
      accepted = error <= tolerance * 0.5
    }
    if (accepted) {
      append(b, vb)
      return
    }
    const mid = (a + b) / 2
    if (depth >= MAX_DEPTH || mid === a || mid === b) {
      reason = 'sample-limit'
      return
    }
    const vm = at(mid)
    split(a, mid, va, vm, depth + 1)
    split(mid, b, vm, vb, depth + 1)
  }
  if (seeds > MAX_SAMPLE_INTERVALS || !Number.isFinite(duration)) reason = 'sample-limit'
  else if (duration === 0) append(0, at(0))
  else {
    const boundaries = [
      ...new Set([
        ...Array.from({ length: seeds + 1 }, (_, i) =>
          i === seeds ? duration : (duration * i) / seeds,
        ),
        ...(options.breakpoints ?? []).filter((t) => t > 0 && t < duration),
      ]),
    ].sort((a, b) => a - b)
    let previous = initial
    for (let i = 0; i < boundaries.length - 1 && !reason; i++) {
      const a = boundaries[i]!,
        b = boundaries[i + 1]!
      const value = at(b)
      split(a, b, previous, value, 0)
      previous = value
    }
  }
  if (!reason)
    return {
      times,
      values,
      sampling: { method: 'adaptive', tolerance, bounded: !!errorBound, evaluations },
    }
  // Preserve the old capped 60 Hz representation if refinement cannot meet its budget.
  // Explicit segment endpoints are still retained by the caller. No precision claim on fallback.
  const steps = Math.max(
    1,
    Math.min(MAX_SAMPLE_INTERVALS, Math.ceil((duration * slowdown * 60) / 1000)),
  )
  const fallbackTimes = [
    ...new Set([
      ...Array.from({ length: steps + 1 }, (_, i) => i / steps),
      ...(options.breakpoints ?? [])
        .filter((t) => t > 0 && t < duration)
        .map((t) => t / duration),
    ]),
  ].sort((a, b) => a - b)
  return {
    times: fallbackTimes,
    values: fallbackTimes.map((t) => project(at(t * duration))),
    sampling: {
      method: 'uniform-fallback',
      tolerance,
      bounded: false,
      evaluations,
      reason,
    },
  }
}
