import { expect, test } from '@playwright/test'
import type {} from './fixture.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    window.rt = window.lab.createWebRuntime(document, { reducedMotion: 'never' })
    window.target = window.lab.makeTarget()
    window.handles = {}
  })
})

test('records the browser and finite controls/thenable completion', async ({
  page,
  browser,
}, info) => {
  await info.attach('browser', {
    body: JSON.stringify({ browser: info.project.name, version: browser.version() }),
    contentType: 'application/json',
  })
  const result = await page.evaluate(async () => {
    const h = rt.animate(
      target,
      { x: [0, 100], opacity: [0, 1] },
      { duration: 180, ease: 'linear' },
    )
    h.pause()
    h.progress = 1
    let settled = false
    void h.finished.then(() => {
      settled = true
    })
    await new Promise((r) => setTimeout(r, 50))
    const endpoint = { settled, paused: h.paused, pose: rt.inspect(target).pose }
    h.progress = 0.4
    const middle = rt.inspect(target).pose
    h.play()
    const finished = await h
    const end = rt.inspect(target)
    h.progress = 0
    h.pause()
    h.play()
    return { endpoint, middle, finished, end, progress: h.progress }
  })
  expect(result.endpoint).toMatchObject({
    settled: false,
    paused: true,
    pose: { x: 100, opacity: 1 },
  })
  expect(result.middle).toMatchObject({ x: 40, opacity: 0.4 })
  expect(result.finished).toBe(true)
  expect(result.end).toMatchObject({
    animations: 0,
    effects: 0,
    pose: { x: 100, opacity: 1 },
  })
  expect(result.progress).toBe(1)
})

test('keeps independent channels and private scale contributions through retargets', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    rt.definePreset('feedback', {
      keyframes: { scale: 0.96 },
      transition: { duration: 40, layer: 'press' },
    })
    rt.set(target, { scale: 1.1 })
    await rt.animate(target, 'feedback')
    const pressed = rt.inspect(target).pose!.scaleX
    await rt.animate(target, { scale: 1.2 }, { duration: 40 })
    const changed = rt.inspect(target).pose!.scaleX
    await rt.animate(target, { scale: 1 }, { duration: 40, layer: 'press' })
    const released = rt.inspect(target).pose!.scaleX
    const x = rt.animate(target, { x: 100 }, { duration: 1000, ease: 'linear' })
    const y = rt.animate(target, { y: 200 }, { duration: 2000, ease: 'linear' })
    x.pause()
    x.progress = 0.4
    y.pause()
    y.progress = 0.3
    const next = rt.animate(target, { x: 300 }, 'snappy')
    next.pause()
    x.play()
    x.progress = 0.8
    const after = rt.inspect(target)
    rt.stop(target, ['x'])
    y.stop()
    return {
      pressed,
      changed,
      released,
      after,
      oldFinished: await x,
      nextFinished: await next,
    }
  })
  expect(result.pressed).toBeCloseTo(1.056, 6)
  expect(result.changed).toBeCloseTo(1.152, 6)
  expect(result.released).toBeCloseTo(1.2, 6)
  expect(result.after.pose!.y).toBeCloseTo(60, 5)
  expect(result.after.tracks!.find((t) => t.property === 'x')!.from).toBeCloseTo(40, 4)
  expect(result.oldFinished).toBe(false)
  expect(result.nextFinished).toBe(false)
})

test('preserves finite repeats, reverse, holds, delay and timeScale', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    rt.configure({ timeScale: 2 })
    const transition = {
      duration: 400,
      delay: 100,
      ease: 'linear' as const,
      repeat: 2,
      repeatType: 'reverse' as const,
      repeatDelay: 80,
    }
    const h = rt.animate(target, { x: [0, 100] }, transition)
    const track = lab.createTrack(
      'x',
      [0, 100],
      lab.resolveTransition(transition, 'x', 2),
      0,
      { timeScale: 2, reducedMotion: false },
    )
    h.pause()
    const samples = [0, 0.1, 0.3, 0.5, 0.7, 0.9, 1].map((progress) => {
      h.progress = progress
      return {
        expected: track.valueAt(h.duration * progress),
        actual: new DOMMatrix(getComputedStyle(target).transform).e,
      }
    })
    const duration = h.duration
    h.stop()
    return { samples, duration, expectedDuration: track.end }
  })
  expect(result.duration).toBe(result.expectedDuration)
  for (const sample of result.samples)
    expect(sample.actual).toBeCloseTo(sample.expected, 3)
})

