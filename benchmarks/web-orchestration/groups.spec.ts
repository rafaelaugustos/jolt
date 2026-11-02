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

test('sequence seeds future steps and validates all descriptors before claiming ownership', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const second = lab.makeTarget(),
      old = rt.animate(target, { x: 100 }, { duration: 1000 })
    old.pause()
    old.progress = 0.5
    const before = rt.inspect(target).pose!.x
    let invalid = false
    try {
      rt.sequence([
        [target, { x: [0, 200] }, { duration: 50 }],
        [second, { y: NaN }],
      ])
    } catch {
      invalid = true
    }
    const retained = rt.inspect(target).pose!.x
    const seq = rt.sequence([
      [target, { x: [0, 30] }, { duration: 100, ease: 'linear' }],
      [second, { opacity: [0, 1] }, { duration: 80, ease: 'linear' }],
    ])
    const seeded = rt.inspect(second).pose!.opacity
    const completed = await seq.finished
    return {
      invalid,
      before,
      retained,
      seeded,
      completed,
      final: rt.inspect(second).pose!.opacity,
      groups: rt.inspect(target).groups,
      timers: rt.inspect(target).timers,
    }
  })
  expect(out.invalid).toBe(true)
  expect(out.retained).toBe(out.before)
  expect(out.seeded).toBe(0)
  expect(out.completed).toBe(true)
  expect(out.final).toBe(1)
  expect(out.groups).toBe(0)
  expect(out.timers).toBe(0)
})

test('sequence supports callback children and overlap; stopping prevents future callbacks', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    let calls = 0
    const seq = rt.sequence([
      [target, { x: 200 }, { duration: 1000 }],
      () => {
        calls++
        return rt.animate(target, { y: 60 }, { duration: 100 })
      },
    ])
    seq.stop()
    const stopped = await seq.finished
    const other = lab.makeTarget()
    const overlapped = rt.sequence([
      [target, { x: [0, 100] }, { duration: 500, ease: 'linear' }],
      [other, { x: [0, 100] }, { duration: 500, ease: 'linear', at: '<' }],
    ])
    const concurrent = rt.inspect(other).tracks?.length ?? 0
    overlapped.stop()
    await Promise.resolve()
    return { calls, stopped, concurrent, timers: rt.inspect(target).timers }
  })
  expect(out.calls).toBe(0)
  expect(out.stopped).toBe(false)
  expect(out.concurrent).toBeGreaterThan(0)
  expect(out.timers).toBe(0)
})

test('negative offsets follow the visual arrival forecast', async ({ page }) => {
  const out = await page.evaluate(async () => {
    const other = lab.makeTarget()
    const seq = rt.sequence([
      [target, { x: [0, 100] }, { duration: 500, ease: 'linear' }],
      [other, { x: [0, 100] }, { duration: 500, ease: 'linear', at: '-500' }],
    ])
    const concurrent = rt.inspect(other).tracks?.length ?? 0
    const stopped = seq.stop()
    await seq.finished
    return { concurrent, timers: rt.inspect(target).timers }
  })
  expect(out.concurrent).toBeGreaterThan(0)
  expect(out.timers).toBe(0)
})

test('timeline pauses current children and future callbacks, then completes both', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    let calls = 0
    const value = rt.motionValue(0)
    const group = rt.timeline([
      [value, [0, 100], { duration: 240, ease: 'linear' }],
      {
        at: 80,
        run: () => {
          calls++
          return rt.animate(target, { x: 120 }, { duration: 100 })
        },
      },
    ])
    group.pause()
    const held = value.get()
    await new Promise((r) => setTimeout(r, 160))
    const frozen = value.get(),
      blocked = calls
    group.play()
    const completed = await group.finished
    return {
      held,
      frozen,
      blocked,
      calls,
      completed,
      value: value.get(),
      x: rt.inspect(target).pose!.x,
      timers: rt.inspect(target).timers,
    }
  })
  expect(out.frozen).toBe(out.held)
  expect(out.blocked).toBe(0)
  expect(out.calls).toBe(1)
  expect(out.completed).toBe(true)
  expect(out.value).toBe(100)
  expect(out.x).toBe(120)
  expect(out.timers).toBe(0)
})

test('timeline resume preserves independently paused borrowed participants', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const child = rt.animate(target, { x: 100 }, { duration: 1000 })
    child.pause()
    const group = rt.timeline([() => child])
    group.pause()
    group.play()
    const held = child.paused
    group.stop()
    return { held, completed: await group.finished, child: await child.finished }
  })
  expect(out).toEqual({ held: true, completed: false, child: false })
})

