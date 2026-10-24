import { describe, expect, it } from 'vitest'
import {
  releaseStop,
  sheetGeometry,
  validateSnaps,
} from '../src/bottom-sheet/geometry.js'

describe('bottom sheet stops in the usable window', () => {
  it('resolves percentages and growing content without changing logical snap identity', () => {
    const points = ['content', '50%', '90%'] as const
    const before = sheetGeometry(points, 800, 800, 800, 0, 20, 30, 260)
    const after = sheetGeometry(points, 800, 800, 800, 0, 20, 30, 420)
    expect(before.height).toBe(750)
    expect(before.stops.map((stop) => stop.height)).toEqual([260, 375, 675])
    expect(after.stops[0]).toEqual({ point: 'content', height: 420, y: 330 })
    expect(after.closedY).toBe(780)
  })

  it('does not subtract keyboard space twice when Android already resized the host', () => {
    const overlay = sheetGeometry(['100%'], 800, 800, 800, 300, 0, 0, 0)
    const resized = sheetGeometry(['100%'], 500, 500, 800, 300, 0, 0, 0)
    expect(overlay.height).toBe(500)
    expect(resized.height).toBe(500)
    expect(overlay.stops[0]!.y).toBe(0)
    expect(resized.stops[0]!.y).toBe(0)
  })

  it('uses only keyboard overlap with an inset host and does not add safe-bottom twice', () => {
    const inset = sheetGeometry(['100%'], 600, 700, 800, 300, 20, 34, 0)
    expect(inset.height).toBe(380)
    const aboveKeyboard = sheetGeometry(['100%'], 300, 400, 800, 300, 0, 10, 0)
    expect(aboveKeyboard.height).toBe(290)
  })

  it('clamps oversized content and DIP snaps after rotation', () => {
    const geometry = sheetGeometry(['content', 500], 320, 320, 320, 0, 0, 20, 900)
    expect(geometry.stops.map((stop) => stop.height)).toEqual([300, 300])
    expect(geometry.stops.map((stop) => stop.y)).toEqual([0, 0])
  })

  it('chooses different destinations for opposite fling directions at the same position', () => {
    const geometry = sheetGeometry(['25%', '75%'], 800, 800, 800, 0, 0, 0, 0)
    expect(releaseStop(geometry, 400, -1200, true)?.point).toBe('75%')
    expect(releaseStop(geometry, 400, 1200, true)?.point).toBe('25%')
    expect(releaseStop(geometry, 600, 1500, true)).toBeUndefined()
    expect(releaseStop(geometry, 600, 1500, false)?.point).toBe('25%')
  })

  it('rejects ambiguous and invalid snap configurations before taking ownership', () => {
    for (const points of [
      [],
      [0],
      [-5],
      [Infinity],
      ['0%'],
      ['101%'],
      ['50%', '50%'],
      ['50px'],
    ])
      expect(() => validateSnaps(points as never)).toThrow()
    expect(() => validateSnaps(['content', '.5%', 240, '100%'])).not.toThrow()
  })
})
