import { test, expect } from '@playwright/test'
for (const framework of ['react', 'angular', 'svelte', 'solid']) {
  test(`${framework}: panel snapping, nested scroll and focus return`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/' + framework + '?geometry')
    await page.waitForFunction(() => (window as any).geometryOwners?.length)
    await page.locator('[data-panel-host]').scrollIntoViewIfNeeded()
    await page.locator('[data-panel-open]').click()
    const handle = page.locator('[data-panel-handle]')
    await expect(handle).toBeFocused()
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).geometryOwners.at(-1).sheet.visibleHeight),
      )
      .toBeCloseTo(220, 0)
    await page.keyboard.press('End')
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).geometryOwners.at(-1).sheet.visibleHeight),
      )
      .toBeCloseTo(450, 0)
    const scroll = page.locator('[data-panel-scroll]')
    await scroll.hover()
    await page.mouse.wheel(0, 200)
    await expect.poll(() => scroll.evaluate((n) => n.scrollTop)).toBeGreaterThan(60)
    await expect(page.locator('[data-panel-status]')).toHaveText('open · content')
    await scroll.evaluate((n) => {
      n.scrollTop = 0
    })
    await page.locator('[data-panel-note]').fill('Bring a camera')
    await page.locator('[data-panel-compact]').click()
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).geometryOwners.at(-1).sheet.visibleHeight),
      )
      .toBeCloseTo(220, 0)
    const box = (await handle.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 170, {
      steps: 24,
    })
    await page.waitForTimeout(180)
    await page.mouse.up()
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).geometryOwners.at(-1).sheet.visibleHeight),
      )
      .toBeGreaterThan(350)
    await handle.focus()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-panel-open]')).toBeFocused()
    await expect(page.locator('[data-panel-status]')).toHaveText('closed')
    expect(errors).toEqual([])
  })
  test(`${framework}: measured reorder, resize cancellation and curved motion lifecycle`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/' + framework + '?geometry')
    await page.waitForFunction(() => (window as any).geometryOwners?.length)
    await page.locator('[data-curve-play]').click()
    await expect(page.locator('[data-curve-status]')).toHaveText('completed')
    const x = () =>
      page
        .locator('[data-curve-marker]')
        .evaluate((n) => new DOMMatrixReadOnly(getComputedStyle(n).transform).m41)
    await expect.poll(x).toBeCloseTo(285, 0)
    await page.locator('[data-curve-reverse]').click()
    await page.waitForTimeout(400)
    await page.locator('[data-curve-cancel]').click()
    const frozen = await x()
    await page.waitForTimeout(150)
    expect(await x()).toBeCloseTo(frozen, 0)
    const handle = (key: number) =>
      page.locator(`[data-measured-key="Stop ${key}"] [data-measured-handle]`)
    await page.locator('[data-measured-list]').scrollIntoViewIfNeeded()
    const a = (await handle(1).boundingBox())!,
      b = (await handle(3).boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 12, { steps: 18 })
    await page.mouse.up()
    await expect(page.locator('[data-measured-status]')).toHaveText(
      'Stop 2, Stop 3, Stop 1',
    )
    await page.locator('[data-measured-reset]').click()
    await expect
      .poll(() =>
        page
          .locator('[data-measured-key]')
          .evaluateAll((nodes) =>
            Math.max(
              ...nodes.map((n) =>
                Math.abs(new DOMMatrixReadOnly(getComputedStyle(n).transform).m42),
              ),
            ),
          ),
      )
      .toBeLessThan(0.01)
    const row = page.locator('[data-measured-key="Stop 2"]'),
      height = (await row.boundingBox())!.height
    await page.locator('[data-measured-resize]').click()
    expect((await row.boundingBox())!.height).toBeGreaterThan(height + 20)
    // Simulate a live content update while a real pointer contact owns a drag.
    await handle(1).scrollIntoViewIfNeeded()
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    const start = (await handle(1).boundingBox())!
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2 + 12, {
      steps: 3,
    })
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).geometryOwners.at(-1).reorder.activeKey),
      )
      .toBe('Stop 1')
    await page
      .locator('[data-measured-resize]')
      .evaluate((n: HTMLButtonElement) => n.click())
    await page.mouse.up()
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).geometryOwners.at(-1).reorder.activeKey),
      )
      .toBeUndefined()
    await expect(page.locator('[data-measured-status]')).toHaveText(
      'Stop 1, Stop 2, Stop 3',
    )
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    )
    await handle(1).focus()
    await page.keyboard.press('Space')
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).geometryOwners.at(-1).reorder.activeKey),
      )
      .toBe('Stop 1')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Space')
    await expect(page.locator('[data-measured-status]')).toHaveText(
      'Stop 2, Stop 1, Stop 3',
    )
    expect(
      await page.evaluate(async () => {
        await (window as any).fixture.unmount()
        return (window as any).geometryOwners.every(
          (o: any) => o.scope.disposed && o.sheet.disposed && o.reorder.disposed,
        )
      }),
    ).toBe(true)
    expect(errors).toEqual([])
  })
}
