import { Application, Color } from '@nativescript/core'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  animate,
  bind,
  configure,
  gradient,
  motionScope,
  motionValue,
  playbackProgress,
  set,
  stop,
} from '../src/index.js'
import { asRoot } from '../src/motion-value.js'
import {
  setGradientPainter,
  type GradientFrame,
  type GradientTiming,
  type Gradient,
} from '../src/gradient.js'
import { createView, driver } from './helpers.js'

const owned: Gradient[] = []
let painted: GradientFrame[]
let plays: {
  frames: readonly GradientFrame[]
  timing: GradientTiming
  cancelled: boolean
  offset: number
}[]
let removed: number
const make: typeof gradient = (target, options) => {
  const result = gradient(target, options)
  owned.push(result)
  return result
}
beforeEach(() => {
  painted = []
  plays = []
  removed = 0
  setGradientPainter(() => ({
    paint: (frame) => painted.push(frame),
    play(frames, _times, timing) {
      const entry = { frames, timing, cancelled: false, offset: 0 }
      plays.push(entry)
      return {
        cancel: () => {
          entry.cancelled = true
        },
        control: (time) => {
          entry.offset = time
        },
      }
    },
    remove: () => {
      removed++
    },
  }))
})
afterEach(() => {
  for (const item of owned.splice(0)) item.remove()
  setGradientPainter(undefined)
})

