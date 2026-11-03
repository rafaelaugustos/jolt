import { test, expect } from '@playwright/test'
import type {} from './fixture.js'
const errors = new WeakMap<object, string[]>()
test.beforeEach(async ({ page }) => {
  const list: string[] = []
  errors.set(page, list)
  page.on('pageerror', (e) => list.push(String(e)))
  await page.goto('/')
  await page.evaluate(() => window.ready)
})
test.afterEach(async ({ page }) => {
  await page.evaluate(() => window.fixture.runtime.dispose())
  expect(errors.get(page)).toEqual([])
})
test('sheet opens, snaps with keyboard, dismisses once and restores styles', async ({
  page,
}) => {
  await page.locator('#action').click()
  await expect
    .poll(() => page.evaluate(() => Math.round(window.fixture.sheet.visibleHeight)))
    .toBe(160)
  await page.locator('#sheet-handle').focus()
  await page.keyboard.press('End')
  await expect
    .poll(() => page.evaluate(() => Math.round(window.fixture.sheet.visibleHeight)))
    .toBe(315)
  await page.keyboard.press('Escape')
  await expect
    .poll(() =>
      page.evaluate(() => window.fixture.changes.filter((x) => x === 'dismissed').length),
    )
    .toBe(1)
  await page.locator('#dispose').click()
  expect(
    await page.locator('#sheet').evaluate((e) => (e as HTMLElement).style.position),
  ).toBe('')
})
test('sheet accepts actual drag and retains text-input interaction', async ({ page }) => {
  await page.evaluate(() => window.fixture.sheet.open('75%'))
  await expect
    .poll(() => page.evaluate(() => Math.round(window.fixture.sheet.visibleHeight)))
    .toBe(315)
  await page.locator('#content input').fill('Hello')
  expect(await page.locator('#content input').inputValue()).toBe('Hello')
  const rect = (await page.locator('#sheet-handle').boundingBox())!
  await page.mouse.move(rect.x + 50, rect.y + 25)
  await page.mouse.down()
  await page.mouse.move(rect.x + 50, rect.y + 165, { steps: 15 })
  await page.waitForTimeout(200)
  await page.mouse.up()
  await expect.poll(() => page.evaluate(() => window.fixture.sheet.snapPoint)).toBe(160)
})
test('sheet pauses animation and scoped disposal releases resources', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.fixture.sheet.open('75%')
    window.fixture.sheet.pause()
  })
  const before = await page.evaluate(() => window.fixture.sheet.visibleHeight)
  await page.waitForTimeout(180)
  expect(await page.evaluate(() => window.fixture.sheet.visibleHeight)).toBe(before)
  await page.evaluate(() => window.fixture.sheet.play())
  await expect
    .poll(() => page.evaluate(() => Math.round(window.fixture.sheet.visibleHeight)))
    .toBe(315)
  await page.evaluate(() => window.fixture.el('sheet').remove())
  await expect.poll(() => page.evaluate(() => window.fixture.sheet.disposed)).toBe(true)
})
test('real dialog preserves focus, handles Escape and external close', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('modal'))
  await page.locator('#action').click()
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('open')
  expect(await page.locator('#dialog').evaluate((e) => e.matches(':modal'))).toBe(true)
  await page.locator('#modal-input').fill('text')
  await page.keyboard.press('Escape')
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('closed')
  await expect(page.locator('#action')).toBeFocused()
  await page.locator('#action').click()
  await page.evaluate(() =>
    (window.fixture.el('dialog') as HTMLDialogElement).close('form'),
  )
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('closed')
})
test('interactive modal short drag returns and long drag closes', async ({ page }) => {
  await page.evaluate(() => window.fixture.boot('modal'))
  await page.locator('#action').click()
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('open')
  const drag = async (distance: number) => {
    const r = (await page.locator('#modal-handle').boundingBox())!
    await page.mouse.move(r.x + 80, r.y + 20)
    await page.mouse.down()
    await page.mouse.move(r.x + 80, r.y + 20 + distance, { steps: 20 })
    await page.waitForTimeout(180)
    await page.mouse.up()
  }
  await drag(25)
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('open')
  await drag(180)
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('closed')
})
test('modal disposal during closing leaves app-owned dialog open and stable', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('modal'))
  await page.locator('#action').click()
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('open')
  await page.evaluate(() => {
    window.fixture.modal.close()
    window.fixture.modal.dispose()
  })
  await page.waitForTimeout(250)
  expect(
    await page.locator('#dialog').evaluate((e) => (e as HTMLDialogElement).open),
  ).toBe(true)
  expect(
    await page.locator('#dialog').evaluate((e) => (e as HTMLElement).style.touchAction),
  ).toBe('')
})
test('navigation waits for async route and performs actual visual flight', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('navigation'))
  const before = await page.locator('#stage').screenshot()
  await page.locator('#action').click()
  await expect.poll(() => page.evaluate(() => window.fixture.nav.state)).toBe('running')
  expect(await page.locator('#stage').screenshot()).not.toEqual(before)
  await expect.poll(() => page.evaluate(() => window.fixture.changes.length)).toBe(1)
  expect(await page.evaluate(() => window.fixture.changes[0])).toMatchObject({
    status: 'completed',
    navigated: true,
  })
  expect(await page.locator('[data-jolt-shared]').count()).toBe(0)
})
test('navigation busy guard, rejection, cancellation and timeout settle without undoing route', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('navigation'))
  const result = await page.evaluate(async () => {
    const f = window.fixture
    let calls = 0
    let resolve!: () => void
    const one = f.nav.navigate({
      tag: 'cover',
      navigate: () => {
        calls++
        return new Promise<void>((done) => {
          resolve = done
        })
      },
    })
    const busy = await f.nav.navigate({
      tag: 'cover',
      navigate: () => {
        calls++
      },
    }).finished
    one.cancel()
    resolve()
    const cancelled = await one.finished
    const failed = await f.nav.navigate({
      tag: 'cover',
      navigate: () => {
        throw Error('route')
      },
    }).finished
    return {
      calls,
      busy,
      cancelled,
      failed: { status: failed.status, navigated: failed.navigated },
    }
  })
  expect(result).toMatchObject({
    calls: 1,
    busy: { reason: 'busy', navigated: false },
    cancelled: { status: 'cancelled', navigated: true },
    failed: { status: 'failed', navigated: true },
  })
  const timeout = await page.evaluate(
    async () =>
      window.fixture.nav.navigate({ tag: 'cover', navigate: () => new Promise(() => {}) })
        .finished,
  )
  expect(timeout).toMatchObject({ reason: 'navigation-timeout', navigated: true })
})
test('physics renders real movement, collides, pauses, resets and releases DOM ownership', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('physics'))
  const first = await page.locator('#a').boundingBox()
  await page.waitForTimeout(500)
  expect(await page.locator('#a').boundingBox()).not.toEqual(first)
  await page.locator('#pause').click()
  const paused = await page.evaluate(() => window.fixture.physics.snapshot())
  await page.waitForTimeout(120)
  expect((await page.evaluate(() => window.fixture.physics.snapshot())).steps).toBe(
    paused.steps,
  )
  await page.locator('#reverse').click()
  expect(
    (await page.evaluate(() => window.fixture.physics.snapshot())).bodies[0]!.x,
  ).toBe(180)
  await page.locator('#play').click()
  await page.waitForTimeout(150)
  expect(
    (await page.evaluate(() => window.fixture.physics.snapshot())).steps,
  ).toBeGreaterThan(paused.steps)
  await page.locator('#dispose').click()
  expect(
    await page.locator('#a').evaluate((e) => (e as HTMLElement).style.position),
  ).toBe('')
  expect(await page.locator('#stage svg').count()).toBe(0)
})
test('physics spring drag preserves integrated momentum and cancel releases pointer', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('physics'))
  await page.waitForTimeout(200)
  const r = (await page.locator('#a').boundingBox())!
  await page.mouse.move(r.x + 28, r.y + 28)
  await page.mouse.down()
  await page.mouse.move(r.x + 160, r.y + 20, { steps: 15 })
  await page.waitForTimeout(60)
  await page.mouse.up()
  const body = (await page.evaluate(() => window.fixture.physics.snapshot())).bodies[0]!
  expect(body.held).toBe(false)
  expect(body.release).not.toBeNull()
  expect(Math.hypot(body.release!.vx, body.release!.vy)).toBeGreaterThan(1)
  await page.evaluate(() => window.fixture.runtime.dispose())
  expect(await page.locator('#stage svg').count()).toBe(0)
})
test('physics invalid bounds recovers and reduced motion stops ticking', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('physics'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(() => page.evaluate(() => window.fixture.physics.snapshot().status))
    .toBe('paused')
  const steps = await page.evaluate(() => window.fixture.physics.snapshot().steps)
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => window.fixture.physics.snapshot().steps)).toBe(steps)
  await page.evaluate(() => (window.fixture.el('stage').style.width = '40px'))
  await expect
    .poll(() => page.evaluate(() => window.fixture.physics.snapshot().status))
    .toBe('invalid-bounds')
  await page.evaluate(() => (window.fixture.el('stage').style.width = ''))
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect
    .poll(() => page.evaluate(() => window.fixture.physics.snapshot().status))
    .toBe('running')
})
test('symbols animate pixels, pause loops, retain replacement and restore styles', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('symbols'))
  const original = await page.locator('#stage').screenshot()
  await page.locator('#action').click()
  await page.waitForTimeout(200)
  expect(await page.locator('#stage').screenshot()).not.toEqual(original)
  await page.evaluate(() => {
    window.fixture.runtime.symbolEffect(window.fixture.el('symbol'), 'pulse', {
      repeat: true,
    })
  })
  await page.waitForTimeout(120)
  const paused = await page.evaluate(() => {
    const handle = window.fixture.runtime.symbolEffect(
      window.fixture.el('symbol'),
      'pulse',
      { repeat: true },
    )
    handle.pause()
    return handle.paused
  })
  expect(paused).toBe(true)
  await page.locator('#reverse').click()
  await page.locator('#dispose').click()
  expect(await page.locator('#symbol').textContent()).toBe('✓')
  expect(await page.locator('#symbol').getAttribute('style')).toBeNull()
})
test('reduced symbol effects skip decoration, replacement still commits', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('symbols'))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  const done = await page.evaluate(
    async () =>
      window.fixture.runtime.symbolEffect(window.fixture.el('symbol'), 'bounce').finished,
  )
  expect(done).toBe(false)
  await page.locator('#reverse').click()
  expect(await page.evaluate(() => window.fixture.symbol.finished)).toBe(true)
})
test('keyboard reports real desktop geometry and callable cleanup is idempotent', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('keyboard'))
  await page
    .locator('#message')
    .fill('Native keyboard reference is documented separately')
  const state = await page.evaluate(() => window.fixture.keyboard.snapshot())
  expect(state.height).toBe(0)
  expect(state.duration).toBe(0)
  await page.evaluate(() => {
    window.fixture.keyboard()
    window.fixture.keyboard.dispose()
  })
  expect(await page.evaluate(() => window.fixture.keyboard.disposed)).toBe(true)
})
test('keyboard VirtualKeyboard geometry follows without double-counting and restores binding', async ({
  page,
}) => {
  await page.evaluate(() => {
    const keyboard = new EventTarget() as EventTarget & { boundingRect: DOMRect }
    keyboard.boundingRect = new DOMRect(0, innerHeight, innerWidth, 0)
    Object.defineProperty(navigator, 'virtualKeyboard', {
      configurable: true,
      value: keyboard,
    })
    window.fixture.boot('keyboard')
    keyboard.boundingRect = new DOMRect(0, 400, innerWidth, innerHeight - 400)
    keyboard.dispatchEvent(new Event('geometrychange'))
  })
  await expect
    .poll(() =>
      page
        .locator('#keyboard-bar')
        .evaluate((e) => Math.round(e.getBoundingClientRect().bottom)),
    )
    .toBe(388)
  expect((await page.evaluate(() => window.fixture.keyboard.snapshot())).accuracy).toBe(
    'exact',
  )
  await page.locator('#dispose').click()
  await expect
    .poll(() =>
      page.locator('#keyboard-bar').evaluate((e) => e.getBoundingClientRect().bottom),
    )
    .toBeGreaterThan(400)
})
test('all new factories participate in motion scopes and reject invalid setup', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const f = window.fixture,
      scope = f.runtime.scope()
    const keyboard = scope.onKeyboard(() => {})
    scope.suspend()
    const paused = keyboard.paused
    scope.resume()
    scope.dispose()
    let rejected = 0
    for (const run of [
      () => f.runtime.symbolEffect(f.el('stage'), 'unknown' as never),
      () => f.runtime.physicsWorld(f.el('stage'), []),
      () => f.runtime.interactiveModal(f.el('stage') as HTMLDialogElement),
    ])
      try {
        run()
      } catch {
        rejected++
      }
    return { paused, disposed: keyboard.disposed, rejected }
  })
  expect(result).toEqual({ paused: true, disposed: true, rejected: 3 })
})

