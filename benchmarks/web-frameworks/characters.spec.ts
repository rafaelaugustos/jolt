import { test, expect } from '@playwright/test'
for (const framework of ['react', 'angular', 'svelte', 'solid']) {
  test(`${framework}: finite keyframes and composed input lifecycle`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/' + framework + '?characters')
    await page.waitForFunction(() => (window as any).characterOwners?.length)
    await page.locator('[data-key-play]').click()
    await page.waitForTimeout(300)
    await page.locator('[data-key-pause]').click()
    const transform = await page
      .locator('[data-key-marker]')
      .evaluate((n) => getComputedStyle(n).transform)
    await page.waitForTimeout(150)
    expect(
      await page
        .locator('[data-key-marker]')
        .evaluate((n) => getComputedStyle(n).transform),
    ).toBe(transform)
    await page.locator('[data-key-resume]').click()
    await expect(page.locator('[data-key-status]')).toHaveText('completed')
    const card = page.locator('[data-gesture]')
    await card.scrollIntoViewIfNeeded()
    const box = (await card.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 15, {
      steps: 8,
    })
    await page.mouse.up()
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).characterOwners.at(-1).gestures.position.x),
      )
      .toBeGreaterThan(40)
    await page.locator('[data-gesture-zoom]').click()
    await expect(page.locator('[data-gesture-status]')).toContainText('scale 1.25')
    await page.locator('[data-gesture-turn]').click()
    await expect(page.locator('[data-gesture-status]')).toContainText(
      'scale 1.25 · angle 30',
    )
    await page.locator('[data-gesture-reset]').click()
    await expect(page.locator('[data-gesture-status]')).toContainText(
      'x 0 · scale 1.00 · angle 0',
    )
    expect(errors).toEqual([])
  })
  test(`${framework}: reorder, drop acceptance, rig sockets and cue-owned particles`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto('/' + framework + '?characters')
    await page.waitForFunction(() => (window as any).characterOwners?.length)
    const drag = async (source: string, target: string) => {
      await page.locator(source).scrollIntoViewIfNeeded()
      const a = (await page.locator(source).boundingBox())!,
        b = (await page.locator(target).boundingBox())!
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await page.mouse.down()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 10, { steps: 15 })
      await page.mouse.up()
    }
    await drag('[data-gift]', '[data-locked]')
    await expect(page.locator('[data-drop-status]')).toHaveText('rejected · effects 0')
    await expect
      .poll(() =>
        page
          .locator('[data-gift]')
          .evaluate((n) => new DOMMatrixReadOnly(getComputedStyle(n).transform).m41),
      )
      .toBeCloseTo(0, 0)
    await drag('[data-gift]', '[data-basket]')
    await expect(page.locator('[data-drop-status]')).toHaveText(
      'accepted · basket · effects 1',
    )
    await page.locator('[data-drop-return]').click()
    await expect(page.locator('[data-drop-status]')).toHaveText('returned · effects 0')
    const first = page.locator('[data-key="Item 1"] [data-handle]')
    await first.focus()
    await page.keyboard.press('Space')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Space')
    await expect(page.locator('[data-order-status]')).toHaveText(
      'Item 2, Item 3, Item 1, Item 4',
    )
    await page.locator('[data-order-reset]').click()
    for (const key of ['Item 1', 'Item 3']) {
      await expect
        .poll(() =>
          page
            .locator(`[data-key="${key}"]`)
            .evaluate((n) => new DOMMatrixReadOnly(getComputedStyle(n).transform).m42),
        )
        .toBeCloseTo(0, 2)
    }
    await drag('[data-key="Item 1"] [data-handle]', '[data-key="Item 3"] [data-handle]')
    await expect(page.locator('[data-order-status]')).toHaveText(
      'Item 2, Item 3, Item 1, Item 4',
    )
    await page.locator('[data-rig-wave]').click()
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).characterOwners.at(-1).rig.point('hand').y),
      )
      .toBeLessThan(100)
    await page.locator('[data-rig-blend]').click()
    await expect(page.locator('[data-rig-status]')).toHaveText('blended')
    await page.locator('[data-rig-rest]').click()
    await expect
      .poll(() =>
        page.evaluate(() => (window as any).characterOwners.at(-1).rig.point('hand').y),
      )
      .toBeCloseTo(152, 0)
    await page.locator('[data-celebrate]').click()
    await expect(page.locator('[data-particle-status]')).toHaveText('100 · running')
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).characterOwners.at(-1).particles.snapshot().particles,
        ),
      )
      .toBe(100)
    const snapshot = await page.evaluate(() =>
      (window as any).characterOwners.at(-1).particles.snapshot(),
    )
    expect(snapshot.particles).toBe(100)
    expect(snapshot.backend).toBe('canvas-2d')
    await page.locator('[data-effect-cancel]').click()
    await expect(page.locator('[data-character] canvas')).toHaveCount(0)
    await page.locator('[data-emit]').click()
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as any).characterOwners.at(-1).particles.snapshot().particles,
        ),
      )
      .toBeGreaterThan(0)
    const disposed = await page.evaluate(async () => {
      await (window as any).fixture.unmount()
      return (window as any).characterOwners.every((owner: any) =>
        ['scope', 'gestures', 'drop', 'reorder', 'rig', 'particles'].every(
          (key) => owner[key].disposed,
        ),
      )
    })
    expect(disposed).toBe(true)
    expect(errors).toEqual([])
  })
}
