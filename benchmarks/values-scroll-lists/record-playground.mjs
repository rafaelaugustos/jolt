import { chromium, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
const output = process.argv[2]
if (!output) throw Error('Pass an output directory')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  recordVideo: { dir: output, size: { width: 1440, height: 1000 } },
})
const page = await context.newPage(),
  errors = []
page.on('pageerror', (error) => errors.push(String(error)))
try {
  await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
  await page.goto((process.env.JOLT_SITE_URL ?? 'http://127.0.0.1:5189') + '/#playground')
  await expect(page.locator('#playground')).toHaveAttribute('data-motion-ready', 'true')
  await page.locator('[data-experiment="list-changes"]').click()
  const demo = page.locator('[data-demo="list-changes"]')
  await demo.locator('.lab-stage').scrollIntoViewIfNeeded()
  await expect(demo).toHaveAttribute('data-demo-ready', 'true')
  const list = demo.locator('.lab-scroll-window')
  await list.hover()
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(600)
  const first = await list.evaluate((node) => {
    const top = node.getBoundingClientRect().top
    const row = [...node.children].find((row) => row.getBoundingClientRect().bottom > top)
    return { key: row.getAttribute('data-key'), top: row.getBoundingClientRect().top }
  })
  await demo.locator('[data-action="insert"]').click()
  await page.waitForTimeout(800)
  expect(
    await list
      .locator(`[data-key="${first.key}"]`)
      .evaluate((node) => node.getBoundingClientRect().top),
  ).toBeCloseTo(first.top, 0)
  await demo.locator('.replay-button').click()
  await page.waitForTimeout(800)
  await demo.locator('[data-action="reverse"]').click()
  await page.waitForTimeout(900)
  await demo.locator('[data-action="reset"]').click()
  await page.waitForTimeout(900)
  await list.hover()
  await page.mouse.wheel(0, -200)
  await page.waitForTimeout(600)
  await demo.locator('.replay-button').click()
  await page.waitForTimeout(150)
  await demo.locator('[data-action="insert"]').click()
  await page.waitForTimeout(900)
  await expect(demo).toHaveAttribute('data-demo-error', 'false')
  if (errors.length) throw Error(errors.join('\n'))
  const video = page.video()
  await context.close()
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-i',
    await video.path(),
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    output + '/list-changes-playground-web.mp4',
  ])
  console.log('Playground keyed-list interaction and anchor passed')
} finally {
  await browser.close()
}
