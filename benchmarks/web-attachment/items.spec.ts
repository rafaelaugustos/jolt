import { test, expect } from '@playwright/test'
import type {} from './fixture.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/?test')
  await page.evaluate(() => {
    window.rt = lab.createWebRuntime(document, { reducedMotion: 'never' })
    window.rows = [1, 2, 3].map((key) => ({ key, target: lab.makeTarget() }))
  })
})
test.afterEach(async ({ page }) => {
  await page.evaluate(() => rt.dispose())
})

test('keyed updates retain in-flight rows and animate new identities', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.items = rt.animateItems(
      rows,
      { x: [0, 100] },
      { duration: 2000, ease: 'linear', once: true },
    )
  })
  await expect.poll(() => page.evaluate(() => items.pending)).toBe(3)
  const result = await page.evaluate(() => {
    const first = rows[0]!.target
    const before = first.getAnimations()[0]
    rows.reverse()
    rows.push({ key: 4, target: lab.makeTarget() })
    items.update(rows)
    return { same: first.getAnimations()[0] === before, active: items.pending }
  })
  expect(result).toEqual({ same: true, active: 3 })
  await expect.poll(() => page.evaluate(() => items.pending)).toBe(4)
  await page.evaluate(() => {
    rows[1]!.target.remove()
    rows.splice(1, 1)
    items.update(rows)
  })
  await expect.poll(() => page.evaluate(() => items.pending)).toBe(3)
  await page.evaluate(() => items.dispose())
  expect(await page.evaluate(() => rt.inspect(document.body).itemAnimations)).toBe(0)
})

test('once follows identity across recycled DOM and forget explicitly re-enables it', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.items = rt.animateItems(
      [rows[0]!],
      { opacity: [0.2, 1] },
      { duration: 1000, once: true },
    )
  })
  await expect.poll(() => page.evaluate(() => items.completed)).toBe(1)
  await page.evaluate(() => {
    items.update([{ key: 1, target: rows[1]!.target }])
  })
  await expect.poll(() => page.evaluate(() => items.completed)).toBe(1)
  expect(
    await page.evaluate(
      () =>
        rows[1]!.target.getAnimations().filter((a) => a.playState === 'running').length,
    ),
  ).toBe(0)
  await page.evaluate(() => items.forget(1))
  await expect.poll(() => page.evaluate(() => items.pending)).toBe(1)
  await page.evaluate(() => items.update([{ key: 'new', target: rows[1]!.target }]))
  await expect.poll(() => page.evaluate(() => items.pending)).toBe(1)
})

test('invalid batches leave current ownership intact', async ({ page }) => {
  await page.evaluate(() => {
    window.items = rt.animateItems(rows, { opacity: [0.2, 1] }, { duration: 2000 })
  })
  await expect.poll(() => page.evaluate(() => items.pending)).toBe(3)
  const result = await page.evaluate(() => {
    const old = rows[0]!.target.getAnimations()[0]
    const invalid = [
      [rows[0]!, rows[0]!],
      [
        { key: 1, target: rows[0]!.target },
        { key: 2, target: rows[0]!.target },
      ],
      [{ key: 1, target: document.createElement('div') }],
      [{ key: NaN, target: rows[0]!.target }],
    ]
    const rejected = invalid.map((batch) => {
      try {
        items.update(batch)
        return false
      } catch {
        return true
      }
    })
    return {
      rejected,
      same: old === rows[0]!.target.getAnimations()[0],
      pending: items.pending,
    }
  })
  expect(result).toEqual({ rejected: [true, true, true, true], same: true, pending: 3 })
})

test('empty collection can acquire rows and scope cleanup preserves newer channels', async ({
  page,
}) => {
  await page.evaluate(() => {
    const scope = rt.scope()
    window.items = scope.animateItems(
      [],
      { x: [0, 100], opacity: [0.1, 1] },
      { duration: 2000 },
    )
    items.update(rows)
    Object.assign(window, { clean: () => scope.dispose() })
  })
  await expect.poll(() => page.evaluate(() => items.pending)).toBe(3)
  await page.evaluate(() => {
    rt.set(rows[0]!.target, { x: 77 })
    ;(window as unknown as { clean(): void }).clean()
  })
  expect(
    await page.evaluate(
      () => new DOMMatrix(getComputedStyle(rows[0]!.target).transform).e,
    ),
  ).toBeCloseTo(77)
  expect(
    await page.evaluate(() => ({
      disposed: items.disposed,
      scopes: rt.inspect(document.body).scopes,
      count: rt.inspect(document.body).itemAnimations,
    })),
  ).toEqual({ disposed: true, scopes: 0, count: 0 })
})

test('reduced motion keeps content visible and suspension has no pending work', async ({
  page,
}) => {
  await page.evaluate(() => {
    rt.configure({ reducedMotion: 'always' })
    window.items = rt.animateItems(rows, 'fadeInUp')
  })
  expect(
    await page.evaluate(() => rows.map((row) => getComputedStyle(row.target).opacity)),
  ).toEqual(['1', '1', '1'])
  expect(await page.evaluate(() => items.pending)).toBe(0)
  await page.evaluate(() => {
    items.suspend()
    items.update([rows[0]!])
    rt.configure({ reducedMotion: 'never' })
  })
  expect(await page.evaluate(() => items.pending)).toBe(0)
  await page.evaluate(() => items.resume())
  await expect.poll(() => page.evaluate(() => items.completed)).toBe(1)
})
