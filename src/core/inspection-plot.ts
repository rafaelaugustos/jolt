export type PlotEvent =
  'start' | 'replace' | 'pause' | 'play' | 'stop' | 'complete' | 'seek'
export interface PlotSample {
  at: number
  expected: number | null
  observed: number | null
  event?: PlotEvent
}
const events: readonly PlotEvent[] = [
  'start',
  'replace',
  'pause',
  'play',
  'stop',
  'complete',
  'seek',
]
export function validatePlotSample(sample: PlotSample) {
  if (
    !sample ||
    !Number.isFinite(sample.at) ||
    sample.at < 0 ||
    [sample.expected, sample.observed].some((v) => v !== null && !Number.isFinite(v)) ||
    (sample.event !== undefined && !events.includes(sample.event))
  )
    throw new TypeError(
      'Plot samples need finite timestamps/values, null gaps and known events.',
    )
}
/** Bounded portable SVG. Missing observations break the line; they are never interpolated. */
export function inspectorPlot(samples: readonly PlotSample[]): string {
  if (!Array.isArray(samples) || samples.length > 4096)
    throw new RangeError('Plot at most 4096 samples.')
  let previous = -1
  for (const sample of samples) {
    validatePlotSample(sample)
    if (sample.at < previous) throw new RangeError('Plot timestamps must be ordered.')
    previous = sample.at
  }
  const values = samples
    .flatMap((s) => [s.expected, s.observed])
    .filter((v): v is number => v !== null)
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values)
  // Normalize before subtraction so finite extreme values cannot overflow.
  const scale = Math.max(Math.abs(min), Math.abs(max))
  const low = min / scale,
    range = max / scale - low
  const first = samples[0]?.at ?? 0,
    span = Math.max(1, (samples.at(-1)?.at ?? 1) - first)
  const x = (at: number) => (12 + ((at - first) / span) * 296).toFixed(2)
  const path = (key: 'expected' | 'observed') => {
    let drawing = false,
      result = ''
    for (const sample of samples) {
      const value = sample[key]
      if (value === null) {
        drawing = false
        continue
      }
      result += `${drawing ? 'L' : 'M'}${x(sample.at)},${(88 - ((value / scale - low) / range) * 72).toFixed(2)} `
      drawing = true
    }
    return result
  }
  const markers = samples
    .filter((s) => s.event)
    .map(
      (s) =>
        `<path d="M${x(s.at)} 12V92" stroke="#8EA6FF" stroke-dasharray="2 3"><title>${s.event}</title></path>`,
    )
    .join('')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="104" viewBox="0 0 320 104" role="img" aria-label="Expected and observed motion; gaps indicate unavailable observations"><rect width="320" height="104" rx="14" fill="#252A34"/><path d="M12 16H308M12 52H308M12 88H308" stroke="#444956" stroke-width=".5"/>${markers}<path d="${path('expected')}" fill="none" stroke="#DFFF69" stroke-width="2.5"/><path d="${path('observed')}" fill="none" stroke="#F0ABCE" stroke-width="2" stroke-dasharray="4 2"/></svg>`
}
