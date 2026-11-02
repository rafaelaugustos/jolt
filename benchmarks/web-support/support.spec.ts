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
    window.source = lab.makeSource()
  })
})
test.afterEach(async ({ page }) => {
  await page.evaluate(() => rt.dispose())
  expect(errors.get(page)).toEqual([])
})
const pose = (page: Page) =>
  page.evaluate(() => {
    const css = getComputedStyle(target),
      matrix = new DOMMatrix(css.transform)
    return {
      x: matrix.e,
      y: matrix.f,
      scale: Math.hypot(matrix.a, matrix.b),
      opacity: Number(css.opacity),
    }
  })
const scrollTo = async (page: Page, n: number) => {
  await page.evaluate((n) => {
    source.scrollTop = n
  }, n)
  await expect.poll(() => page.evaluate(() => source.scrollTop)).toBe(n)
}
const near = async (
  page: Page,
  property: 'x' | 'y' | 'scale' | 'opacity',
  value: number,
) => {
  await expect
    .poll(async () => Math.abs((await pose(page))[property] - value))
    .toBeLessThan(0.03)
}

test('derived values share one input, coexist with press and independently dispose', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.value = rt.motionValue(0)
    window.mapped = value.to([0, 100], [0, 200])
    rt.bind(target, {
      x: mapped,
      scale: value.to([0, 100], [1, 1.2]),
      opacity: value.to([0, 100], [0.4, 1]),
    })
    rt.press(target)
    value.set(50)
  })
  await near(page, 'x', 100)
  await near(page, 'scale', 1.1)
  await near(page, 'opacity', 0.7)
  await page.locator('.test-target').focus()
  await page.keyboard.down('Space')
  await near(page, 'scale', 1.056)
  await page.evaluate(() => value.set(100))
  await near(page, 'scale', 1.152)
  await page.keyboard.up('Space')
  await near(page, 'scale', 1.2)
  await page.evaluate(() => {
    mapped.dispose()
    value.set(25)
  })
  await near(page, 'x', 200)
  await near(page, 'scale', 1.05)
  await page.evaluate(() => value.dispose())
  expect(await page.evaluate(() => rt.inspect(target).values)).toBe(0)
  await expect
    .poll(() => page.evaluate(() => rt.inspect(target).scheduler.pending))
    .toBe(false)
})
test('mapped follower inputs retain velocity, reject cross-context and do not expose set', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const input = rt.motionValue(0),
      mapped = input.to([100, 0], [200, 0], { clamp: false })
    const follower = rt.springValue(mapped, { stiffness: 180, damping: 24 })
    rt.bind(target, { x: follower.to([0, 200], [0, 100], { clamp: false }) })
    input.set(100)
    await new Promise((r) => setTimeout(r, 100))
    rt.scheduler.hidden(true)
    const p = follower.get(),
      v = follower.getVelocity()
    input.set(-20)
    const delta = Math.abs(p - follower.get()),
      speedDelta = Math.abs(v - follower.getVelocity())
    rt.scheduler.hidden(false)
    const other = lab.createWebRuntime(document)
    let rejected = false
    try {
      other.springValue(mapped)
    } catch {
      rejected = true
    } finally {
      other.dispose()
    }
    return { delta, speedDelta, rejected, readonly: !('set' in mapped) }
  })
  expect(result.delta).toBeLessThan(0.000001)
  expect(result.speedDelta).toBeLessThan(0.001)
  expect(result.rejected).toBe(true)
  expect(result.readonly).toBe(true)
  await near(page, 'x', -20)
})
test('refresh keeps paused channels, velocity, press and the same animation object', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    window.animation = rt.animate(
      target,
      { x: [0, 200], scale: [1, 1.2] },
      { duration: 1000, ease: 'linear' },
    )
    animation.pause()
    animation.progress = 0.4
    const effect = target.getAnimations()[0],
      before = rt.inspect(target)
    target.style.width = '240px'
    target.style.transformOrigin = '25% 50%'
    rt.refresh(target)
    return {
      before,
      after: rt.inspect(target),
      same: effect === target.getAnimations()[0],
      width: target.getBoundingClientRect().width,
      origin: getComputedStyle(target).transformOrigin,
    }
  })
  expect(result.same).toBe(true)
  expect(result.after.pose).toEqual(result.before.pose)
  expect(result.after.rebuilds).toBe(result.before.rebuilds)
  expect(result.origin).toBe('60px 30px')
  expect(result.width).toBeCloseTo(259.2, 1)
  await page.evaluate(() => animation.play())
  await near(page, 'x', 200)
})
test('automatic geometry preserves live mappings on text/size changes and old leases cannot stop a new observer', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.value = rt.motionValue(1)
    rt.bind(target, { scale: value })
    window.lease = rt.observeGeometry(target)
    rt.observeGeometry(target)
    target.style.width = '180px'
    target.textContent = 'Responsive content changes'
    value.set(1.2)
  })
  await near(page, 'scale', 1.2)
  expect(await page.evaluate(() => rt.inspect(target).geometryObservers)).toBe(1)
  const bounds = await page.locator('.test-target').boundingBox()
  expect(bounds!.width).toBeCloseTo(216, 1)
  await page.evaluate(() => {
    rt.release(target)
    rt.set(target, { scale: 1.1 })
    rt.observeGeometry(target)
    lease.dispose()
    target.style.width = '220px'
  })
  await near(page, 'scale', 1.1)
  expect(await page.evaluate(() => rt.inspect(target).geometryObservers)).toBe(1)
})
test('failed refresh cannot replace valid ownership and drag still cancels on resize', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    rt.set(target, { x: 22 })
    target.style.scale = '2'
    let failed = false
    try {
      rt.refresh(target)
    } catch {
      failed = true
    }
    target.style.scale = 'none'
    rt.refresh(target)
    return { failed, pose: rt.inspect(target).pose }
  })
  expect(result.failed).toBe(true)
  expect(result.pose!.x).toBe(22)
  await page.evaluate(() => {
    rt.drag(target)
    rt.observeGeometry(target)
  })
  const box = await page.locator('.test-target').boundingBox()
  await page.mouse.move(box!.x + 20, box!.y + 20)
  await page.mouse.down()
  await page.mouse.move(box!.x + 60, box!.y + 20)
  await page.setViewportSize({ width: 950, height: 750 })
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => rt.inspect(target).scheduler.pending))
    .toBe(false)
})

