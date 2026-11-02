import { test, expect, type Page } from '@playwright/test'
import type { Demo } from './fixture.js'
declare global {
  interface Window {
    demo: Demo
  }
}
const snapshot = (page: Page) => page.evaluate(() => window.demo.snapshot())
async function mouseDrag(page: Page, selector: string, dx: number, dy = 0) {
  const box = (await page.locator(selector).boundingBox())!
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(x + (dx * i) / 8, y + (dy * i) / 8)
    await page.waitForTimeout(16)
  }
  await page.mouse.up()
}
const errors = new WeakMap<Page, string[]>()
test.afterEach(async ({ page }) => {
  expect(errors.get(page) ?? []).toEqual([])
})
test.beforeEach(async ({ page }) => {
  const collected: string[] = []
  errors.set(page, collected)
  page.on('pageerror', (error) => collected.push(error.message))
  await page.goto('/')
  await page.evaluate(() => window.demo.frame())
})
test('header focus handoff keeps only the current title reachable', async ({ page }) => {
  await page.evaluate(() => {
    window.demo.setup('header')
    const title = document.querySelector<HTMLElement>('#title')!
    title.tabIndex = 0
    title.focus()
    window.demo.header.scrollToItem('5')
  })
  await expect(page.locator('#compact')).toBeFocused()
  await expect(page.locator('#compact')).toHaveAttribute('aria-hidden', 'false')
  await expect(page.locator('#title')).toHaveAttribute('inert', '')
  await page.evaluate(() => window.demo.header.scrollToTop())
  await expect(page.locator('#title')).toBeFocused()
  await expect(page.locator('#title')).toHaveAttribute('aria-hidden', 'false')
  await expect(page.locator('#compact')).toHaveAttribute('inert', '')
  await page.evaluate(() => window.demo.header.dispose())
  await expect(page.locator('#title')).not.toHaveAttribute('aria-hidden')
  await expect(page.locator('#compact')).not.toHaveAttribute('inert')
})
test('decay release, pause and cancel preserve position without stopping another channel', async ({
  page,
}) => {
  await mouseDrag(page, '#card', 130)
  await expect.poll(async () => (await snapshot(page)).log).toContain('release')
  await page.evaluate(() => {
    window.demo.controller.pause()
    window.demo.runtime.animate(
      document.querySelector<HTMLElement>('#card')!,
      { scale: 1.2 },
      { type: 'tween', duration: 100 },
    )
  })
  const x = (await snapshot(page)).position!.x
  await page.waitForTimeout(150)
  expect((await snapshot(page)).position!.x).toBeCloseTo(x, 1)
  await page.evaluate(() => window.demo.controller.play())
  await expect
    .poll(async () => (await snapshot(page)).log, { timeout: 5000 })
    .toContain('settled')
  expect((await snapshot(page)).position!.x).toBeLessThanOrEqual(220.1)
  await mouseDrag(page, '#card', -80)
  await page.evaluate(() => window.demo.controller.cancel())
  const frozen = (await snapshot(page)).position!.x
  await page.waitForTimeout(150)
  expect((await snapshot(page)).position!.x).toBeCloseTo(frozen, 1)
})
test('borrowed motion values survive drag disposal and external replacement wins', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('value'))
  await mouseDrag(page, '#surface', 70)
  await page.evaluate(() => window.demo.controller.dispose())
  expect(await page.evaluate(() => window.demo.value!.disposed)).toBe(false)
  await page.evaluate(() => window.demo.value!.set(42))
  expect(await page.evaluate(() => window.demo.value!.get())).toBe(42)
  await expect.poll(async () => (await snapshot(page)).inspect.drags).toBe(0)
})
test('legacy snap return remains compatible', async ({ page }) => {
  await page.evaluate(() =>
    window.demo.setup('drag', { release: 'spring', rubberband: false }),
  )
  await mouseDrag(page, '#card', 60)
  await expect
    .poll(async () => (await snapshot(page)).position!.x, { timeout: 5000 })
    .toBeCloseTo(0, 1)
})
test('pan and exclusive taps use real browser input and release captures', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('gesture'))
  await mouseDrag(page, '#surface', 100, 40)
  const result = await snapshot(page)
  expect(result.position!.x).toBeCloseTo(100, 0)
  expect(result.position!.y).toBeCloseTo(40, 0)
  expect(result.log).toEqual(['start', 'end'])
  await page.locator('#surface').dblclick({ position: { x: 40, y: 40 }, delay: 50 })
  await page.waitForTimeout(350)
  expect((await snapshot(page)).log).toEqual(['start', 'end', 'double'])
  await page.evaluate(() => window.demo.controller.dispose())
  expect(await page.locator('#surface').evaluate((el) => el.style.touchAction)).toBe('')
})
test('panel consumes upward delta before content and reverses at scroll start', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('scroll'))
  const box = (await page.locator('#surface').boundingBox())!
  await page.mouse.move(box.x + 300, box.y + 350)
  await page.mouse.down()
  await page.mouse.move(box.x + 300, box.y + 150, { steps: 10 })
  await page.evaluate(() => window.demo.frame())
  let result = await snapshot(page)
  expect(result.position!.y).toBeCloseTo(0, 0)
  expect(result.scroll).toBeCloseTo(40, 0)
  await page.mouse.move(box.x + 300, box.y + 250, { steps: 10 })
  await page.evaluate(() => window.demo.frame())
  result = await snapshot(page)
  expect(result.scroll).toBeCloseTo(0, 0)
  expect(result.position!.y).toBeCloseTo(60, 0)
  await page.evaluate(() => window.demo.controller.cancel())
  await page.mouse.up()
  await expect.poll(async () => (await snapshot(page)).inspect.scheduler.tasks).toBe(0)
})
test('detach releases gesture values and resources', async ({ page }) => {
  await page.evaluate(() => {
    window.demo.setup('gesture')
    document.querySelector('#surface')!.remove()
  })
  await expect.poll(() => page.evaluate(() => window.demo.controller.disposed)).toBe(true)
  expect((await snapshot(page)).inspect.interactions).toBe(0)
})
test('zoom supports focal controls, keyboard, cancellation and stale dismissal guards', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('zoom'))
  await expect.poll(() => page.evaluate(() => window.demo.zoom.ready)).toBe(true)
  await page.evaluate(() => window.demo.zoom.zoomTo(2, { x: 550, y: 225 }, false))
  let state = await page.evaluate(() => window.demo.zoom.state)
  expect(state.scale).toBe(2)
  expect(state.x).toBeLessThan(0)
  await page.locator('#surface').focus()
  await page.keyboard.press('0')
  await expect
    .poll(() => page.evaluate(() => window.demo.zoom.state.scale), { timeout: 5000 })
    .toBeCloseTo(1, 2)
  await page.evaluate(() => window.demo.zoom.requestDismiss())
  expect((await page.evaluate(() => window.demo.zoom.state)).pending).toBe(true)
  expect(await page.evaluate(() => window.demo.dismissal.cancel())).toBe(true)
  expect(await page.evaluate(() => window.demo.dismissal.complete())).toBe(false)
  await page.evaluate(() => window.demo.zoom.dispose())
  expect(await page.locator('#surface').getAttribute('tabindex')).toBe(null)
  expect((await snapshot(page)).inspect.interactions).toBe(0)
})
test('scroll header preserves a keyed row on insertion and rejects stale refresh commits', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('header'))
  await page.evaluate(() => window.demo.header.scrollToItem('5'))
  await expect.poll(() => page.evaluate(() => window.demo.header.state.progress)).toBe(1)
  const top = await page
    .locator('[data-key="5"]')
    .evaluate((el) => el.getBoundingClientRect().top)
  await page.evaluate(() =>
    window.demo.header.preserveAnchor(() => {
      const row = document.createElement('div')
      row.dataset.key = 'new'
      row.style.height = '120px'
      row.textContent = 'Inserted'
      document.querySelector('#rows')!.prepend(row)
    }),
  )
  expect(
    await page.locator('[data-key="5"]').evaluate((el) => el.getBoundingClientRect().top),
  ).toBeCloseTo(top, 0)
  await page.evaluate(() => {
    void window.demo.header.refresh()
  })
  await expect
    .poll(() => page.evaluate(() => window.demo.header.state.refreshing))
    .toBe(true)
  await page.evaluate(() => window.demo.header.cancelRefresh())
  expect(
    await page.evaluate(() =>
      window.demo.refreshContext.commit(() => {
        throw new Error('stale commit ran')
      }),
    ),
  ).toBe(false)
  await page.evaluate(() => window.demo.finishRefresh())
  await page.evaluate(() => {
    void window.demo.header.refresh()
  })
  await expect
    .poll(async () => (await snapshot(page)).log.filter((x) => x === 'refresh').length)
    .toBe(2)
  await page.evaluate(() => window.demo.failRefresh())
  await expect.poll(async () => (await snapshot(page)).log).toContain('error')
  await page.evaluate(() => {
    void window.demo.header.refresh()
  })
  await page.evaluate(() => window.demo.finishRefresh())
  await expect
    .poll(() => page.evaluate(() => window.demo.header.state.refreshing))
    .toBe(false)
  await page.evaluate(() => window.demo.header.dispose())
  expect(await page.locator('[data-jolt-header-spacer]').count()).toBe(0)
})
test('reorder commits one keyed move with mouse and keyboard and preserves focus', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('reorder'))
  await mouseDrag(page, '[data-key="Alpha"] [data-grip]', 0, 210)
  await expect
    .poll(() => page.evaluate(() => window.demo.order))
    .toEqual(['Bravo', 'Charlie', 'Alpha', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'])
  await expect
    .poll(async () => (await snapshot(page)).log.filter((x) => x === 'commit').length)
    .toBe(1)
  await page.waitForTimeout(500)
  const grip = page.locator('[data-key="Alpha"] [data-grip]')
  await grip.focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowUp')
  await page.keyboard.press('Enter')
  await expect
    .poll(() => page.evaluate(() => window.demo.order))
    .toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta', 'Echo', 'Foxtrot', 'Golf', 'Hotel'])
  await expect(grip).toBeFocused()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => window.demo.reorder.activeKey)).toBe(undefined)
  await page.evaluate(() => window.demo.reorder.dispose())
  expect((await snapshot(page)).inspect.interactions).toBe(0)
})