test('supports authored keyframes, scale overrides and portable preset stagger', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const targets = [target, lab.makeTarget(), lab.makeTarget()]
    const preset = rt.animate(targets, 'fadeInUp', {
      stagger: { each: 100, from: 'center' },
    })
    preset.pause()
    preset.progress = 0
    const initial = targets.map((t) => rt.inspect(t).pose)
    preset.stop()
    const h = rt.animate(
      target,
      { x: [0, 60, -20, 100], scale: [1, 2], scaleY: [1, 0.5] },
      {
        duration: 1000,
        times: [0, 0.2, 0.7, 1],
        ease: 'linear',
        scale: { duration: 1000, ease: 'linear' },
        scaleY: { duration: 1000, ease: 'linear' },
      },
    )
    h.pause()
    h.progress = 0.2
    const pose = rt.inspect(target).pose
    h.stop()
    return { initial, pose }
  })
  for (const pose of result.initial) expect(pose).toMatchObject({ opacity: 0, y: 24 })
  expect(result.pose).toMatchObject({ x: 60, scaleX: 1.2, scaleY: 0.9 })
})

test('rolls back invalid plans and keyframe budgets without stealing ownership', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    rt.dispose()
    window.rt = lab.createWebRuntime(document, {
      maxKeyframes: 8,
      reducedMotion: 'never',
    })
    const h = rt.animate(target, { x: [0, 100] }, { duration: 1000, ease: 'linear' })
    h.pause()
    h.progress = 0.3
    const before = rt.inspect(target),
      styles = target.style.cssText
    const errors: string[] = []
    for (const operation of [
      () =>
        rt.animate(target, { x: 200 }, { type: 'spring', bounce: 0.5, duration: 1000 }),
      () => rt.animate(target, { opacity: 0.2 }, { repeat: Infinity }),
      () => rt.animate([target, lab.makeTarget('transform: rotateY(30deg)')], { x: 200 }),
      () => rt.animate(target, { x: [0, NaN] }),
    ]) {
      try {
        operation()
      } catch (error) {
        errors.push(String(error))
      }
    }
    const after = rt.inspect(target),
      afterStyles = target.style.cssText
    h.stop()
    return { before, after, styles, afterStyles, errors, stopped: await h }
  })
  expect(result.errors).toHaveLength(4)
  expect(result.after).toEqual(result.before)
  expect(result.afterStyles).toBe(result.styles)
  expect(result.stopped).toBe(false)
})

test('isolates contexts and custom recipes; refuses simultaneous target ownership', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const second = lab.createWebRuntime(document, {
      timeScale: 2,
      reducedMotion: 'never',
    })
    const other = lab.makeTarget()
    rt.definePreset('custom', { keyframes: { x: 90 }, transition: { duration: 400 } })
    const first = rt.animate(target, 'custom')
    first.pause()
    const h = second.animate(other, { x: 90 }, { duration: 400 })
    h.pause()
    const errors: string[] = []
    try {
      second.animate(other, 'custom')
    } catch (e) {
      errors.push(String(e))
    }
    try {
      second.animate(target, { y: 10 })
    } catch (e) {
      errors.push(String(e))
    }
    const durations = [first.duration, h.duration]
    rt.release(target)
    const replacement = second.animate(
      target,
      { x: [0, 200] },
      { duration: 1000, ease: 'linear' },
    )
    replacement.pause()
    replacement.progress = 0.5
    first.play()
    first.progress = 1
    const pose = second.inspect(target).pose
    const retired = await first
    second.dispose()
    second.dispose()
    return {
      errors,
      durations,
      pose,
      retired,
      state: second.inspect(target),
      replaced: await replacement,
    }
  })
  expect(result.errors).toHaveLength(2)
  expect(result.durations).toEqual([400, 200])
  expect(result.pose!.x).toBe(100)
  expect(result.retired).toBe(false)
  expect(result.replaced).toBe(false)
  expect(result.state).toMatchObject({
    targets: 0,
    animations: 0,
    observers: 0,
    pendingFrame: false,
  })
})

