import { test, expect } from '@playwright/test'
for (const framework of ['react', 'angular', 'svelte', 'solid']) {
  test(`${framework}: mapped colors, property groups, states, priorities and seek`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/' + framework + '?advanced')
    await page.waitForFunction(() => (window as any).advancedOwners?.length)
    const x = (selector: string) =>
      page
        .locator(selector)
        .evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node).transform).m41)
    await page.locator('[data-map-right]').click()
    await expect.poll(() => x('[data-map]')).toBeCloseTo(100, 0)
    await expect(page.locator('[data-map]')).toHaveCSS(
      'background-color',
      'rgb(219, 255, 122)',
    )
    await page.locator('[data-map-left]').click()
    await expect.poll(() => x('[data-map]')).toBeCloseTo(-100, 0)
    await page.locator('[data-group-right]').click()
    await expect.poll(() => x('[data-group]')).toBeCloseTo(100, 0)
    const invalid = await page.evaluate(() => {
      const owner = (window as any).advancedOwners.at(-1),
        before = owner.group.get()
      let rejected = false
      try {
        owner.group.animate({ x: 0, scale: NaN })
      } catch {
        rejected = true
      }
      return { rejected, before, after: owner.group.get() }
    })
    expect(invalid.rejected).toBe(true)
    expect(invalid.after).toEqual(invalid.before)
    await page.locator('[data-group-left]').click()
    await expect.poll(() => x('[data-group]')).toBeCloseTo(-100, 0)
    await page.locator('[data-state-focus]').click()
    await expect.poll(() => x('[data-state]')).toBeCloseTo(80, 0)
    await page.locator('[data-state-rest]').click()
    await expect.poll(() => x('[data-state]')).toBeCloseTo(0, 0)
    await page.locator('[data-pet]').click()
    await page.locator('[data-dress]').click()
    await page.locator('[data-eat]').click()
    await expect(page.locator('[data-behavior]')).toHaveText('eat: blocked')
    await expect(page.locator('[data-behavior]')).toHaveText('Behavior: rest')
    await expect.poll(() => x('[data-state]')).toBeCloseTo(0, 0)
    await page.locator('[data-seek-quarter]').click()
    await expect.poll(() => x('[data-seek]')).toBeCloseTo(-50, 0)
    await page.locator('[data-seek-threequarters]').click()
    await expect.poll(() => x('[data-seek]')).toBeCloseTo(50, 0)
    await expect(page.locator('[data-seek-status]')).toContainText('Events: 0')
    await page.locator('[data-seek-quarter]').click()
    await page.locator('[data-seek-play]').click()
    await expect(page.locator('[data-seek-status]')).toContainText('Events: 1 · second')
    await expect(page.locator('[data-activity]')).toHaveText('Renderer: idle')
    expect(errors).toEqual([])
  })
  test(`${framework}: retained drawing, glyph sheen, inertia, viewport and owned teardown`, async ({
    page,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto('/' + framework + '?advanced')
    await page.waitForFunction(() => (window as any).advancedOwners?.length)
    await page.locator('[data-drawing-play]').click()
    await expect(page.locator('[data-activity]')).toHaveText('Renderer: active')
    await page.locator('[data-drawing-pause]').click()
    const before = await page
      .locator('[data-path]')
      .evaluate((node) => getComputedStyle(node).transform)
    await page.waitForTimeout(200)
    expect(
      await page
        .locator('[data-path]')
        .evaluate((node) => getComputedStyle(node).transform),
    ).toBe(before)
    await expect(page.locator('[data-drawing-status]')).toHaveText('Retained shapes: 21')
    await page.locator('[data-drawing-resume]').click()
    await expect(page.locator('[data-activity]')).toHaveText('Renderer: idle')
    const graphics = await page.evaluate(() => {
      const owner = (window as any).advancedOwners.at(-1)
      return {
        stroke: owner.stroke.snapshot().strokeEnd,
        items: owner.drawing.snapshot().items,
      }
    })
    expect(graphics).toEqual({ stroke: 1, items: 20 })
    const card = page.locator('[data-inertia]')
    await card.scrollIntoViewIfNeeded()
    const box = (await card.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, {
      steps: 8,
    })
    await page.mouse.up()
    await expect(page.locator('[data-inertia-status]')).toContainText('Settled:')
    const scroller = page.locator('[data-viewport]')
    await scroller.scrollIntoViewIfNeeded()
    await scroller.hover()
    await page.mouse.wheel(0, 420)
    await expect(page.locator('[data-entry-once]')).toHaveCSS('opacity', '1')
    await expect(page.locator('[data-entry-replay]')).toHaveCSS('opacity', '1')
    await page.mouse.wheel(0, -420)
    await page.waitForTimeout(250)
    await page.mouse.wheel(0, 420)
    await expect(page.locator('[data-entry-replay]')).toHaveCSS('opacity', '1')
    await page.locator('[data-drawing-clear]').click()
    await expect(page.locator('[data-vectors] svg')).toHaveCount(0)
    const cleanup = await page.evaluate(async () => {
      await (window as any).fixture.unmount()
      await new Promise((resolve) => setTimeout(resolve, 50))
      return (window as any).advancedOwners.every((owner: any) =>
        [
          'scope',
          'source',
          'mapped',
          'color',
          'group',
          'states',
          'behaviors',
          'drawing',
          'stroke',
          'title',
          'drag',
          'once',
          'replay',
          'activity',
        ].every((key) => owner[key].disposed),
      )
    })
    expect(cleanup).toBe(true)
    expect(errors).toEqual([])
  })
}
