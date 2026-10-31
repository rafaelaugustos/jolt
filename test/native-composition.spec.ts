import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { View } from '@nativescript/core'
import { animate, bind, motionValue, stop } from '../src/index.js'
import {
  setLiveSpringDriver,
  type LiveInput,
  type LiveMapping,
  type LiveNode,
  type LiveSpringPhysics,
} from '../src/live-spring-driver.js'
import { createView, driver } from './helpers.js'

class Node implements LiveNode {
  disposed = false
  composed: { rest: number; inputs: readonly LiveInput[] }[] = []
  bindings: {
    view: View
    property: string
    maps: readonly LiveMapping[]
    layers: (readonly LiveInput[])[]
    cancelled: boolean
  }[] = []
  constructor(
    public value: number,
    readonly physics: LiveSpringPhysics,
    readonly reduce: boolean,
  ) {}
  position() {
    return this.value
  }
  velocity() {
    return 0
  }
  moving() {
    return this.composed.at(-1)?.inputs.some((input) => input.running) ?? false
  }
  follow() {}
  update() {}
  inputs(rest: number, inputs: readonly LiveInput[]) {
    this.composed.push({ rest, inputs })
    this.value = inputs.reduce((sum, input) => sum + input.value, rest)
  }
  reduced() {}
  paused() {}
  bind(view: View, property: string, maps: readonly LiveMapping[]) {
    const entry = {
      view,
      property,
      maps,
      layers: [] as (readonly LiveInput[])[],
      cancelled: false,
    }
    this.bindings.push(entry)
    return {
      value: () => this.value,
      layers: (inputs: readonly LiveInput[]) => {
        entry.layers.push(inputs)
      },
      cancel: () => {
        entry.cancelled = true
      },
    }
  }
  dispose() {
    this.disposed = true
  }
}

let nodes: Node[]
const endless = (duration: number) =>
  ({ duration, ease: 'linear', repeat: Infinity, repeatType: 'reverse' }) as const
const windows = () => driver.played.filter((p) => p.track.duration === 4000)

beforeEach(() => {
  nodes = []
  setLiveSpringDriver({
    create(value, physics, reduced) {
      const node = new Node(value, physics, reduced)
      nodes.push(node)
      return node
    },
    sync() {},
  })
})
afterEach(() => setLiveSpringDriver(undefined))