describe('gradient value bindings', () => {
  it('shares a root across native view properties and all mixed gradient components without observer frames', () => {
    const value = motionValue(0)
    const view = createView()
    const release = bind(view, { x: value.to([0, 1], [0, 100]), opacity: value })
    const glow = make(view, {
      type: 'conic',
      colors: [value.to([0, 1], [new Color(0x80ff0000), 'blue']), 'white'],
      stops: [value.to([0, 1], [0.1, 0.4]), 1],
      angle: value.to([0, 1], [0, 360]),
      center: { x: value, y: 0.5 },
      radius: value.to([0, 1], [0.2, 0.8]),
    })
    expect(asRoot(value).listeners.size).toBe(1)
    animate(value, 1, { duration: 1000, ease: 'linear' })
    const frames = plays.at(-1)!.frames
    expect(frames[30]).toMatchObject({
      angle: 180,
      x: 0.5,
      y: 0.5,
      radius: 0.5,
      stops: [0.25, 1],
    })
    expect(frames[0]!.colors[0]).toBe(0x80ff0000)
    expect(frames.at(-1)!.colors[0]).toBe(0xff0000ff)
    expect(driver.frames.size).toBe(0)
    driver.advance(1000)
    expect(painted.at(-1)!.angle).toBe(360)
    glow.remove()
    release()
    expect(asRoot(value).listeners.size).toBe(0)
  })

  it('uses descending/extrapolated mappings and projects the entire overshooting stop vector without swapping colors', () => {
    const value = motionValue(0)
    make(createView(), {
      type: 'radial',
      colors: ['red', 'blue', 'white'],
      angle: value.to([1, 0], [180, 0], { clamp: false }),
      stops: [value.to([0, 1], [0, 0.8], { clamp: false }), 0.5, 1],
      radius: value.to([0, 1], [0.2, 0.8], { clamp: false }),
    })
    set(value, 2)
    expect(painted.at(-1)).toMatchObject({
      angle: 360,
      stops: [1, 1, 1],
      colors: [0xffff0000, 0xff0000ff, 0xffffffff],
    })
    expect(painted.at(-1)!.radius).toBeCloseTo(1.4)
    set(value, -1)
    expect(painted.at(-1)).toMatchObject({ angle: -180, radius: 0, stops: [0, 0.5, 1] })
  })

  it('keeps source pause, seek and resume on the same clock', () => {
    const value = motionValue(0)
    make(createView(), {
      type: 'linear',
      colors: ['red', 'blue'],
      angle: value.to([0, 1], [0, 100]),
    })
    const run = animate(value, 1, { duration: 1000, ease: 'linear' })
    driver.advance(250)
    run.pause()
    expect(painted.at(-1)!.angle).toBeCloseTo(25)
    driver.advance(500)
    run.progress = 0.7
    expect(painted.at(-1)!.angle).toBeCloseTo(70)
    run.play()
    expect(plays.at(-1)!.frames[0]!.angle).toBeCloseTo(70)
    expect(plays.at(-1)!.timing.duration).toBeCloseTo(300)
    driver.advance(300)
    expect(painted.at(-1)!.angle).toBe(100)
  })

  it('combines independent roots and scalar layers into coherent bounded native windows', () => {
    const one = motionValue(0),
      two = motionValue(0)
    make(createView(), {
      type: 'conic',
      colors: ['red', 'blue'],
      angle: one,
      center: { x: one, y: two },
    })
    animate(one, 10, { duration: 10000, ease: 'linear' })
    animate(two, 1, { duration: 1000, ease: 'linear' })
    animate(one, [0, 0.1, 0], { duration: 500, ease: 'linear', layer: 'pulse' })
    const frames = plays.at(-1)!.frames
    expect(frames.every((frame) => frame.angle === frame.x)).toBe(true)
    expect(plays.at(-1)!.timing.duration).toBeLessThanOrEqual(4000)
    expect(frames.length).toBeLessThanOrEqual(241)
    expect(frames[15]!.x).toBeCloseTo(0.35)
    expect(frames[15]!.y).toBeCloseTo(0.25)
    expect(driver.frames.size).toBe(0)
    stop(one, { layer: 'pulse' })
    expect(asRoot(one).listeners.size).toBe(1)
  })

  it('binds derived progress without an observer or an independent JS frame clock', () => {
    const run = animate(createView(), { x: 100 }, { duration: 1000, ease: 'linear' })
    const progress = playbackProgress(run)
    make(createView(), {
      type: 'linear',
      colors: [progress.to([0, 1], ['red', 'blue']), 'white'],
      angle: progress.to([1, 0], [360, 0]),
    })
    driver.advance(400)
    run.pause()
    expect(painted.at(-1)!.angle).toBeCloseTo(144)
    run.progress = 0.2
    expect(painted.at(-1)!.angle).toBeCloseTo(72)
    expect(driver.frames.size).toBe(0)
  })

  it('preserves per-component owners and makes stale release functions harmless', () => {
    const first = motionValue(0),
      second = motionValue(0.5)
    const glow = make(createView(), { type: 'radial', colors: ['red', 'blue'] })
    const old = glow.bind({ angle: first, center: { x: first, y: first } })
    const newer = glow.bind({ angle: second, center: { x: second } })
    old()
    set(first, 0.8)
    set(second, 0.6)
    expect(painted.at(-1)).toMatchObject({ angle: 0.6, x: 0.6, y: 0 })
    newer()
    set(second, 1)
    glow.set({ radius: 1 })
    expect(painted.at(-1)).toMatchObject({ angle: 0.6, x: 0.6, y: 0, radius: 1 })
    expect(asRoot(first).listeners.size + asRoot(second).listeners.size).toBe(0)
  })

  it('lets concrete set/animate take only their bound components and binds over only part of a concrete animation', async () => {
    const value = motionValue(0.2)
    const glow = make(createView(), {
      type: 'radial',
      colors: ['red', 'blue'],
      center: { x: value, y: value },
      angle: value,
    })
    glow.set({ angle: 90 })
    set(value, 0.3)
    expect(painted.at(-1)).toMatchObject({ angle: 90, x: 0.3, y: 0.3 })
    const run = glow.animate(
      { angle: 180, radius: 1 },
      { duration: 1000, ease: 'linear' },
    )
    driver.advance(200)
    glow.bind({ angle: value })
    driver.advance(800)
    expect(await run).toBe(true)
    expect(painted.at(-1)).toMatchObject({ angle: 0.3, radius: 1, x: 0.3, y: 0.3 })
  })

  it('validates replacements before detaching working bindings and rejects wrong value kinds', () => {
    const value = motionValue(0.2)
    const glow = make(createView(), {
      type: 'linear',
      colors: ['red', 'blue'],
      angle: value,
    })
    const before = painted.length
    expect(() => glow.bind({ stops: [0.8, 0.2], angle: 90 })).toThrow(/going back/)
    expect(() => glow.bind({ colors: [value, 'white'] } as never)).toThrow(/color/)
    expect(() =>
      glow.bind({ angle: value.to([0, 1], ['red', 'blue']) } as never),
    ).toThrow(/numeric/)
    expect(() => glow.bind({ radius: -1 })).toThrow(/negative/)
    expect(painted.length).toBe(before)
    set(value, 0.6)
    expect(painted.at(-1)!.angle).toBe(0.6)
  })

  it('replaces color/stop structure atomically and does not revive removed indices', () => {
    const value = motionValue(0.2)
    const glow = make(createView(), {
      type: 'conic',
      colors: ['red', 'blue', value.to([0, 1], ['white', 'black'])],
      stops: [0, value, 1],
      angle: value,
    })
    glow.set({ colors: ['black', 'white'] })
    set(value, 0.7)
    expect(painted.at(-1)).toMatchObject({
      colors: [0xff000000, 0xffffffff],
      stops: [0, 1],
      angle: 0.7,
    })
    expect(() => glow.animate({ colors: ['red', 'blue', 'white'] })).toThrow(
      /keeps its 2 colors/,
    )
  })

  it('holds the last valid compound frame if a later mapping overflows, without breaking other consumers', () => {
    const value = motionValue(0)
    const glow = make(createView(), {
      type: 'linear',
      colors: ['red', 'blue'],
      angle: value.to([0, 1], [0, Number.MAX_VALUE], { clamp: false }),
    })
    const release = bind(createView(), { x: value })
    expect(() => set(value, 2)).not.toThrow()
    expect(painted.at(-1)!.angle).toBe(0)
    expect(asRoot(value).listeners.size).toBe(0)
    glow.set({ angle: 45 })
    expect(painted.at(-1)!.angle).toBe(45)
    release()
  })

  it('suspends, reloads and resumes at the current source position without duplicate subscriptions', () => {
    const value = motionValue(0)
    const view = createView()
    const scope = motionScope()
    const glow = scope.gradient(view, {
      type: 'radial',
      colors: ['red', 'blue'],
      center: { x: value },
    })
    animate(value, 1, { duration: 1000, ease: 'linear' })
    driver.advance(200)
    scope.suspend()
    expect(asRoot(value).listeners.size).toBe(0)
    driver.advance(200)
    scope.resume()
    expect(asRoot(value).listeners.size).toBe(1)
    expect(plays.at(-1)!.frames[0]!.x).toBeCloseTo(0.4)
    view.notify({ eventName: 'unloaded', object: view })
    expect(asRoot(value).listeners.size).toBe(0)
    driver.advance(100)
    view.notify({ eventName: 'loaded', object: view })
    view.notify({ eventName: 'loaded', object: view })
    expect(asRoot(value).listeners.size).toBe(1)
    expect(plays.at(-1)!.frames[0]!.x).toBeCloseTo(0.5)
    scope.dispose()
    expect(asRoot(value).listeners.size).toBe(0)
    expect(() => glow.bind({ angle: value })).toThrow(/removed/)
  })

  it('handles background/resume, resize and repeated cleanup without allocating observer frames', () => {
    const value = motionValue(0)
    const view = createView()
    const glow = make(view, { type: 'conic', colors: ['red', 'blue'], angle: value })
    animate(value, 1, { duration: 1000, ease: 'linear' })
    driver.advance(100)
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    driver.advance(200)
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    expect(plays.at(-1)!.frames[0]!.angle).toBeCloseTo(0.3)
    view.notify({ eventName: 'layoutChanged', object: view })
    expect(plays.at(-1)!.frames[0]!.angle).toBeCloseTo(0.3)
    for (let i = 0; i < 20; i++) {
      const off = glow.bind({ radius: value })
      off()
      off()
    }
    expect(asRoot(value).listeners.size).toBe(1)
    glow.stop()
    expect(asRoot(value).listeners.size).toBe(0)
    expect(driver.frames.size).toBe(0)
  })

  it('reduces bound geometry while retaining color interpolation', () => {
    configure({ reducedMotion: 'always' })
    const value = motionValue(0)
    make(createView(), {
      type: 'linear',
      colors: [value.to([0, 1], ['red', 'blue']), 'white'],
      angle: value.to([0, 1], [0, 360]),
    })
    animate(value, 1, { duration: 1000, ease: 'linear' })
    const frames = plays.at(-1)!.frames
    expect(new Set(frames.map((frame) => frame.angle))).toEqual(new Set([360]))
    expect(frames[0]!.colors[0]).toBe(0xffff0000)
    expect(frames.at(-1)!.colors[0]).toBe(0xff0000ff)
  })
})
