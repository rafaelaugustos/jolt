import { describe, expect, it } from 'vitest'
import { animate, bind, motionValue, set } from '../src/index.js'
import { createView, driver } from './helpers.js'

describe('motion value input ranges', () => {
  it('maps a closed-to-open offset without reversing the caller arrays', () => {
    const input = Object.freeze([380, 0])
    const output = Object.freeze([0, 1])
    const offset = motionValue(380)
    const progress = offset.to(input, output)
    for (const [value, expected] of [
      [500, 0],
      [380, 0],
      [285, 0.25],
      [0, 1],
      [-30, 1],
    ]) {
      set(offset, value!)
      expect(progress.get()).toBeCloseTo(expected!)
    }
    expect(input).toEqual([380, 0])
    expect(output).toEqual([0, 1])
  })

  it.each([true, false])(
    'preserves paired multi-stop mappings with clamp=%s',
    (clamp) => {
      const value = motionValue()
      const input = [-20, -5, 10, 60]
      const output = [9, -4, 2, 0]
      const ascending = value.to(input, output, { clamp })
      const descending = value.to([...input].reverse(), [...output].reverse(), { clamp })
      for (const at of [-80, -20, -12, -5, 0, 10, 22, 60, 100]) {
        set(value, at)
        expect(descending.get()).toBeCloseTo(ascending.get())
      }
    },
  )

  it('extends the paired endpoint segments when unclamped', () => {
    const value = motionValue()
    const mapped = value.to([30, 10, -10], [0, 10, 50], { clamp: false })
    set(value, 50)
    expect(mapped.get()).toBe(-10)
    set(value, -30)
    expect(mapped.get()).toBe(90)
  })

  it('maps and clamps colors in either direction', () => {
    const value = motionValue()
    const ascending = value.to([-1, 0, 1], ['red', '#2468ac', 'white'])
    const descending = value.to([1, 0, -1], ['white', '#2468ac', 'red'])
    for (const at of [-2, -1, -0.5, 0, 0.7, 1, 2]) {
      set(value, at)
      expect(descending.get().argb).toBe(ascending.get().argb)
    }
  })

  it('agrees with bound native tracks through derived chains and spring overshoot', () => {
    const value = motionValue(380)
    const progress = value.to([380, 0], [0, 1], { clamp: false })
    const mapped = progress.to([1, 0], [-80, 120], { clamp: false })
    const clamped = value.to([380, 0], [0, 1])
    const color = clamped.to([1, 0], ['white', 'black'])
    const view = createView()
    bind(view, { x: mapped, opacity: clamped, backgroundColor: color })
    animate(value, 0, 'bouncy')
    const x = driver.last('x').track
    const opacity = driver.last('opacity').track
    const tint = driver.last('backgroundColor').track
    expect(Math.min(...x.values)).toBeLessThan(-80)
    expect(Math.min(...opacity.values)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...opacity.values)).toBeLessThanOrEqual(1)
    let elapsed = 0
    for (const at of [0, 30, 80, 150, 300, 600]) {
      driver.advance(at - elapsed)
      elapsed = at
      expect(mapped.get()).toBeCloseTo(x.valueAt(at))
      expect(clamped.get()).toBeCloseTo(opacity.valueAt(at))
      expect(color.get().argb >>> 0).toBe(tint.valueAt(at) >>> 0)
    }
  })

  it.each([true, false])('preserves duplicate-stop steps with clamp=%s', (clamp) => {
    const value = motionValue()
    const ascending = value.to([0, 1, 1, 2], [0, 10, 20, 30], { clamp })
    const descending = value.to([2, 1, 1, 0], [30, 20, 10, 0], { clamp })
    for (const [at, expected] of [
      [0, 0],
      [0.5, 5],
      [1, 10],
      [1.5, 25],
      [2, 30],
    ]) {
      set(value, at!)
      expect(ascending.get()).toBe(expected)
      expect(descending.get()).toBe(expected)
    }
    set(value, 1 + 1e-6)
    expect(descending.get()).toBeCloseTo(20)
  })

  it.each([true, false])('preserves duplicate endpoints with clamp=%s', (clamp) => {
    const value = motionValue()
    const ascending = value.to([0, 0, 1, 1], [10, 20, 30, 40], { clamp })
    const descending = value.to([1, 1, 0, 0], [40, 30, 20, 10], { clamp })
    for (const at of [-1, 0, 1e-6, 0.5, 1 - 1e-6, 1, 2]) {
      set(value, at)
      expect(descending.get()).toBe(ascending.get())
    }
  })

  it('retains the existing all-equal range behavior', () => {
    const value = motionValue()
    const clamped = value.to([2, 2, 2], [10, 20, 30])
    const free = value.to([2, 2, 2], [10, 20, 30], { clamp: false })
    for (const [at, held, extended] of [
      [1, 10, 10],
      [2, 10, 20],
      [3, 30, 30],
    ]) {
      set(value, at!)
      expect(clamped.get()).toBe(held)
      expect(free.get()).toBe(extended)
    }
  })

  it.each([
    [0, 2, 1],
    [2, 0, 1],
    [0, 1, 0],
    [1, 0, 1],
  ])('rejects direction changes in %j', (...input) => {
    expect(() => motionValue().to(input, [0, 1, 2])).toThrow(/cannot change direction/)
  })

  it.each([NaN, Infinity, -Infinity, '3', null])(
    'rejects non-finite or non-number inputs: %s',
    (invalid) => {
      expect(() => motionValue().to([3, invalid, 0] as number[], [0, 1, 2])).toThrow(
        /finite numbers/,
      )
    },
  )
})
