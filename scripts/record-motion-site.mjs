import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5181'
const root = resolve(import.meta.dirname, '..')
const output = '/tmp/jolt-motion-site-recording'
await mkdir(output, { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
  recordVideo: { dir: output, size: { width: 1440, height: 1000 } },
  permissions: ['clipboard-read', 'clipboard-write'],
})
const page = await context.newPage()
const video = page.video()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
await context.addInitScript(() => {
  // Fixture only the unchanged community listing; no cross-origin request to
  // cancel while the visual review navigates between pages.
  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const url = input instanceof Request ? input.url : String(input)
    if (
      /^https:\/\/manager\.getcortexlabs\.com\/api\/v1\/public\/forms\/[^/]+\/entries(?:\?|$)/.test(
        url,
      ) &&
      (init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'GET'
    )
      return Promise.resolve(
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      )
    return originalFetch(input, init)
  }
})
await page.goto(base)
await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
await page.waitForTimeout(1400)
await page.mouse.move(1100, 390, { steps: 30 })
await page.locator('.sculpture-turn').click()
await page.waitForTimeout(1700)
await page.mouse.move(920, 480, { steps: 25 })
await page.waitForTimeout(1000)
await page.mouse.move(1100, 340)
await page.mouse.down()
await page.mouse.move(1240, 365, { steps: 22 })
await page.mouse.up()
await page.waitForTimeout(2100)
await page.mouse.wheel(0, 820)
await page.waitForTimeout(1000)
await page.locator('.morrow-phone').scrollIntoViewIfNeeded()
await page.locator('.morrow-phone video').evaluate(async (video) => {
  video.muted = true
  video.currentTime = 16
  await video.play()
})
await page.waitForTimeout(6000)
await page.locator('.morrow-phone video').evaluate((video) => video.pause())
await page.locator('.recipe-card').first().hover()
await page.waitForTimeout(4500)
await page.locator('#playground').scrollIntoViewIfNeeded()
await page.waitForTimeout(800)
await page.locator('.replay-button').click()
await page.waitForTimeout(260)
await page.locator('.replay-button').click()
await page.waitForTimeout(1100)
await page.locator('#bounce').focus()
await page.keyboard.press('ArrowRight')
await page.keyboard.press('ArrowRight')
await page.keyboard.press('ArrowRight')
await page.waitForTimeout(1300)
await page.locator('.lab-tabs button').filter({ hasText: 'Stagger' }).click()
await page.locator('.replay-button').click()
await page.waitForTimeout(1400)
await page.locator('.lab-tabs button').filter({ hasText: 'Drag & snap' }).click()
const box = await page.locator('.lab-tile').boundingBox()
await page.mouse.move(box.x + 39, box.y + 39)
await page.mouse.down()
await page.mouse.move(box.x + 139, box.y - 5, { steps: 24 })
await page.waitForTimeout(450)
await page.mouse.up()
await page.waitForTimeout(1500)
await page.locator('#performance').scrollIntoViewIfNeeded()
await page.waitForTimeout(1700)
await page.locator('[data-metric="memory"]').click()
await page.waitForTimeout(1700)
await page.locator('[data-metric="presentation"]').click()
await page.waitForTimeout(1700)
await page.locator('[data-metric="cpu"]').click()
await page.waitForTimeout(1200)
await page.locator('#jolt-drive').scrollIntoViewIfNeeded()
await page.locator('#jolt-drive video').evaluate(async (video) => {
  video.muted = true
  await video.play()
})
await page.waitForTimeout(9500)
await page.locator('#jolt-drive a[href$="showcase#jolt-drive"]').click()
await expect(page.locator('#jolt-drive')).toHaveText('Jolt Drive.')
await page.waitForTimeout(1700)
await page.locator('.drive-screens').scrollIntoViewIfNeeded()
await page.waitForTimeout(2200)
await page.goto(`${base}/guide/showcase#morrow`)
await expect(page.locator('[data-showcase-ready="true"]')).toBeVisible()
await page.locator('[data-watch="morrow"]').click()
await page.waitForTimeout(3500)
await page.mouse.wheel(0, 240)
await page.waitForTimeout(1300)
await page.goto(`${base}/guide/frameworks`)
await expect(page.locator('[data-doc-motion-ready="true"]')).toBeVisible()
await page.waitForTimeout(4000)
await page.locator('.VPSwitchAppearance').first().click()
await page.waitForTimeout(2500)
await page.locator('.VPSwitchAppearance').first().click()
await page.mouse.wheel(0, 560)
await page.waitForTimeout(1800)
await page.goto(`${base}/guide/api`)
await expect(page.locator('[data-doc-motion-ready="true"]')).toBeVisible()
await page.waitForTimeout(1800)
await page.goto(base)
await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
await page.locator('.site-footer').scrollIntoViewIfNeeded()
await page.waitForTimeout(2000)
await page.locator('.footer-top-link').click()

