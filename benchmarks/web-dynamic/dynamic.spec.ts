import { expect, test, type Page } from '@playwright/test'
const errors = new WeakMap<Page, string[]>()
test.afterEach(async ({ page }) => {
  expect(errors.get(page) ?? []).toEqual([])
})
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  const seen: string[] = []
  errors.set(page, seen)
  page.on('pageerror', (e) => seen.push(String(e)))
  await page.goto('/')
  await page.evaluate(() => {
    window.rt = lab.createWebRuntime(document, { reducedMotion: 'never' })
    window.target = lab.makeTarget()
    window.values = {}
  })
})

test('numeric bindings coexist with finite channels and stale unbind cannot reclaim a replacement', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    values.x = rt.motionValue(0)
    binding = rt.bind(target, { x: values.x })
    const other = rt.animate(
      target,
      { y: 80, scale: 1.2 },
      { duration: 180, ease: 'linear' },
    )
    values.x.set(30)
    values.x.set(50)
    await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    const live = rt.inspect(target)
    const matrix = new DOMMatrix(getComputedStyle(target).transform)
    const replacement = rt.animate(target, { x: 100 }, { duration: 160, ease: 'linear' })
    binding.dispose()
    values.x.set(-200)
    const finished = await replacement.finished
    await other.finished
    await new Promise(requestAnimationFrame)
    return { live, matrixX: matrix.e, finished, end: rt.inspect(target) }
  })
  expect(result.matrixX).toBeCloseTo(50, 3)
  expect(result.live.bindings).toBe(1)
  expect(result.finished).toBe(true)
  expect(result.end.pose).toMatchObject({ x: 100, y: 80, scaleX: 1.2 })
  expect(result.end.bindings).toBe(0)
  expect(result.end.scheduler.pending).toBe(false)
})
test('rejects cross-context binding atomically and releases disposed inputs', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    values.x = rt.motionValue(20)
    binding = rt.bind(target, { x: values.x })
    const foreign = lab.createWebRuntime(document)
    let rejected = false
    try {
      rt.bind(target, { x: values.x, y: foreign.motionValue(9) })
    } catch {
      rejected = true
    }
    values.x.set(40)
    await new Promise(requestAnimationFrame)
    values.x.dispose()
    await new Promise(requestAnimationFrame)
    const result = { rejected, state: rt.inspect(target) }
    foreign.dispose()
    return result
  })
  expect(result.rejected).toBe(true)
  expect(result.state.pose!.x).toBe(40)
  expect(result.state.bindings).toBe(0)
  expect(result.state.scheduler.pending).toBe(false)
})
test('continuous spring retargets, pauses, settles and honors live reduced motion', async ({
  page,
}) => {
  await page.evaluate(() => {
    values.x = rt.motionValue(0)
    spring = rt.springValue(values.x, { stiffness: 170, damping: 18 })
    binding = rt.bind(target, { x: spring })
    values.x.set(180)
  })
  await expect
    .poll(() => page.evaluate(() => new DOMMatrix(getComputedStyle(target).transform).e))
    .toBeGreaterThan(10)
  const paused = await page.evaluate(() => {
    spring.pause()
    return { position: spring.get(), velocity: spring.getVelocity() }
  })
  await page.waitForTimeout(50)
  expect(await page.evaluate(() => spring.get())).toBe(paused.position)
  await page.evaluate(() => {
    values.x!.set(-90)
    spring.play()
  })
  await expect.poll(() => page.evaluate(() => spring.moving)).toBe(false)
  expect(
    await page.evaluate(() => new DOMMatrix(getComputedStyle(target).transform).e),
  ).toBeCloseTo(-90, 2)
  const state = await page.evaluate(async () => {
    values.x!.set(220)
    rt.configure({ reducedMotion: 'always' })
    await new Promise(requestAnimationFrame)
    return { position: spring.get(), state: rt.inspect(target) }
  })
  expect(state.position).toBe(220)
  expect(state.state.scheduler.pending).toBe(false)
})
test('real pointer drag composes press, releases to WAAPI, can be caught and stops scheduling', async ({
  page,
}) => {
  await page.evaluate(() => {
    rt.set(target, { scale: 1.1 })
    rt.press(target)
    drag = rt.drag(target, {
      axis: 'x',
      bounds: { left: -20, right: 220 },
      snap: { x: [0, 160] },
      spring: { stiffness: 180, damping: 20 },
    })
  })
  await page.locator('.test-target').hover()
  await page.mouse.down()
  await page.mouse.move(210, 630, { steps: 8 })
  await expect
    .poll(() => page.evaluate(() => rt.inspect(target).pose!.x))
    .toBeGreaterThan(80)
  await page.evaluate(() => rt.animate(target, { scale: 1.2 }, 'snappy'))
  await page.waitForTimeout(400)
  expect(await page.evaluate(() => rt.inspect(target).pose!.scaleX)).toBeCloseTo(1.152, 2)
  await page.mouse.up()
  expect(
    await page.evaluate(() => ({
      dragging: drag.dragging,
      bindings: rt.inspect(target).bindings,
      effects: rt.inspect(target).effects,
    })),
  ).toMatchObject({ dragging: false, bindings: 0, effects: 1 })
  await page.locator('.test-target').hover()
  await page.mouse.down()
  const caught = await page.evaluate(() => rt.inspect(target).pose!.x)
  await page.mouse.move(145, 630, { steps: 4 })
  await page.mouse.up()
  await page.evaluate(async () => {
    await drag.animation?.finished
  })
  await expect
    .poll(() => page.evaluate(() => rt.inspect(target).scheduler.pending))
    .toBe(false)
  const end = await page.evaluate(() => rt.inspect(target))
  expect(caught).toBeGreaterThan(0)
  expect(end.bindings).toBe(0)
  expect(end.pose!.scaleX).toBeCloseTo(1.2, 2)
})
test('disabling and detaching during drag cancels capture and releases all target work', async ({
  page,
}) => {
  await page.evaluate(() => {
    drag = rt.drag(target, { axis: 'x' })
  })
  await page.locator('.test-target').hover()
  await page.mouse.down()
  await page.mouse.move(180, 630, { steps: 4 })
  await page.evaluate(() => drag.update({ disabled: true }))
  expect(await page.evaluate(() => drag.dragging)).toBe(false)
  await page.mouse.up()
  await page.evaluate(() => drag.update({ disabled: false }))
  await page.locator('.test-target').hover()
  await page.mouse.down()
  await page.mouse.move(230, 630, { steps: 4 })
  await page.evaluate(() => target.remove())
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => rt.inspect(target).targets)).toBe(0)
  const end = await page.evaluate(() => rt.inspect(target))
  expect(end.values).toBe(0)
  expect(end.scheduler.pending).toBe(false)
})
test('rejects transformed ancestor coordinates before modifying input styles', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const parent = document.createElement('div')
    parent.style.transform = 'scale(2)'
    document.body.append(parent)
    parent.append(target)
    let message = ''
    try {
      rt.drag(target)
    } catch (e) {
      message = String(e)
    }
    return { message, touch: target.style.touchAction }
  })
  expect(result.message).toContain('transformed')
  expect(result.touch).toBe('')
})

