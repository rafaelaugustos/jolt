import { describe, expect, it } from 'vitest'
import { parsePath } from '../src/svg-path.js'

const point = (
  path: string,
  progress: number,
  x: number,
  y: number,
  tolerance = 0.03,
) => {
  const p = parsePath(path).at(progress)
  expect(Math.abs(p.x - x)).toBeLessThanOrEqual(tolerance)
  expect(Math.abs(p.y - y)).toBeLessThanOrEqual(tolerance)
  return p
}

describe('SVG motion geometry', () => {
  it('measures by distance, not command count or Bezier parameter', () => {
    const p = parsePath('M0 0 L10 0 L110 0')
    expect(p.length).toBe(110)
    expect(p.at(0.5)).toEqual({ x: 55, y: 0, rotate: 0 })
    point('M0 0 C0 0 0 0 100 0', 0.5, 50, 0)
  })
  it('samples the requested cubic and its tangent', () => {
    const p = parsePath('M0 0 C 80 -120, 200 -120, 280 0')
    expect(p.at(0).rotate).toBeCloseTo((Math.atan2(-120, 80) * 180) / Math.PI)
    expect(p.at(1).rotate).toBeCloseTo((Math.atan2(120, 80) * 180) / Math.PI)
    point('M0 0 C 80 -120, 200 -120, 280 0', 0.5, 140, -90)
    expect(p.at(0.5).rotate).toBeCloseTo(0, 0)
    expect(p.length).toBeGreaterThan(280)
  })
  it('handles implicit lines after M, relative coordinates, H/V and close', () => {
    const path = 'm10 20 30 0 h10 v20 l-40 0 z'
    expect(parsePath(path).length).toBe(120)
    point(path, 0, 10, 20)
    point(path, 1, 10, 20)
    point('M0 0 H100 V100', 0.25, 50, 0)
    point('M0 0 H100 V100', 0.75, 100, 50)
  })
  it('reflects cubic and quadratic controls only after compatible commands', () => {
    const equivalent = (a: string, b: string) => {
      const p = parsePath(a),
        q = parsePath(b)
      for (let i = 0; i <= 20; i++) {
        expect(p.at(i / 20).x).toBeCloseTo(q.at(i / 20).x, 6)
        expect(p.at(i / 20).y).toBeCloseTo(q.at(i / 20).y, 6)
      }
    }
    equivalent(
      'M0 0 C0 -50 50 -50 50 0 S100 50 100 0',
      'M0 0 C0 -50 50 -50 50 0 C50 50 100 50 100 0',
    )
    equivalent('M0 0 Q50 -100 100 0 T200 0', 'M0 0 Q50 -100 100 0 Q150 100 200 0')
    equivalent('M0 0 L50 0 S100 50 100 0', 'M0 0 L50 0 C50 0 100 50 100 0')
    equivalent('M0 0 L100 0 T200 0', 'M0 0 L100 0 Q100 0 200 0')
    equivalent('m0 0 q50 -100 100 0 t100 0', 'M0 0 Q50 -100 100 0 T200 0')
  })
  it('reads compact decimals, signs, exponents and packed arc flags', () => {
    point('M.5.5L1e2-2e1', 1, 100, -20)
    const a = parsePath('M0 0 A50 50 0 01100 0'),
      b = parsePath('M0 0 A50 50 0 0 1 100 0')
    expect(a.at(0.5)).toEqual(b.at(0.5))
    point('M0 0 A50 50 0 01100 0', 0.5, 50, -50)
  })
  it('handles rotated elliptical arcs and normalized radii', () => {
    point('M0 -50 A50 25 90 0 1 0 50', 0.5, 25, 0)
    point('M0 0 A50 25 0 0 1 100 0', 0.5, 50, -25)
    point('M0 0 A-50 -25 0 0 0 100 0', 0.5, 50, 25)
    point('M0 0 A1 1 0 0 1 100 0', 0.5, 50, -50)
    const p = parsePath('M0 0 A80 30 40 1 1 120 40')
    expect(p.at(0).x).toBe(0)
    expect(p.at(1).x).toBe(120)
    expect(p.at(1).y).toBe(40)
    expect(p.length).toBeGreaterThan(Math.hypot(120, 40))
    const a = parsePath('M0 0 A80 80 0 0 1 100 0'),
      b = parsePath('M0 0 A80 80 0 1 1 100 0')
    expect(b.length).toBeGreaterThan(a.length * 2)
  })
  it('treats zero radii as lines and coincident arc endpoints as no movement', () => {
    point('M0 0 A0 50 0 0 1 100 0', 0.5, 50, 0)
    expect(parsePath('M10 20 A50 50 0 1 1 10 20').at(0.5)).toEqual({
      x: 10,
      y: 20,
      rotate: 0,
    })
    expect(parsePath('M10 20').at(0.5)).toEqual({ x: 10, y: 20, rotate: 0 })
  })
  it('unwraps heading continuously around circles, including small geometry', () => {
    for (const radius of [50, 0.01]) {
      const p = parsePath(
        `M${radius} 0 A${radius} ${radius} 0 1 1 ${-radius} 0 A${radius} ${radius} 0 1 1 ${radius} 0`,
      )
      expect(p.at(0).rotate).toBeCloseTo(90)
      expect(p.at(1).rotate).toBeCloseTo(450)
      let angle = p.at(0).rotate
      for (let i = 1; i <= 100; i++) {
        const next = p.at(i / 100).rotate
        expect(next - angle).toBeGreaterThan(-0.01)
        expect(next - angle).toBeLessThan(10)
        angle = next
      }
    }
  })
  it('keeps headings finite at stationary controls and reversals', () => {
    const p = parsePath('M0 0 C0 0 100 0 100 0 C200 0 -100 0 100 0')
    for (let i = 0; i <= 100; i++) {
      const pose = p.at(i / 100)
      expect(Object.values(pose).every(Number.isFinite)).toBe(true)
    }
  })
  it.each([
    '',
    '  ',
    'L0 0',
    'M0',
    'M0 0 C1 2',
    'M0 0 X10 20',
    'M0 0 M10 20',
    'M,0 0',
    'M0,,0',
    'M0 0,',
    'M0 0Z10 20',
    'M0 0 A10 20 0 2 0 20 20',
    'M0 0 A10 20 0 0.5 1 20 20',
    'M0 0 LNaN 0',
    'M0 0 L1e999 0',
  ])('rejects malformed path %s', (data) => {
    expect(() => parsePath(data)).toThrow()
  })
  it('bounds source size, coordinate range, relative accumulation and command count', () => {
    expect(() => parsePath('M0 0' + ' '.repeat(100001))).toThrow(/long/)
    expect(() => parsePath('M1000001 0')).toThrow(/1000000/)
    expect(() => parsePath('M999999 0 l2 0')).toThrow(/1000000/)
    expect(() => parsePath('M0 0' + ' L1 1'.repeat(1025))).toThrow(/segments/)
  })
})
