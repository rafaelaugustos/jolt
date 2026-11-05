import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5181'
const root = resolve(import.meta.dirname, '..')
const output = '/tmp/jolt-auralis-site-recording'
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
await expect(page.locator('[data-auralis-ready="true"]')).toBeVisible()
await page.locator('.auralis-feature').scrollIntoViewIfNeeded()
await page.waitForTimeout(1600)
await page.mouse.wheel(0, 110)
await page.waitForTimeout(800)
await page.locator('.auralis-phone video').evaluate(async (video) => {
  video.muted = true
  await video.play()
})
await page.waitForTimeout(19000)
await page.locator('.auralis-primary').click()
await expect(page.locator('#auralis')).toHaveText('Auralis.')
await page.locator('[data-watch="auralis"]').click()
await page.waitForTimeout(2800)
await page.locator('[aria-labelledby="auralis"] a[href*="q=Auralis"]').click()
await expect(page.locator('.recipe-card')).toHaveCount(2)
await page.waitForTimeout(1000)
await page.locator('a[href="/recipes/auralis-cards"]').click()
await expect(page.locator('.recipe-code')).toContainText('entryFlight')
await page.waitForTimeout(1500)
await page.locator('.code-topline button').click()
await page.waitForTimeout(800)
await page.getByRole('button', { name: /Copy AI prompt/ }).click()
await page.waitForTimeout(1000)
await page.goto(`${base}/recipes/auralis-clock`)
await expect(page.locator('.recipe-code')).toContainText('useCarouselClock')
await page.waitForTimeout(1500)
await page.getByRole('button', { name: /Copy AI prompt/ }).click()
await page.waitForTimeout(900)
expect(errors).toEqual([])
await context.close()
const source = await video.path()
await browser.close()
if (errors.length) throw new Error(errors.join('\n'))
const destination = resolve(root, 'docs/public/media/auralis-site-chromium.mp4')
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
      input:
        'Playwright pointer clicks and wheel input; home video started with HTMLMediaElement.play()',
      nativeFootage: 'Creator-provided Auralis iOS recording; capture device unspecified',
      duration: info.format.duration,
      dimensions: [info.streams[0].width, info.streams[0].height],
      decoded: true,
    },
    null,
    2,
  ),
)
console.log(`Recorded and decoded ${destination}: ${info.format.duration}s`)
