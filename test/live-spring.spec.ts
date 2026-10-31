import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application, type View } from '@nativescript/core'
import {
  animate,
  bind,
  configure,
  motionScope,
  motionValue,
  set,
  springValue,
  type SpringValue,
} from '../src/index.js'
import {
  setLiveSpringDriver,
  type LiveBinding,
  type LiveInput,
  type LiveMapping,
  type LiveNode,
  type LiveSpringPhysics,
} from '../src/live-spring-driver.js'
import { createView, driver } from './helpers.js'
import { asRoot } from '../src/motion-value.js'

class Node implements LiveNode {
  value: number
  speed = 0
  active = false
  stopped = false
  updates: LiveInput[] = []
  composed: { rest: number; inputs: readonly LiveInput[] }[] = []
  parent: LiveNode | undefined
  maps: readonly LiveMapping[] = []
  bindings: {
    view: View
    property: string
    maps: readonly LiveMapping[]
    handle: LiveBinding
  }[] = []
  constructor(
    value: number,
    readonly physics: LiveSpringPhysics,
    public reduce: boolean,
  ) {
    this.value = value
  }
  position() {
    return this.value
  }
  velocity() {
    return this.speed
  }
  moving() {
    return this.active
  }
  follow(source: LiveNode, maps: readonly LiveMapping[]) {
    this.parent = source
    this.maps = maps
  }
  update(input: LiveInput) {
    this.updates.push(input)
    this.active = input.running || input.value !== this.value
    if (this.reduce) {
      this.value = input.value
      this.speed = 0
    }
  }
  inputs(rest: number, inputs: readonly LiveInput[]) {
    this.composed.push({ rest, inputs })
    this.active = inputs.some((input) => input.running)
    if (this.reduce) {
      this.value = inputs.reduce((sum, input) => sum + input.value, rest)
      this.speed = 0
    }
  }
  reduced(value: boolean) {
    this.reduce = value
  }
  paused = vi.fn()
  bind(
    view: View,
    property: Parameters<LiveNode['bind']>[1],
    maps: readonly LiveMapping[],
  ) {
    const handle = { value: () => this.value, layers: vi.fn(), cancel: vi.fn() }
    this.bindings.push({ view, property, maps, handle })
    return handle
  }
  dispose() {
    this.stopped = true
    this.active = false
  }
}
let nodes: Node[]
let owned: SpringValue[]
const follower = (...args: Parameters<typeof springValue>) => {
  const value = springValue(...args)
  owned.push(value)
  return value
}
beforeEach(() => {
  nodes = []
  owned = []
  setLiveSpringDriver({
    create(value, physics, reduced) {
      const node = new Node(value, physics, reduced)
      nodes.push(node)
      return node
    },
    sync() {},
  })
})
afterEach(() => {
  owned.reverse().forEach((value) => value.dispose())
  setLiveSpringDriver(undefined)
})

