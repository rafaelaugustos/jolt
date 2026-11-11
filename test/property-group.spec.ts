import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerNativeProperty, propertyGroup } from '../src/native-property.js'
import {
  setNativePropertyDriver,
  type NativePropertyDriver,
} from '../src/native-property-driver.js'
import { configure, motionScope, motionValue } from '../src/index.js'
import { createAdapterInspector } from '../src/core/adapter-inspection.js'
import { driver } from './helpers.js'

type Sink = { value: number; alive: boolean }
const players: {
  time: number
  paused: boolean
  cancelled: boolean
  end: (done: boolean) => void
}[] = []
const native: NativePropertyDriver = {
  validate() {},
  alive: (sink) => (sink as Sink).alive,
  read: (sink) => [(sink as Sink).value],
  write: (sink, values) => {
    ;(sink as Sink).value = values[0]!
  },
  dispose: (sink) => {
    ;(sink as Sink).alive = false
  },
  play(_sink, _track, _samples, _final, end) {
    const state = { time: 0, paused: false, cancelled: false, end }
    players.push(state)
    return {
      control: (time, paused) => {
        state.time = time
        state.paused = paused
      },
      cancel: () => {
        state.cancelled = true
      },
    }
  },
}
let serial = 0
function make(spatial = false) {
  const factory = registerNativeProperty<number>({
    name: `group${serial++}/value`,
    units: ['units'],
    platforms: ['ios', 'android'],
    spatial,
    encode: (v) => [v],
    decode: (v) => v[0]!,
    create: (target) => target,
  })
  const sinks: Sink[] = Array.from({ length: 3 }, () => ({ value: 0, alive: true }))
  return { sinks, factory, props: sinks.map(factory) }
}
beforeEach(() => {
  players.length = 0
  setNativePropertyDriver(native)
})
afterEach(() => {
  setNativePropertyDriver(undefined)
  vi.restoreAllMocks()
})

