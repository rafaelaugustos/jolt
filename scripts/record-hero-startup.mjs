import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5181'
const root = resolve(import.meta.dirname, '..')
const output = '/tmp/jolt-hero-startup-recording'
await mkdir(output, { recursive: true })
await mkdir(resolve(root, '.local/media'), { recursive: true })
const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
  reducedMotion: 'no-preference',
  recordVideo: { dir: output, size: { width: 1440, height: 1000 } },
})
const page = await context.newPage()
const video = page.video()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
await page.route(/\/MotionHome\.[^/]+\.js(?:\?|$)/, async (route) => {
  await new Promise((resolve) => setTimeout(resolve, 2000))
  await route.continue()
})
await page.goto(base, { waitUntil: 'domcontentloaded' })
await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'pending')
await expect(page.locator('.sculpture-fallback')).not.toBeVisible()
await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'webgl')
await page.waitForTimeout(1800)
await page.locator('.sculpture-input').click()
await page.waitForTimeout(1800)
const bounds = await page.locator('.sculpture-input').boundingBox()
const x = bounds.x + bounds.width * 0.6
const y = bounds.y + bounds.height * 0.6
await page.mouse.move(x, y)
await page.mouse.down()
await page.mouse.move(x + 110, y + 20, { steps: 20 })
await page.mouse.up()
await page.waitForTimeout(2200)
await page.reload({ waitUntil: 'domcontentloaded' })
await expect(page.locator('.sculpture-fallback')).not.toBeVisible()
await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'webgl')
await page.waitForTimeout(1800)
await page.emulateMedia({ reducedMotion: 'reduce' })
await page.reload({ waitUntil: 'domcontentloaded' })
await expect(page.locator('.sculpture-fallback')).not.toBeVisible()
await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'webgl')
await page.waitForTimeout(1800)
expect(errors).toEqual([])
await context.close()
const source = await video.path()
await browser.close()
const destination = resolve(root, '.local/media/motion-hero-startup-chromium.mp4')
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
      moduleDelayMilliseconds: 2000,
      input:
        'Actual Playwright pointer clicks and drag; page reload and reduced-motion preference emulation',
      duration: info.format.duration,
      dimensions: [info.streams[0].width, info.streams[0].height],
      decoded: true,
    },
    null,
    2,
  ) + '\n',
)
console.log(`Recorded and decoded ${destination}: ${info.format.duration}s`)