for (const execution of ['auto', 'scheduler'] as const) {
  test(`scroll ${execution}: CSS-pixel range, reverse after end, no idle loop`, async ({
    page,
    browserName,
  }) => {
    await page.evaluate((execution) => {
      window.linked = rt.scrollLinked(
        source,
        target,
        { x: [10, 110, 210], opacity: [1, 0.75, 0.5] },
        { range: [100, 500], times: [0, 0.5, 1], execution },
      )
    }, execution)
    await near(page, 'x', 10)
    const path = await page.evaluate(() => linked.execution)
    if (execution === 'scheduler') expect(path).toBe('scheduler')
    if (execution === 'auto' && browserName === 'chromium')
      expect(path).toBe('scroll-timeline')
    await scrollTo(page, 300)
    await near(page, 'x', 110)
    await near(page, 'opacity', 0.75)
    await scrollTo(page, 700)
    await near(page, 'x', 210)
    await scrollTo(page, 100)
    await near(page, 'x', 10)
    await expect
      .poll(() => page.evaluate(() => rt.inspect(target).scheduler.pending))
      .toBe(false)
    const frames = await page.evaluate(() => rt.inspect(target).scheduler.frames)
    await page.waitForTimeout(100)
    expect(await page.evaluate(() => rt.inspect(target).scheduler.frames)).toBe(frames)
    await page.evaluate(() => linked.dispose())
    expect(await page.evaluate(() => rt.inspect(target).values)).toBe(0)
    expect(await page.evaluate(() => rt.inspect(target).scrollSources)).toBe(0)
  })
  test(`scroll ${execution}: press and a partial replacement retain other channels`, async ({
    page,
  }) => {
    await page.evaluate((execution) => {
      window.linked = rt.scrollLinked(
        source,
        target,
        { x: [0, 200], scale: [1, 1.2] },
        { range: [0, 500], execution },
      )
      rt.press(target)
    }, execution)
    await scrollTo(page, 250)
    await near(page, 'scale', 1.1)
    await page.locator('.test-target').focus()
    await page.keyboard.down('Space')
    await near(page, 'scale', 1.056)
    await scrollTo(page, 500)
    await near(page, 'scale', 1.152)
    await page.keyboard.up('Space')
    await near(page, 'scale', 1.2)
    await page.evaluate(() => rt.set(target, { x: 77 }))
    await scrollTo(page, 0)
    await near(page, 'scale', 1)
    await near(page, 'x', 77)
    await page.evaluate(() => {
      rt.set(target, { scale: 1.4 })
      linked.dispose()
    })
    await near(page, 'scale', 1.4)
    await near(page, 'x', 77)
    expect(await page.evaluate(() => linked.execution)).toBe('released')
  })
  test(`scroll ${execution}: reduce spatial motion, retain opacity, restore and resize range`, async ({
    page,
  }) => {
    await page.evaluate((execution) => {
      window.linked = rt.scrollLinked(
        source,
        target,
        { x: [0, 200], opacity: [1, 0.4] },
        { range: [0, 1000], execution },
      )
      rt.observeGeometry(target)
    }, execution)
    await scrollTo(page, 500)
    await near(page, 'x', 100)
    await page.evaluate(() => rt.configure({ reducedMotion: 'always' }))
    await near(page, 'x', 200)
    await near(page, 'opacity', 0.7)
    await scrollTo(page, 200)
    await near(page, 'x', 200)
    await near(page, 'opacity', 0.88)
    await page.evaluate(() => rt.configure({ reducedMotion: 'never' }))
    await near(page, 'x', 40)
    await page.evaluate(() => {
      ;(source.firstElementChild as HTMLElement).style.height = '300px'
      source.style.height = '200px'
      target.style.width = '160px'
      linked.refresh()
    })
    await expect.poll(() => page.evaluate(() => source.scrollTop)).toBe(100)
    await near(page, 'x', 20)
    await page.evaluate(() => {
      ;(source.firstElementChild as HTMLElement).style.height = '100px'
      linked.refresh()
    })
    await near(page, 'x', 0)
  })
}
test('raw scroll mappings and spring inputs refresh without leaking observers after detach', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.scrollInput = rt.scrollValue(source)
    rt.bind(target, {
      x: rt.springValue(scrollInput.to([0, 500], [0, 100]), {
        stiffness: 250,
        damping: 30,
      }),
    })
  })
  await scrollTo(page, 250)
  await near(page, 'x', 50)
  await page.evaluate(() => {
    source.remove()
  })
  await expect.poll(() => page.evaluate(() => rt.inspect(target).values)).toBe(0)
  expect(await page.evaluate(() => scrollInput.disposed)).toBe(true)
  await expect
    .poll(() => page.evaluate(() => rt.inspect(target).scheduler.pending))
    .toBe(false)
})
test('native scroll observers do not force visual JS writes; wheel and keyboard scroll actual content', async ({
  page,
  browserName,
}) => {
  await page.evaluate(() => {
    window.linked = rt.scrollLinked(source, target, { x: [0, 200] }, { range: [0, 500] })
  })
  await page.locator('.test-source').scrollIntoViewIfNeeded()
  await page.locator('.test-source').hover()
  await page.mouse.wheel(0, 200)
  await expect.poll(() => page.evaluate(() => source.scrollTop)).toBeGreaterThan(50)
  await page.locator('.test-source').focus()
  await page.keyboard.press('End')
  await expect.poll(() => page.evaluate(() => source.scrollTop)).toBe(1000)
  await near(page, 'x', 200)
  await page.waitForTimeout(150)
  const path = await page.evaluate(() => linked.execution)
  await page.evaluate(() => {
    window.scrollInput = rt.scrollValue(source)
    scrollInput.subscribe(() => {})
  })
  await scrollTo(page, 250)
  await near(page, 'x', 100)
  expect(await page.evaluate(() => linked.execution)).toBe(path)
  if (browserName === 'chromium') expect(path).toBe('scroll-timeline')
  await page.evaluate(() => scrollInput.dispose())
  await expect
    .poll(() => page.evaluate(() => rt.inspect(target).scheduler.pending))
    .toBe(false)
  const frames = await page.evaluate(() => rt.inspect(target).scheduler.frames)
  await scrollTo(page, 300)
  await near(page, 'x', 120)
  if (path === 'scroll-timeline')
    expect(await page.evaluate(() => rt.inspect(target).scheduler.frames)).toBe(frames)
})
test('document source, invalid ranges and detached sources preserve existing motion', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    rt.set(target, { x: 33 })
    let rejected = 0
    for (const range of [
      [0, 0],
      [10, 0],
      [-1, 100],
      [0, Infinity],
    ])
      try {
        rt.scrollLinked(
          source,
          target,
          { x: [0, 100] },
          { range: range as [number, number] },
        )
      } catch {
        rejected++
      }
    const detached = lab.makeSource()
    detached.remove()
    try {
      rt.scrollLinked(detached, target, { x: [0, 100] }, { range: [0, 100] })
    } catch {
      rejected++
    }
    return { rejected, x: rt.inspect(target).pose!.x, values: rt.inspect(target).values }
  })
  expect(result).toEqual({ rejected: 5, x: 33, values: 0 })
  await page.evaluate(() => {
    document.body.style.height = '2400px'
    target.style.position = 'fixed'
    target.style.top = '20px'
    window.linked = rt.scrollLinked(
      document,
      target,
      { x: [0, 200] },
      { range: [0, 500] },
    )
    window.scrollTo(0, 250)
  })
  await near(page, 'x', 100)
  await page.evaluate(() => target.remove())
  await expect.poll(() => page.evaluate(() => rt.inspect(target).values)).toBe(0)
  expect(await page.evaluate(() => linked.execution)).toBe('released')
})

