import { describe, it, expect } from 'vitest'
import { angleDelta, contactGeometry, consumeScroll } from '../src/core/gesture-math.js'

describe('portable contact and scroll coordination', () => {
  it('preserves the focal centroid under contact permutation and crosses the angular seam continuously', () => {
    const points = [
      { x: 10, y: 20 },
      { x: 70, y: 100 },
    ]
    const a = contactGeometry(points),
      b = contactGeometry([...points].reverse())
    expect(a.x).toBe(40)
    expect(a.y).toBe(60)
    expect(a.distance).toBe(100)
    expect(b.x).toBe(a.x)
    expect(b.y).toBe(a.y)
    expect(b.distance).toBe(a.distance)
    expect(angleDelta(-179, 179)).toBe(2)
    expect(angleDelta(179, -179)).toBe(-2)
    expect(
      contactGeometry([
        { x: 1, y: 2 },
        { x: 1, y: 2 },
      ]).distance,
    ).toBe(0)
  })
  it('expands before scrolling, drains nested content before collapsing and never consumes delta twice', () => {
    const expanded = consumeScroll(
      -180,
      100,
      [0, 100],
      [
        { position: 0, max: 50 },
        { position: 0, max: 200 },
      ],
    )
    expect(expanded).toEqual({ panel: 0, scroll: [50, 30], remaining: 0 })
    const reversed = consumeScroll(
      180,
      0,
      [0, 100],
      [
        { position: 50, max: 50 },
        { position: 30, max: 200 },
      ],
    )
    expect(reversed).toEqual({ panel: 100, scroll: [0, 0], remaining: 0 })
    for (const delta of [-1000, -180, -1, 0, 1, 180, 1000]) {
      const next = consumeScroll(
        delta,
        40,
        [0, 100],
        [
          { position: 25, max: 50 },
          { position: 70, max: 200 },
        ],
      )
      const consumed = next.panel - 40 - (next.scroll[0]! - 25) - (next.scroll[1]! - 70)
      expect(consumed + next.remaining).toBeCloseTo(delta, 10)
      expect(next.panel).toBeGreaterThanOrEqual(0)
      expect(next.panel).toBeLessThanOrEqual(100)
      expect(next.scroll[0]).toBeGreaterThanOrEqual(0)
      expect(next.scroll[0]).toBeLessThanOrEqual(50)
    }
  })
})
