import { test, expect, type Page } from '@playwright/test'
import type {} from './fixture.js'
const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on('pageerror', (error) => errors.get(page)!.push(String(error)))
  await page.goto('/?test')
  await page.evaluate(() => {
    window.rt = lab.createWebRuntime(document, { reducedMotion: 'never' })
    window.target = lab.makeTarget()
  })
})
test.afterEach(async ({ page }) => {
  await page.evaluate(() => rt.dispose())
  expect(errors.get(page)).toEqual([])
})

test('numeric keyframes, additive layers and selective cancellation share a live value', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const value = rt.motionValue(10)
    const base = rt.animate(value, [10, 110], { duration: 1000, ease: 'linear' })
    base.pause()
    base.progress = 0.5
    const layer = rt.animate(value, [0, 20], {
      duration: 1000,
      ease: 'linear',
      layer: 'feedback',
    })
    layer.pause()
    layer.progress = 0.5
    const combined = value.get()
    rt.bind(target, { x: value })
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    )
    const shown = new DOMMatrix(getComputedStyle(target).transform).e
    layer.stop()
    const restored = value.get()
    const baseStillPaused = base.paused
    base.progress = 0.8
    const continued = value.get()
    rt.stop(value)
    return {
      combined,
      shown,
      restored,
      baseStillPaused,
      continued,
      held: value.get(),
      base: await base.finished,
      layer: await layer.finished,
      active: rt.inspect(target).valueAnimations,
    }
  })
  expect(out).toEqual({
    combined: 70,
    shown: 70,
    restored: 60,
    baseStillPaused: true,
    continued: 90,
    held: 90,
    base: false,
    layer: false,
    active: 0,
  })
})

test('set clears settled and running value layers without stale cleanup overwriting the input', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const value = rt.motionValue(3)
    const settled = rt.animate(value, 7, { duration: 0, layer: 'offset' })
    await settled.finished
    const withLayer = value.get()
    const running = rt.animate(value, 100, { duration: 1000 })
    running.pause()
    running.progress = 0.4
    rt.set(value, 20)
    running.stop()
    settled.stop()
    const held = value.get()
    const next = rt.animate(value, 30, { duration: 0 })
    await next.finished
    return {
      withLayer,
      held,
      final: value.get(),
      old: await running.finished,
      active: rt.inspect(target).valueAnimations,
    }
  })
  expect(out).toEqual({ withLayer: 10, held: 20, final: 30, old: false, active: 0 })
})

test('value takeover carries analytical position and velocity and rejects foreign input atomically', async ({
  page,
}) => {
  const out = await page.evaluate(() => {
    const value = rt.motionValue(0)
    const first = rt.animate(value, [0, 100], { duration: 1000, ease: 'linear' })
    first.pause()
    first.progress = 0.4
    first.play()
    // Commands and samples share the clock within this task; compare initial spring velocity.
    const before = value.get(),
      velocity = value.getVelocity()
    const second = rt.animate(value, 200, { stiffness: 180, damping: 18 })
    const after = value.get(),
      inherited = rt.inspect(target).valueTracks[0]!.initialVelocity
    const foreignRuntime = lab.createWebRuntime(document),
      foreign = foreignRuntime.motionValue(5)
    let rejected = 0
    try {
      rt.animate(value, NaN)
    } catch {
      rejected++
    }
    try {
      rt.animate(foreign, 100)
    } catch {
      rejected++
    }
    try {
      rt.animate(value, 1, { layer: '' })
    } catch {
      rejected++
    }
    foreignRuntime.dispose()
    second.pause()
    return {
      before,
      after,
      velocity,
      inherited,
      rejected,
      active: rt.inspect(target).valueAnimations,
    }
  })
  expect(out.after).toBeCloseTo(out.before, 0)
  expect(out.inherited).toBeCloseTo(out.velocity, 0)
  expect(out.rejected).toBe(3)
  expect(out.active).toBe(1)
})

test('direct and scene value playback preserve other channels and settle once', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const value = rt.motionValue(0)
    const scene = rt.seekableTimeline(
      [
        { value, keyframes: [0, 100], transition: { duration: 1000, ease: 'linear' } },
        {
          target,
          keyframes: { x: [0, 100] },
          transition: { duration: 1000, ease: 'linear' },
        },
      ],
      { paused: true },
    )
    scene.progress = 0.5
    const replacement = rt.animate(value, 200, { duration: 0 })
    await replacement.finished
    scene.progress = 0.8
    const x = rt.inspect(target).pose!.x
    const sample = value.get()
    scene.stop()
    return {
      x,
      sample,
      scene: await scene.finished,
      active: rt.inspect(target).valueAnimations,
    }
  })
  expect(out).toEqual({ x: 80, sample: 200, scene: false, active: 0 })
})

test('unobserved finite values use their existing clock without a frame task and complete normally', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const value = rt.motionValue(0)
    const a = rt.animate(value, 100, { duration: 100, ease: 'linear' })
    const pending = rt.inspect(target).scheduler.pending
    const completed = await a.finished
    const final = value.get()
    value.dispose()
    return {
      pending,
      completed,
      final,
      tasks: rt.inspect(target).scheduler.tasks,
      active: rt.inspect(target).valueAnimations,
    }
  })
  expect(out).toEqual({
    pending: false,
    completed: true,
    final: 100,
    tasks: 0,
    active: 0,
  })
})

