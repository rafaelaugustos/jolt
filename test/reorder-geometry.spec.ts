import { describe, expect, it } from 'vitest'
import { reorderDestination } from '../src/core/reorder.js'

describe('measured reorder destination', () => {
  const rows = [
    { start: 0, size: 44 },
    { start: 52, size: 180 },
    { start: 240, size: 70 },
  ]
  it('crosses other row centers, retaining equality and clamping at both ends', () => {
    expect(reorderDestination(rows, 1, 142)).toBe(1)
    expect(reorderDestination(rows, 1, 275)).toBe(1)
    expect(reorderDestination(rows, 1, 276)).toBe(2)
    expect(reorderDestination(rows, 1, -50)).toBe(0)
    expect(reorderDestination(rows, 1, 1000)).toBe(2)
    expect(reorderDestination(rows, 0, 143)).toBe(1)
  })
  it('rejects invalid indices, pointers and stale nonfinite measurements', () => {
    expect(reorderDestination(rows, -1, 0)).toBeUndefined()
    expect(reorderDestination(rows, 0, NaN)).toBeUndefined()
    expect(reorderDestination([{ start: 0, size: Infinity }], 0, 20)).toBeUndefined()
    expect(reorderDestination([], 0, 0)).toBeUndefined()
  })
})
