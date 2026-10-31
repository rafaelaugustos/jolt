import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application } from '@nativescript/core'
import { sensor, type Sensor, type SensorSnapshot } from '../src/sensors/index.js'
import { setSensorFactory, type SensorDriver } from '../src/sensors/native.js'
import { liveValueInput } from '../src/motion-value.js'
import { bind, configure, motionScope, springValue } from '../src/index.js'
import {
  setLiveSpringDriver,
  type LiveNode,
  type LiveInput,
} from '../src/live-spring-driver.js'
import { replaySensor } from '../src/testing/sensors.js'
import { createView, driver } from './helpers.js'
class Node implements LiveNode {
  value: number
  disposed = false
  constructor(value: number) {
    this.value = value
  }
  position() {
    return this.value
  }
  velocity() {
    return 0
  }
  moving() {
    return false
  }
  follow = vi.fn()
  update(input: LiveInput) {
    this.value = input.value
  }
  reduced = vi.fn()
  paused = vi.fn()
  inputs() {}
  bind() {
    return { value: () => this.value, layers: vi.fn(), cancel: vi.fn() }
  }
  dispose() {
    this.disposed = true
  }
}
let sources: Sensor[],
  nodes: Node[],
  backends: (SensorDriver & {
    snapshot: () => SensorSnapshot
    enabled: ReturnType<typeof vi.fn>
  })[]
