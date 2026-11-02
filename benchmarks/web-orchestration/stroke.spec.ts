import { test, expect, type Page } from '@playwright/test'
import type {} from './fixture.js'
const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on('pageerror', (e) => errors.get(page)!.push(String(e)))
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

test('SVG drawing measures authored length and shares progress with playback controls', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath()
    path.setAttribute('pathLength', '10')
    const drawing = rt.drawPath(path, { progress: 0 }),
      animation = drawing.animate(1, { duration: 1000, ease: 'linear' })
    const progress = rt.playbackProgress(animation)
    animation.pause()
    animation.progress = 0.4
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const sample = drawing.snapshot(),
      css = getComputedStyle(path)
    const offset = parseFloat(css.strokeDashoffset),
      dash = css.strokeDasharray
    animation.progress = 1
    const held = animation.paused
    animation.progress = 0.2
    animation.play()
    animation.stop()
    return {
      sample,
      offset,
      dash,
      held,
      progress: progress.get(),
      completed: await animation.finished,
      pending: rt.inspect(target).scheduler.pending,
    }
  })
  expect(out.sample.progress).toBeCloseTo(0.4)
  expect(out.sample.length).toBeGreaterThan(300)
  expect(out.offset).toBeCloseTo(6)
  expect(out.dash).toBe('10px, 10px')
  expect(out.held).toBe(true)
  expect(out.progress).toBeCloseTo(0.2, 1)
  expect(out.completed).toBe(false)
  expect(out.pending).toBe(false)
})

test('reversing an unfinished stroke inherits its presentation and stale handles cannot cancel it', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath(),
      drawing = rt.drawPath(path, { progress: 0 })
    const forward = drawing.animate(1, { duration: 1000, ease: 'linear' })
    forward.pause()
    forward.progress = 0.6
    const before = drawing.snapshot().progress
    const reverse = drawing.animate(0, { duration: 300, ease: 'linear' })
    reverse.pause()
    const after = drawing.snapshot().progress
    forward.stop()
    reverse.progress = 0.5
    const half = drawing.snapshot().progress
    reverse.progress = 1
    reverse.play()
    const completed = await reverse.finished
    return {
      before,
      after,
      half,
      completed,
      first: await forward.finished,
      final: drawing.snapshot().progress,
      opacity: getComputedStyle(path).strokeOpacity,
    }
  })
  expect(out.before).toBeCloseTo(0.6)
  expect(out.after).toBeCloseTo(0.6, 2)
  expect(out.half).toBeCloseTo(0.3, 2)
  expect(out.first).toBe(false)
  expect(out.completed).toBe(true)
  expect(out.final).toBe(0)
  expect(out.opacity).toBe('0')
})

test('geometry refresh preserves the paused normalized position and the existing handle', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath(),
      drawing = rt.drawPath(path, { progress: 0 }),
      a = drawing.animate(1, { duration: 1000, ease: 'linear' })
    a.pause()
    a.progress = 0.25
    path.setAttribute('d', 'M 10 30 L 510 30')
    drawing.refresh()
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const snapshot = drawing.snapshot(),
      offset = parseFloat(getComputedStyle(path).strokeDashoffset),
      effects = path.getAnimations().length
    a.progress = 1
    a.play()
    const done = await a.finished
    return { snapshot, offset, effects, done, final: drawing.snapshot().progress }
  })
  expect(out.snapshot.length).toBeCloseTo(500)
  expect(out.snapshot.progress).toBeCloseTo(0.25)
  expect(out.offset).toBeCloseTo(375)
  expect(out.effects).toBe(1)
  expect(out.done).toBe(true)
  expect(out.final).toBe(1)
})

test('drawings restore authored styles and preserve newer owners and external inline edits', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath()
    path.style.strokeDasharray = '3 9'
    path.style.strokeDashoffset = '2'
    path.style.strokeOpacity = '.7'
    const original = path.style.strokeDasharray
    const first = rt.drawPath(path, { progress: 0 }),
      a = first.animate(1, { duration: 1000 })
    a.pause()
    a.progress = 0.4
    const second = rt.drawPath(path),
      before = second.snapshot().progress
    first.dispose()
    a.stop()
    second.set(0.8)
    const retained = second.snapshot().progress
    path.style.strokeDashoffset = '42px'
    second.dispose()
    return {
      before,
      retained,
      original,
      array: path.style.strokeDasharray,
      offset: path.style.strokeDashoffset,
      opacity: path.style.strokeOpacity,
      completed: await a.finished,
      paths: rt.inspect(target).paths,
    }
  })
  expect(out.before).toBeGreaterThan(0)
  expect(out.retained).toBe(0.8)
  expect(out.array).toBe(out.original)
  expect(out.offset).toBe('42px')
  expect(out.opacity).toBe('0.7')
  expect(out.completed).toBe(false)
  expect(out.paths).toBe(0)
})

test('scope disposal cancels drawings without touching another path, including shadow-root removal', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const scope = rt.scope(),
      path = lab.makePath(),
      other = lab.makePath()
    const drawing = scope.drawPath(path, { progress: 0 }),
      sibling = rt.drawPath(other, { progress: 0 })
    const a = drawing.animate(1, { duration: 1000 }),
      b = sibling.animate(1, { duration: 1000 })
    b.pause()
    scope.dispose()
    const siblingPlaying = other.getAnimations().length
    const host = document.createElement('div')
    document.body.append(host)
    host.attachShadow({ mode: 'open' }).append(other.ownerSVGElement!)
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    host.remove()
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    return {
      a: await a.finished,
      b: await b.finished,
      siblingPlaying,
      disposed: sibling.disposed,
      paths: rt.inspect(target).paths,
    }
  })
  expect(out).toEqual({ a: false, b: false, siblingPlaying: 1, disposed: true, paths: 0 })
})

