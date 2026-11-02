import { expect, it } from 'vitest'
import { numericMap } from '../src/core/numeric-map.js'
import { NumericValue, DerivedValueNode } from '../src/web/value.js'
import { FrameScheduler } from '../src/web/scheduler.js'

it('maps descending ranges, clamps boundaries and exposes the selected derivative', () => {
  const m = numericMap([20, 10, 0], [40, 10, 0])
  expect(m.sample(-1)).toEqual({ value: 0, slope: 0 })
  expect(m.sample(10)).toEqual({ value: 10, slope: 1 })
  expect(m.sample(15)).toEqual({ value: 25, slope: 3 })
  expect(m.sample(20)).toEqual({ value: 40, slope: 0 })
  expect(numericMap([0, 10], [20, 0], { clamp: false }).sample(20)).toEqual({
    value: -20,
    slope: -2,
  })
})
it('rejects ambiguous or overflowing maps and copies the source arrays', () => {
  for (const input of [
    [0, 0],
    [0, 1, 0],
    [0, Infinity],
    [-1e308, 1e308],
  ])
    expect(() => numericMap(input, input)).toThrow()
  expect(() => numericMap([0, 1], [0])).toThrow()
  expect(() => numericMap([0, 1], [0, 1], { clamp: 1 as unknown as boolean })).toThrow()
  const input = [0, 1],
    output = [0, 2],
    m = numericMap(input, output)
  input[1] = 0
  output[1] = 20
  expect(m.sample(0.5).value).toBe(1)
  expect(() => numericMap([0, 1], [0, 1e308], { clamp: false }).sample(10)).toThrow()
})
it('keeps unused graphs lazy, batches observations, propagates velocities and ends descendants', () => {
  let now = 0,
    id = 0,
    forgotten = 0
  const frames = new Map<number, (n: number) => void>()
  const scheduler = new FrameScheduler({
    now: () => now,
    request: (cb) => {
      frames.set(++id, cb)
      return id
    },
    cancel: (id) => {
      frames.delete(id)
    },
    error: (e) => {
      throw e
    },
  })
  const root = new NumericValue(
    scheduler,
    0,
    (e) => {
      throw e
    },
    () => {},
  )
  const derive = (source: NumericValue) =>
    new DerivedValueNode(
      source,
      numericMap([0, 100], [0, 200], { clamp: false }),
      (e) => {
        throw e
      },
      () => {
        forgotten++
      },
    )
  const a = derive(root),
    b = derive(a),
    independent = derive(root)
  now = 10
  root.set(1)
  expect(b.get()).toBe(4)
  expect(b.getVelocity()).toBe(400)
  expect(frames.size).toBe(0)
  const observed: number[] = []
  const stop = b.subscribe((n) => observed.push(n))
  now = 20
  root.set(2)
  now = 30
  root.set(3)
  for (const callback of [...frames.values()]) callback(now)
  frames.clear()
  expect(observed).toEqual([12])
  stop()
  a.dispose()
  expect(b.disposed).toBe(true)
  expect(independent.disposed).toBe(false)
  expect(b.get()).toBe(12)
  expect(b.getVelocity()).toBe(0)
  let leaf: NumericValue = root
  for (let i = 0; i < 32; i++) leaf = derive(leaf)
  expect(() => derive(leaf)).toThrow(/32/)
  root.dispose()
  expect(independent.disposed).toBe(true)
  expect(forgotten).toBe(35)
  expect(scheduler.size).toBe(0)
})