test('sheet owns initial backdrop presentation and does not lose paused work on resize delivery', async ({
  page,
}) => {
  const initial = await page.evaluate(() => {
    const f = window.fixture
    f.sheet.dispose()
    const panel = f.el('sheet'),
      backdrop = f.el('backdrop')
    backdrop.style.opacity = '1'
    const owner = f.runtime.bottomSheet(panel, {
      host: f.el('stage'),
      handle: f.el('sheet-handle'),
      snap: [160],
      backdrop,
    })
    const opacity = getComputedStyle(backdrop).opacity
    owner.dispose()
    return { opacity, restored: backdrop.style.opacity }
  })
  expect(initial).toEqual({ opacity: '0', restored: '1' })
})
test('navigation missing target falls back and invalid timeout cannot claim the container', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const f = window.fixture
    f.boot('navigation')
    f.nav.dispose()
    let rejected = false
    try {
      f.runtime.sharedNavigation(f.el('stage'), { layoutTimeout: -1 })
    } catch {
      rejected = true
    }
    const navigation = f.runtime.sharedNavigation(f.el('stage'), {
      navigationTimeout: 50,
      layoutTimeout: 50,
    })
    navigation.attach(f.el('card'), 'cover')
    let calls = 0
    const result = await navigation.navigate({
      tag: 'cover',
      navigate() {
        calls++
        f.el('card').remove()
      },
    }).finished
    navigation.dispose()
    return { rejected, calls, result }
  })
  expect(result).toMatchObject({
    rejected: true,
    calls: 1,
    result: { status: 'unavailable', reason: 'missing-target', navigated: true },
  })
})
test('floating keyboard reports its actual rectangle without bottom coverage', async ({
  page,
}) => {
  const state = await page.evaluate(() => {
    const keyboard = new EventTarget() as EventTarget & { boundingRect: DOMRect }
    keyboard.boundingRect = new DOMRect(120, 250, 250, 160)
    Object.defineProperty(navigator, 'virtualKeyboard', {
      configurable: true,
      value: keyboard,
    })
    window.fixture.boot('keyboard')
    return window.fixture.keyboard.snapshot()
  })
  expect(state).toMatchObject({
    visible: true,
    height: 0,
    accuracy: 'exact',
    rect: { left: 120, top: 250, right: 370, bottom: 410 },
  })
})
test('modal cancellation reverses close, and failed native-like options leave runtime usable', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('modal'))
  await page.locator('#action').click()
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('open')
  await page.evaluate(() => {
    window.fixture.modal.close()
    window.fixture.modal.cancel()
  })
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('open')
  await page.evaluate(() => window.fixture.modal.close())
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('closed')
  await page.locator('#action').click()
  await expect.poll(() => page.evaluate(() => window.fixture.modal.state)).toBe('open')
})

