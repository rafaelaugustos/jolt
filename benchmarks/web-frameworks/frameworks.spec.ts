import { test, expect } from '@playwright/test'
for (const framework of ['react', 'angular', 'svelte', 'solid']) {
  test(`${framework}: packed SSR hydration, interruption, replacement and borrowed ownership`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })
    await page.goto('/' + framework)
    await page.waitForFunction(() => (window as any).fixture)
    const x = () =>
      page
        .locator('[data-card]')
        .evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m41)
    await page.getByRole('button', { name: 'Move', exact: true }).click()
    await expect.poll(x).toBeGreaterThan(8)
    const before = await x()
    await page.getByRole('button', { name: 'Rerender', exact: true }).click()
    await expect.poll(x).toBeGreaterThan(before)
    await page.getByRole('button', { name: 'Interrupt', exact: true }).click()
    await expect.poll(x).toBeLessThan(-59)
    await page.getByRole('button', { name: 'Replace', exact: true }).click()
    await expect.poll(x).toBeLessThan(-59)
    await page.locator('[data-card]').click()
    await expect(page.locator('[data-taps]')).toHaveText('1')
    for (let i = 0; i < 3; i++) {
      await page.getByRole('button', { name: 'Toggle', exact: true }).click()
      await expect(page.locator('[data-card]')).toHaveCount(0)
      await page.getByRole('button', { name: 'Toggle', exact: true }).click()
      await expect(page.locator('[data-card]')).toHaveCount(1)
    }
    await page.getByRole('button', { name: 'Reduce motion', exact: true }).click()
    await page.getByRole('button', { name: 'Move', exact: true }).click()
    await expect.poll(x).toBeCloseTo(160, 0)
    const borrowed = await page.evaluate(async () => {
      const f = (window as any).fixture
      await f.unmount()
      const node = document.createElement('div')
      document.body.append(node)
      const motion = f.runtime.animate(node, { x: 42 }, { duration: 0 })
      await motion.finished
      const result = new DOMMatrixReadOnly(getComputedStyle(node).transform).m41
      f.runtime.dispose()
      node.remove()
      return result
    })
    expect(borrowed).toBeCloseTo(42, 0)
    expect(errors).toEqual([])
  })
}

test('Angular reentry during leave retains its root and cancels stale removal', async ({
  page,
}) => {
  await page.goto('/angular')
  await page.waitForFunction(() => (window as any).fixture)
  const card = page.locator('[data-card]')
  await expect
    .poll(() => card.evaluate((n) => Number(getComputedStyle(n).opacity)))
    .toBe(1)
  await card.evaluate((n) => ((window as any).originalRoot = n))
  await page.getByRole('button', { name: 'Toggle', exact: true }).click()
  await expect(card).toHaveCount(1)
  await page.getByRole('button', { name: 'Toggle', exact: true }).click()
  await expect
    .poll(() => card.evaluate((n) => Number(getComputedStyle(n).opacity)))
    .toBe(1)
  expect(await card.evaluate((n) => n === (window as any).originalRoot)).toBe(true)
  await page.waitForTimeout(450)
  await expect(card).toHaveCount(1)
})
