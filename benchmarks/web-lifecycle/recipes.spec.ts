import { expect, test } from '@playwright/test'

test('complete recipes compose drag return, intrinsic size, reorder and disposal', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto('/?demo=recipes')
  const drag = page.locator('#recipe-drag'),
    box = (await drag.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 45, {
    steps: 10,
  })
  await expect
    .poll(() => drag.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e))
    .toBeCloseTo(90, 0)
  await page.mouse.up()
  await expect
    .poll(() => drag.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).e))
    .toBeCloseTo(0, 1)
  await page.locator('#recipe-expand').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#recipe-expand')).toHaveAttribute('aria-expanded', 'true')
  await expect
    .poll(() =>
      page.locator('#recipe-panel').evaluate((el) => (el as HTMLElement).style.height),
    )
    .toBe('auto')
  await page.click('#recipe-reorder')
  await expect(page.locator('#recipe-list button').first()).toHaveText('C')
  await page.click('#recipe-remove')
  await expect(page.locator('#recipe-list button')).toHaveCount(2)
  await page.click('#recipe-expand')
  await page.click('#recipe-expand')
  await expect
    .poll(() =>
      page.locator('#recipe-panel').evaluate((el) => (el as HTMLElement).style.height),
    )
    .toBe('auto')
  await page.click('#dispose')
  expect(
    await page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.target)),
  ).toMatchObject({ scopes: 0, values: 0, sizes: 0, layouts: 0 })
  expect(errors).toEqual([])
})

test('reduced-motion recipes keep controls and final layout usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/?demo=recipes')
  await page.click('#recipe-expand')
  await expect
    .poll(() =>
      page.locator('#recipe-panel').evaluate((el) => (el as HTMLElement).style.height),
    )
    .toBe('auto')
  await page.click('#recipe-reorder')
  await expect(page.locator('#recipe-list button').first()).toHaveText('C')
  await expect
    .poll(() =>
      page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.target).animations),
    )
    .toBe(0)
})
