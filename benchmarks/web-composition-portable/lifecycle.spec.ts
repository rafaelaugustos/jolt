import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.composition?.lifecycle.drawing)
})

test('Vue cached drawing keeps identity and progress; actual unmount frees it without destroying borrowed runtime', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { lifecycle, runtime } = window.composition
    const drawing = lifecycle.drawing!
    const playback = lifecycle.draw()
    playback.pause()
    playback.progress = 0.4
    const before = drawing.snapshot().strokeEnd
    await lifecycle.cache()
    await new Promise((r) => setTimeout(r, 80))
    const cached = {
      same: lifecycle.drawing === drawing,
      disposed: drawing.disposed,
      paused: playback.paused,
    }
    await lifecycle.cache()
    await new Promise((r) => setTimeout(r, 80))
    const after = drawing.snapshot().strokeEnd
    const same = lifecycle.drawing === drawing,
      stillPaused = playback.paused
    lifecycle.unmount()
    const alive = runtime.motionValue(1)
    const borrowed = alive.get()
    alive.dispose()
    return {
      before,
      after,
      cached,
      same,
      stillPaused,
      disposed: drawing.disposed,
      current: !!lifecycle.drawing,
      borrowed,
    }
  })
  expect(result.before).toBeCloseTo(0.4, 3)
  expect(result.after).toBeCloseTo(0.4, 3)
  expect(result.cached).toEqual({ same: true, disposed: false, paused: true })
  expect(result.same).toBe(true)
  expect(result.stillPaused).toBe(true)
  expect(result.disposed).toBe(true)
  expect(result.current).toBe(false)
  expect(result.borrowed).toBe(1)
})

test('retained settled playback, static cleanup and foreign lifetime remain explicit', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.composition.runtime,
      scope = runtime.scope(),
      events: string[] = []
    const resource = scope.resource(() => ({
      dispose() {
        events.push('dispose')
      },
    }))
    const playback = scope.retain(
      runtime.animate(window.composition.card, { x: 10 }, { duration: 0 }),
    )
    await playback.finished
    scope.suspend()
    scope.resume()
    let rejected = false
    try {
      runtime.scope().add(resource)
    } catch {
      rejected = true
    }
    const size = scope.size
    scope.release(resource)
    scope.dispose()
    return { events, rejected, size }
  })
  expect(result).toEqual({ events: ['dispose'], rejected: true, size: 2 })
})

test('behavior priority cancels late work, blocks exclusions and restores rest', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.composition.runtime,
      events: string[] = []
    let old!: () => void, done!: () => void, late!: () => void
    const behavior = runtime.motionBehaviors(
      {
        rest: {
          priority: -1,
          run() {
            events.push('rest')
          },
        },
        touch: {
          run: async (ctx) => {
            ctx.scope.retain(() => events.push('cleanup'))
            late = ctx.guard(() => events.push('late'))
            await ctx.wait(
              new Promise<void>((r) => {
                old = r
              }),
            )
            events.push('continued')
          },
        },
        eat: {
          priority: 2,
          blocks: ['touch'],
          run: () =>
            new Promise<void>((r) => {
              done = r
            }),
        },
      },
      { rest: 'rest' },
    )
    const first = behavior.request('touch'),
      second = behavior.request('eat')
    const blocked = await behavior.request('touch').finished
    old()
    late()
    done()
    const states = [
      (await first.finished).status,
      (await second.finished).status,
      blocked.status,
    ]
    await Promise.resolve()
    behavior.dispose()
    return { states, events }
  })
  expect(result.states).toEqual(['interrupted', 'completed', 'blocked'])
  expect(result.events).toEqual(['cleanup', 'rest'])
})

test('background and manual pause hold behavior continuation; disposal cancels without rest', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.composition.runtime,
      events: string[] = []
    let done!: () => void
    const behavior = runtime.motionBehaviors(
      {
        task: {
          run: async ({ wait }) => {
            await wait(
              new Promise<void>((r) => {
                done = r
              }),
            )
            events.push('done')
          },
        },
        rest: {
          run() {
            events.push('rest')
          },
        },
      },
      { rest: 'rest' },
    )
    const run = behavior.request('task')
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    done()
    await Promise.resolve()
    await Promise.resolve()
    const background = events.slice()
    behavior.pause()
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    await Promise.resolve()
    const paused = events.slice()
    behavior.dispose()
    const result = await run.finished
    return { background, paused, events, status: result.status }
  })
  expect(result).toEqual({ background: [], paused: [], events: [], status: 'cancelled' })
})