test('progress binds to the source clock through pause and seek, disposal preserves source playback', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const a = rt.animate(target, { x: [0, 200] }, { duration: 1000, ease: 'linear' })
    const p = rt.playbackProgress(a)
    const idle = rt.inspect(target).scheduler.pending
    a.pause()
    a.progress = 0.35
    const held = p.get(),
      velocity = p.getVelocity()
    const other = lab.makeTarget()
    rt.bind(other, { scale: p.to([0, 1], [1, 2]) })
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    )
    const shown = new DOMMatrix(getComputedStyle(other).transform).a
    p.dispose()
    a.progress = 0.7
    const source = rt.inspect(target).pose!.x
    a.stop()
    return { idle, held, velocity, shown, source, stopped: await a.finished }
  })
  expect(out.idle).toBe(false)
  expect(out.held).toBeCloseTo(0.35)
  expect(out.velocity).toBe(0)
  expect(out.shown).toBeCloseTo(1.35, 3)
  expect(out.source).toBeCloseTo(140)
  expect(out.stopped).toBe(false)
})

test('value progress and subscriptions settle and leave no idle scheduler', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const value = rt.motionValue(0),
      samples: number[] = []
    const a = rt.animate(value, 1, { duration: 120, ease: 'linear' })
    const progress = rt.playbackProgress(a)
    const off = progress.subscribe((p) => samples.push(p))
    await a.finished
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    )
    const final = progress.get(),
      tasks = rt.inspect(target).scheduler.tasks
    off()
    progress.dispose()
    value.dispose()
    return {
      final,
      tasks,
      intermediate: samples.some((v) => v > 0 && v < 1),
      pending: rt.inspect(target).scheduler.pending,
    }
  })
  expect(out).toEqual({ final: 1, tasks: 0, intermediate: true, pending: false })
})

test('decay uses projected snap, inherited velocity and partial element ownership', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    rt.set(target, { x: 30 })
    const y = rt.animate(target, { y: [0, 100] }, { duration: 1000, ease: 'linear' })
    y.pause()
    y.progress = 0.5
    const d = rt.decay(target, { x: 600 }, { friction: 0.99 })
    d.pause()
    d.progress = 0.5
    const halfway = rt.inspect(target).pose!
    let rejected = false
    try {
      rt.decay(target, { x: 5, y: Infinity })
    } catch {
      rejected = true
    }
    const still = rt.inspect(target).pose!.x
    d.stop()
    const snap = rt.decay(target, { x: -1000 }, { snap: [0, 320] })
    snap.pause()
    snap.progress = 1
    snap.play()
    await snap.finished
    const final = rt.inspect(target).pose!
    y.stop()
    return {
      halfway,
      still,
      rejected,
      final,
      free: await d.finished,
      snap: await snap.finished,
    }
  })
  expect(out.halfway.x).toBeGreaterThan(30)
  expect(out.halfway.y).toBeCloseTo(50)
  expect(out.still).toBe(out.halfway.x)
  expect(out.rejected).toBe(true)
  expect(out.final.x).toBeCloseTo(0)
  expect(out.final.y).toBeCloseTo(50)
  expect(out.free).toBe(false)
  expect(out.snap).toBe(true)
})

test('infinite scalar repeats stay analytic, pause safely and reject finite progress', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const value = rt.motionValue(0),
      a = rt.animate(value, [0, 10], {
        duration: 50,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'linear',
      })
    a.pause()
    const held = value.get()
    let rejected = 0
    try {
      a.progress = 0.5
    } catch {
      rejected++
    }
    try {
      rt.playbackProgress(a)
    } catch {
      rejected++
    }
    a.play()
    a.stop()
    return {
      infinite: a.duration === Infinity,
      held,
      rejected,
      done: await a.finished,
      pending: rt.inspect(target).scheduler.pending,
    }
  })
  expect(out.infinite).toBe(true)
  expect(out.rejected).toBe(2)
  expect(out.done).toBe(false)
  expect(out.pending).toBe(false)
})

test('reduced motion removes decay displacement while progress remains readable', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    rt.configure({ reducedMotion: 'always' })
    const a = rt.decay(target, { x: 800 }, { snap: [0, 180] })
    const progress = rt.playbackProgress(a)
    const completed = await a.finished
    return {
      completed,
      end: rt.inspect(target).pose!.x,
      duration: a.duration,
      progress: progress.get(),
      pending: rt.inspect(target).scheduler.pending,
    }
  })
  expect(out).toEqual({
    completed: true,
    end: 180,
    duration: 0,
    progress: 1,
    pending: false,
  })
})

test('disposing a scalar cancels its playback but preserves other scene participants', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const value = rt.motionValue(0)
    const a = rt.seekableTimeline(
      [
        { value, keyframes: [0, 1], transition: { duration: 500 } },
        {
          target,
          keyframes: { x: [0, 100] },
          transition: { duration: 500, ease: 'linear' },
        },
      ],
      { paused: true },
    )
    value.dispose()
    a.progress = 0.7
    const x = rt.inspect(target).pose!.x
    a.stop()
    return { x, completed: await a.finished, values: rt.inspect(target).valueAnimations }
  })
  expect(out).toEqual({ x: 70, completed: false, values: 0 })
})
