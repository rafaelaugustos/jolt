import { beforeEach, afterEach, expect, it } from 'vitest'
import { Application } from '@nativescript/core'
import { blur, type Blur, type BlurSnapshot } from '../src/blur/index.js'
import { setBlurFactory, type BlurPainter } from '../src/blur/native.js'
import { configure, motionScope } from '../src/index.js'
import type { Track } from '../src/track.js'
import { createView, driver } from './helpers.js'
let owners: Blur[], painters: (BlurPainter & { removed: boolean })[], unsupported: boolean
beforeEach(() => {
  owners = []
  painters = []
  unsupported = false
  setBlurFactory((_view, options) => {
    let current = options.amount,
      program:
        { track: Track; offset: number; anchor: number; paused: boolean } | undefined
    const p = {
      removed: false,
      paint(v: number) {
        current = v
        program = undefined
      },
      play(track: Track) {
        program = { track, offset: 0, anchor: driver.time, paused: false }
      },
      control(offset: number, paused: boolean) {
        if (program) Object.assign(program, { offset, paused, anchor: driver.time })
      },
      resize() {},
      snapshot(): BlurSnapshot {
        const amount = program
          ? Math.max(
              0,
              Math.min(
                1,
                program.track.valueAt(
                  program.offset + (program.paused ? 0 : driver.time - program.anchor),
                ),
              ),
            )
          : current
        return {
          amount,
          appliedAmount: unsupported ? 0 : amount,
          backend: unsupported ? 'none' : 'ios-material',
          attached: !this.removed,
          nativeAnimations: program ? 1 : 0,
          frames: 0,
          width: 300,
          height: 400,
        }
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
  owners.forEach((o) => o.dispose())
  setBlurFactory(undefined)
})
function make(view = createView()) {
  const b = blur(view)
  owners.push(b)
  return b
}
it('validates before claiming a view and keeps one owner until disposal', () => {
  const v = createView()
  for (const options of [
    { amount: NaN },
    { amount: 2 },
    { radius: 0 },
    { radius: Infinity },
    { style: 'invalid' as 'light' },
  ])
    expect(() => blur(v, options)).toThrow()
  expect(painters).toHaveLength(0)
  const b = make(v)
  expect(() => make(v)).toThrow(/already/)
  b.dispose()
  expect(() => make(v)).not.toThrow()
})
it('retargets displayed blur and rejects invalid commands without interrupting it', async () => {
  const b = make(),
    a = b.animate(1, { duration: 1000, ease: 'linear' })
  driver.advance(300)
  const before = b.snapshot()
  expect(before.amount).toBeCloseTo(0.3)
  expect(() => b.animate(-1)).toThrow()
  expect(() => b.set(NaN)).toThrow()
  expect(() => b.animate(0.5, 'unknown' as 'snappy')).toThrow()
  expect(b.snapshot()).toEqual(before)
  const c = b.animate(0, { duration: 500, ease: 'linear' })
  expect(await a.finished).toBe(false)
  expect(b.snapshot().amount).toBeCloseTo(0.3)
  driver.advance(250)
  expect(b.snapshot().amount).toBeCloseTo(0.15)
  driver.advance(250)
  expect(await c.finished).toBe(true)
  expect(b.snapshot().amount).toBe(0)
  expect(driver.frames.size).toBe(0)
})
it('pauses during delay, seeks and finishes a reversed repeat at its start', async () => {
  const b = make(),
    a = b.animate(1, {
      duration: 100,
      delay: 50,
      repeat: 1,
      repeatType: 'reverse',
      ease: 'linear',
    })
  driver.advance(25)
  a.pause()
  driver.advance(900)
  expect(b.snapshot().amount).toBe(0)
  a.progress = 0.4
  expect(b.snapshot().amount).toBeCloseTo(0.5)
  a.play()
  driver.advance(150)
  expect(await a.finished).toBe(true)
  expect(b.snapshot().amount).toBe(0)
})
it('holds a stopped presentation and ignores terminal handle controls', async () => {
  const b = make(),
    a = b.animate(1, { duration: 1000, ease: 'linear' })
  driver.advance(400)
  b.stop()
  expect(await a.finished).toBe(false)
  a.play()
  a.progress = 0.9
  driver.advance(1000)
  expect(b.snapshot().amount).toBeCloseTo(0.4)
  b.set(0.8)
  expect(b.snapshot().amount).toBe(0.8)
})
it('resumes background-unloaded work after load and preserves explicit pauses', async () => {
  const v = createView(),
    b = make(v),
    a = b.animate(1, { duration: 1000, ease: 'linear' })
  driver.advance(250)
  Application.notify({ eventName: Application.suspendEvent })
  v.notify({ eventName: 'unloaded' })
  driver.advance(2000)
  Application.notify({ eventName: Application.resumeEvent })
  driver.advance(500)
  expect(a.paused).toBe(true)
  expect(b.snapshot().amount).toBeCloseTo(0.25)
  v.notify({ eventName: 'loaded' })
  driver.advance(250)
  expect(b.snapshot().amount).toBeCloseTo(0.5)
  a.pause()
  Application.notify({ eventName: Application.suspendEvent })
  Application.notify({ eventName: Application.resumeEvent })
  expect(a.paused).toBe(true)
  a.play()
  driver.advance(500)
  expect(await a.finished).toBe(true)
})
it('cancels ordinary unload and native replacement, then reattaches the held amount', async () => {
  const v = createView(),
    b = make(v),
    a = b.animate(1, { duration: 1000, ease: 'linear' })
  driver.advance(250)
  v.notify({ eventName: 'unloaded' })
  expect(await a.finished).toBe(false)
  expect(painters[0]!.removed).toBe(true)
  expect(b.snapshot().attached).toBe(false)
  expect(b.snapshot().appliedAmount).toBe(0)
  v.notify({ eventName: 'loaded' })
  expect(b.snapshot().amount).toBeCloseTo(0.25)
  const c = b.animate(1, { duration: 1000, ease: 'linear' })
  driver.advance(500)
  v.nativeViewProtected = {}
  v.notify({ eventName: 'layoutChanged' })
  expect(await c.finished).toBe(false)
  expect(painters[1]!.removed).toBe(true)
  expect(b.snapshot().amount).toBeCloseTo(0.625)
})
it('applies Reduce Motion destinations immediately and releases a scoped effect', async () => {
  const v = createView(),
    b = make(v),
    scope = motionScope()
  scope.add(b)
  const a = b.animate(1, { duration: 1000 })
  driver.advance(100)
  configure({ reducedMotion: 'always' })
  expect(await a.finished).toBe(false)
  expect(b.snapshot().amount).toBe(1)
  const c = b.animate(0)
  expect(await c.finished).toBe(true)
  expect(b.snapshot().nativeAnimations).toBe(0)
  scope.dispose()
  scope.dispose()
  expect(b.disposed).toBe(true)
  expect(b.snapshot().attached).toBe(false)
  expect(v.listenerCount('loaded')).toBe(0)
  expect(driver.frames.size).toBe(0)
  expect(() => b.set(0)).toThrow(/disposed/)
})
it('uses an immediate no-effect fallback without changing target opacity', async () => {
  unsupported = true
  const v = createView(),
    b = make(v)
  v.opacity = 0.7
  const a = b.animate(1, { duration: 500, repeat: Infinity })
  expect(await a.finished).toBe(true)
  expect(a.duration).toBe(0)
  expect(b.snapshot()).toMatchObject({
    backend: 'none',
    amount: 1,
    appliedAmount: 0,
    nativeAnimations: 0,
  })
  expect(v.opacity).toBe(0.7)
})
