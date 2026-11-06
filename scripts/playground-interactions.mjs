import { expect } from '@playwright/test'

export async function selectExperiment(page, id) {
  await page.locator(`[data-experiment="${id}"]`).click()
  const demo = page.locator(`[data-demo="${id}"]`)
  await demo.locator('.lab-stage').scrollIntoViewIfNeeded()
  await expect(demo).toHaveAttribute('data-demo-ready', 'true')
  return demo
}
const pose = (locator, property) =>
  locator.evaluate(
    (node, property) => new DOMMatrixReadOnly(getComputedStyle(node).transform)[property],
    property,
  )
async function drag(page, locator, dx, dy, edge = false) {
  const box = await locator.boundingBox()
  const x = box.x + (edge ? 10 : box.width / 2),
    y = box.y + box.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 15 })
  await page.waitForTimeout(220)
  await page.mouse.up()
}
export async function exercisePlaygroundInput(page) {
  await selectExperiment(page, 'press')
  const tile = page.locator('.lab-tile')
  await tile.focus()
  await page.keyboard.down('Space')
  await expect.poll(() => pose(tile, 'm11')).toBeLessThan(0.95)
  await page.keyboard.up('Space')
  await expect.poll(() => pose(tile, 'm11')).toBeGreaterThan(0.99)

  await selectExperiment(page, 'drag')
  const box = await tile.boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 85, box.y + box.height / 2 + 30, {
    steps: 15,
  })
  await expect.poll(() => pose(tile, 'm41')).toBeGreaterThan(40)
  await page.mouse.up()
  await expect.poll(async () => Math.abs(await pose(tile, 'm41'))).toBeLessThan(2)

  await selectExperiment(page, 'gestures')
  await drag(page, tile, 65, 35)
  await expect.poll(() => pose(tile, 'm41')).toBeGreaterThan(35)

  await selectExperiment(page, 'pointer')
  const stage = await page.locator('.lab-stage').boundingBox()
  await page.mouse.move(stage.x + stage.width - 30, stage.y + 70)
  await expect.poll(() => pose(tile, 'm41')).toBeGreaterThan(35)

  await selectExperiment(page, 'zoom')
  await page.locator('.lab-zoom img').dblclick()
  await expect.poll(() => pose(page.locator('.lab-zoom img'), 'm11')).toBeGreaterThan(1.5)
  await page.locator('[data-action=reset-zoom]').click()

  await selectExperiment(page, 'reorder')
  await page.locator('.lab-grab').first().focus()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('.lab-list-row').first()).toHaveAttribute('data-key', '02')

  await selectExperiment(page, 'scroll')
  await page.locator('.lab-scroll-window').hover()
  await page.mouse.wheel(0, 320)
  await expect
    .poll(() => page.locator('.lab-scroll-window').evaluate((node) => node.scrollTop))
    .toBeGreaterThan(100)

  await selectExperiment(page, 'scroll-header')
  await page.locator('.lab-header-scroll').hover()
  await page.mouse.wheel(0, 260)
  await expect
    .poll(() => page.locator('.lab-header-scroll').evaluate((node) => node.scrollTop))
    .toBeGreaterThan(100)

  await selectExperiment(page, 'interactive-back')
  await drag(page, page.locator('.lab-back-page'), 28, 0, true)
  await expect(page.locator('.lab-back-page')).toBeVisible()
  await expect
    .poll(async () => Math.abs(await pose(page.locator('.lab-back-page'), 'm41')))
    .toBeLessThan(2)
  const region = await page.locator('.lab-back-region').boundingBox()
  await drag(page, page.locator('.lab-back-page'), region.width * 0.8, 0, true)
  await expect(page.locator('.lab-back-page')).toBeHidden()

  await selectExperiment(page, 'modal')
  await page.locator('.replay-button').click()
  await expect(page.locator('.lab-dialog')).toBeVisible()
  await page.locator('.lab-dialog-input').fill('Motion with a little personality.')
  await page.keyboard.press('Escape')
  await expect(page.locator('.lab-dialog')).toBeHidden()

  await selectExperiment(page, 'gallery')
  await page.locator('.lab-gallery-thumbnail').click()
  await expect(page.locator('.lab-gallery-viewer')).toBeVisible()
  await page.waitForTimeout(700)
  await page.locator('[data-action=delete-thumbnail]').click()
  await page.locator('[data-action=back]').click()
  await expect(page.locator('.lab-gallery-viewer')).toBeHidden()
  await expect(page.locator('.lab-gallery-title')).toBeFocused()
  await page.locator('.replay-button').click()
  await expect(page.locator('.lab-gallery-viewer')).toBeVisible()
  await page.locator('[data-action=back]').click()

  await selectExperiment(page, 'lifecycle')
  await page.locator('.replay-button').click()
  await page.waitForTimeout(200)
  await page.locator('[data-action=pause]').click()
  const stopped = await pose(tile, 'm11')
  await page.waitForTimeout(200)
  expect(Math.abs((await pose(tile, 'm11')) - stopped)).toBeLessThan(0.001)
  await page.locator('[data-action=resume]').click()
  await expect
    .poll(async () => Math.abs((await pose(tile, 'm11')) - stopped))
    .toBeGreaterThan(0.02)
}

