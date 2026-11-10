import { describe, expect, it } from 'vitest'
import { inspectorPlot } from '../src/core/inspection-plot.js'
describe('portable inspector evidence', () => {
  it('breaks unavailable observations rather than inventing a continuous trace', () => {
    const svg = inspectorPlot([
      { at: 0, expected: 0, observed: 0 },
      { at: 10, expected: 2, observed: null },
      { at: 20, expected: 4, observed: 3, event: 'replace' },
    ])
    const paths = [...svg.matchAll(/<path d="([^"]+)" fill="none"/g)]
    expect(paths[0]![1]!.match(/M/g)).toHaveLength(1)
    expect(paths[1]![1]!.match(/M/g)).toHaveLength(2)
    expect(svg).toContain('<title>replace</title>')
    expect(svg).not.toContain('NaN')
  })
  it('keeps extreme finite observations drawable', () => {
    const svg = inspectorPlot([
      { at: 0, expected: -Number.MAX_VALUE, observed: Number.MAX_VALUE },
    ])
    expect(svg).not.toMatch(/NaN|Infinity/)
  })
  it('rejects unsafe labels, invalid numeric input, disorder and oversized exports', () => {
    for (const rows of [
      [{ at: 0, expected: Infinity, observed: null }],
      [{ at: 0, expected: 0, observed: 0, event: '<script>' }],
      [
        { at: 2, expected: 0, observed: 0 },
        { at: 1, expected: 0, observed: 0 },
      ],
      Array.from({ length: 4097 }, (_, at) => ({ at, expected: 0, observed: 0 })),
    ])
      expect(() => inspectorPlot(rows as never)).toThrow()
  })
})
