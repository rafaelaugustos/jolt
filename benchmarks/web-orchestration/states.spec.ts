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

test('named states compose endpoints with per-target transitions and atomic validation', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const other = lab.makeTarget()
    const states = rt.motionStates(
      { card: target, badge: other },
      {
        open: { card: { x: 100, scale: 1.2 }, badge: { opacity: 0.4 } },
        closed: { card: { x: 0, scale: 1 }, badge: { opacity: 1 } },
      },
      { transition: { duration: 200, ease: 'linear', badge: { duration: 0 } } },
    )
    const a = states.to('open')
    states.pause()
    const current = states.current,
      settled = states.settled ?? null,
      badge = rt.inspect(other).pose!.opacity
    let invalid = 0
    try {
      states.to('oops' as any)
    } catch {
      invalid++
    }
    try {
      states.to('closed', { card: { duration: NaN } })
    } catch {
      invalid++
    }
    const unchanged = states.current
    states.play()
    const done = await a.finished
    const endpoint = rt.inspect(target).pose!.x
    return {
      current,
      settled,
      badge,
      invalid,
      unchanged,
      done,
      endpoint,
      settledEnd: states.settled,
    }
  })
  expect(out).toEqual({
    current: 'open',
    settled: null,
    badge: 0.4,
    invalid: 2,
    unchanged: 'open',
    done: true,
    endpoint: 100,
    settledEnd: 'open',
  })
})

test('state replacement inherits position, freezes omitted channels and ignores stale cleanup', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const states = rt.motionStates(
      { card: target },
      { a: { card: { x: 200, y: 100 } }, b: { card: { x: 0 } } },
      { transition: { duration: 500, ease: 'linear' } },
    )
    const first = states.to('a')
    await new Promise<void>((resolve) => {
      const tick = () =>
        rt.inspect(target).pose!.x > 10 ? resolve() : requestAnimationFrame(tick)
      tick()
    })
    states.pause()
    const before = rt.inspect(target).pose!
    const second = states.to('b')
    const after = rt.inspect(target).pose!
    first.stop()
    states.play()
    await second.finished
    const final = rt.inspect(target).pose!
    states.dispose()
    return {
      before,
      after,
      final,
      first: await first.finished,
      second: await second.finished,
    }
  })
  expect(out.after.x).toBeCloseTo(out.before.x, 0)
  expect(out.after.y).toBeCloseTo(out.before.y, 0)
  expect(out.final.x).toBe(0)
  expect(out.final.y).toBeCloseTo(out.before.y, 0)
  expect(out.first).toBe(false)
  expect(out.second).toBe(true)
})

test('replacement refs join completion and cancel only the old owned channels', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const states = rt.motionStates(
      { card: target },
      { open: { card: { x: 100 } } },
      { transition: { duration: 120, ease: 'linear' } },
    )
    const independent = rt.animate(target, { y: 80 }, { duration: 1000 })
    independent.pause()
    const a = states.to('open')
    states.pause()
    const next = lab.makeTarget()
    states.attach('card', next)
    let completed = false
    void a.finished.then(() => {
      completed = true
    })
    await Promise.resolve()
    const premature = completed
    const newPaused = rt.inspect(next).tracks!.every((t) => t.paused)
    states.play()
    const done = await a.finished
    const result = {
      premature,
      newPaused,
      done,
      x: rt.inspect(next).pose!.x,
      oldActive: rt.inspect(target).tracks?.length ?? 0,
      settled: states.settled,
    }
    independent.stop()
    states.dispose()
    return result
  })
  expect(out).toEqual({
    premature: false,
    newPaused: true,
    done: true,
    x: 100,
    oldActive: 1,
    settled: 'open',
  })
})

test('late attachments are awaited; settled attachments receive the endpoint', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const states = rt.motionStates(
      { card: target, badge: null },
      { open: { card: { x: 100 }, badge: { opacity: 0.2 } } },
      { transition: { duration: 100 } },
    )
    const a = states.to('open')
    states.pause()
    const badge = lab.makeTarget()
    states.ref('badge')(badge)
    states.play()
    const done = await a.finished
    const fresh = lab.makeTarget()
    states.ref('card')(fresh)
    const callback = states.ref('card'),
      stable = callback === states.ref('card')
    const x = rt.inspect(fresh).pose!.x,
      opacity = rt.inspect(badge).pose!.opacity
    states.dispose()
    callback(null)
    return { done, x, opacity, stable, disposed: states.disposed }
  })
  expect(out).toEqual({ done: true, x: 100, opacity: 0.2, stable: true, disposed: true })
})

test('definitions reject invalid absent endpoints and scope suspend controls active states', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    let invalid = 0
    for (const definitions of [
      { open: { card: { x: NaN } } },
      { open: { card: { x: [0, 1] } } },
      { open: { card: { backgroundColor: 'invalid-color' } } },
    ]) {
      try {
        rt.motionStates({ card: null }, definitions as any)
      } catch {
        invalid++
      }
    }
    const scope = rt.scope(),
      states = scope.motionStates(
        { card: target },
        { open: { card: { x: 100 } } },
        { transition: { duration: 500 } },
      )
    const a = states.to('open')
    scope.suspend()
    const paused = states.paused
    scope.resume()
    const resumed = !states.paused
    scope.dispose()
    return {
      invalid,
      paused,
      resumed,
      disposed: states.disposed,
      done: await a.finished,
      active: rt.inspect(target).tracks?.length ?? 0,
    }
  })
  expect(out).toEqual({
    invalid: 3,
    paused: true,
    resumed: true,
    disposed: true,
    done: false,
    active: 0,
  })
})
