import {
  parseTrace,
  traceRandom,
  type InteractionTrace,
  type TraceInput,
  type TraceState,
} from './trace.js'

export interface ReplayAdapter {
  input(event: TraceInput): void | Promise<void>
  read(id: string): TraceState
  dispose(): void | Promise<void>
  /** Owned subscriptions/handles remaining after dispose; must be zero. */
  resources(): number
}
export interface ReplayObservation {
  at: number
  id: string
  expected: TraceState
  observed: TraceState
  positionError: number
  velocityError: number
  passed: boolean
}
export interface ReplayReport {
  passed: boolean
  observations: ReplayObservation[]
  errors: string[]
  remainingResources: number
  trace: InteractionTrace
  /** A compact expected/observed SVG, useful as a failure artifact. */
  plot: string
}
export interface ReplayOptions {
  advanceTo(at: number): void | Promise<void>
  /** Construct fresh state for each replay. Include the supplied seed in random effects. */
  create(trace: InteractionTrace, random: () => number): ReplayAdapter
  signal?: { readonly aborted: boolean }
}

/** Ordered replay at original timestamps. A 250 ms gap advances once, never fifteen fake frames. */
export async function replayInteraction(
  value: InteractionTrace | string,
  options: ReplayOptions,
): Promise<ReplayReport> {
  const trace = parseTrace(value)
  const observations: ReplayObservation[] = [],
    errors: string[] = []
  let adapter: ReplayAdapter | undefined,
    remainingResources = 0
  try {
    if (!trace.entries.some((entry) => 'expected' in entry))
      throw new Error('A regression trace needs at least one checkpoint.')
    adapter = options.create(trace, traceRandom(trace.seed))
    let previous = -1
    for (const entry of trace.entries) {
      if (options.signal?.aborted) throw new Error('Replay cancelled.')
      if (entry.at !== previous) {
        await options.advanceTo(entry.at)
        previous = entry.at
      }
      if ('input' in entry) await adapter.input(entry.input)
      else {
        const value = adapter.read(entry.id)
        const observed = {
          position: value.position,
          velocity: value.velocity,
          settled: value.settled,
        }
        const positionError = Math.abs(observed.position - entry.expected.position)
        const velocityError = Math.abs(observed.velocity - entry.expected.velocity)
        const passed =
          typeof observed.position === 'number' &&
          typeof observed.velocity === 'number' &&
          typeof observed.settled === 'boolean' &&
          Number.isFinite(positionError) &&
          Number.isFinite(velocityError) &&
          positionError <= entry.tolerance.position &&
          velocityError <= entry.tolerance.velocity &&
          observed.settled === entry.expected.settled
        observations.push({
          at: entry.at,
          id: entry.id,
          expected: entry.expected,
          observed: { ...observed },
          positionError,
          velocityError,
          passed,
        })
        if (!passed)
          errors.push(
            `${entry.id} at ${entry.at} ms: position error ${positionError}, velocity error ${velocityError}, settled ${observed.settled} (expected ${entry.expected.settled}).`,
          )
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'Replay adapter failed.')
  } finally {
    if (adapter) {
      try {
        await adapter.dispose()
      } catch {
        errors.push('Replay adapter disposal failed.')
      }
      try {
        remainingResources = adapter.resources()
        if (!Number.isSafeInteger(remainingResources) || remainingResources !== 0)
          errors.push('Replay left owned subscriptions or handles alive.')
      } catch {
        remainingResources = -1
        errors.push('Replay resource audit failed.')
      }
    }
  }
  return {
    passed: errors.length === 0,
    observations,
    errors,
    remainingResources,
    trace,
    plot: replayPlot(observations),
  }
}

/** IDs are validated by parseTrace; plotted values must be finite before entering SVG. */
export function replayPlot(samples: readonly ReplayObservation[]): string {
  const finite = samples.filter((s) =>
    [s.at, s.expected.position, s.observed.position].every(Number.isFinite),
  )
  const end = Math.max(1, ...finite.map((s) => s.at))
  const min = Math.min(
    0,
    ...finite.flatMap((s) => [s.expected.position, s.observed.position]),
  )
  const max = Math.max(
    min + 1,
    ...finite.flatMap((s) => [s.expected.position, s.observed.position]),
  )
  const point = (at: number, y: number) =>
    `${(40 + (at / end) * 560).toFixed(2)},${(180 - ((y - min) / (max - min)) * 140).toFixed(2)}`
  const ids = [...new Set(finite.map((s) => s.id))]
  const lines = ids
    .map((id) => {
      const rows = finite.filter((s) => s.id === id)
      return `<polyline fill="none" stroke="#176b5b" stroke-width="2" points="${rows.map((s) => point(s.at, s.expected.position)).join(' ')}"/><polyline fill="none" stroke="#b7355f" stroke-width="2" stroke-dasharray="4 3" points="${rows.map((s) => point(s.at, s.observed.position)).join(' ')}"/>`
    })
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="220" viewBox="0 0 640 220"><rect width="640" height="220" fill="#faf8f1"/><g font-family="sans-serif" font-size="12" fill="#202630"><text x="20" y="20">Presentation position (DIP): green expected / pink observed</text><text x="40" y="205">0 ms</text><text x="540" y="205">${end.toFixed(0)} ms</text><text x="8" y="45">${max.toFixed(0)}</text><text x="8" y="180">${min.toFixed(0)}</text></g><path d="M40 35 V180 H605" fill="none" stroke="#bfc5be"/>${lines}</svg>`
}