test('synthetic two-contact contract preserves pinch/rotation and rebases when a contact leaves', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('gesture')
    const el = document.querySelector<HTMLElement>('#surface')!,
      box = el.getBoundingClientRect()
    // Recognition conformance only: browser-trusted multi-touch is covered separately through CDP.
    el.setPointerCapture = () => {}
    el.hasPointerCapture = () => false
    const emit = (type: string, id: number, x: number, y: number) =>
      el.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          pointerId: id,
          pointerType: 'touch',
          isPrimary: id === 1,
          button: 0,
          buttons: type === 'pointerup' ? 0 : 1,
          clientX: box.left + x,
          clientY: box.top + y,
        }),
      )
    emit('pointerdown', 1, 280, 225)
    emit('pointerdown', 2, 480, 225)
    emit('pointermove', 1, 230, 175)
    emit('pointermove', 2, 530, 275)
    await window.demo.frame()
    const first = window.demo.snapshot().position!
    emit('pointerup', 2, 530, 275)
    emit('pointermove', 1, 260, 195)
    await window.demo.frame()
    const next = window.demo.snapshot().position!
    emit('pointerup', 1, 260, 195)
    return { first, next, inspect: window.demo.snapshot().inspect }
  })
  expect(result.first.scale).toBeCloseTo(Math.sqrt(10) / 2, 3)
  expect(result.first.rotate).toBeCloseTo(18.4349, 2)
  expect(result.next.scale).toBeCloseTo(result.first.scale, 5)
  expect(result.next.rotate).toBeCloseTo(result.first.rotate, 5)
  expect(result.next.x - result.first.x).toBeCloseTo(30, 1)
  expect(result.next.y - result.first.y).toBeCloseTo(20, 1)
})
test('real Chromium two-contact input retains scale when the second finger leaves', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Playwright exposes trusted multi-contact injection through Chromium CDP only; other engines run recognition conformance.',
  )
  await page.evaluate(() => window.demo.setup('gesture'))
  const session = await page.context().newCDPSession(page),
    box = (await page.locator('#surface').boundingBox())!
  const point = (id: number, x: number, y: number) => ({
    id,
    x: box.x + x,
    y: box.y + y,
    radiusX: 4,
    radiusY: 4,
    force: 1,
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [point(1, 280, 220), point(2, 480, 220)],
  })
  for (let i = 1; i <= 8; i++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        point(1, 280 - i * 5, 220 - i * 3),
        point(2, 480 + i * 5, 220 + i * 3),
      ],
    })
    await page.waitForTimeout(20)
  }
  const scale = (await snapshot(page)).position!.scale
  expect(scale).toBeGreaterThan(1.3)
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [point(1, 240, 196)],
  })
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [point(1, 270, 216)],
  })
  await page.evaluate(() => window.demo.frame())
  expect((await snapshot(page)).position!.scale).toBeCloseTo(scale, 3)
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await session.detach()
})
test('scope suspension blocks new gesture input, resumes controls and disposes cleanly', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.demo.controller.dispose()
    const runtime = window.demo.runtime,
      scope = runtime.scope(),
      g = scope.gestures(document.querySelector<HTMLElement>('#surface')!, { pan: true })
    Object.assign(window, { gestureScope: scope, scopedGesture: g })
    scope.suspend()
  })
  await mouseDrag(page, '#surface', 60)
  const read = () =>
    page.evaluate(
      () =>
        (window as unknown as { scopedGesture: { position: { x: number } } })
          .scopedGesture.position.x,
    )
  expect(await read()).toBe(0)
  await page.evaluate(() =>
    (window as unknown as { gestureScope: { resume(): void } }).gestureScope.resume(),
  )
  await mouseDrag(page, '#surface', 60)
  expect(await read()).toBeCloseTo(60, 0)
  await page.evaluate(() =>
    (window as unknown as { gestureScope: { dispose(): void } }).gestureScope.dispose(),
  )
  await expect.poll(async () => (await snapshot(page)).inspect.scheduler.tasks).toBe(0)
  expect((await snapshot(page)).inspect.interactions).toBe(0)
})
test('refresh cancellation resolves immediately and reduced motion completes zoom without a spring loop', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('header'))
  expect(
    await page.evaluate(async () => {
      const result = window.demo.header.refresh()
      window.demo.header.cancelRefresh()
      return result
    }),
  ).toBe(false)
  await page.evaluate(() => {
    window.demo.setup('zoom')
    window.demo.runtime.configure({ reducedMotion: 'always' })
  })
  await expect.poll(() => page.evaluate(() => window.demo.zoom.ready)).toBe(true)
  await page.evaluate(() => window.demo.zoom.zoomTo(2))
  expect(await page.evaluate(() => window.demo.zoom.state.scale)).toBe(2)
  await expect.poll(async () => (await snapshot(page)).inspect.scheduler.tasks).toBe(0)
})
test('reorder edge scrolling advances content, cancels on data replacement and keeps application scale', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.demo.setup('reorder')
    window.demo.runtime.set(document.querySelector<HTMLElement>('[data-key="Alpha"]')!, {
      scale: 1.1,
    })
  })
  const grip = (await page.locator('[data-key="Alpha"] [data-grip]').boundingBox())!,
    box = (await page.locator('#list').boundingBox())!
  await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
  await page.mouse.down()
  await page.mouse.move(grip.x + grip.width / 2, box.y + box.height - 18, { steps: 15 })
  await expect
    .poll(() => page.locator('#list').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(100)
  await page.evaluate(() => document.querySelector('[data-key="Alpha"]')!.remove())
  await expect
    .poll(() => page.evaluate(() => window.demo.reorder.activeKey))
    .toBe(undefined)
  await page.mouse.up()
  expect((await snapshot(page)).log).not.toContain('commit')
})

