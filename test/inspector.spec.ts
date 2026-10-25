import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application } from '@nativescript/core'
import { animate, bind, motionValue, set } from '../src/index.js'
import { getDriver } from '../src/driver/index.js'
import { inspectViewMotion } from '../src/engine.js'
import {
  createMotionInspector,
  inspectorSpring,
  springCode,
  type MotionInspector,
} from '../src/inspector/index.js'
import { createView, driver } from './helpers.js'

const native = vi.hoisted(() => ({
  rows: [] as (number | null)[][],
  active: 0,
  starts: 0,
  fail: false,
}))
vi.mock('../src/inspector/probe.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('../src/inspector/probe.js')>()
  return {
    ...real,
    startProbe() {
      if (native.fail) throw new Error('missing native probe')
      native.active++
      native.starts++
      let disposed = false
      return {
        drain: () => ({
          rows: native.rows.splice(0),
          dropped: 0,
          samples: 4,
          sampleCpuMs: 0.02,
          drainCpuMs: 0.01,
          active: !disposed,
        }),
        dispose: () => {
          if (!disposed) {
            native.active--
            disposed = true
          }
        },
      }
    },
  }
})
let inspector: MotionInspector | undefined
beforeEach(() => {
  native.rows = []
  native.active = 0
  native.starts = 0
  native.fail = false
})
afterEach(() => {
  inspector?.dispose()
  inspector = undefined
})
function prepare(capacity = 16) {
  const view = createView()
  inspector = createMotionInspector({ development: true, capacity })
  inspector.watch(view, 'card')
  inspector.select('card')
  return view
}
const linear = { duration: 1000, ease: 'linear' as const }

