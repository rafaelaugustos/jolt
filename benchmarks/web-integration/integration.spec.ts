import { test, expect, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.integrationLab)
})
const settle = async (page: Page) => {
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0)
}

test('retains v-if leave until done and emits completion once', async ({ page }) => {
  await page.evaluate(() => integrationLab.mount({ duration: 300 }))
  await settle(page)
  await page.click('#toggle')
  await expect(page.locator('#card')).toHaveCount(1)
  await expect(page.locator('#card')).toHaveCount(0)
  expect(
    await page.evaluate(
      () => integrationLab.state().events.filter((x) => x === 'left').length,
    ),
  ).toBe(1)
})

test('v-show show/hide/show cancels old leave and preserves reentry', async ({
  page,
}) => {
  await page.evaluate(() => integrationLab.mount({ persisted: true, duration: 500 }))
  await settle(page)
  // Toggle from the browser's animation frame: a second automation click can
  // arrive after the entire leave on a busy runner, testing reentry instead.
  const interruption = await page.evaluate(async () => {
    const state = integrationLab.state()
    state.show.value = false
    await state.nextTick()
    return new Promise<{ time: number; opacity: number }>((resolve, reject) => {
      const tick = () => {
        const card = document.querySelector('#card')!
        const animation = card.getAnimations()[0]
        if (!animation) {
          reject(new Error('Leave completed before its interruption checkpoint.'))
          return
        }
        const time = Number(animation.currentTime ?? 0)
        if (time < 100) {
          requestAnimationFrame(tick)
          return
        }
        const opacity = Number(getComputedStyle(card).opacity)
        state.show.value = true
        void state.nextTick().then(() => resolve({ time, opacity }))
      }
      requestAnimationFrame(tick)
    })
  })
  expect(interruption.time).toBeGreaterThanOrEqual(100)
  expect(interruption.time).toBeLessThan(500)
  expect(interruption.opacity).toBeGreaterThan(0)
  expect(interruption.opacity).toBeLessThan(1)
  await settle(page)
  await expect(page.locator('#card')).toBeVisible()
  const events = await page.evaluate(() => integrationLab.state().events)
  expect(events.filter((x) => x === 'leave cancelled')).toHaveLength(1)
  expect(events.filter((x) => x === 'left')).toHaveLength(0)
  expect(events.filter((x) => x === 'entered')).toHaveLength(2)
})

test('v-if new generation survives old leave and repeated replacements', async ({
  page,
}) => {
  await page.evaluate(() => integrationLab.mount({ duration: 300 }))
  for (let i = 0; i < 6; i++) {
    await page.evaluate(async () => {
      const s = integrationLab.state()
      s.show.value = false
      await s.nextTick()
      s.show.value = true
      await s.nextTick()
      s.key.value++
      await s.nextTick()
    })
  }
  await settle(page)
  await expect(page.locator('#card')).toHaveCount(1)
  await expect(page.locator('#card')).toBeVisible()
  expect(
    await page.evaluate(() => getComputedStyle(document.querySelector('#card')!).opacity),
  ).toBe('1')
})

test('application retarget while pressed composes, release restores new base', async ({
  page,
}) => {
  await settle(page)
  const card = page.locator('#card'),
    box = (await card.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await settle(page)
  const scale = () =>
    page.evaluate(
      () => new DOMMatrix(getComputedStyle(document.querySelector('#card')!).transform).a,
    )
  expect(await scale()).toBeCloseTo(1.056, 3)
  await page.evaluate(() => {
    integrationLab.state().motion.animate({ scale: 1.2 }, { duration: 120 })
  })
  await settle(page)
  expect(await scale()).toBeCloseTo(1.152, 3)
  await page.mouse.up()
  await settle(page)
  expect(await scale()).toBeCloseTo(1.2, 3)
})

test('unmount during leave cancels work and suppresses stale completion', async ({
  page,
}) => {
  await settle(page)
  await page.click('#toggle')
  await page.evaluate(() => {
    const s = integrationLab.state()
    globalThis.savedMotion = s.motion
    integrationLab.unmount()
  })
  await page.waitForTimeout(700)
  await expect(page.locator('#card')).toHaveCount(0)
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
  expect(
    await page.evaluate(
      () => integrationLab.state().events.filter((x) => x === 'left').length,
    ),
  ).toBe(0)
  expect(
    await page.evaluate(() => {
      try {
        globalThis.savedMotion.animate({ x: 10 })
        return ''
      } catch (e) {
        return String(e)
      }
    }),
  ).toContain('disposed')
})

test('live reduced-motion during entry settles transforms and keeps opacity contract', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => integrationLab.mount({ duration: 1200 }))
  await page.waitForTimeout(100)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new DOMMatrix(getComputedStyle(document.querySelector('#card')!).transform).f,
      ),
    )
    .toBe(0)
  await settle(page)
  expect(
    await page.evaluate(
      () => integrationLab.state().events.filter((x) => x === 'entered').length,
    ),
  ).toBe(1)
})

test('replace target cancels old application and press; new target remains controllable', async ({
  page,
}) => {
  await settle(page)
  await page.evaluate(() => {
    const s = integrationLab.state()
    globalThis.oldTarget = s.target.value!
    globalThis.oldAnimation = s.motion.animate({ x: 200 }, { duration: 2000 })
    s.key.value++
  })
  await settle(page)
  expect(await page.evaluate(async () => await globalThis.oldAnimation.finished)).toBe(
    false,
  )
  expect(await page.evaluate(() => globalThis.oldTarget.getAnimations().length)).toBe(0)
  await page.evaluate(() => {
    integrationLab.state().motion.animate({ x: 70 }, { duration: 100 })
  })
  await settle(page)
  expect(
    await page.evaluate(
      () => new DOMMatrix(getComputedStyle(document.querySelector('#card')!).transform).e,
    ),
  ).toBeCloseTo(70, 2)
})