test('a real pull triggers one refresh and error recovery stays near the release position', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('header'))
  await mouseDrag(page, '#scroll', 0, 125)
  await expect
    .poll(async () => (await snapshot(page)).log.filter((x) => x === 'refresh').length)
    .toBe(1)
  expect(await page.evaluate(() => window.demo.header.state.pull)).toBe(80)
  await page.evaluate(() => window.demo.failRefresh())
  const positions: number[] = []
  for (let i = 0; i < 15; i++) {
    positions.push(await page.evaluate(() => window.demo.header.state.pull))
    await page.waitForTimeout(20)
  }
  expect(Math.max(...positions)).toBeLessThan(120)
  await expect
    .poll(() => page.evaluate(() => window.demo.header.state.pull), { timeout: 5000 })
    .toBeCloseTo(0, 1)
})

test('nested RTL scroll consumes each horizontal delta once and reverses within a contact', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.demo.setup('gesture')
    window.demo.controller.dispose()
    const surface = document.querySelector<HTMLElement>('#surface')!
    surface.innerHTML =
      '<div id="outer" style="width:650px;height:200px;overflow:auto;direction:rtl"><div style="width:1000px;direction:ltr"><div id="inner" style="width:500px;height:150px;overflow:auto;direction:rtl"><div style="width:800px;height:120px">Nested</div></div></div></div>'
    const outer = document.querySelector<HTMLElement>('#outer')!,
      inner = document.querySelector<HTMLElement>('#inner')!
    outer.scrollLeft = -(outer.scrollWidth - outer.clientWidth)
    inner.scrollLeft = -(inner.scrollWidth - inner.clientWidth)
    Object.assign(window, {
      nestedGesture: window.demo.runtime.gestures(surface, {
        pan: { axis: 'x', bounds: { left: 0, right: 0 } },
        scroll: { element: outer, axis: 'x' },
      }),
    })
  })
  const box = (await page.locator('#inner').boundingBox())!
  const x = box.x + 450,
    y = box.y + 60
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x - 350, y, { steps: 20 })
  await page.evaluate(() => window.demo.frame())
  const read = () =>
    page.evaluate(() =>
      ['inner', 'outer'].map((id) => {
        const el = document.getElementById(id)!
        return el.scrollWidth - el.clientWidth + el.scrollLeft
      }),
    )
  expect(await read()).toEqual([300, 50])
  await page.mouse.move(x - 150, y, { steps: 12 })
  await page.evaluate(() => window.demo.frame())
  expect(await read()).toEqual([100, 50])
  await page.evaluate(() =>
    (window as unknown as { nestedGesture: { cancel(): void } }).nestedGesture.cancel(),
  )
  await page.mouse.up()
})

