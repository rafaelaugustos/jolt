import { test, expect } from '@playwright/test'
for (const framework of ['react', 'angular', 'svelte', 'solid']) {
  test(`${framework}: retained presence cancels stale exit`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/' + framework)
    await page.waitForFunction(
      () => (window as any).fixture && (window as any).expansionOwners?.length,
    )
    const card = page.locator('[data-card]')
    await expect
      .poll(() => card.evaluate((n) => Number(getComputedStyle(n).opacity)))
      .toBe(1)
    await card.evaluate((n) => ((window as any).retainedIdentity = n))
    await page.getByRole('button', { name: 'Toggle', exact: true }).click()
    await expect(card).toHaveCount(1)
    await page.getByRole('button', { name: 'Toggle', exact: true }).click()
    await expect
      .poll(() => card.evaluate((n) => Number(getComputedStyle(n).opacity)))
      .toBe(1)
    expect(await card.evaluate((n) => n === (window as any).retainedIdentity)).toBe(true)
    await page.waitForTimeout(500)
    await expect(card).toHaveCount(1)
    await page.getByRole('button', { name: 'Toggle', exact: true }).click()
    await expect(card).toHaveCount(0)
    expect(errors).toEqual([])
  })
  test(`${framework}: resources own pointer, values, drag, scroll, sequences, layout and diagnostics`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/' + framework)
    await page.waitForFunction(
      () => (window as any).fixture && (window as any).expansionOwners?.length,
    )
    const x = (selector: string) =>
      page
        .locator(selector)
        .evaluate((n) => new DOMMatrixReadOnly(getComputedStyle(n).transform).m41)
    await page.locator('[data-value-right]').click()
    await expect.poll(() => x('[data-value]')).toBeGreaterThan(50)
    await page.locator('[data-value-left]').click()
    await expect.poll(() => x('[data-value]')).toBeLessThan(-79)
    const region = page.locator('[data-pointer-region]')
    await region.scrollIntoViewIfNeeded()
    const rect = (await region.boundingBox())!
    await page.mouse.move(rect.x + rect.width * 0.85, rect.y + rect.height * 0.2)
    await expect(page.locator('[data-pointer-status]')).toHaveText('active')
    await expect.poll(() => x('[data-pointer]')).toBeGreaterThan(45)
    await page.locator('[data-pointer-status]').hover()
    await expect.poll(() => x('[data-pointer]')).toBeCloseTo(0, 0)
    const drag = page.locator('[data-drag]')
    await drag.scrollIntoViewIfNeeded()
    const bounds = (await drag.boundingBox())!
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 75,
      bounds.y + bounds.height / 2,
      { steps: 8 },
    )
    await page.mouse.up()
    await expect.poll(() => x('[data-drag]')).toBeCloseTo(100, 0)
    await page.locator('[data-stagger]').click()
    await expect(page.locator('[data-cues]')).toHaveText('Events: 1')
    await page.locator('[data-cancel]').click()
    await page.waitForTimeout(3600)
    await expect(page.locator('[data-cues]')).toHaveText('Cancelled · Events: 1')
    await page.locator('[data-stagger]').click()
    await expect(page.locator('[data-cues]')).toHaveText('Events: 2')
    await page.locator('[data-sequence]').click()
    await expect
      .poll(() =>
        page
          .locator('[data-bar]')
          .last()
          .evaluate((n) => Number(getComputedStyle(n).opacity)),
      )
      .toBe(1)
    await page.locator('[data-layout-toggle]').click()
    await expect
      .poll(() =>
        page.locator('[data-layout]').evaluate((n) => n.getBoundingClientRect().width),
      )
      .toBeCloseTo(180, 0)
    await page.locator('[data-scroll]').evaluate((n) => (n.scrollTop = 300))
    await expect(page.locator('[data-scroll-status]')).toHaveText('1.00')
    await page.locator('[data-inspect]').click()
    await expect(page.locator('[data-inspector]')).toContainText('computed-style')
    await page.locator('[data-preset]').click()
    await expect
      .poll(() =>
        page
          .locator('[data-layout]')
          .evaluate((n) => Number(getComputedStyle(n).opacity)),
      )
      .toBe(1)
    const cleanup = await page.evaluate(async () => {
      const w = window as any
      await w.fixture.unmount()
      await new Promise((resolve) => setTimeout(resolve, 50))
      return w.expansionOwners.every(
        (o: any) =>
          o.scope.disposed &&
          o.value.disposed &&
          o.spring.disposed &&
          o.pointer.disposed &&
          o.drag.disposed &&
          o.layout.disposed &&
          o.scroll.disposed,
      )
    })
    expect(cleanup).toBe(true)
    expect(errors).toEqual([])
  })
}

test('framework scoped setup tears down detached resources and rebuilds on insertion', async ({
  page,
}) => {
  await page.goto('/react')
  await page.waitForFunction(() => (window as any).expansionOwners?.length)
  const outcome = await page.evaluate(async () => {
    const w = window as any,
      previous = w.expansionOwners.at(-1),
      node = previous.host
    const parent = node.parentNode,
      next = node.nextSibling
    node.remove()
    await new Promise((resolve) => setTimeout(resolve, 30))
    const stopped =
      previous.scope.disposed && previous.pointer.disposed && previous.drag.disposed
    parent.insertBefore(node, next)
    await new Promise((resolve) => setTimeout(resolve, 30))
    const current = w.expansionOwners.at(-1)
    return {
      stopped,
      recreated: current !== previous && !current.scope.disposed && current.host === node,
    }
  })
  expect(outcome).toEqual({ stopped: true, recreated: true })
})
