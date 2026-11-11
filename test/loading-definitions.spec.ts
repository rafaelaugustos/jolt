import { describe, expect, it } from 'vitest'
import {
  loaderDefinition,
  loaderItems,
  revealRadius,
  shimmerDefinition,
  shimmerOffset,
} from '../src/core/loading.js'

describe('shared loading definitions', () => {
  it('places each loader copy like the native replicator', () => {
    const dots = loaderItems('dots', 50)
    expect(dots.map((item) => item.x)).toEqual([5, 25, 45])
    expect(dots.every((item) => item.width === 10 && item.height === 10)).toBe(true)
    expect(dots.every((item) => item.scaleX === 1 && item.opacity === 1)).toBe(true)
    const bars = loaderItems('bars', 100)
    expect(bars).toHaveLength(5)
    expect(bars[4]!.x).toBeCloseTo(94)
    expect(bars[0]!.height).toBe(75)
    const ring = loaderItems('ring', 100)
    expect(ring).toHaveLength(12)
    expect(ring[0]).toMatchObject({ x: 50, y: 8, opacity: 0.35 })
    expect(ring[3]!.x).toBeCloseTo(92)
    expect(ring[3]!.y).toBeCloseTo(50)
  })

  it('delays every copy by a fraction of the cycle', () => {
    const { duration } = loaderDefinition
    const first = loaderItems('dots', 48, 0, duration)
    expect(first.map((item) => item.scaleX)).toEqual([0.35, 0.35, 0.35])
    const peak = loaderItems('dots', 48, 0.3 * duration, duration)
    expect(peak[0]!.scaleX).toBeCloseTo(1)
    expect(peak[0]!.scaleY).toBeCloseTo(1)
    expect(peak[1]!.scaleX).toBeCloseTo(0.35 + 0.65 * (0.1 / 0.3))
    const bars = loaderItems('bars', 48, 0.45 * duration, duration)
    expect(bars[0]!.scaleX).toBe(1)
    expect(bars[0]!.scaleY).toBeCloseTo(0.675)
    const ring = loaderItems('ring', 48, duration / 12, duration)
    expect(ring[1]!.opacity).toBeCloseTo(1)
    expect(ring[0]!.opacity).toBeCloseTo(1 - 0.8 / 12)
    expect(loaderItems('ring', 48, duration, duration)[0]!.opacity).toBe(1)
  })

  it('sweeps the shimmer band across one width each way', () => {
    const { duration } = shimmerDefinition
    expect(shimmerOffset(0)).toBe(-1)
    expect(shimmerOffset(duration / 2)).toBe(0)
    expect(shimmerOffset(duration * 1.75)).toBe(0.5)
    expect(shimmerOffset(300, 600)).toBe(0)
  })

  it('reaches the farthest corner from any origin', () => {
    expect(revealRadius(200, 100, 100, 50)).toBeCloseTo(Math.hypot(100, 50))
    expect(revealRadius(200, 100, 0, 0)).toBeCloseTo(Math.hypot(200, 100))
    expect(revealRadius(200, 100, -50, 120)).toBeCloseTo(Math.hypot(250, 120))
  })
})