export async function reviewPlaygroundShell(page, base, engine) {
  await page.locator('.lab-search input').fill('physicsWorld')
  await expect(page.locator('[data-experiment]')).toHaveCount(1)
  await expect(page.locator('[data-experiment]')).toHaveAttribute(
    'data-experiment',
    'physics',
  )
  await page.locator('.lab-search input').fill('zz-no-result')
  await expect(page.locator('.lab-empty')).toBeVisible()
  await page.locator('.lab-search input').fill('')
  await page.locator('[data-family=effects]').click()
  await expect(page.locator('[data-experiment]')).toHaveCount(12)
  await page.locator('[data-experiment=gradient]').click()
  await page.locator('.lab-families button').first().click()
  if (engine === 'chromium') {
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
    await page.locator('.lab-copy').click()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
      'scope.gradient',
    )
  }
  for (const locale of ['', '/pt-BR', '/es', '/zh-Hans']) {
    await page.goto(`${base}${locale}/?play=physics#playground`)
    await expect(page.locator('#playground')).toHaveAttribute('data-motion-ready', 'true')
    await expect(page.locator('[data-demo=physics]')).toHaveCount(1)
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.locator('.lab-stage').scrollIntoViewIfNeeded()
      await expect(page.locator('[data-demo=physics]')).toHaveAttribute(
        'data-demo-ready',
        'true',
      )
      await expect(page.locator('[data-demo=physics]')).toHaveAttribute(
        'data-demo-error',
        'false',
      )
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      ).toBe(true)
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await selectExperiment(page, 'spring')
  await page.locator('.replay-button').click()
  await expect(page.locator('[data-demo=spring]')).toHaveAttribute(
    'data-demo-error',
    'false',
  )
  await expect
    .poll(() =>
      page
        .locator('.lab-stage')
        .evaluate(
          (node) =>
            node
              .getAnimations({ subtree: true })
              .filter((animation) => animation.playState === 'running').length,
        ),
    )
    .toBe(0)
  await selectExperiment(page, 'physics')
  await page.locator('h1').scrollIntoViewIfNeeded()
  await expect(page.locator('.lab-stage')).toBeEmpty()
  await page.locator('.lab-stage').scrollIntoViewIfNeeded()
  await expect(page.locator('.lab-physics-ball')).toHaveCount(2)
  await page.locator('.lab-code > a').click()
  await expect(page.locator('.lab-session')).toHaveCount(0)
  await page.goBack()
  await page.locator('.lab-stage').scrollIntoViewIfNeeded()
  await expect(page.locator('[data-demo=physics]')).toHaveAttribute(
    'data-demo-ready',
    'true',
  )
}
