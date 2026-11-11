import { expect, test, type Page } from '@playwright/test'
import type {} from './fixture.js'

const box = async (page: Page, selector: string) =>
  (await page.locator(selector).boundingBox())!
const frame = (page: Page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(0))))
const moves = (page: Page) => page.evaluate(() => window.depth.board!.moves.length)

/** Presses the grip and returns a mover that places the card's center by pointer. */
async function grab(page: Page) {
  const grip = await box(page, '#grip'),
    card = await box(page, '#card')
  const pointer = { x: grip.x + grip.width / 2, y: grip.y + grip.height / 2 }
  const offset = {
    x: card.x + card.width / 2 - pointer.x,
    y: card.y + card.height / 2 - pointer.y,
  }
  await page.mouse.move(pointer.x, pointer.y)
  await page.mouse.down()
  return {
    pointer,
    offset,
    async center(x: number, y: number, steps = 12) {
      pointer.x = x - offset.x
      pointer.y = y - offset.y
      await page.mouse.move(pointer.x, pointer.y, { steps })
      await frame(page)
      await frame(page)
    },
    async by(dx: number, dy: number, steps = 8) {
      pointer.x += dx
      pointer.y += dy
      await page.mouse.move(pointer.x, pointer.y, { steps })
      await frame(page)
      await frame(page)
    },
  }
}
/** WebKit delivers whole-pixel pointer coordinates, so allow one CSS pixel. */
async function underPointer(page: Page, drag: Awaited<ReturnType<typeof grab>>) {
  const card = await box(page, '#card')
  const x = card.x + card.width / 2 - drag.pointer.x - drag.offset.x,
    y = card.y + card.height / 2 - drag.pointer.y - drag.offset.y
  expect(Math.abs(x), `horizontal offset ${x}`).toBeLessThanOrEqual(1)
  expect(Math.abs(y), `vertical offset ${y}`).toBeLessThanOrEqual(1)
}

test.beforeEach(async ({ page }) => {
  await page.goto('/?mode=board')
  await page.waitForFunction(() => !!window.depth?.board)
})

test('the grip button starts the drag while the card body keeps its click and scrolling', async ({
  page,
}) => {
  const touch = (selector: string) =>
    page.locator(selector).evaluate((node) => getComputedStyle(node).touchAction)
  expect(await touch('#grip')).toBe('none')
  expect(await touch('#card')).toBe('auto')
  expect(await touch('#notes')).toBe('auto')
  const start = await box(page, '#card')
  await page.locator('#open').click()
  await expect(page.locator('#open')).toHaveText('Open · 1')
  const title = await box(page, '#card strong')
  await page.mouse.move(title.x + 5, title.y + 5)
  await page.mouse.down()
  await page.mouse.move(title.x + 160, title.y + 40, { steps: 10 })
  await page.mouse.up()
  await frame(page)
  expect((await box(page, '#card')).x).toBeCloseTo(start.x, 0)
  expect(await moves(page)).toBe(0)
  const notes = await box(page, '#notes')
  await page.mouse.move(notes.x + notes.width / 2, notes.y + notes.height / 2)
  await page.mouse.wheel(0, 60)
  await expect
    .poll(() => page.locator('#notes').evaluate((node) => node.scrollTop))
    .toBeGreaterThan(0)
  const drag = await grab(page)
  await drag.by(120, 30)
  await underPointer(page, drag)
  expect(await moves(page)).toBeGreaterThan(0)
  await page.mouse.up()
  await expect(page.locator('#open')).toHaveText('Open · 1')
  await page.locator('#grip').focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.locator('#status')).toHaveText('Dropped in done · request')
  await expect(page.locator('#done-cards #card')).toHaveCount(1)
})