await page.waitForTimeout(1000)
await page.locator('.motion-nav-links a').first().click()
await expect(page.locator('.recipe-card')).toHaveCount(18)
await page.waitForTimeout(900)
await page.getByRole('button', { name: 'Touch & gestures', exact: true }).click()
await page.waitForTimeout(1100)
await page.getByRole('button', { name: 'All motion', exact: true }).click()
await page.getByRole('searchbox').pressSequentially('spring', { delay: 180 })
await page.waitForTimeout(900)
await page.locator('a.recipe-card[href="/recipes/spring-feeling"]').click()
await expect(page.locator('.recipe-full-screen video')).toBeVisible()
// Use the browser's real video controls through the element's play API.
await page.locator('.recipe-full-screen video').evaluate(async (video) => {
  video.muted = true
  await video.play()
})
await page.waitForTimeout(4500)
await page.getByRole('button', { name: /Copy code/ }).click()
await page.waitForTimeout(700)
await page.getByRole('button', { name: /Copy AI prompt/ }).click()
await page.waitForTimeout(1000)
await page.getByRole('button', { name: /Read the prompt/ }).click()
await page.waitForTimeout(1600)
await page.goto(`${base}/recipes/?q=Jolt%20Drive`)
await expect(page.locator('.recipe-card')).toHaveCount(4)
await page.waitForTimeout(1800)
await page.locator('a.recipe-card[href="/recipes/drive-cockpit"]').click()
await page.locator('.recipe-full-screen video').evaluate(async (video) => {
  video.muted = true
  await video.play()
})
await page.waitForTimeout(6000)
await page.locator('.code-topline button').click()
await page.getByRole('button', { name: /Copy AI prompt/ }).click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: /Read the prompt/ }).click()
await page.locator('.prompt-preview').scrollIntoViewIfNeeded()
await page.waitForTimeout(1600)
await page.screenshot({ path: `${output}/recipe-recording-end.png` })
await context.close()
const source = await video.path()
await browser.close()
if (errors.length) throw new Error(errors.join('\n'))
const destination = resolve(root, 'docs/public/media/motion-site-chromium.mp4')
execFileSync('ffmpeg', [
  '-v',
  'error',
  '-i',
  source,
  '-c:v',
  'libx264',
  '-preset',
  'slow',
  '-crf',
  '23',
  '-pix_fmt',
  'yuv420p',
  '-movflags',
  '+faststart',
  '-an',
  '-y',
  destination,
])
execFileSync('ffmpeg', ['-v', 'error', '-i', destination, '-f', 'null', '-'])
const info = JSON.parse(
  execFileSync(
    'ffprobe',
    ['-v', 'quiet', '-show_streams', '-show_format', '-of', 'json', destination],
    { encoding: 'utf8' },
  ),
)
await writeFile(
  `${output}/capture.json`,
  JSON.stringify(
    {
      source,
      destination,
      browser: 'Chromium',
      platform: 'macOS arm64',
      language: 'English',
      originalTiming: true,
      input: 'Actual Playwright pointer and keyboard input',
      nativeFootage:
        'Labeled iOS simulator recipe videos, creator-supplied Morrow iOS footage and the published Jolt Drive entrance played inside the website',
      duration: info.format.duration,
      dimensions: [info.streams[0].width, info.streams[0].height],
      decoded: true,
    },
    null,
    2,
  ),
)
console.log(`Recorded and decoded ${destination}: ${info.format.duration}s`)
