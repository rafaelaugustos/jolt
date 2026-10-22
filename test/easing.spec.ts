import { describe, expect, it } from 'vitest'
import { cubicBezier, resolveEasing, type EasingName } from '../src/easing.js'

const names: EasingName[] = [
  'linear',
  'ease',
  'easeIn',
  'easeOut',
  'easeInOut',
  'circIn',
  'circOut',
  'circInOut',
  'backIn',
  'backOut',
  'backInOut',
  'anticipate',
  ...(['quad', 'cubic', 'quart', 'quint', 'sine', 'expo'] as const).flatMap(
    (family) =>
      [`${family}In`, `${family}Out`, `${family}InOut`] as const satisfies EasingName[],
  ),
]

function bezierPoint([x1, y1, x2, y2]: number[], t: number) {
  const at = (a: number, b: number) =>
    3 * (1 - t) ** 2 * t * a + 3 * (1 - t) * t ** 2 * b + t ** 3
  return { x: at(x1!, x2!), y: at(y1!, y2!) }
}

describe('easing', () => {
  it.each(names)('%s starts at 0 and ends at 1', (name) => {
    const easing = resolveEasing(name)
    expect(easing(0)).toBeCloseTo(0, 6)
    expect(easing(1)).toBe(1)
  })

  it.each([
    [0.25, 0.1, 0.25, 1],
    [0.42, 0, 0.58, 1],
    [0.34, 1.56, 0.64, 1],
    [0.68, -0.6, 0.32, 1.6],
  ])('solves cubic-bezier(%s, %s, %s, %s)', (...points) => {
    const easing = cubicBezier(...(points as [number, number, number, number]))
    for (let t = 0.05; t < 1; t += 0.05) {
      const { x, y } = bezierPoint(points, t)
      expect(easing(x)).toBeCloseTo(y, 5)
    }
  })

  it('takes a cubic bezier as an array, or a function', () => {
    expect(resolveEasing([0.42, 0, 0.58, 1])(0.5)).toBeCloseTo(0.5, 6)
    const custom = (p: number) => p * p
    expect(resolveEasing(custom)).toBe(custom)
  })

  it('overshoots with back easings and pulls back with anticipate', () => {
    const backOut = resolveEasing('backOut')
    const anticipate = resolveEasing('anticipate')
    const samples = Array.from({ length: 99 }, (_, i) => (i + 1) / 100)

    expect(Math.max(...samples.map(backOut))).toBeGreaterThan(1)
    expect(Math.min(...samples.map(anticipate))).toBeLessThan(0)
  })

  it('matches the standard polynomial, sine and expo curves', () => {
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(resolveEasing('quadIn')(p)).toBeCloseTo(p * p, 9)
      expect(resolveEasing('cubicOut')(p)).toBeCloseTo(1 - (1 - p) ** 3, 9)
      expect(resolveEasing('quartIn')(p)).toBeCloseTo(p ** 4, 9)
      expect(resolveEasing('quintOut')(p)).toBeCloseTo(1 - (1 - p) ** 5, 9)
      expect(resolveEasing('sineInOut')(p)).toBeCloseTo(
        -(Math.cos(Math.PI * p) - 1) / 2,
        9,
      )
      expect(resolveEasing('expoOut')(p)).toBeCloseTo(1 - 2 ** (-10 * p), 9)
    }
    expect(resolveEasing('cubicInOut')(0.25)).toBeCloseTo(4 * 0.25 ** 3, 9)
    expect(resolveEasing('cubicInOut')(0.75)).toBeCloseTo(1 - (-2 * 0.75 + 2) ** 3 / 2, 9)
    expect(resolveEasing('expoIn')(0)).toBe(0)
  })

  it('rejects unknown names', () => {
    expect(() => resolveEasing('bouncy' as EasingName)).toThrow('Unknown easing "bouncy"')
  })
})