test('reentrant lifecycle callbacks cannot restart disposed input or reverse a requested modal close', async ({
  page,
}) => {
  const keyboard = await page.evaluate(() => {
    const f = window.fixture
    let calls = 0
    const source = new EventTarget() as EventTarget & { boundingRect: DOMRect }
    source.boundingRect = new DOMRect(0, innerHeight, innerWidth, 0)
    Object.defineProperty(navigator, 'virtualKeyboard', {
      configurable: true,
      value: source,
    })
    const control = f.runtime.onKeyboard(() => {
      if (++calls === 2) control.dispose()
    })
    control.pause()
    control.play()
    source.boundingRect = new DOMRect(0, 400, innerWidth, innerHeight - 400)
    source.dispatchEvent(new Event('geometrychange'))
    return { calls, disposed: control.disposed }
  })
  expect(keyboard).toEqual({ calls: 2, disposed: true })
  await page.evaluate(async () => {
    const f = window.fixture
    f.boot('modal')
    f.modal.dispose()
    await new Promise<void>((resolve) => {
      let reentered = false
      const modal = f.runtime.interactiveModal(f.el('dialog') as HTMLDialogElement, {
        onState(state) {
          if (state === 'opening' && !reentered) {
            reentered = true
            modal.close()
          }
          if (state === 'closed') {
            modal.dispose()
            resolve()
          }
        },
      })
      modal.open()
    })
  })
  expect(
    await page.locator('#dialog').evaluate((e) => (e as HTMLDialogElement).open),
  ).toBe(false)
})