describe('optional motion inspector', () => {
  it('does not read a native handle before driver.play has returned it', () => {
    getDriver().elapsed = (handle) => {
      if (handle === undefined) throw new Error('Native handle is not ready')
      return 0
    }
    const view = prepare()
    expect(() => animate(view, { x: 100 }, linear)).not.toThrow()
  })
  it('requires an explicit development gate and bounded buffers', () => {
    expect(() => createMotionInspector({ development: false as true })).toThrow(
      /development/,
    )
    expect(() => createMotionInspector({ development: true, capacity: 100000 })).toThrow(
      /capacity/,
    )
    expect(getDriver()).toBe(driver)
  })
  it('selects an already running view without taking ownership or changing its clock', () => {
    const view = createView(),
      animation = animate(view, { x: [0, 100] }, linear)
    driver.advance(230)
    const owner = inspectViewMotion(view)[0]!.owner
    inspector = createMotionInspector({ development: true })
    inspector.watch(view, 'card')
    inspector.select('card')
    inspector.label(animation, 'Entrance')
    const snapshot = inspector.read()
    expect(snapshot.properties[0]).toMatchObject({
      label: 'Entrance',
      elapsed: 230,
      value: 23,
      target: 100,
    })
    expect(inspectViewMotion(view)[0]!.owner).toBe(owner)
    expect(animation.paused).toBe(false)
    expect(driver.played).toHaveLength(1)
  })
  it('associates batched native samples with the correct pre/post interruption curves', () => {
    const view = prepare()
    const first = animate(view, { x: [0, 100] }, linear)
    inspector!.label(first, 'Entrance')
    driver.advance(200)
    const second = animate(view, { x: 0 }, linear)
    inspector!.label(second, 'Return')
    native.rows = [
      [1100, 10],
      [1300, 18],
    ]
    const snapshot = inspector!.read()
    expect(snapshot.samples.map((s) => s.expected)).toEqual([10, 18])
    expect(snapshot.events.find((e) => e.kind === 'replace')).toMatchObject({
      label: 'Return',
      previousLabel: 'Entrance',
    })
    expect(snapshot.properties).toHaveLength(1)
  })
  it('retires an adopted handle after completion before selecting the same view again', () => {
    const view = createView()
    animate(view, { x: [0, 100] }, { duration: 100 })
    inspector = createMotionInspector({ development: true })
    inspector.watch(view, 'card')
    inspector.select('card')
    driver.advance(200)
    set(view, { x: 50 })
    inspector.select('card')
    native.rows = [[driver.now(), 50]]
    expect(inspector.read().samples[0]?.expected).toBe(50)
  })
  it('shows separate owners on a layered property and its native composite curve', () => {
    const view = prepare()
    animate(view, { x: [0, 100] }, linear)
    animate(view, { x: [0, 20] }, { ...linear, layer: 'press' })
    driver.advance(100)
    const snapshot = inspector!.read()
    expect(snapshot.properties).toHaveLength(2)
    expect(snapshot.properties.find((p) => p.layer === 'press')?.target).toBe(20)
    expect(new Set(snapshot.properties.map((p) => p.owner)).size).toBe(2)
  })
  it('retains a delay in timing and leaves the animation running on disposal', () => {
    const view = prepare()
    const animation = animate(view, { x: [0, 100] }, { ...linear, delay: 300 })
    driver.advance(150)
    expect(inspector!.read().properties[0]).toMatchObject({
      delay: 300,
      elapsed: 150,
      value: 0,
    })
    inspector!.dispose()
    expect(getDriver()).toBe(driver)
    expect(native.active).toBe(0)
    expect(animation.paused).toBe(false)
    expect(driver.last('x').stopped).toBe(false)
  })
  it('exposes the real binding graph without subscriptions or native restarts', () => {
    const view = prepare(),
      progress = motionValue(0.25)
    const release = bind(view, {
      x: progress.to([0, 1], [0, 200]).to([0, 200], [10, 250]),
    })
    inspector!.label(progress, 'Progress')
    const snapshot = inspector!.read()
    expect(snapshot.bindings[0]).toMatchObject({
      value: 70,
      source: { kind: 'motion value', label: 'Progress' },
    })
    expect(snapshot.bindings[0]!.source.mappings).toHaveLength(2)
    expect(driver.frames.size).toBe(0)
    release()
    expect(inspector!.read().bindings).toEqual([])
  })
  it('scrubs only on an explicit command and preserves the held expected value', () => {
    const view = prepare(),
      animation = animate(view, { x: [0, 100] }, linear)
    inspector!.control(animation, 'seek', 0.4)
    driver.advance(100)
    native.rows = [[driver.now(), 40]]
    expect(inspector!.read().samples[0]?.expected).toBe(40)
    expect(animation.paused).toBe(true)
    inspector!.control(animation, 'play')
    expect(animation.paused).toBe(false)
    expect(() => inspector!.control(animation, 'seek', 2)).toThrow(/progress/)
  })
  it('bounds samples and event histories and returns detached snapshots', () => {
    const view = prepare(8)
    for (let i = 0; i < 30; i++) {
      animate(view, { x: i + 1 }, linear)
      driver.advance(1)
    }
    native.rows = Array.from({ length: 30 }, (_, i) => [driver.now() + i, i])
    const snapshot = inspector!.read()
    expect(snapshot.samples).toHaveLength(8)
    expect(snapshot.events).toHaveLength(8)
    snapshot.samples[0]!.observed = 999
    expect(inspector!.read().samples[0]!.observed).not.toBe(999)
  })
  it('stops collection on unload/background and never reports the model as native data', () => {
    const view = prepare()
    native.rows = [[driver.now(), null]]
    expect(inspector!.read().samples[0]).toMatchObject({
      observed: null,
      source: 'unavailable',
    })
    view.notify({ eventName: 'unloaded', object: view })
    expect(native.active).toBe(0)
    inspector!.select('card')
    Application.notify({ eventName: Application.suspendEvent })
    expect(native.active).toBe(0)
    expect(inspector!.read().status).toMatch(/background/)
  })
  it('does not contaminate a newly selected view when an old animation completes', () => {
    const first = prepare(),
      second = createView()
    inspector!.watch(second, 'second')
    animate(first, { x: [0, 100] }, { duration: 20 })
    set(second, { x: 50 })
    inspector!.select('second')
    driver.advance(30)
    native.rows = [[driver.now(), 50]]
    expect(inspector!.read().samples[0]?.expected).toBe(50)
  })
  it('reports missing/unsupported native sampling and cleans hooks exactly once', () => {
    const view = prepare()
    inspector!.select('card', 'shadowRadius')
    expect(inspector!.read().status).toMatch(/unavailable.*shadowRadius/)
    native.fail = true
    inspector!.select('card')
    expect(inspector!.read().status).toMatch(/missing native probe/)
    expect(() => createMotionInspector({ development: true })).toThrow(/existing/)
    inspector!.dispose()
    inspector!.dispose()
    expect(view.listenerCount('unloaded')).toBe(0)
    expect(getDriver()).toBe(driver)
    expect(() => inspector!.read()).toThrow(/disposed/)
  })
})

describe('reproducible spring tuning', () => {
  it('copies only validated spring options and emits the same config for another run', () => {
    const spring = { duration: 650, bounce: 0.35 }
    const code = springCode({ target: 'card', to: 220, spring })
    const copied = JSON.parse(code.slice(code.indexOf('{\n'), code.lastIndexOf(')')))
    expect(copied).toEqual({ ...inspectorSpring(spring), velocity: 0 })
    const view = createView()
    animate(view, { x: [0, 220] }, copied)
    const first = [...driver.last('x').track.values]
    const restarted = createView()
    animate(restarted, { x: [0, 220] }, { ...inspectorSpring(spring), velocity: 0 })
    expect(driver.last('x').track.values).toEqual(first)
  })
  it('rejects unsafe identifiers and invalid duration/physics values', () => {
    expect(() =>
      springCode({ target: 'card);x(', to: 20, spring: { duration: 400, bounce: 0 } }),
    ).toThrow(/identifier/)
    expect(() => inspectorSpring({ duration: -1, bounce: 0 })).toThrow(/duration/)
    expect(() => inspectorSpring({ stiffness: -1, damping: 20, mass: 1 })).toThrow(
      /positive/,
    )
    expect(() => inspectorSpring({ duration: 400, bounce: NaN })).toThrow(/bounce/)
  })
})
