import { afterEach, expect, it } from 'vitest'
import { Application, type View } from '@nativescript/core'
import {
  bind,
  motionValue,
  scrollLinked,
  scrollValue,
  springValue,
} from '../src/index.js'
import { inspectScrollValue } from '../src/motion-value.js'
import { setScrollSourceDriver, type NativeScrollSource } from '../src/scroll-source.js'
import {
  setLiveSpringDriver,
  type LiveInput,
  type LiveMapping,
  type LiveNode,
} from '../src/live-spring-driver.js'
import { scalarProgram, type ScalarInstruction } from '../src/core/scalar-program.js'
import { numericMap } from '../src/core/numeric-map.js'
import { ScrollView } from './shims/core.js'
import { createView, driver } from './helpers.js'

class Node implements LiveNode {
  value = 0
  speed = 0
  active = false
  ended = false
  reader?: () => { value: number; velocity: number }
  position() {
    return this.reader?.().value ?? this.value
  }
  velocity() {
    return this.reader?.().velocity ?? this.speed
  }
  moving() {
    return this.active
  }
  follow(source: LiveNode) {
    this.reader = () => ({ value: source.position(), velocity: source.velocity() })
  }
  update(input: LiveInput) {
    this.value = input.value
  }
  inputs(rest: number, inputs: readonly LiveInput[]) {
    this.value = rest + inputs.reduce((sum, input) => sum + input.value, 0)
  }
  compute(sources: readonly LiveNode[], program: readonly ScalarInstruction[]) {
    const evaluate = scalarProgram(program, sources.length)
    this.reader = () =>
      evaluate(
        sources.map((source) => ({
          value: source.position(),
          velocity: source.velocity(),
        })),
      )
  }
  reduced() {}
  paused() {}
  bind(_view: View, _property: string, maps: readonly LiveMapping[]) {
    return {
      value: () =>
        maps.reduce(
          (value, map) =>
            numericMap(map.input, map.output, { clamp: map.clamp }).sample(value).value,
          this.position(),
        ),
      layers() {},
      cancel() {},
    }
  }
  dispose() {
    this.ended = true
  }
}
function scene() {
  const nodes: Node[] = [],
    handles: (NativeScrollSource & {
      observing: boolean
      active: boolean
      ended: boolean
      event(value: number): void
    })[] = []
  setLiveSpringDriver({
    create(value) {
      const node = new Node()
      node.value = value
      nodes.push(node)
      return node
    },
    sync() {},
  })
  setScrollSourceDriver((view, input, _axis, _height, changed) => {
    const node = input as Node
    node.value = (view as unknown as ScrollView).verticalOffset
    let updates = 0,
      callbacks = 0
    const handle = {
      observing: false,
      active: true,
      ended: false,
      enabled(value: boolean) {
        this.active = value
      },
      observe(value: boolean) {
        this.observing = value
      },
      refresh() {},
      snapshot() {
        return { offset: node.value, updates, callbacks }
      },
      dispose() {
        this.active = false
        this.ended = true
      },
      event(value: number) {
        if (!this.active) return
        updates++
        node.value = value
        node.active = true
        if (this.observing) {
          callbacks++
          changed()
        }
      },
    }
    handles.push(handle)
    return handle
  })
  return { nodes, handles }
}
afterEach(() => {
  setScrollSourceDriver()
  setLiveSpringDriver(undefined)
})

it('has no Jolt callback per native scroll until a derived value is explicitly subscribed', () => {
  const s = scene(),
    scroll = new ScrollView(),
    value = scrollValue(scroll as never)
  const combined = value.mul(2).add(3),
    off = bind(createView(), { y: combined })
  s.handles[0]!.event(40)
  expect(combined.get()).toBe(83)
  expect(inspectScrollValue(value)?.callbacks).toBe(0)
  expect(driver.frames.size).toBe(0)
  const seen: number[] = [],
    unobserve = combined.subscribe((v) => seen.push(v))
  expect(s.handles[0]!.observing).toBe(true)
  s.handles[0]!.event(60)
  driver.advance(16)
  expect(seen.at(-1)).toBe(123)
  expect(inspectScrollValue(value)?.callbacks).toBe(1)
  unobserve()
  expect(s.handles[0]!.observing).toBe(false)
  expect(driver.frames.size).toBe(0)
  off()
  combined.dispose()
  value.dispose()
})
it('switches, unloads, suspends and disposes observers without disposing borrowed graphs', () => {
  const s = scene(),
    a = new ScrollView(),
    b = new ScrollView(),
    value = scrollValue(a as never)
  b.verticalOffset = 80
  value.ref(b as never)
  expect(s.handles[0]!.ended).toBe(true)
  expect(value.get()).toBe(80)
  Application.notify({
    eventName: Application.suspendEvent,
    object: Application,
  } as never)
  expect(s.handles[1]!.active).toBe(false)
  Application.notify({ eventName: Application.resumeEvent, object: Application } as never)
  expect(s.handles[1]!.active).toBe(true)
  b.notify({ eventName: 'unloaded', object: b })
  expect(s.handles[1]!.ended).toBe(true)
  value.ref(null)
  value.dispose()
  expect(value.disposed).toBe(true)
  expect(s.nodes.every((node) => node.ended)).toBe(true)
})
it('propagates explicit observation through a follower and cleans native scroll-linked bindings', () => {
  const s = scene(),
    scroll = new ScrollView(),
    value = scrollValue(scroll as never)
  const follower = springValue(value, { duration: 0 }),
    stop = follower.subscribe(() => {})
  expect(s.handles[0]!.observing).toBe(true)
  stop()
  expect(s.handles[0]!.observing).toBe(false)
  follower.dispose()
  value.dispose()
  const target = createView(),
    cleanup = scrollLinked(
      scroll as never,
      target,
      { y: [0, -60], opacity: [1, 0] },
      { range: [0, 120], execution: 'native' },
    )
  s.handles.at(-1)!.event(60)
  expect(s.handles.at(-1)!.snapshot().callbacks).toBe(0)
  expect(driver.frames.size).toBe(0)
  cleanup()
  expect(s.handles.at(-1)!.ended).toBe(true)
})
