import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.depth)
})

test('real mouse drop accepts once and rejection retains the return spring', async ({
  page,
}) => {
  const from = (await page.locator('#source').boundingBox())!,
    to = (await page.locator('#accept').boundingBox())!
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 10 })
  await expect(page.locator('#accept')).toHaveAttribute('data-hover', '')
  await page.mouse.up()
  await expect(page.locator('#status')).toHaveText('Accepted once · drag · 1')
  await page.locator('#reset').click()
  const source = (await page.locator('#source').boundingBox())!,
    rejected = (await page.locator('#reject').boundingBox())!
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2)
  await page.mouse.down()
  await page.mouse.move(
    rejected.x + rejected.width / 2,
    rejected.y + rejected.height / 2,
    { steps: 10 },
  )
  await page.mouse.up()
  await expect(page.locator('#status')).toContainText('Rejected')
  await expect
    .poll(async () => (await page.locator('#source').boundingBox())!.x)
    .toBeCloseTo(source.x, 0)
  expect(await page.evaluate(() => window.depth.count)).toBe(0)
})

test('release hit testing includes an unpainted final input sample and fresh target layout', async ({
  page,
}) => {
  const from = (await page.locator('#source').boundingBox())!,
    to = (await page.locator('#accept').boundingBox())!
  await page.evaluate(() =>
    document.getElementById('source')!.addEventListener(
      'pointerdown',
      (event) => {
        document.getElementById('source')!.dataset.pointer = String(event.pointerId)
      },
      { once: true },
    ),
  )
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(from.x + from.width / 2 + 10, from.y + from.height / 2)
  // A final pointer-up can carry a newer position than the previous RAF/move.
  await page.evaluate(
    ({ x, y }) =>
      window.dispatchEvent(
        new PointerEvent('pointerup', {
          pointerId: Number(document.getElementById('source')!.dataset.pointer),
          pointerType: 'mouse',
          isPrimary: true,
          clientX: x,
          clientY: y,
          button: 0,
        }),
      ),
    { x: to.x + to.width / 2, y: to.y + to.height / 2 },
  )
  await expect(page.locator('#status')).toHaveText('Accepted once · drag · 1')
  await page.mouse.up()
})

test('keyboard alternative, pause, removed targets and repeated scope teardown remain bounded', async ({
  page,
}) => {
  await page.locator('#request').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('#status')).toHaveText('Accepted once · request · 1')
  await page.locator('#pause').click()
  expect(await page.evaluate(() => window.depth.drop.request('accept'))).toBe(false)
  await page.locator('#pause').click()
  await page.evaluate(() => document.getElementById('accept')!.remove())
  expect(await page.evaluate(() => window.depth.drop.request('accept'))).toBe(false)
  for (let i = 0; i < 5; i++) await page.locator('#reset').click()
  const result = await page.evaluate(() => {
    const diagnostics = window.depth.runtime.diagnostics({ development: true })
    window.depth.scope.dispose()
    return diagnostics.snapshot().resources
  })
  expect(result.drags).toBe(0)
  expect(result.interactions).toBe(0)
  expect(result.frameTasks).toBe(0)
})
