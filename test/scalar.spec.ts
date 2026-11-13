import { expect, it } from 'vitest'
import { scalarBounds, scalarSample } from '../src/core/scalar.js'
import { ArithmeticValueNode, NumericValue } from '../src/web/value.js'
import { FrameScheduler } from '../src/web/scheduler.js'

it('propagates derivatives through nonlinear arithmetic and defines singularities', () => {
  expect(scalarSample('mul', 3, 2, 4, -1)).toEqual({ value: 12, velocity: 5 })
  expect(scalarSample('div', 3, 2, 4, -1)).toEqual({ value: 0.75, velocity: 11 / 16 })
  expect(scalarSample('div', 3, 2, 0, 10)).toEqual({ value: 0, velocity: 0 })
  expect(scalarSample('mul', Number.MAX_VALUE, 2, 10)).toEqual({ value: 0, velocity: 0 })
  expect(scalarSample('clamp', 2, 10, 0, 0, 2)).toEqual({ value: 2, velocity: 0 })
  expect(scalarSample('min', 2, 10, 2, 20)).toEqual({ value: 2, velocity: 0 })
  expect(scalarSample('abs', -4, 2)).toEqual({ value: 4, velocity: -2 })
  expect(scalarSample('sin', Math.PI, 2).velocity).toBeCloseTo(-2)
  expect(scalarSample('velocity', 4, 10)).toEqual({ value: 10, velocity: 0 })
  expect(() => scalarBounds(2, 1)).toThrow()
})

function scene() {
  let time = 0,
    id = 0
  const frames = new Map<number, (time: number) => void>()
  const error = (error: unknown) => {
    throw error
  }
  const scheduler = new FrameScheduler({
    now: () => time,
    request: (cb) => {
      frames.set(++id, cb)
      return id
    },
    cancel: (id) => {
      frames.delete(id)
    },
    error,
  })
  const input = (n: number) => new NumericValue(scheduler, n, error, () => {})
  return {
    frames,
    scheduler,
    input,
    error,
    frame(t: number) {
      time = t
      const batch = [...frames.values()]
      frames.clear()
      batch.forEach((cb) => cb(time))
    },
  }
}

it('coalesces two inputs into one observer delivery with no extra frame or idle clock', () => {
  const s = scene(),
    a = s.input(1),
    b = s.input(2)
  const sum = new ArithmeticValueNode(a, 'add', b, undefined, s.error, () => {})
  const square = new ArithmeticValueNode(sum, 'mul', sum, undefined, s.error, () => {})
  const seen: number[] = []
  const stop = square.subscribe((value) => seen.push(value))
  a.set(3)
  b.set(4)
  expect(square.get()).toBe(49)
  s.frame(16)
  expect(seen).toEqual([49])
  expect(s.frames.size).toBe(0)
  stop()
  a.set(5)
  expect(square.get()).toBe(81)
  expect(s.frames.size).toBe(0)
  square.dispose()
  expect(a.disposed).toBe(false)
  expect(b.disposed).toBe(false)
})

it('disposes descendants when an input is disposed, without disposing borrowed siblings', () => {
  const s = scene(),
    a = s.input(1),
    b = s.input(2)
  const sum = new ArithmeticValueNode(a, 'add', b, undefined, s.error, () => {})
  const child = new ArithmeticValueNode(
    sum,
    'abs',
    undefined,
    undefined,
    s.error,
    () => {},
  )
  child.subscribe(() => {})
  a.dispose()
  expect(sum.disposed).toBe(true)
  expect(child.disposed).toBe(true)
  expect(b.disposed).toBe(false)
  expect(s.frames.size).toBe(0)
  expect(
    () => new ArithmeticValueNode(b, 'add', a, undefined, s.error, () => {}),
  ).toThrow()
})

it('rejects cross-runtime inputs and bounds graph depth', () => {
  const a = scene(),
    b = scene()
  expect(
    () =>
      new ArithmeticValueNode(
        a.input(1),
        'add',
        b.input(2),
        undefined,
        a.error,
        () => {},
      ),
  ).toThrow()
  let node: NumericValue = a.input(1)
  for (let i = 0; i < 32; i++)
    node = new ArithmeticValueNode(node, 'add', 1, undefined, a.error, () => {})
  expect(node.get()).toBe(33)
  expect(
    () => new ArithmeticValueNode(node, 'add', 1, undefined, a.error, () => {}),
  ).toThrow()
})

import fixtures from '../packages/swiftui/Tests/JoltCoreTests/Fixtures/scalar-vectors.json'
import { scalarProgram, type ScalarInstruction } from '../src/core/scalar-program.js'
it.each(fixtures)('matches portable scalar vectors: $name', (fixture) => {
  const sample = scalarProgram(
    fixture.program as ScalarInstruction[],
    fixture.sources.length,
  )(fixture.sources)
  expect(sample.value).toBeCloseTo(fixture.expected.value, 9)
  expect(sample.velocity).toBeCloseTo(fixture.expected.velocity, 9)
})
