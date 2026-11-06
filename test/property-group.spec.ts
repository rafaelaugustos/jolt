import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { registerNativeProperty, propertyGroup } from '../src/native-property.js'
import {
  setNativePropertyDriver,
  type NativePropertyDriver,
} from '../src/native-property-driver.js'
import { configure, motionScope } from '../src/index.js'
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