test('move reports carry the visual bounds and hovered target, and stop on cancellation', async ({
  page,
}) => {
  const done = await box(page, '#done')
  const drag = await grab(page)
  await drag.center(done.x + done.width / 2, done.y + done.height / 2)
  await expect(page.locator('#done')).toHaveAttribute('data-hover', '')
  const report = await page.evaluate(() => window.depth.board!.moves.at(-1)!)
  const card = await box(page, '#card')
  expect(report.id).toBe('done')
  expect(report.x).toBeCloseTo(card.x, 0)
  expect(report.y).toBeCloseTo(card.y, 0)
  expect(report.width).toBeCloseTo(card.width, 0)
  await expect(page.locator('#done-cards #gap')).toHaveCount(1)
  const count = await moves(page)
  await page.evaluate(() => window.depth.drop.cancel())
  expect(await page.evaluate(() => window.depth.drop.dragging)).toBe(false)
  await expect(page.locator('#gap')).toHaveCount(0)
  const frozen = await box(page, '#card')
  await drag.by(-80, 40)
  await page.mouse.up()
  await frame(page)
  expect(await moves(page)).toBe(count)
  expect((await box(page, '#card')).x).toBeCloseTo(frozen.x, 0)
  await expect(page.locator('#status')).not.toContainText('Dropped')
  await page.locator('#reset').click()
  await page.locator('#pause').click()
  const start = await box(page, '#card')
  const paused = await grab(page)
  await paused.by(100, 0)
  await page.mouse.up()
  expect(await moves(page)).toBe(0)
  expect((await box(page, '#card')).x).toBeCloseTo(start.x, 0)
  expect(await page.evaluate(() => window.depth.drop.request('done'))).toBe(false)
})

test('hit padding accepts a release below a short column and nothing beyond it', async ({
  page,
}) => {
  const done = await box(page, '#done')
  let drag = await grab(page)
  await drag.center(done.x + done.width / 2, done.y + done.height + 80)
  await expect(page.locator('#done')).not.toHaveAttribute('data-hover', '')
  await page.mouse.up()
  await expect(page.locator('#status')).toHaveText('No target · returned')
  await page.locator('#reset').click()
  drag = await grab(page)
  await drag.center(done.x + done.width / 2, done.y + done.height + 40)
  await expect(page.locator('#done')).toHaveAttribute('data-hover', '')
  await page.mouse.up()
  await expect(page.locator('#status')).toHaveText('Dropped in done · drag')
  await expect(page.locator('#done-cards #card')).toHaveCount(1)
  await expect
    .poll(async () => (await box(page, '#card')).y - (await box(page, '#ship')).y)
    .toBeGreaterThan(0)
})

test('reduced motion keeps direct tracking and returns a rejected drop at once', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => window.depth.boot())
  const start = await box(page, '#card'),
    locked = await box(page, '#locked')
  const drag = await grab(page)
  await drag.center(locked.x + locked.width / 2, locked.y + locked.height / 2, 16)
  await underPointer(page, drag)
  await expect(page.locator('#locked')).toHaveAttribute('data-hover', '')
  await page.mouse.up()
  await expect(page.locator('#status')).toHaveText('Rejected by locked · return spring')
  await frame(page)
  await frame(page)
  const end = await box(page, '#card')
  expect(end.x).toBeCloseTo(start.x, 0)
  expect(end.y).toBeCloseTo(start.y, 0)
})

test('the card stays under the pointer when the board changes layout around it', async ({
  page,
}) => {
  const spec = await box(page, '#spec')
  const layout = () =>
    page.locator('#card').evaluate((node) => (node as HTMLElement).offsetTop)
  const top = await layout()
  const drag = await grab(page)
  await drag.by(4, 4)
  await underPointer(page, drag)
  // Moving above Spec's midpoint makes the board insert its gap above both cards.
  await drag.center(spec.x + spec.width / 2, spec.y + 2)
  await expect(page.locator('#todo-cards > :first-child')).toHaveId('gap')
  await frame(page)
  expect(await layout()).toBeGreaterThan(top + 50)
  await underPointer(page, drag)
  await page.evaluate(() => {
    const spacer = document.createElement('div')
    spacer.id = 'spacer'
    spacer.style.height = '40px'
    document.getElementById('todo-cards')!.prepend(spacer)
  })
  await frame(page)
  await underPointer(page, drag)
  await page.evaluate(() => {
    document.getElementById('spacer')!.style.height = '90px'
    window.depth.drop.refresh()
  })
  await frame(page)
  await underPointer(page, drag)
  await drag.by(-30, 10)
  await underPointer(page, drag)
  expect(await page.evaluate(() => window.depth.drop.hovered)).toBe('todo')
  await page.mouse.up()
  await expect(page.locator('#status')).toHaveText('Dropped in todo · drag')
})