test('timeline callback failures reject once and cancel already-started participants', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const child = rt.animate(target, { x: 100 }, { duration: 1000 })
    const group = rt.timeline([
      () => child,
      {
        at: 0,
        run: () => {
          throw new Error('callback failed')
        },
      },
    ])
    const message = await group.finished.then(
      () => '',
      (e) => e.message,
    )
    return {
      message,
      child: await child.finished,
      active: rt.inspect(target).tracks?.length ?? 0,
      timers: rt.inspect(target).timers,
    }
  })
  expect(out).toEqual({ message: 'callback failed', child: false, active: 0, timers: 0 })
})

test('hidden contexts freeze future timeline callbacks without losing a user pause', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    let calls = 0,
      hidden = false
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
    const group = rt.timeline([
      {
        at: 60,
        run: () => {
          calls++
          return rt.animate(target, { x: 100 }, { duration: 0 })
        },
      },
    ])
    group.pause()
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    await new Promise((r) => setTimeout(r, 100))
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    const paused = group.paused,
      blocked = calls
    group.play()
    const completed = await group.finished
    delete (document as any).hidden
    return { paused, blocked, completed, calls }
  })
  expect(out).toEqual({ paused: true, blocked: 0, completed: true, calls: 1 })
})

test('scope cancellation stops nested scheduling but leaves unrelated playback alone', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const scope = rt.scope(),
      other = lab.makeTarget()
    const unrelated = rt.animate(other, { x: 100 }, { duration: 1000 })
    unrelated.pause()
    let callbacks = 0
    const group = scope.timeline([
      () => scope.timeline([[target, { y: 50 }, { duration: 500 }]]),
      {
        at: 100,
        run: () => {
          callbacks++
          return rt.animate(target, { x: 100 })
        },
      },
    ])
    scope.dispose()
    const finished = await group.finished
    const active = rt.inspect(other).tracks?.length ?? 0
    unrelated.stop()
    return { finished, callbacks, active, timers: rt.inspect(target).timers }
  })
  expect(out.finished).toBe(false)
  expect(out.callbacks).toBe(0)
  expect(out.active).toBe(1)
  expect(out.timers).toBe(0)
})

test('runtime disposal inside a factory prevents later callbacks and settles cancellation', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    let later = 0
    const child = rt.animate(target, { x: 100 }, { duration: 1000 })
    const group = rt.timeline([
      {
        at: 0,
        run: () => {
          rt.dispose()
          return child
        },
      },
      {
        at: 0,
        run: () => {
          later++
          return child
        },
      },
    ])
    return { later, completed: await group.finished, child: await child.finished }
  })
  expect(out).toEqual({ later: 0, completed: false, child: false })
})

test('aggregate progress reads the same finite timeline clock and stops observation at completion', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    const child = rt.animate(target, { x: 100 }, { duration: 160, ease: 'linear' })
    await child.ready
    const group = rt.timeline([() => child])
    const progress = rt.playbackProgress(group),
      samples: number[] = []
    const off = progress.subscribe((p) => samples.push(p))
    group.pause()
    const held = progress.get()
    await new Promise((r) => setTimeout(r, 25))
    const frozen = progress.get()
    group.play()
    await group.finished
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const result = {
      held,
      frozen,
      end: progress.get(),
      intermediate: samples.some((p) => p > 0 && p < 1),
      tasks: rt.inspect(target).scheduler.tasks,
    }
    off()
    progress.dispose()
    return result
  })
  expect(out.held).toBe(out.frozen)
  expect(out.end).toBe(1)
  expect(out.intermediate).toBe(true)
  expect(out.tasks).toBe(0)
})

test('absolute activation time uses timeScale once, independently of list order', async ({
  page,
}) => {
  const out = await page.evaluate(async () => {
    rt.configure({ timeScale: 2 })
    const order: number[] = []
    const marker = new Promise<void>((resolve) =>
      setTimeout(() => {
        order.push(3)
        resolve()
      }, 130),
    )
    const group = rt.timeline([
      {
        at: 180,
        run: () => {
          order.push(2)
          return rt.animate(target, { x: 100 }, { duration: 0 })
        },
      },
      {
        at: 0,
        run: () => {
          order.push(1)
          return rt.animate(target, { y: 20 }, { duration: 0 })
        },
      },
    ])
    await Promise.all([group.finished, marker])
    return order
  })
  expect(out).toEqual([1, 2, 3])
})