test('held symbol scale survives unrelated DOM changes and pause/resume without replay', async ({
  page,
}) => {
  await page.evaluate(() => {
    const f = window.fixture
    f.boot('symbols')
    f.runtime.symbolEffect(f.el('symbol'), 'scale', { speed: 10 })
  })
  await expect
    .poll(() => page.locator('#symbol').evaluate((e) => getComputedStyle(e).scale))
    .toBe('1.2')
  await page.evaluate(() => {
    const node = document.createElement('span')
    document.body.append(node)
    node.remove()
  })
  await page.waitForTimeout(20)
  expect(await page.locator('#symbol').evaluate((e) => getComputedStyle(e).scale)).toBe(
    '1.2',
  )
  const result = await page.evaluate(async () => {
    const f = window.fixture,
      handle = f.runtime.symbolEffect(f.el('symbol'), 'scale', { speed: 10 })
    await new Promise((resolve) => setTimeout(resolve, 100))
    handle.pause()
    handle.play()
    const scale = getComputedStyle(f.el('symbol')).scale
    handle.dispose()
    return { scale, finished: await handle.finished }
  })
  expect(result).toEqual({ scale: '1.2', finished: false })
})

test('resized layout viewport reports keyboard visibility without double coverage', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    Object.defineProperty(navigator, 'virtualKeyboard', {
      configurable: true,
      value: undefined,
    })
    let height = 740
    let width = 920
    const viewport = new EventTarget()
    Object.defineProperties(viewport, {
      height: { get: () => height },
      width: { get: () => width },
      offsetTop: { value: 0 },
      scale: { value: 1 },
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      get: () => height,
    })
    Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => width })
    window.fixture.boot('keyboard')
    window.fixture.el('message').focus()
    height = 400
    viewport.dispatchEvent(new Event('resize'))
    const open = window.fixture.keyboard.snapshot()
    window.fixture.el('message').blur()
    height = 740
    viewport.dispatchEvent(new Event('resize'))
    const closed = window.fixture.keyboard.snapshot()
    // Rotation is not a software keyboard, even with an editable field focused.
    window.fixture.el('message').focus()
    width = 1100
    height = 360
    viewport.dispatchEvent(new Event('resize'))
    return { open, closed, rotated: window.fixture.keyboard.snapshot() }
  })
  expect(result.open).toMatchObject({ visible: true, height: 0, accuracy: 'estimated' })
  expect(result.closed.visible).toBe(false)
  expect(result.rotated.visible).toBe(false)
})