test('zoom interrupts on resize, resets for a replacement image and releases failed images', async ({
  page,
}) => {
  await page.evaluate(() =>
    window.demo.setup('zoom', { onError: () => window.demo.log.push('image-error') }),
  )
  await expect.poll(() => page.evaluate(() => window.demo.zoom.ready)).toBe(true)
  await page.evaluate(() => {
    window.demo.zoom.zoomTo(4)
    document.querySelector<HTMLElement>('#surface')!.style.width = '550px'
  })
  await page.waitForTimeout(150)
  const scale = await page.evaluate(() => window.demo.zoom.state.scale)
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => window.demo.zoom.state.scale)).toBeCloseTo(scale, 5)
  await page.evaluate(() => {
    document.querySelector<HTMLImageElement>('#photo')!.src =
      'data:image/svg+xml,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="800"><rect width="400" height="800" fill="blue"/></svg>',
      )
  })
  await expect.poll(() => page.evaluate(() => window.demo.zoom.ready)).toBe(true)
  await expect.poll(() => page.evaluate(() => window.demo.zoom.state.scale)).toBe(1)
  await page.evaluate(() => {
    document.querySelector<HTMLImageElement>('#photo')!.src =
      'data:image/png;base64,invalid'
  })
  await expect.poll(() => page.evaluate(() => window.demo.zoom.disposed)).toBe(true)
  expect((await snapshot(page)).log).toContain('image-error')
  await expect.poll(async () => (await snapshot(page)).inspect.scheduler.tasks).toBe(0)
  expect((await snapshot(page)).inspect.interactions).toBe(0)
})