test('stroke playback composes with imperative timelines, pause and progress observation', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath(),
      drawing = rt.drawPath(path, { progress: 0 })
    let a: ReturnType<typeof drawing.animate> | undefined
    const timeline = rt.timeline([
      {
        at: 0,
        run: () => {
          a = drawing.animate(1, { duration: 180, ease: 'linear' })
          return a
        },
      },
      { at: 60, run: () => rt.animate(target, { x: 100 }, { duration: 60 }) },
    ])
    timeline.pause()
    const held = drawing.snapshot().progress
    await new Promise((r) => setTimeout(r, 100))
    const frozen = drawing.snapshot().progress
    const p = rt.playbackProgress(a!)
    timeline.play()
    const done = await timeline.finished
    return { held, frozen, done, progress: p.get(), x: rt.inspect(target).pose!.x }
  })
  expect(out.held).toBe(out.frozen)
  expect(out.done).toBe(true)
  expect(out.progress).toBe(1)
  expect(out.x).toBe(100)
})

test('reduced motion completes to the endpoint and cancels visual activity on preference changes', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath(),
      drawing = rt.drawPath(path, { progress: 0 })
    const a = drawing.animate(1, { duration: 1000 })
    a.pause()
    a.progress = 0.3
    rt.configure({ reducedMotion: 'always' })
    const first = await a.finished
    const b = drawing.animate(0, { duration: 1000 })
    const second = await b.finished
    return {
      first,
      second,
      duration: b.duration,
      end: drawing.snapshot().progress,
      effects: path.getAnimations().length,
    }
  })
  expect(out).toEqual({ first: true, second: true, duration: 0, end: 0, effects: 0 })
})

test('invalid endpoints, multi-contour geometry and foreign contexts reject without replacing playback', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath(),
      drawing = rt.drawPath(path, { progress: 0 }),
      a = drawing.animate(1, { duration: 1000, ease: 'linear' })
    a.pause()
    a.progress = 0.4
    const foreign = lab.createWebRuntime(document)
    let rejected = 0
    try {
      drawing.animate(1.2)
    } catch {
      rejected++
    }
    try {
      drawing.animate(1, { repeat: Infinity })
    } catch {
      rejected++
    }
    try {
      foreign.drawPath(path)
    } catch {
      rejected++
    }
    const bad = lab.makePath()
    bad.setAttribute('d', 'M0 0L10 10 M20 20L30 30')
    try {
      rt.drawPath(bad)
    } catch {
      rejected++
    }
    foreign.dispose()
    const held = drawing.snapshot().progress
    a.stop()
    return { rejected, held, completed: await a.finished }
  })
  expect(out.rejected).toBe(4)
  expect(out.held).toBeCloseTo(0.4)
  expect(out.completed).toBe(false)
})

test('zero-length geometry is an invisible no-op and ordinary SVG geometry uses measured units', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath()
    path.setAttribute('d', 'M 10 10')
    const zero = rt.drawPath(path, { progress: 0 }),
      a = zero.animate(1, { duration: 500 })
    await a.finished
    const values = []
    for (const [name, attributes] of [
      ['circle', { cx: '50', cy: '50', r: '30' }],
      ['rect', { x: '10', y: '10', width: '100', height: '40' }],
      ['polyline', { points: '0,0 100,0 100,50' }],
    ] as const) {
      const shape = document.createElementNS('http://www.w3.org/2000/svg', name)
      for (const [k, v] of Object.entries(attributes)) shape.setAttribute(k, v)
      path.ownerSVGElement!.append(shape)
      const drawing = rt.drawPath(shape),
        b = drawing.animate([0, 1], { duration: 1000, ease: 'linear' })
      b.pause()
      b.progress = 0.5
      values.push({
        length: drawing.snapshot().length,
        offset: parseFloat(getComputedStyle(shape).strokeDashoffset),
      })
      drawing.dispose()
    }
    return {
      duration: a.duration,
      zero: zero.snapshot().progress,
      opacity: getComputedStyle(path).strokeOpacity,
      values,
    }
  })
  expect(out.duration).toBe(0)
  expect(out.zero).toBe(1)
  expect(out.opacity).toBe('0')
  for (const v of out.values) {
    expect(v.length).toBeGreaterThan(0)
    expect(v.offset).toBeCloseTo(v.length / 2, 2)
  }
})

test('a spring reversal carries forward velocity before turning around', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const path = lab.makePath(),
      drawing = rt.drawPath(path, { progress: 0 })
    const forward = drawing.animate(1, { duration: 1000, ease: 'linear' })
    forward.pause()
    forward.progress = 0.5
    forward.play()
    const reverse = drawing.animate(0, { stiffness: 20, damping: 4 })
    const moving = drawing.snapshot()
    reverse.pause()
    forward.stop()
    reverse.progress = 1
    reverse.play()
    return { moving, finished: await reverse.finished, end: drawing.snapshot().progress }
  })
  expect(out.moving.progress).toBeGreaterThanOrEqual(0.5)
  expect(out.moving.velocity).toBeGreaterThan(0)
  expect(out.finished).toBe(true)
  expect(out.end).toBe(0)
})