test('unbound finite playback never starts a dynamic frame loop', async ({ page }) => {
  const state = await page.evaluate(async () => {
    await rt.animate(target, { x: 60 }, { duration: 100 })
    return rt.inspect(target)
  })
  expect(state.scheduler).toEqual({ tasks: 0, pending: false, frames: 0 })
  expect(state.pose!.x).toBe(60)
})
test('partial replacement preserves the other live channel and held press contribution', async ({
  page,
}) => {
  const state = await page.evaluate(async () => {
    values.x = rt.motionValue(20)
    values.y = rt.motionValue(30)
    binding = rt.bind(target, { x: values.x, y: values.y })
    rt.set(target, { scale: 1.1 })
    const feedback = rt.press(target)
    await rt.animate(target, { x: 90 }, { duration: 80 })
    values.x.set(-200)
    values.y.set(60)
    await new Promise(requestAnimationFrame)
    binding.dispose()
    feedback.dispose()
    return rt.inspect(target)
  })
  expect(state.pose).toMatchObject({ x: 90, y: 60, scaleX: 1.1 })
  expect(state.bindings).toBe(0)
})
test('context disposal settles finite controls and drops input listeners and scheduled work', async ({
  page,
}) => {
  const state = await page.evaluate(async () => {
    values.x = rt.motionValue(0)
    spring = rt.springValue(values.x)
    rt.bind(target, { x: spring })
    values.x.set(300)
    const finite = rt.animate(target, { y: 100 }, { duration: 1000 })
    rt.press(target)
    drag = rt.drag(target, { axis: 'y' })
    rt.dispose()
    rt.dispose()
    const result = await finite.finished
    return {
      result,
      inputDisposed: values.x.disposed,
      springDisposed: spring.disposed,
      state: rt.inspect(target),
      touch: target.style.touchAction,
    }
  })
  expect(state.result).toBe(false)
  expect(state.inputDisposed).toBe(true)
  expect(state.springDisposed).toBe(true)
  expect(state.touch).toBe('')
  expect(state.state).toMatchObject({
    targets: 0,
    values: 0,
    animations: 0,
    observers: 0,
    scheduler: { pending: false, tasks: 0 },
  })
})
test('held drag cancellation preserves unrelated animation and does not snap', async ({
  page,
}) => {
  await page.evaluate(() => {
    drag = rt.drag(target, { axis: 'x', snap: { x: [0] } })
    target.addEventListener('pointerdown', (event) => {
      target.dataset.pointer = String(event.pointerId)
    })
    rt.animate(target, { y: 30, opacity: 0.5 }, { duration: 500 })
  })
  await page.locator('.test-target').hover()
  await page.mouse.down()
  await page.mouse.move(210, 650, { steps: 5 })
  await page.waitForTimeout(30)
  const before = await page.evaluate(() => rt.inspect(target).pose!.x)
  await page.evaluate(() =>
    window.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: Number(target.dataset.pointer) }),
    ),
  )
  await page.mouse.up()
  expect(await page.evaluate(() => drag.dragging)).toBe(false)
  await page.waitForTimeout(550)
  const state = await page.evaluate(() => rt.inspect(target))
  expect(state.pose!.x).toBeCloseTo(before, 3)
  expect(state.pose!.y).toBe(30)
  expect(state.pose!.opacity).toBe(0.5)
  expect(state.scheduler.pending).toBe(false)
})
test('a newer application owner cancels a held drag without old cleanup restoring x', async ({
  page,
}) => {
  await page.evaluate(() => {
    drag = rt.drag(target, { axis: 'x' })
  })
  await page.locator('.test-target').hover()
  await page.mouse.down()
  await page.mouse.move(170, 630, { steps: 4 })
  await page.evaluate(() => rt.animate(target, { x: 75 }, { duration: 80 }))
  await page.mouse.move(250, 630)
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => rt.inspect(target).pose!.x)).toBe(75)
  expect(await page.evaluate(() => drag.dragging)).toBe(false)
})
test('a drag suppresses only its generated click, while taps and keyboard clicks survive', async ({
  page,
}) => {
  await page.evaluate(() => {
    drag = rt.drag(target, { axis: 'x' })
    target.dataset.clicks = '0'
    target.addEventListener('click', () => {
      target.dataset.clicks = String(Number(target.dataset.clicks) + 1)
    })
  })
  await page.locator('.test-target').click()
  expect(await page.locator('.test-target').getAttribute('data-clicks')).toBe('1')
  await page.locator('.test-target').hover()
  await page.mouse.down()
  await page.mouse.move(200, 630, { steps: 6 })
  await page.mouse.up()
  expect(await page.locator('.test-target').getAttribute('data-clicks')).toBe('1')
  await page.locator('.test-target').focus()
  await page.keyboard.press('Space')
  expect(await page.locator('.test-target').getAttribute('data-clicks')).toBe('2')
})
test('hidden-time policy freezes continuous state and resumes without a catch-up jump', async ({
  page,
}) => {
  const state = await page.evaluate(async () => {
    values.x = rt.motionValue(0)
    spring = rt.springValue(values.x, { stiffness: 100, damping: 10 })
    rt.bind(target, { x: spring })
    values.x.set(150)
    await new Promise((r) => setTimeout(r, 70))
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
    const held = spring.get()
    await new Promise((r) => setTimeout(r, 120))
    const after = spring.get(),
      pending = rt.inspect(target).scheduler.pending
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
    document.dispatchEvent(new Event('visibilitychange'))
    const resumed = spring.get()
    return { held, after, resumed, pending }
  })
  expect(state.after).toBe(state.held)
  expect(state.pending).toBe(false)
  expect(Math.abs(state.resumed - state.held)).toBeLessThan(2)
})
test('repeated bindings and spring disposal leave no retained context work', async ({
  page,
}) => {
  const state = await page.evaluate(async () => {
    for (let i = 0; i < 40; i++) {
      const element = lab.makeTarget(),
        input = rt.motionValue(0),
        follow = rt.springValue(input)
      rt.bind(element, { x: follow })
      input.set(100)
      rt.press(element)
      rt.drag(element, { axis: 'y' })
      await new Promise(requestAnimationFrame)
      rt.release(element)
      element.remove()
      input.dispose()
      follow.dispose()
    }
    return rt.inspect(target)
  })
  expect(state).toMatchObject({
    values: 0,
    targets: 0,
    animations: 0,
    observers: 0,
    scheduler: { tasks: 0, pending: false },
  })
})
test('touch scroll takeover cancels horizontal drag and leaves native vertical scrolling available', async ({
  page,
  browserName,
  context,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Actual touch scroll injection uses Chromium CDP; pointer cancellation runs in all engines.',
  )
  await page.evaluate(() => {
    document.body.style.paddingBottom = '1500px'
    drag = rt.drag(target, { axis: 'x' })
  })
  const box = await page.locator('.test-target').boundingBox()
  const session = await context.newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  })
  const x = box!.x + 40,
    y = box!.y + 25
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
  for (let i = 1; i <= 8; i++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - i * 15 }],
    })
    await page.waitForTimeout(20)
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(20)
  expect(await page.evaluate(() => drag.dragging)).toBe(false)
  expect(await page.evaluate(() => rt.inspect(target).bindings)).toBe(0)
})