test('trusted touch scroll before long press does not reorder, while held touch commits once', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Trusted multi-contact injection is available through Chromium CDP; other engines exercise pointer and keyboard contracts.',
  )
  await page.evaluate(() => window.demo.setup('reorder', { longPress: 180 }))
  const session = await page.context().newCDPSession(page)
  const contact = async (selector: string, dy: number, hold: number) => {
    const box = (await page.locator(selector).boundingBox())!,
      x = box.x + box.width / 2,
      y = box.y + box.height / 2
    const point = (offset: number) => ({
      id: 1,
      x,
      y: y + offset,
      radiusX: 4,
      radiusY: 4,
      force: 1,
    })
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [point(0)],
    })
    if (hold) await page.waitForTimeout(hold)
    for (let i = 1; i <= 10; i++) {
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [point((dy * i) / 10)],
      })
      await page.waitForTimeout(16)
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  }
  await contact('[data-key="Charlie"] [data-grip]', -100, 0)
  expect((await snapshot(page)).log).not.toContain('commit')
  await expect
    .poll(() => page.locator('#list').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(30)
  await page.evaluate(() => window.demo.setup('reorder', { longPress: 180 }))
  await contact('[data-key="Alpha"] [data-grip]', 210, 240)
  await expect
    .poll(async () => (await snapshot(page)).log.filter((x) => x === 'commit').length)
    .toBe(1)
  expect((await snapshot(page)).order[2]).toBe('Alpha')
  await session.detach()
})
