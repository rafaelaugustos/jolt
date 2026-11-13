import { afterEach, expect, it } from 'vitest'
import {
  animate,
  bind,
  motionValue,
  set,
  springValue,
  type DerivedValue,
} from '../src/index.js'
import { scalarProgram, type ScalarInstruction } from '../src/core/scalar-program.js'
import {
  setLiveSpringDriver,
  type LiveNode,
  type LiveInput,
  type LiveMapping,
} from '../src/live-spring-driver.js'
import { createView, driver } from './helpers.js'

class Node implements LiveNode {
  value = 0
  speed = 0
  active = false
  ended = false
  inputsList: readonly LiveInput[] = []
  samples?: () => { value: number; velocity: number }
  constructor(value: number) {
    this.value = value
  }
  position() {
    return this.samples?.().value ?? this.value
  }
  velocity() {
    return this.samples?.().velocity ?? this.speed
  }
  moving() {
    return this.active
  }
  compute(sources: readonly LiveNode[], program: readonly ScalarInstruction[]) {
    const evaluate = scalarProgram(program, sources.length)
    this.samples = () =>
      evaluate(
        sources.map((source) => ({
          value: source.position(),
          velocity: source.velocity(),
        })),
      )
  }
  follow(source: LiveNode) {
    this.samples = () => ({ value: source.position(), velocity: source.velocity() })
  }
  update(input: LiveInput) {
    this.value = input.value
    this.active = input.running
  }
  inputs(rest: number, inputs: readonly LiveInput[]) {
    this.inputsList = inputs
    this.value = rest + inputs.reduce((sum, input) => sum + input.value, 0)
  }
  reduced() {}
  paused() {}
  bind(_view: unknown, _property: string, _maps: readonly LiveMapping[]) {
    return { value: () => this.position(), layers() {}, cancel() {} }
  }
  dispose() {
    this.ended = true
  }
}
afterEach(() => setLiveSpringDriver(undefined))

it('compiles independent finite clocks into native tracks and retargets at boundaries', () => {
  const a = motionValue(0),
    b = motionValue(0),
    total = a.add(b).mul(2)
  const view = createView(),
    stop = bind(view, { x: total })
  animate(a, 100, { type: 'tween', duration: 1000, ease: 'linear' })
  animate(b, 50, { type: 'tween', duration: 500, ease: 'linear' })
  const track = driver.played.at(-1)!.track
  expect(track.valueAt(250)).toBeCloseTo(100)
  expect(track.valueAt(750)).toBeCloseTo(250)
  expect(track.valueAt(1000)).toBeCloseTo(300)
  expect(driver.frames.size).toBe(0)
  set(a, 10)
  expect(driver.played.at(-1)!.track.valueAt(250)).toBeCloseTo(70)
  stop()
  total.dispose()
  a.dispose()
  b.dispose()
})

it('combines a native input and sampled sources without a JavaScript frame listener', () => {
  const nodes: Node[] = []
  setLiveSpringDriver({
    create(initial) {
      const node = new Node(initial)
      nodes.push(node)
      return node
    },
    sync() {},
  })
  const source = motionValue(0),
    live = springValue(source, { duration: 0 })
  const sheet = motionValue(20)
  const tilt = live.mul(0.04).add(live.velocity().div(1800).clamp(-6, 6)).sub(sheet)
  const views = Array.from({ length: 16 }, () => createView())
  const stop = bind(views, { rotate: tilt })
  expect(nodes.length).toBe(3) // shared live source, sampled bridge, one combined program
  nodes[0]!.value = 100
  nodes[0]!.speed = 3600
  expect(nodes[2]!.position()).toBeCloseTo(-14)
  expect(tilt.get()).toBeCloseTo(-14)
  expect(driver.frames.size).toBe(0)
  stop()
  expect(nodes[2]!.ended).toBe(true)
  expect(nodes[1]!.ended).toBe(true)
  expect(live.disposed).toBe(false)
  tilt.dispose()
  live.dispose()
  source.dispose()
  sheet.dispose()
})

it('disposes borrowed descendants without stopping siblings; rejects disposed/cyclic-depth inputs', () => {
  const a = motionValue(2),
    b = motionValue(3),
    sum = a.add(b),
    child = sum.abs()
  a.dispose()
  expect(sum.disposed).toBe(true)
  expect(child.disposed).toBe(true)
  expect(b.disposed).toBe(false)
  expect(() => b.add(a)).toThrow()
  let deep: DerivedValue = b
  for (let i = 0; i < 32; i++) deep = deep.add(1)
  expect(deep.get()).toBe(35)
  expect(() => deep.add(1)).toThrow()
  b.dispose()
})