test('release transfers input position and nonzero velocity into the finite spring', async ({
  page,
}) => {
  await page.evaluate(() => {
    target.addEventListener(
      'pointerdown',
      (event) => {
        target.dataset.pointer = String(event.pointerId)
        target.dataset.downTime = String(event.timeStamp)
      },
      { once: true },
    )
    drag = rt.drag(target, {
      axis: 'x',
      snap: { x: [200] },
      spring: { stiffness: 150, damping: 18 },
    })
  })
  await page.mouse.move(90, 630)
  await page.mouse.down()
  // Establish real pointer capture, then replay a timed sample sequence atomically.
  // Browser-driver round trips on a busy CI runner can exceed the 80 ms velocity
  // expiry window. That correctly produces zero velocity, but does not exercise
  // this test's nonzero handoff contract. Real input is covered by the drag test.
  const state = await page.evaluate(() => {
      const pointerId = Number(target.dataset.pointer)
      const downTime = Number(target.dataset.downTime)
      for (let i = 1; i <= 9; i++) {
        const event = new PointerEvent(i === 9 ? 'pointerup' : 'pointermove', {
          pointerId,
          pointerType: 'mouse',
          isPrimary: true,
          buttons: i === 9 ? 0 : 1,
          clientX: 90 + Math.min(i, 8) * 10,
          clientY: 630,
          bubbles: true,
        })
        Object.defineProperty(event, 'timeStamp', { value: downTime + i * 12 })
        target.dispatchEvent(event)
      }
      return rt.inspect(target)
    }),
    track = state.tracks!.find((t) => t.property === 'x')!
  await page.mouse.up()
  expect(track.from).toBeCloseTo(80, 3)
  expect(track.initialVelocity).toBeGreaterThan(100)
  expect(track.initialVelocity).toBeLessThanOrEqual(5001)
  expect(state.bindings).toBe(0)
  expect(state.scheduler.pending).toBe(false)
  await page.evaluate(async () => {
    await drag.animation?.finished
  })
  expect(await page.evaluate(() => rt.inspect(target).pose!.x)).toBe(200)
})
test('a shared input drives 32 followers and the scheduler returns to idle', async ({
  page,
}, info) => {
  const result = await page.evaluate(async () => {
    const source = rt.motionValue(0),
      targets: HTMLElement[] = [],
      followers = []
    const start = performance.now()
    for (let i = 0; i < 32; i++) {
      const el = lab.makeTarget()
      const follow = rt.springValue(source, { stiffness: 240, damping: 30 })
      rt.bind(el, { x: follow })
      targets.push(el)
      followers.push(follow)
    }
    const preparationMs = performance.now() - start
    source.set(140)
    while (followers.some((f) => f.moving)) await new Promise(requestAnimationFrame)
    await new Promise(requestAnimationFrame)
    const settled = rt.inspect(target),
      count = settled.scheduler.frames
    await new Promise((r) => setTimeout(r, 100))
    const idle = rt.inspect(target).scheduler.frames === count
    for (const el of targets) {
      rt.release(el)
      el.remove()
    }
    source.dispose()
    return { preparationMs, settled, idle, cleanup: rt.inspect(target) }
  })
  await info.attach('bounded-workload', {
    body: JSON.stringify(result),
    contentType: 'application/json',
  })
  expect(result.idle).toBe(true)
  expect(result.cleanup).toMatchObject({
    targets: 0,
    values: 0,
    scheduler: { tasks: 0, pending: false },
  })
})
