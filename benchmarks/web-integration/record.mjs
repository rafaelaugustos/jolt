import { chromium } from '@playwright/test'
import { mkdir, rename } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
const dir = fileURLToPath(new URL('./captures/', import.meta.url))
await mkdir(dir, { recursive: true })
const browser = await chromium.launch(),
  context = await browser.newContext({
    viewport: { width: 920, height: 740 },
    recordVideo: { dir, size: { width: 920, height: 740 } },
  }),
  page = await context.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
await page.goto('http://127.0.0.1:4284')
await page.waitForTimeout(1200)
await page.click('#toggle')
await page.waitForTimeout(250)
await page.click('#toggle')
await page.waitForTimeout(1100)
const box = await page.locator('#card').boundingBox()
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
await page.mouse.down()
await page.waitForTimeout(900)
await page.keyboard.press('g')
await page.waitForTimeout(900)
await page.mouse.up()
await page.waitForTimeout(1000)
await page.click('#replace')
await page.waitForTimeout(1000)
await page.click('#toggle')
await page.waitForTimeout(1100)
await page.click('#toggle')
await page.waitForTimeout(1000)
await page.locator('#card').focus()
await page.keyboard.down('Space')
await page.waitForTimeout(800)
await page.keyboard.up('Space')
await page.waitForTimeout(1000)
await context.close()
await rename(await page.video().path(), dir + 'web-vue-chromium.webm')
await browser.close()
if (errors.length) throw new Error(errors.join('\n'))
console.log(dir + 'web-vue-chromium.webm')