test('finite clocks survive scroll fallback, pause, geometry refresh and return to timeline', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.linked = rt.scrollLinked(source, target, { x: [0, 200] }, { range: [0, 500] })
    window.animation = rt.animate(
      target,
      { y: [0, 80] },
      { duration: 1000, ease: 'linear' },
    )
    animation.pause()
    animation.progress = 0.5
    target.style.width = '175px'
    rt.refresh(target)
  })
  await scrollTo(page, 250)
  await near(page, 'x', 100)
  await near(page, 'y', 40)
  await page.evaluate(() => animation.play())
  await expect.poll(() => page.evaluate(() => linked.execution)).toBe('scheduler')
  await near(page, 'y', 80)
  expect(await page.evaluate(() => animation.finished)).toBe(true)
  await scrollTo(page, 0)
  await near(page, 'x', 0)
  await near(page, 'y', 80)
})
test('hidden fallback resumes latest input and observed text geometry without replaying the hidden gap', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.linked = rt.scrollLinked(
      source,
      target,
      { x: [0, 200] },
      { range: [0, 500], execution: 'scheduler' },
    )
    rt.observeGeometry(target)
    rt.scheduler.hidden(true)
    target.style.width = 'auto'
    target.textContent = 'A much longer label after a font size change'
    target.style.fontSize = '24px'
    source.scrollTop = 250
  })
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => rt.inspect(target).scheduler.pending)).toBe(false)
  await page.evaluate(() => rt.scheduler.hidden(false))
  await near(page, 'x', 100)
  await expect
    .poll(() => page.evaluate(() => rt.inspect(target).scheduler.pending))
    .toBe(false)
})
test('real touch scroll drives the linked surface and source disposal removes all owned work', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'CDP touch injection is Chromium-only.')
  await page.evaluate(() => {
    window.linked = rt.scrollLinked(source, target, { x: [0, 200] }, { range: [0, 500] })
  })
  await page.locator('.test-source').scrollIntoViewIfNeeded()
  const box = await page.locator('.test-source').boundingBox()
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setTouchEmulationEnabled', {
    enabled: true,
    maxTouchPoints: 1,
  })
  const x = box!.x + 80,
    y = box!.y + 180
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - i * 15 }],
    })
    await page.waitForTimeout(20)
  }
  // Hold the real touch while comparing presentation so inertial scrolling
  // cannot invalidate the offset between two separate protocol reads.
  await page.waitForTimeout(150)
  await expect.poll(() => page.evaluate(() => source.scrollTop)).toBeGreaterThan(100)
  const expected = await page.evaluate(() => Math.min(200, source.scrollTop * 0.4))
  await near(page, 'x', expected)
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  })
  await page.evaluate(() => source.remove())
  await expect.poll(() => page.evaluate(() => rt.inspect(target).values)).toBe(0)
  expect(await page.evaluate(() => linked.execution)).toBe('released')
  await cdp.detach()
})