describe('live spring control plane', () => {
  it('retargets the retained native node without rebuilding view tracks or bindings', () => {
    const target = motionValue(0)
    const plan = vi.spyOn(asRoot(target), 'plan')
    const value = follower(target, { stiffness: 260, damping: 24 })
    const view = createView()
    const release = bind(view, { x: value })
    const node = nodes[0]!
    node.value = 28
    node.speed = 130
    for (const next of [100, -80, 50]) set(target, next)
    expect(nodes).toHaveLength(1)
    expect(node.bindings).toHaveLength(1)
    expect(node.updates.at(-1)?.value).toBe(50)
    expect(value.get()).toBe(28)
    expect(value.getVelocity()).toBe(130)
    expect(driver.frames.size).toBe(0)
    expect(driver.played).toHaveLength(0)
    expect(plan).not.toHaveBeenCalled()
    release()
    expect(view.translateX).toBe(28)
    expect(node.bindings[0]!.handle.cancel).toHaveBeenCalledOnce()
  })

  it('links three followers in native code and preserves chained numeric mappings', () => {
    const target = motionValue(0)
    const a = follower(target)
    const b = follower(a.to([0, 100], [0, 200]).to([0, 200], [10, 40], { clamp: false }))
    const c = follower(b)
    expect(nodes[1]!.parent).toBe(nodes[0])
    expect(nodes[2]!.parent).toBe(nodes[1])
    expect(nodes[1]!.maps).toHaveLength(2)
    expect(nodes[1]!.maps[1]!.clamp).toBe(false)
    set(target, 100)
    expect(nodes[1]!.updates).toHaveLength(0)
    expect(nodes[2]!.updates).toHaveLength(0)
    expect(driver.frames.size).toBe(0)
    expect(c.disposed).toBe(false)
  })

  it('sends sampled source playback only at start, seek and pause boundaries', () => {
    const target = motionValue(0)
    follower(target)
    const animation = animate(target, 100, { duration: 1000, ease: 'linear' })
    const count = nodes[0]!.updates.length
    driver.advance(200)
    expect(nodes[0]!.updates).toHaveLength(count)
    expect(nodes[0]!.updates.at(-1)!.values.at(-1)).toBe(100)
    animation.pause()
    expect(nodes[0]!.updates.at(-1)!.running).toBe(false)
    animation.progress = 0.5
    expect(nodes[0]!.updates.at(-1)!.value).toBeCloseTo(50)
    animation.stop()
  })

  it('keeps ownership after rest and disposes all native work with the scope', () => {
    const scope = motionScope()
    const target = motionValue(0)
    const value = scope.add(follower(target))
    bind(createView(), { x: value })
    nodes[0]!.active = false
    expect(scope.size).toBe(1)
    set(target, 200)
    expect(value.moving).toBe(true)
    scope.dispose()
    const count = nodes[0]!.updates.length
    set(target, 50)
    expect(nodes[0]!.updates).toHaveLength(count)
    expect(nodes[0]!.stopped).toBe(true)
    expect(value.disposed).toBe(true)
    expect(nodes[0]!.bindings[0]!.handle.cancel).toHaveBeenCalledOnce()
    expect(() => bind(createView(), { x: value })).toThrow(/disposed/)
  })

  it('detaches on unload and recreates only the native binding on reload', () => {
    const value = follower(motionValue(0))
    const view = createView()
    const release = bind(view, { x: value })
    nodes[0]!.value = 42
    view.notify({ eventName: 'unloaded', object: view })
    view.unload()
    expect(nodes[0]!.bindings[0]!.handle.cancel).toHaveBeenCalledOnce()
    view.load()
    expect(nodes).toHaveLength(1)
    expect(nodes[0]!.bindings).toHaveLength(2)
    release()
    view.unload()
    view.load()
    expect(nodes[0]!.bindings).toHaveLength(2)
  })

  it('composes named layers natively and returns to the normal mixer on unbind', () => {
    const value = follower(motionValue(0))
    const view = createView()
    const release = bind(view, { x: value })
    const layer = animate(
      view,
      { x: [0, 20, 0] },
      { duration: 800, layer: 'shake', ease: 'linear' },
    )
    const handle = nodes[0]!.bindings[0]!.handle
    const layers = vi.mocked(handle.layers).mock.calls.at(-1)![0]
    expect(layers).toHaveLength(1)
    expect(layers[0]!.running).toBe(true)
    expect(layers[0]!.values).toContain(20)
    expect(driver.played).toHaveLength(0)
    nodes[0]!.value = 70
    release()
    expect(driver.played.length).toBeGreaterThan(0)
    layer.stop()
  })

  it('applies reduced motion, zero duration and suspension at native boundaries', () => {
    const target = motionValue(10)
    follower(target, { duration: 0, initial: 0 })
    expect(nodes[0]!.reduce).toBe(true)
    set(target, 30)
    expect(nodes[0]!.value).toBe(30)
    follower(target)
    configure({ reducedMotion: 'always' })
    expect(nodes[1]!.reduce).toBe(true)
    configure({ reducedMotion: 'never' })
    expect(nodes[0]!.reduce).toBe(true)
    expect(nodes[1]!.reduce).toBe(false)
    Application.notify({ eventName: Application.suspendEvent })
    Application.notify({ eventName: Application.resumeEvent })
    expect(nodes[1]!.paused.mock.calls).toEqual([[true], [false]])
  })

  it('stops opted-in JS observation when the native spring rests', () => {
    const value = follower(motionValue(100), { initial: 0 })
    const callback = vi.fn()
    const off = value.subscribe(callback)
    nodes[0]!.value = 100
    nodes[0]!.active = false
    driver.advance(16)
    expect(callback).toHaveBeenLastCalledWith(100, expect.any(Number))
    expect(driver.frames.size).toBe(0)
    off()
  })

  it('preserves a scoped subscription through suspension and does not override manual pause on app resume', () => {
    const scope = motionScope()
    const value = scope.add(follower(motionValue(0)))
    nodes[0]!.value = 45
    nodes[0]!.speed = 120
    scope.suspend()
    expect(value.paused).toBe(true)
    expect(value.disposed).toBe(false)
    scope.resume()
    expect(value.paused).toBe(false)
    expect(value.get()).toBe(45)
    expect(value.getVelocity()).toBe(120)
    value.pause()
    Application.notify({ eventName: Application.suspendEvent })
    Application.notify({ eventName: Application.resumeEvent })
    expect(nodes[0]!.paused).toHaveBeenLastCalledWith(true)
    value.play()
    expect(nodes[0]!.paused).toHaveBeenLastCalledWith(false)
    scope.dispose()
  })

  it('rejects invalid physics and unsupported binding types before touching views', () => {
    for (const options of [
      { stiffness: -1 },
      { mass: 0 },
      { damping: -1 },
      { restDelta: 0 },
      { restSpeed: Infinity },
      { initial: NaN },
      { duration: -1 },
    ])
      expect(() => follower(motionValue(0), options)).toThrow()
    expect(nodes).toHaveLength(0)
    const value = follower(motionValue(0))
    expect(() => value.to([0, 1], ['red', 'blue'])).toThrow(/numeric/)
    expect(() => bind(createView(), { borderRadius: value })).toThrow(/numeric/)
  })
})
