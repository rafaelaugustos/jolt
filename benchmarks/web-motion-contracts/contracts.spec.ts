import { test, expect, type Page } from '@playwright/test'
import type { demo } from './fixture.js'
declare global {
  interface Window {
    demo: typeof demo
  }
}
const snap = (page: Page) => page.evaluate(() => window.demo.snapshot())
async function drag(page: Page, id: string, dx: number, dy: number) {
  const b = (await page.locator(id).boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(100)
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(x + (dx * i) / 12, y + (dy * i) / 12)
    await page.waitForTimeout(25)
  }
  await page.mouse.up()
  await page.waitForTimeout(250)
}
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.demo.frame())
})
for (const mode of ['inner', 'outer'] as const)
  test(`${mode} waits for failure without double activation`, async ({ page }) => {
    await page
      .getByRole('button', {
        name: mode === 'inner' ? 'Inner waits' : 'Outer waits',
        exact: true,
      })
      .click()
    await drag(page, '#inner', 130, 0)
    const s = await snap(page),
      winner = mode
    expect(s.log).toEqual([`${winner} start`, `${winner} end`])
    expect(s[winner]!.x).toBeCloseTo(130, 0)
    expect(s[mode === 'inner' ? 'outer' : 'inner']!.x).toBe(0)
  })
test('carousel cancels press feedback once without moving the card independently', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Press & carousel', exact: true }).click()
  const b = (await page.locator('#inner').boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.waitForTimeout(250)
  expect((await snap(page)).pressed).toBe(true)
  await page.mouse.move(x + 100, y, { steps: 12 })
  await page.waitForTimeout(350)
  expect((await snap(page)).pressed).toBe(false)
  expect((await snap(page)).log).toEqual(['carousel start'])
  await page.mouse.up()
  await page.waitForTimeout(250)
  expect((await snap(page)).log).toEqual(['carousel start', 'carousel end'])
})
test('paused and stopped follower publishes zero through a derivative graph', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Paused velocity' }).click()
  await page.getByRole('button', { name: 'Move', exact: true }).click()
  await page.waitForTimeout(350)
  expect(Math.abs((await snap(page)).speed!)).toBeGreaterThan(10)
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const before = await snap(page)
  await page.waitForTimeout(1000)
  expect(await snap(page)).toMatchObject({
    spring: before.spring,
    speed: 0,
    derivative: 0,
  })
  await page.getByRole('button', { name: 'Resume', exact: true }).click()
  await page.waitForTimeout(300)
  expect(Math.abs((await snap(page)).speed!)).toBeGreaterThan(10)
  await page.getByRole('button', { name: 'Stop', exact: true }).click()
  await page.waitForTimeout(500)
  expect(await snap(page)).toMatchObject({ speed: 0, derivative: 0 })
})
test('trusted touch chooses swipe or reorder and commits once', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'Trusted multi-contact injection uses Chromium CDP; other engines run mouse policy checks.',
  )
  const c = await page.context().newCDPSession(page)
  async function contact(hold: boolean) {
    await page.getByRole('button', { name: 'Swipe & reorder', exact: true }).click()
    const b = (await page.locator('#Alpha').boundingBox())!,
      x = b.x + b.width / 2,
      y = b.y + b.height / 2
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [{ x, y, id: 1 }],
    })
    await page.waitForTimeout(hold ? 500 : 40)
    for (let i = 1; i <= 12; i++) {
      await c.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [
          {
            x: x + ((hold ? 0 : 140) * i) / 12,
            y: y + ((hold ? 180 : 0) * i) / 12,
            id: 1,
          },
        ],
      })
      await page.waitForTimeout(25)
    }
    await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(600)
  }
  await contact(false)
  expect((await snap(page)).log).toEqual(['swipe start', 'swipe end'])
  expect((await snap(page)).order[0]).toBe('Alpha')
  await contact(true)
  expect((await snap(page)).log).toEqual(['reorder start', 'reorder commit'])
  expect((await snap(page)).order[0]).toBe('Bravo')
})
test('photo at minimum yields to sheet while pinch retains ownership', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Trusted pinch uses Chromium CDP.')
  await page.getByRole('button', { name: 'Photo & sheet', exact: true }).click()
  await expect.poll(async () => (await snap(page)).height).toBeGreaterThan(395)
  await drag(page, '#photo', 0, 90)
  await expect.poll(async () => (await snap(page)).height).toBeLessThan(190)
  await page.getByRole('button', { name: 'Photo & sheet', exact: true }).click()
  await expect.poll(async () => (await snap(page)).height).toBeGreaterThan(395)
  const b = (await page.locator('#photo').boundingBox())!,
    x = b.x + b.width / 2,
    y = b.y + b.height / 2,
    c = await page.context().newCDPSession(page)
  await c.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: x - 45, y, id: 1 },
      { x: x + 45, y, id: 2 },
    ],
  })
  for (let i = 1; i <= 12; i++) {
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: x - 45 - i * 5, y: y + 20, id: 1 },
        { x: x + 45 + i * 5, y: y + 20, id: 2 },
      ],
    })
    await page.waitForTimeout(35)
  }
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(600)
  expect((await snap(page)).photo!.scale).toBeGreaterThan(1.6)
  expect((await snap(page)).height).toBeGreaterThan(395)
})
