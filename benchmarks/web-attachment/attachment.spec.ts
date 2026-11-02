import { test, expect } from '@playwright/test'
import type {} from './fixture.js'

test('cancelled detached enters never finish a newer transition', async ({ page }) => {
  await page.goto('/?test')
  await page.evaluate(() => {
    window.transition = lab.detachedTransition()
    transition.enter()
    transition.motion.transition.onEnterCancelled(transition.surface)
    transition.enter()
    document.body.append(transition.surface)
  })
  await expect.poll(() => page.evaluate(() => transition.completions)).toBe(1)
  await page.evaluate(() => transition.stop())
})

test('scope disposal cancels detached transition and its pending completion', async ({
  page,
}) => {
  await page.goto('/?test')
  await page.evaluate(() => {
    window.transition = lab.detachedTransition()
    transition.enter()
    transition.stop()
    document.body.append(transition.surface)
  })
  await page.evaluate(() => new Promise(requestAnimationFrame))
  expect(await page.evaluate(() => transition.completions)).toBe(0)
})

test('a known detached shadow root starts after its host enters the document', async ({
  page,
}) => {
  await page.goto('/?test')
  await page.evaluate(() => {
    window.transition = lab.detachedTransition()
    const host = document.createElement('div'),
      root = host.attachShadow({ mode: 'open' })
    root.append(transition.surface)
    transition.enter()
    queueMicrotask(() => document.body.append(host))
  })
  await expect.poll(() => page.evaluate(() => transition.completions)).toBe(1)
  await page.evaluate(() => transition.stop())
})

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})
for (const directive of [false, true]) {
  const api = directive ? 'directive' : 'composable'
  test(`${api} waits for real attachment and preserves imperative validation`, async ({
    page,
  }) => {
    const initial = await page.evaluate((directive) => {
      window.app = lab.mountDetached(directive)
      let rejected = false
      try {
        app.runtime.viewportEnter(app.target!)
      } catch {
        rejected = true
      }
      return {
        errors: app.errors,
        setups: app.events,
        rejected,
        animations: app.runtime.inspect(document.body).animations,
      }
    }, directive)
    expect(initial).toEqual({ errors: [], setups: [], rejected: true, animations: 0 })
    await page.evaluate(() => app.insert())
    await expect
      .poll(() =>
        page.evaluate(() => app.runtime.inspect(document.body).viewportEntrances),
      )
      .toBe(1)
    await expect
      .poll(() => page.evaluate(() => Number(getComputedStyle(app.target!).opacity)))
      .toBe(1)
    const done = await page.evaluate(() => {
      app.unmount()
      const result = {
        errors: app.errors,
        scopes: app.runtime.inspect(document.body).scopes,
        entrances: app.runtime.inspect(document.body).viewportEntrances,
      }
      app.runtime.dispose()
      return result
    })
    expect(done).toEqual({ errors: [], scopes: 0, entrances: 0 })
  })
  test(`${api} cancels pending insertion on unmount`, async ({ page }) => {
    const result = await page.evaluate(async (directive) => {
      const app = lab.mountDetached(directive)
      app.unmount()
      app.insert()
      await new Promise((resolve) => requestAnimationFrame(resolve))
      const result = {
        errors: app.errors,
        events: app.events,
        scopes: app.runtime.inspect(document.body).scopes,
        entrances: app.runtime.inspect(document.body).viewportEntrances,
      }
      app.runtime.dispose()
      app.root.remove()
      return result
    }, directive)
    expect(result).toEqual({ errors: [], events: [], scopes: 0, entrances: 0 })
  })
  test(`${api} handles KeepAlive detachment, reactivation and element replacement`, async ({
    page,
  }) => {
    await page.evaluate((directive) => {
      window.app = lab.mountDetached(directive)
      app.insert()
    }, directive)
    await expect
      .poll(() =>
        page.evaluate(() => app.runtime.inspect(document.body).viewportEntrances),
      )
      .toBe(1)
    expect(
      await page.evaluate(() => app.runtime.inspect(document.body).interactions),
    ).toBe(directive ? 0 : 1)
    await page.evaluate(() => app.show(false))
    await expect
      .poll(() =>
        page.evaluate(() => app.runtime.inspect(document.body).viewportEntrances),
      )
      .toBe(0)
    expect(
      await page.evaluate(() => app.runtime.inspect(document.body).interactions),
    ).toBe(0)
    await page.evaluate(() => app.show(true))
    await expect
      .poll(() =>
        page.evaluate(() => app.runtime.inspect(document.body).viewportEntrances),
      )
      .toBe(1)
    await page.evaluate(() => app.replace())
    await expect
      .poll(() =>
        page.evaluate(() => app.runtime.inspect(document.body).viewportEntrances),
      )
      .toBe(1)
    expect(
      await page.evaluate(() => app.runtime.inspect(document.body).interactions),
    ).toBe(directive ? 0 : 1)
    const result = await page.evaluate(() => {
      app.unmount()
      const result = {
        errors: app.errors,
        scopes: app.runtime.inspect(document.body).scopes,
      }
      app.runtime.dispose()
      return result
    })
    expect(result).toEqual({ errors: [], scopes: 0 })
    expect(
      await page.evaluate(() => app.runtime.inspect(document.body).interactions),
    ).toBe(0)
  })
}