describe('native composition instead of rolling windows', () => {
  it('plays endless view layers with no common period on a composer per property', () => {
    const card = createView()
    animate(card, { x: [0, 16, 0] }, { ...endless(701), layer: 'wobble' })
    expect(nodes).toHaveLength(0)
    expect(driver.last('x').track.duration).toBe(1402)
    animate(card, { x: [0, 9, 0] }, { ...endless(709), layer: 'pulse' })
    expect(nodes).toHaveLength(1)
    const node = nodes[0]!
    expect(node.reduce).toBe(true)
    expect(node.value).toBe(0)
    expect(node.bindings).toHaveLength(1)
    expect(node.bindings[0]!.property).toBe('x')
    const layers = node.bindings[0]!.layers.at(-1)!
    expect(layers.map((layer) => layer.duration).sort((a, b) => a - b)).toEqual([
      0, 701, 709,
    ])
    expect(layers.filter((layer) => layer.running)).toHaveLength(2)
    expect(layers.find((layer) => layer.duration === 701)!.elapsed).toBe(0)
    expect(driver.last('x').stopped).toBe(true)
    driver.advance(4500)
    expect(windows()).toHaveLength(0)
    expect(node.bindings[0]!.layers).toHaveLength(1)
  })

  it('returns a property to a sampled loop once the layers share a period again', () => {
    const card = createView()
    animate(card, { x: [0, 16, 0] }, { ...endless(701), layer: 'wobble' })
    animate(card, { x: [0, 9, 0] }, { ...endless(709), layer: 'pulse' })
    const node = nodes[0]!
    driver.advance(1000)
    stop(card, ['x'], { layer: 'pulse' })
    expect(node.disposed).toBe(true)
    expect(node.bindings[0]!.cancelled).toBe(true)
    const loop = driver.last('x')
    expect(loop.track.repeat).toBe(Infinity)
    expect(loop.track.duration).toBe(1402)
    const progress = 1 - 299 / 701
    expect(loop.track.valueAt(0)).toBeCloseTo(32 * (1 - progress), 2)
  })

  it('composes a motion value with incompatible endless runs on one composer per value', () => {
    const progress = motionValue(24)
    const views = [createView(), createView()]
    const release = bind(views, { x: progress, scaleX: progress.to([24, 48], [1, 2]) })
    animate(progress, [0, 12, 0], { ...endless(701), layer: 'a' })
    expect(nodes).toHaveLength(0)
    const pulse = animate(progress, [0, 6, 0], { ...endless(709), layer: 'b' })
    expect(nodes).toHaveLength(1)
    const node = nodes[0]!
    expect(node.composed.at(-1)!.rest).toBe(24)
    expect(node.composed.at(-1)!.inputs.map((input) => input.duration)).toEqual([
      701, 709,
    ])
    expect(node.composed.at(-1)!.inputs[0]!.values.length).toBeGreaterThan(2)
    expect(node.bindings).toHaveLength(4)
    expect(node.bindings.find((entry) => entry.property === 'scaleX')!.maps).toEqual([
      { input: [24, 48], output: [1, 2], clamp: true },
    ])
    const submitted = driver.played.length
    driver.advance(4500)
    expect(windows()).toHaveLength(0)
    expect(driver.played).toHaveLength(submitted)
    pulse.pause()
    expect(node.disposed).toBe(true)
    expect(node.bindings.every((entry) => entry.cancelled)).toBe(true)
    expect(driver.last('x', views[0]!).track.repeat).toBe(Infinity)
    const held = driver.last('x', views[0]!)
    expect(held.track.valueAt(held.offset ?? 0)).toBeCloseTo(progress.get(), 5)
    pulse.play()
    expect(nodes).toHaveLength(2)
    const resumed = nodes[1]!
    expect(resumed.composed.at(-1)!.inputs.every((input) => input.running)).toBe(true)
    expect(
      resumed.composed.at(-1)!.inputs.find((input) => input.duration === 709)!.elapsed,
    ).toBe(4500)
    expect(resumed.bindings).toHaveLength(4)
    expect(progress.get()).toBeCloseTo(resumed.value, 5)
    release()
    expect(resumed.disposed).toBe(true)
    expect(resumed.bindings.every((entry) => entry.cancelled)).toBe(true)
  })

  it('hands bindings back to sampled tracks when a value stops rolling', () => {
    const progress = motionValue(24)
    const view = createView()
    bind(view, { x: progress })
    animate(progress, [0, 12, 0], { ...endless(701), layer: 'a' })
    const pulse = animate(progress, [0, 6, 0], { ...endless(709), layer: 'b' })
    const node = nodes[0]!
    driver.advance(800)
    pulse.stop()
    expect(node.disposed).toBe(true)
    const native = driver.last('x', view)
    expect(native.track.repeat).toBe(Infinity)
    expect(native.track.duration).toBe(701)
    expect(native.track.reverse).toBe(true)
    expect(native.offset).toBe(800)
    expect(native.track.valueAt(800)).toBeCloseTo(progress.get(), 5)
  })

  it('keeps sampled windows for an app built without the native classes', () => {
    setLiveSpringDriver(undefined)
    const card = createView()
    animate(card, { x: [0, 16, 0] }, { ...endless(701), layer: 'wobble' })
    animate(card, { x: [0, 9, 0] }, { ...endless(709), layer: 'pulse' })
    expect(nodes).toHaveLength(0)
    expect(driver.last('x').track.duration).toBe(4000)
    const progress = motionValue(24)
    bind(createView(), { x: progress })
    animate(progress, [0, 12, 0], { ...endless(701), layer: 'a' })
    animate(progress, [0, 6, 0], { ...endless(709), layer: 'b' })
    expect(driver.last('x').track.duration).toBe(4000)
  })
})