let available: boolean
beforeEach(() => {
  sources = []
  nodes = []
  backends = []
  available = true
  setLiveSpringDriver({
    create(initial) {
      const node = new Node(initial)
      nodes.push(node)
      return node
    },
    sync() {},
  })
  setSensorFactory((kind, options, values, changed) => {
    let status: SensorSnapshot['status'] = available ? 'idle' : 'unavailable'
    const backend = {
      enabled: vi.fn((active: boolean, paused: boolean) => {
        const next = paused
          ? 'paused'
          : available
            ? active
              ? 'active'
              : 'idle'
            : 'unavailable'
        if (next !== status) {
          status = next
          changed()
        }
      }),
      snapshot: () => ({
        status,
        available,
        error: null,
        timestamp: null,
        samples: 0,
        frames: 0,
        callbacks: 0,
        processingMs: 0,
        interval: options.interval,
        values: values.map((value) => value.get()),
      }),
      recenter: vi.fn(),
      replay: vi.fn(),
      dispose: vi.fn(() => {
        status = 'disposed'
      }),
    }
    backends.push(backend)
    return backend
  })
})
afterEach(() => {
  sources.forEach((source) => source.dispose())
  setSensorFactory(undefined)
  setLiveSpringDriver(undefined)
})
function rotation(options: Parameters<typeof sensor>[1] = {}) {
  const source = sensor('rotation', options)
  sources.push(source)
  return source
}
describe('native sensor sources', () => {
  it('starts only for a loaded binding and stops on unload, detach and disposal', () => {
    const source = rotation(),
      view = createView(),
      backend = backends[0]!
    expect(source.status).toBe('idle')
    expect(nodes).toHaveLength(7)
    expect(source.quaternion.w.get()).toBe(1)
    const release = bind(view, { rotateY: source.y.to([-1, 1], [-20, 20]), x: source.x })
    expect(source.status).toBe('active')
    expect(driver.frames.size).toBe(0)
    view.notify({ eventName: 'unloaded', object: view })
    expect(source.status).toBe('idle')
    view.notify({ eventName: 'loaded', object: view })
    expect(source.status).toBe('active')
    release()
    release()
    expect(source.status).toBe('idle')
    source.dispose()
    source.dispose()
    expect(backend.dispose).toHaveBeenCalledOnce()
    expect(nodes.every((node) => node.disposed)).toBe(true)
  })
  it('propagates demand through mapped native spring chains, including paused followers', () => {
    const source = rotation(),
      a = springValue(source.x.to([-1, 1], [-25, 25])),
      b = springValue(a)
    expect(source.status).toBe('idle')
    const release = bind(createView(), { x: b })
    expect(source.status).toBe('active')
    expect(driver.frames.size).toBe(0)
    b.pause()
    expect(source.status).toBe('idle')
    b.play()
    expect(source.status).toBe('active')
    release()
    expect(source.status).toBe('idle')
    b.dispose()
    a.dispose()
  })
  it('shares one source across consumers without one detach stopping the other', () => {
    const source = rotation(),
      a = bind(createView(), { x: source.x }),
      b = bind(createView(), { y: source.y })
    a()
    expect(source.status).toBe('active')
    b()
    expect(source.status).toBe('idle')
  })
  it('suspends with scope, application background and Reduce Motion', () => {
    const scope = motionScope(),
      source = rotation({ scope }),
      release = bind(createView(), { x: source.x })
    scope.suspend()
    expect(source.status).toBe('paused')
    scope.resume()
    expect(source.status).toBe('active')
    Application.notify({ eventName: Application.suspendEvent })
    expect(source.status).toBe('paused')
    Application.notify({ eventName: Application.resumeEvent })
    expect(source.status).toBe('active')
    configure({ reducedMotion: 'always' })
    expect(source.status).toBe('paused')
    configure({ reducedMotion: 'never' })
    expect(source.status).toBe('active')
    scope.dispose()
    expect(source.disposed).toBe(true)
    expect(source.status).toBe('disposed')
    release()
  })
  it('restores owned bindings after scope suspension', () => {
    const scope = motionScope(),
      source = rotation({ scope }),
      follow = scope.add(springValue(source.x))
    scope.use(() => bind(createView(), { x: follow }))
    expect(source.status).toBe('active')
    scope.suspend()
    expect(source.status).toBe('paused')
    scope.resume()
    expect(source.status).toBe('active')
    scope.dispose()
    expect(nodes.every((node) => node.disposed)).toBe(true)
  })
  it('allows explicit nondecorative sensors to continue under Reduce Motion', () => {
    configure({ reducedMotion: 'always' })
    const source = rotation({ reducedMotion: 'continue' }),
      release = bind(createView(), { x: source.x })
    expect(source.status).toBe('active')
    release()
  })
  it('retains the source for explicit JS observations only while subscribed', () => {
    const source = rotation(),
      listener = vi.fn(),
      release = source.x.subscribe(listener)
    expect(source.status).toBe('active')
    expect(listener).toHaveBeenCalledOnce()
    expect(driver.frames.size).toBeGreaterThan(0)
    release()
    expect(source.status).toBe('idle')
    expect(driver.frames.size).toBe(0)
  })
  it('leaves a static identity fallback when hardware is missing', () => {
    available = false
    const source = rotation(),
      release = bind(createView(), { x: source.x })
    expect(source.status).toBe('unavailable')
    expect(source.available).toBe(false)
    expect(source.snapshot().values).toEqual([0, 0, 0, 0, 0, 0, 1])
    expect(driver.frames.size).toBe(0)
    release()
  })
  it('allocates three native values for gravity without mislabelling acceleration', () => {
    const source = sensor('gravity')
    sources.push(source)
    expect(nodes).toHaveLength(3)
    expect(source.kind).toBe('gravity')
    expect('quaternion' in source).toBe(false)
  })
  it('rejects invalid options before allocating native resources', () => {
    for (const interval of [0, -1, 4, Infinity, NaN, 1001])
      expect(() => rotation({ interval })).toThrow()
    expect(() => rotation({ coordinates: 'world' as never })).toThrow()
    expect(() => rotation({ reducedMotion: 'ignore' as never })).toThrow()
    expect(() => rotation({ onStatus: 4 as never })).toThrow()
    const scope = motionScope()
    scope.suspend()
    expect(() => rotation({ scope })).toThrow()
    scope.dispose()
    expect(nodes).toHaveLength(0)
  })
  it('does not retain a follower suspended inside a status callback', () => {
    let follow: ReturnType<typeof springValue> | undefined
    const source = rotation({
      onStatus(status) {
        if (status === 'active') follow?.pause()
      },
    })
    follow = springValue(source.x)
    const release = bind(createView(), { x: follow })
    expect(source.status).toBe('idle')
    expect(follow.paused).toBe(true)
    release()
    follow.dispose()
    expect(driver.frames.size).toBe(0)
  })
  it('reports coarse state boundaries and never polls snapshots for bound values', () => {
    const changed = vi.fn(),
      source = rotation({ onStatus: changed }),
      view = createView(),
      release = bind(view, { x: source.x })
    const node = liveValueInput(source.x).node as Node
    for (let i = 0; i < 100; i++) node.value = i
    expect(source.x.get()).toBe(99)
    expect(driver.frames.size).toBe(0)
    expect(changed.mock.calls.map((call) => call[0])).toEqual(['idle', 'active'])
    release()
    expect(changed).toHaveBeenLastCalledWith('idle')
  })
  it('validates explicit test input before invoking the native player', () => {
    const source = rotation(),
      trace = [
        { time: 0, values: [0, 0, 0, 1] },
        { time: 1000, values: [0, 0.2, 0, 0.98], orientation: 90 as const },
      ]
    replaySensor(source, trace)
    expect(backends[0]!.replay).toHaveBeenCalledWith(JSON.stringify(trace))
    for (const samples of [
      [],
      [trace[0]!],
      [trace[1]!, trace[0]!],
      [trace[0]!, { time: 1, values: [NaN, 0, 0, 1] }],
      [trace[0]!, { time: 1, values: [0, 0, 0, 0] }],
      [trace[0]!, { time: 1, values: [0, 0, 0, 1], orientation: 45 }],
    ])
      expect(() => replaySensor(source, samples as never)).toThrow()
    source.dispose()
    expect(() => replaySensor(source, trace)).toThrow()
  })
})
