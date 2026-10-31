import { afterEach, beforeEach, expect, it } from 'vitest'
import { Application } from '@nativescript/core'
import { shape, type Shape } from '../src/shapes/index.js'
import { shapePath, compatible, pathString } from '../src/shapes/path.js'
import { setShapeFactory, type ShapePainter } from '../src/shapes/native.js'
import { mixFrame, type ShapeFrame } from '../src/shapes/types.js'
import type { Track } from '../src/track.js'
import { configure, motionScope } from '../src/index.js'
import { createView, driver, state } from './helpers.js'

const check = 'M20 50 L40 70 L80 25',
  other = 'M20 25 L50 60 L80 50'
let shapes: Shape[], painters: (ShapePainter & { removed: boolean; sizes: number })[]
beforeEach(() => {
  shapes = []
  painters = []
  setShapeFactory((_view, _style, initial) => {
    let current = initial,
      program:
        | {
            a: ShapeFrame
            b: ShapeFrame
            track: Track
            start: number
            offset: number
            paused: boolean
          }
        | undefined
    const p = {
      removed: false,
      sizes: 0,
      paint(f: ShapeFrame) {
        current = f
        program = undefined
      },
      read() {
        return program
          ? mixFrame(
              program.a,
              program.b,
              program.track.valueAt(
                program.offset + (program.paused ? 0 : driver.time - program.start),
              ),
            )
          : current
      },
      play(a: ShapeFrame, b: ShapeFrame, track: Track) {
        program = { a, b, track, start: driver.time, offset: 0, paused: false }
      },
      control(offset: number, paused: boolean) {
        if (program) Object.assign(program, { offset, paused, start: driver.time })
      },
      resize() {
        this.sizes++
      },
      animations() {
        return program ? 1 : 0
      },
      bounds() {
        return [0, 0, 100, 100]
      },
      dispose() {
        this.removed = true
        program = undefined
      },
    }
    painters.push(p)
    return p
  })
})
afterEach(() => {
  shapes.forEach((s) => s.dispose())
  setShapeFactory(undefined)
})
function make(view = createView(), d = check) {
  const s = shape(view, { d, viewBox: [0, 0, 100, 100], stroke: '#FF00FF', strokeEnd: 0 })
  shapes.push(s)
  return s
}
it('normalizes SVG commands, relative positions, smooth control points and multiple contours', () => {
  const p = shapePath('m10 20 h30 v20 q10 10 20 0 t20 0 z M0 0 c1 2 3 4 5 6 s7 8 9 10')
  expect(p.commands).toBe('MLLQQZMCC')
  expect(p.contours).toBe(2)
  expect(p.points.slice(0, 14)).toEqual([
    10, 20, 40, 20, 40, 40, 50, 50, 60, 40, 70, 30, 80, 40,
  ])
  expect(p.points.slice(-6)).toEqual([7, 8, 12, 14, 14, 16])
  expect(shapePath(pathString(p))).toEqual(p)
})
it('converts elliptical arcs to cubic segments with exact endpoints and quarter-circle controls', () => {
  const p = shapePath('M90 50 A40 40 0 1 1 10 50 A40 40 0 1 1 90 50 Z')
  expect(p.commands).toBe('MCCCCZ')
  expect(p.points.slice(0, 2)).toEqual([90, 50])
  expect(p.points.at(-2)).toBe(90)
  expect(p.points.at(-1)).toBe(50)
  expect(p.points[3]).toBeCloseTo(50 + ((40 * 4) / 3) * Math.tan(Math.PI / 8), 8)
})
it('rejects malformed, nonfinite and oversized paths and incompatible morph topology', () => {
  for (const d of [
    '',
    'L1 2',
    'M1 2',
    'M1 2 C3 4',
    'M0 0 L1e309 2',
    'M0 0 A20 20 0 2 1 30 30',
    'M0 0 R2 3',
    'M0 0Z4',
  ])
    expect(() => shapePath(d)).toThrow()
  expect(() => shapePath('M0 0' + 'L1 2'.repeat(256))).toThrow(/256/)
  expect(() => compatible(shapePath(check), shapePath('M0 0Q20 20 40 0'))).toThrow(
    /matching/,
  )
})
it('validates setup before claiming a view and rejects compound partial trim', () => {
  const v = createView()
  expect(() => shape(v, { d: check, viewBox: [0, 0, 0, 100] })).toThrow(/viewBox/)
  expect(painters).toHaveLength(0)
  const s = make(v)
  expect(() => make(v)).toThrow(/already/)
  expect(() => s.set({ d: 'M0 0 L20 20 M30 30 L40 40' })).toThrow(/continuous/)
  s.set({ d: 'M0 0 L20 20 M30 30 L40 40', strokeEnd: 1 })
  expect(shapePath(s.snapshot().d).contours).toBe(2)
})
it('uses native presentation for interruption and preserves a valid animation on invalid input', async () => {
  const s = make()
  const a = s.animate({ strokeEnd: 1, d: other }, { duration: 1000, ease: 'linear' })
  driver.advance(300)
  const before = s.snapshot()
  expect(before.strokeEnd).toBeCloseTo(0.3)
  expect(() => s.animate({ d: 'M0 0Q20 20 40 0' })).toThrow(/matching/)
  expect(s.snapshot()).toEqual(before)
  const b = s.animate({ d: check, strokeEnd: 0.6 }, { duration: 500, ease: 'linear' })
  expect(await a.finished).toBe(false)
  expect(s.snapshot().d).toBe(before.d)
  driver.advance(250)
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.45)
  driver.advance(250)
  expect(await b.finished).toBe(true)
  expect(s.snapshot().strokeEnd).toBe(0.6)
  expect(driver.frames.size).toBe(0)
})
it('supports delay, reverse repeats, pause and seek without a JS display loop', async () => {
  const s = make(),
    a = s.animate(
      { strokeEnd: 1 },
      { duration: 100, delay: 50, repeat: 1, repeatType: 'reverse', ease: 'linear' },
    )
  driver.advance(25)
  expect(s.snapshot().strokeEnd).toBe(0)
  a.pause()
  driver.advance(1000)
  expect(s.snapshot().strokeEnd).toBe(0)
  a.progress = 0.4
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.5)
  a.play()
  driver.advance(100)
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.5)
  driver.advance(50)
  expect(await a.finished).toBe(true)
  expect(s.snapshot().strokeEnd).toBe(0)
  expect(driver.frames.size).toBe(0)
})
it('suspends for background, honors manual pause and holds the presentation on unload/reload', () => {
  const v = createView(),
    s = make(v),
    a = s.animate({ strokeEnd: 1 }, { duration: 1000, ease: 'linear' })
  driver.advance(250)
  Application.notify({ eventName: Application.suspendEvent })
  driver.advance(1000)
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.25)
  Application.notify({ eventName: Application.resumeEvent })
  driver.advance(250)
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.5)
  a.pause()
  Application.notify({ eventName: Application.suspendEvent })
  Application.notify({ eventName: Application.resumeEvent })
  expect(a.paused).toBe(true)
  v.notify({ eventName: 'unloaded' })
  expect(painters[0]!.removed).toBe(true)
  expect(s.snapshot().attached).toBe(false)
  v.notify({ eventName: 'loaded' })
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.5)
  expect(painters).toHaveLength(2)
  v.notify({ eventName: 'layoutChanged' })
  expect(painters[1]!.sizes).toBeGreaterThan(0)
})
it('rebuilds a replaced native surface without retaining old playback', async () => {
  const v = createView(),
    s = make(v),
    a = s.animate({ strokeEnd: 1 }, { duration: 1000, ease: 'linear' })
  driver.advance(250)
  v.nativeViewProtected = {}
  v.notify({ eventName: 'layoutChanged' })
  expect(await a.finished).toBe(false)
  expect(painters[0]!.removed).toBe(true)
  expect(painters).toHaveLength(2)
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.25)
})
it('resumes background-suspended playback after NativeScript unloads and reloads the view', async () => {
  const v = createView(),
    s = make(v),
    a = s.animate({ strokeEnd: 1 }, { duration: 1000, ease: 'linear' })
  driver.advance(250)
  Application.notify({ eventName: Application.suspendEvent })
  v.notify({ eventName: 'unloaded' })
  driver.advance(2000)
  Application.notify({ eventName: Application.resumeEvent })
  driver.advance(500)
  expect(a.paused).toBe(true)
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.25)
  v.notify({ eventName: 'loaded' })
  expect(a.paused).toBe(false)
  driver.advance(250)
  expect(s.snapshot().strokeEnd).toBeCloseTo(0.5)
  driver.advance(500)
  expect(await a.finished).toBe(true)
  expect(painters[0]!.removed).toBe(true)
})
it('settles decorative work under Reduce Motion and releases resources through a scope', async () => {
  const v = createView(),
    s = make(v),
    scope = motionScope()
  scope.add(s)
  const a = s.animate({ strokeEnd: 1 }, { duration: 1000 })
  driver.advance(100)
  configure({ reducedMotion: 'always' })
  expect(await a.finished).toBe(false)
  expect(s.snapshot().strokeEnd).toBe(1)
  expect(s.snapshot().nativeAnimations).toBe(0)
  const b = s.animate({ d: other })
  expect(await b.finished).toBe(true)
  expect(shapePath(s.snapshot().d)).toEqual(shapePath(other))
  scope.dispose()
  expect(s.disposed).toBe(true)
  expect(s.snapshot().attached).toBe(false)
  expect(painters[0]!.removed).toBe(true)
  expect(() => s.animate({ strokeEnd: 0 })).toThrow(/disposed/)
  expect(v.listenerCount('loaded')).toBe(0)
  expect(driver.frames.size).toBe(0)
})
it('creates a shape before the view loads and attaches it with the current frame on load', () => {
  const v = createView().unload()
  const s = make(v)
  expect(painters).toHaveLength(0)
  expect(s.snapshot()).toMatchObject({ attached: false, strokeEnd: 0 })
  s.set({ strokeEnd: 0.25 })
  v.load()
  expect(painters).toHaveLength(1)
  expect(painters[0]!.read()).toMatchObject({ start: 0, end: 0.25 })
  expect(s.snapshot()).toMatchObject({ attached: true, strokeEnd: 0.25 })
})
it('starts an animation requested before load once the view attaches', async () => {
  const v = createView().unload()
  const s = make(v)
  const drawing = s.animate({ strokeEnd: 1 }, { duration: 400, ease: 'linear' })
  driver.advance(300)
  const settled = state(drawing.finished)
  await Promise.resolve()
  expect(painters).toHaveLength(0)
  expect(settled()).toBeUndefined()
  v.load()
  expect(painters).toHaveLength(1)
  expect(painters[0]!.animations()).toBe(1)
  expect(drawing.progress).toBe(0)
  driver.advance(200)
  expect(painters[0]!.read().end).toBeCloseTo(0.5, 5)
  driver.advance(200)
  expect(await drawing.finished).toBe(true)
  expect(s.snapshot()).toMatchObject({ strokeEnd: 1, nativeAnimations: 0 })
})
it('keeps a pause requested before load and resumes from the start', () => {
  const v = createView().unload()
  const s = make(v)
  const drawing = s.animate({ strokeEnd: 1 }, { duration: 400, ease: 'linear' })
  drawing.pause()
  v.load()
  driver.advance(200)
  expect(drawing.paused).toBe(true)
  expect(painters[0]!.read().end).toBe(0)
  drawing.play()
  driver.advance(200)
  expect(painters[0]!.read().end).toBeCloseTo(0.5, 5)
})
it('completes an instant animation requested before load when the view attaches', async () => {
  configure({ reducedMotion: 'always' })
  const v = createView().unload()
  const s = make(v)
  const drawing = s.animate({ strokeEnd: 1 }, { duration: 400 })
  const settled = state(drawing.finished)
  await Promise.resolve()
  expect(settled()).toBeUndefined()
  v.load()
  expect(await drawing.finished).toBe(true)
  expect(painters[0]!.read()).toMatchObject({ end: 1 })
})