it('validates every member before replacing any valid animation', () => {
  const { props } = make(),
    a = props[0]!.animate(5, { duration: 1000 })
  const group = propertyGroup({ a: props[0]!, b: props[1]! })
  expect(() => group.animate({ a: 4, b: NaN })).toThrow(/finite/)
  expect(players).toHaveLength(1)
  expect(players[0]!.cancelled).toBe(false)
  expect(() => group.animate({ a: 4 } as any)).toThrow(/every/)
  a.stop()
  group.dispose()
  props.forEach((p) => p.dispose())
})
it('controls three targets from one clock and settles once', async () => {
  const { props } = make(),
    group = propertyGroup({ a: props[0]!, b: props[1]!, c: props[2]! })
  const a = group.animate(
    { a: 1, b: 2, c: 3 },
    { duration: 1000, delay: 100, ease: 'linear' },
  )
  const complete = vi.fn()
  void a.finished.then(complete)
  driver.advance(300)
  a.pause()
  expect(players.map((p) => [p.time, p.paused])).toEqual([
    [300, true],
    [300, true],
    [300, true],
  ])
  a.progress = 0.5
  expect(players.map((p) => p.time)).toEqual([550, 550, 550])
  a.play()
  driver.advance(550)
  await expect(a.finished).resolves.toBe(true)
  expect(group.get()).toEqual({ a: 1, b: 2, c: 3 })
  expect(complete).toHaveBeenCalledOnce()
  expect(players.every((p) => p.cancelled)).toBe(true)
  expect(driver.frames.size).toBe(0)
  group.dispose()
  expect(props[0]!.get()).toBe(1)
  props.forEach((p) => p.dispose())
})
it('a replacement of one member cancels its whole group but preserves unrelated channels', async () => {
  const { props } = make(),
    group = propertyGroup({ a: props[0]!, b: props[1]! })
  const a = group.animate({ a: 10, b: 20 }, { duration: 1000 })
  const unrelated = props[2]!.animate(30, { duration: 1000 })
  const replacement = props[0]!.animate(40, { duration: 1000 })
  await expect(a.finished).resolves.toBe(false)
  expect(players[0]!.cancelled && players[1]!.cancelled).toBe(true)
  expect(players[2]!.cancelled).toBe(false)
  group.stop()
  expect(players[3]!.cancelled).toBe(false)
  replacement.stop()
  unrelated.stop()
  group.dispose()
  props.forEach((p) => p.dispose())
})
it('rejects alias channels and stops every member after partial native setup failure', () => {
  const { props, factory, sinks } = make(),
    alias = factory(sinks[0]!)
  expect(() => propertyGroup({ a: props[0]!, alias })).toThrow(/twice/)
  const group = propertyGroup({ a: props[0]!, b: props[1]! })
  const original = native.play
  let calls = 0
  vi.spyOn(native, 'play').mockImplementation((...args) => {
    if (++calls === 2) throw new Error('native setup')
    return original(...args)
  })
  expect(() => group.animate({ a: 2, b: 3 }, { duration: 1000 })).toThrow(/setup/)
  expect(players[0]!.cancelled).toBe(true)
  group.dispose()
  props.forEach((p) => p.dispose())
  alias.dispose()
})
it('rolls back completed writes on setter failure without restarting cancelled motion', () => {
  const { props } = make(),
    group = propertyGroup({ a: props[0]!, b: props[1]! })
  const write = native.write
  vi.spyOn(native, 'write').mockImplementation((sink, values) => {
    if (values[0] === 3) throw new Error('setter')
    write(sink, values)
  })
  expect(() => group.set({ a: 2, b: 3 })).toThrow(/failed/)
  expect(group.get()).toEqual({ a: 0, b: 0 })
  group.dispose()
  props.forEach((p) => p.dispose())
})
it('releases the whole group on target destruction and preserves manual pauses through scope suspension', async () => {
  const { props } = make(),
    scope = motionScope(),
    group = scope.resource(() => propertyGroup({ a: props[0]!, b: props[1]! }))
  const a = group.animate({ a: 1, b: 2 }, { duration: 1000 })
  a.pause()
  scope.suspend()
  scope.resume()
  expect(a.paused).toBe(true)
  props[1]!.dispose()
  await expect(a.finished).resolves.toBe(false)
  expect(players.every((p) => p.cancelled)).toBe(true)
  expect(() => group.animate({ a: 1, b: 2 })).toThrow(/disposed/)
  scope.dispose()
  props.forEach((p) => p.dispose())
})
it('settles spatial members immediately under reduced motion', async () => {
  const { props } = make(true),
    group = propertyGroup({ a: props[0]!, b: props[1]! })
  configure({ reducedMotion: 'always' })
  const a = group.animate({ a: 1, b: 2 }, { duration: 1000 })
  await expect(a.finished).resolves.toBe(true)
  expect(group.get()).toEqual({ a: 1, b: 2 })
  expect(players).toHaveLength(0)
  group.dispose()
  props.forEach((p) => p.dispose())
})

it('rejects excessive sampled vectors before native playback or interruption', () => {
  const factory = registerNativeProperty<number>({
    name: `budget${serial++}/value`,
    units: Array(64).fill('number'),
    platforms: ['ios', 'android'],
    encode: (value) => Array(64).fill(value),
    decode: (values) => values[0]!,
    create: (target) => target,
  })
  const property = factory({ value: 0, alive: true })
  const valid = property.animate(1, { duration: 1000 })
  expect(() => property.animate(2, { duration: 100000 })).toThrow(
    /sampled-component budget/,
  )
  expect(players).toHaveLength(1)
  expect(players[0]!.cancelled).toBe(false)
  valid.stop()
  property.dispose()
})

function inspect(props: object[]) {
  let tick = 0
  const inspector = createAdapterInspector({
    development: true,
    capacity: 512,
    now: () => tick++,
  })
  props.forEach((property, i) => inspector.watch(property, `p${i}`))
  const count = (kind: string) =>
    props.map(
      (_, i) =>
        inspector.read().events.filter((e) => e.target === `p${i}` && e.kind === kind)
          .length,
    )
  return { inspector, count }
}