test('restores a static CSS baseline and preserves external inline changes', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    target.style.transform = 'translate(10px, 5px) rotate(20deg)'
    target.style.opacity = '0.8'
    target.style.transformOrigin = '25px 30px'
    const original = target.style.cssText
    const h = rt.animate(
      target,
      { x: [0, 100], scale: [1, 2], opacity: [0.8, 0.4] },
      { duration: 1000, ease: 'linear' },
    )
    h.pause()
    h.progress = 0.5
    const expected = new DOMMatrix('translate(10px, 5px) rotate(20deg)')
      .translate(50, 0)
      .scale(1.5)
    const actual = new DOMMatrix(getComputedStyle(target).transform)
    rt.release(target)
    const restored = target.style.cssText
    const next = rt.animate(target, { x: 100 }, { duration: 1000 })
    target.style.transform = 'scale(1.3)'
    target.style.opacity = '0.2'
    rt.release(target)
    return {
      original,
      restored,
      a: actual.toFloat64Array(),
      b: expected.toFloat64Array(),
      external: target.style.transform,
      opacity: target.style.opacity,
      cancelled: await next,
    }
  })
  expect(result.restored).toBe(result.original)
  for (let i = 0; i < 16; i++) expect(result.a[i]).toBeCloseTo(result.b[i]!, 3)
  expect(result.external).toBe('scale(1.3)')
  expect(result.opacity).toBe('0.2')
  expect(result.cancelled).toBe(false)
})

test('cleans up removed targets, including inside a shadow root', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = host.attachShadow({ mode: 'open' })
    root.append(target)
    target.style.display = 'block'
    const h = rt.animate(target, { x: 500 }, { duration: 1000 })
    target.remove()
    const finished = await h
    return { finished, state: rt.inspect(target), effects: target.getAnimations().length }
  })
  expect(result.finished).toBe(false)
  expect(result.state).toMatchObject({
    targets: 0,
    animations: 0,
    observers: 0,
    pendingFrame: false,
  })
  expect(result.effects).toBe(0)
})

test('follows live reduced-motion preference and leaves opacity playing', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => {
    rt.configure({ reducedMotion: 'user' })
    handles.move = rt.animate(target, { x: 300 }, { duration: 2000 })
    handles.fade = rt.animate(
      target,
      { opacity: 0.4 },
      { duration: 2000, ease: 'linear' },
    )
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(await page.evaluate(() => handles.move!.finished)).toBe(true)
  const state = await page.evaluate(() => rt.inspect(target))
  expect(state.pose!.x).toBe(300)
  expect(state.tracks!.map((t) => t.property)).toEqual(['opacity'])
  await page.evaluate(() => {
    const query = matchMedia('(prefers-reduced-motion: reduce)')
    // A newly constructed query can report the new preference before existing
    // query objects receive their change event in WebKit. Await that notification.
    ;(window as unknown as { preferenceRestored: Promise<void> }).preferenceRestored =
      new Promise<void>((resolve) => {
        const changed = () => {
          if (!query.matches) {
            query.removeEventListener('change', changed)
            resolve()
          }
        }
        query.addEventListener('change', changed)
        changed()
      })
  })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(
    () => (window as unknown as { preferenceRestored: Promise<void> }).preferenceRestored,
  )
  const next = await page.evaluate(() => {
    const h = rt.animate(target, { x: 0 }, { duration: 1000 })
    h.pause()
    const value = rt.inspect(target).tracks!.find((t) => t.property === 'x')!
    rt.dispose()
    return value.duration
  })
  expect(next).toBe(1000)
})

test('plays without per-frame style writes or a library frame loop', async ({ page }) => {
  const result = await page.evaluate(async () => {
    let frames = 0
    const original = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (callback) => {
      frames++
      return original(callback)
    }
    rt.animate(target, { x: 240, opacity: 0.3 }, { duration: 3000, ease: 'linear' })
    await Promise.all(target.getAnimations().map((a) => a.ready))
    await new Promise<void>((r) => original(() => r()))
    const before = rt.inspect(target)
    let writes = 0
    const observer = new MutationObserver((records) => {
      writes += records.length
    })
    observer.observe(target, { attributes: true, attributeFilter: ['style'] })
    const start = new DOMMatrix(getComputedStyle(target).transform).e
    let position = start
    const until = performance.now() + 2000
    while (position < start + 10 && performance.now() < until) {
      await new Promise<void>((r) => original(() => r()))
      position = new DOMMatrix(getComputedStyle(target).transform).e
    }
    observer.disconnect()
    const after = rt.inspect(target)
    window.requestAnimationFrame = original
    return { start, position, writes, frames, before, after }
  })
  expect(result.position).toBeGreaterThan(result.start + 9)
  expect(result.writes).toBe(0)
  expect(result.frames).toBe(0)
  expect(result.after.rebuilds).toBe(result.before.rebuilds)
})
