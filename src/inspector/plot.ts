import type { InspectorSample } from './index.js'

/** Separate paths preserve unavailable observations instead of fabricating a line. */
export function inspectorPlot(samples: readonly InspectorSample[]): string {
  const values = samples
    .flatMap((s) => [s.expected, s.observed])
    .filter((v): v is number => v !== null && Number.isFinite(v))
  const min = Math.min(0, ...values),
    max = Math.max(1, ...values)
  const first = samples[0]?.at ?? 0,
    span = Math.max(1, (samples.at(-1)?.at ?? 1) - first)
  const path = (key: 'expected' | 'observed') => {
    let drawing = false,
      result = ''
    for (const s of samples) {
      const value = s[key]
      if (value === null || !Number.isFinite(value)) {
        drawing = false
        continue
      }
      result += `${drawing ? 'L' : 'M'}${(12 + ((s.at - first) / span) * 296).toFixed(2)},${(88 - ((value - min) / (max - min)) * 72).toFixed(2)} `
      drawing = true
    }
    return result
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="104" viewBox="0 0 320 104"><rect width="320" height="104" rx="14" fill="#252A34"/><path d="M12 16H308M12 52H308M12 88H308" stroke="#444956" stroke-width=".5"/><path d="${path('expected')}" fill="none" stroke="#DFFF69" stroke-width="2.5"/><path d="${path('observed')}" fill="none" stroke="#F0ABCE" stroke-width="2" stroke-dasharray="4 2"/></svg>`
}