it('an overlapping group cancels the whole older group once and leaves it reusable', async () => {
  const { props, sinks } = make(),
    { inspector, count } = inspect(props)
  const first = propertyGroup({ a: props[0]!, b: props[1]! }),
    second = propertyGroup({ b: props[1]!, c: props[2]! })
  const older = first.animate({ a: 10, b: 20 }, { duration: 1000 }),
    settled = vi.fn()
  void older.finished.then(settled)
  driver.advance(200)
  const newer = second.animate({ b: 30, c: 40 }, { duration: 1000 })
  await expect(older.finished).resolves.toBe(false)
  expect(players.map((p) => p.cancelled)).toEqual([true, true, false, false])
  expect(sinks[0]!.value).toBe(0)
  first.stop()
  expect(players[2]!.cancelled || players[3]!.cancelled).toBe(false)
  driver.advance(1000)
  await expect(newer.finished).resolves.toBe(true)
  expect(second.get()).toEqual({ b: 30, c: 40 })
  const back = first.animate({ a: 1, b: 2 }, { duration: 500 })
  driver.advance(500)
  await expect(back.finished).resolves.toBe(true)
  expect(sinks.map((s) => s.value)).toEqual([1, 2, 40])
  expect(settled).toHaveBeenCalledOnce()
  expect(count('cancel')).toEqual([1, 1, 0])
  expect(count('complete')).toEqual([1, 2, 1])
  expect(count('replace')).toEqual([0, 1, 0])
  inspector.dispose()
  first.dispose()
  second.dispose()
  props.forEach((p) => p.dispose())
})

it('set() or bind() on one member cancels the group without writing the other members', async () => {
  const { props, sinks } = make(),
    group = propertyGroup({ a: props[0]!, b: props[1]!, c: props[2]! })
  const first = group.animate({ a: 1, b: 2, c: 3 }, { duration: 1000 })
  props[1]!.set(7)
  await expect(first.finished).resolves.toBe(false)
  expect(sinks.map((s) => s.value)).toEqual([0, 7, 0])
  expect(players.every((p) => p.cancelled)).toBe(true)
  const second = group.animate({ a: 1, b: 2, c: 3 }, { duration: 1000 })
  const unbind = props[2]!.bind(motionValue(5), (value) => value)
  await expect(second.finished).resolves.toBe(false)
  expect(sinks.map((s) => s.value)).toEqual([0, 7, 5])
  expect(players.every((p) => p.cancelled)).toBe(true)
  driver.advance(2000)
  expect(sinks.map((s) => s.value)).toEqual([0, 7, 5])
  unbind()
  group.dispose()
  props.forEach((p) => p.dispose())
})

it('ignores repeated and late native end callbacks and completes each run once', async () => {
  const { props } = make(),
    { inspector, count } = inspect(props.slice(0, 2)),
    group = propertyGroup({ a: props[0]!, b: props[1]! })
  const settled = vi.fn()
  const lost = group.animate({ a: 1, b: 2 }, { duration: 1000 })
  void lost.finished.then(settled)
  const [a, b] = players
  a!.end(false)
  a!.end(false)
  b!.end(true)
  await expect(lost.finished).resolves.toBe(false)
  expect(b!.cancelled).toBe(true)
  const next = group.animate({ a: 3, b: 4 }, { duration: 1000 })
  void next.finished.then(settled)
  a!.end(false)
  b!.end(false)
  driver.advance(400)
  next.progress = 1
  driver.advance(1000)
  players[2]!.end(true)
  players[3]!.end(false)
  next.stop()
  group.stop()
  await expect(next.finished).resolves.toBe(true)
  expect(settled.mock.calls).toEqual([[false], [true]])
  expect(group.get()).toEqual({ a: 3, b: 4 })
  expect(count('cancel')).toEqual([1, 1])
  expect(count('complete')).toEqual([1, 1])
  expect(driver.frames.size).toBe(0)
  inspector.dispose()
  group.dispose()
  group.dispose()
  props.forEach((p) => p.dispose())
})

it('a member losing its native target cancels every member and frees the channels', async () => {
  const { props, sinks } = make(),
    group = propertyGroup({ a: props[0]!, b: props[1]!, c: props[2]! })
  const run = group.animate({ a: 1, b: 2, c: 3 }, { duration: 1000 })
  driver.advance(300)
  sinks[1]!.alive = false
  players[1]!.end(false)
  await expect(run.finished).resolves.toBe(false)
  expect(players.every((p) => p.cancelled)).toBe(true)
  expect(() => group.animate({ a: 1, b: 2, c: 3 })).toThrow(/lost its native target/)
  expect(players).toHaveLength(3)
  const alone = props[0]!.animate(9, { duration: 100 })
  driver.advance(100)
  await expect(alone.finished).resolves.toBe(true)
  expect(sinks[0]!.value).toBe(9)
  group.dispose()
  props.forEach((p) => p.dispose())
})