test('inactive VirtualKeyboard API falls back to actual visual viewport geometry', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const keyboard = Object.assign(new EventTarget(), {
      boundingRect: new DOMRect(0, 0, 0, 0),
      overlaysContent: false,
    })
    Object.defineProperty(navigator, 'virtualKeyboard', {
      configurable: true,
      value: keyboard,
    })
    const viewport = Object.assign(new EventTarget(), {
      height: innerHeight,
      width: innerWidth,
      offsetTop: 0,
      scale: 1,
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
    window.fixture.boot('keyboard')
    window.fixture.el('message').focus()
    viewport.height = innerHeight - 300
    viewport.dispatchEvent(new Event('resize'))
    return {
      state: window.fixture.keyboard.snapshot(),
      overlaysContent: keyboard.overlaysContent,
    }
  })
  expect(result.state).toMatchObject({
    visible: true,
    height: 300,
    backend: 'visual-viewport',
    accuracy: 'estimated',
  })
  expect(result.overlaysContent).toBe(false)
})

test('panned visual viewport keeps the keyboard visible with current bottom coverage', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const viewport = Object.assign(new EventTarget(), {
      height: innerHeight,
      width: innerWidth,
      offsetTop: 0,
      scale: 1,
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
    window.fixture.boot('keyboard')
    document.querySelector('input')!.focus()
    viewport.height = innerHeight - 300
    viewport.offsetTop = 270
    viewport.dispatchEvent(new Event('resize'))
    const partial = window.fixture.keyboard.snapshot()
    viewport.offsetTop = 300
    viewport.dispatchEvent(new Event('scroll'))
    return { partial, uncovered: window.fixture.keyboard.snapshot() }
  })
  expect(result.partial.visible).toBe(true)
  expect(result.partial.height).toBe(30)
  expect(result.uncovered.visible).toBe(true)
  expect(result.uncovered.height).toBe(0)
})
