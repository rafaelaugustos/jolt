// Actual Chromium playback and pointer input. The MP4 conversion preserves time.
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve(process.argv[2] ?? 'benchmarks/web-effects/captures')
mkdirSync(output, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-effects/server.mjs'], {
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
try {
  await new Promise((yes, no) => {
    server.stdout.once('data', yes)
    server.once('exit', (code) => no(new Error(`Fixture exited: ${code}`)))
  })
  browser = await chromium.launch()
  for (const mode of ['gradient', 'loading', 'reveal', 'text', 'roll']) {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 920 },
      deviceScaleFactor: 1,
      recordVideo: { dir: output, size: { width: 1000, height: 920 } },
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto('http://127.0.0.1:4297')
    await page.locator(`[data-mode="${mode}"]`).click()
    await page.waitForTimeout(1500)
    await page.locator('#action').click()
    await page.waitForTimeout(mode === 'loading' ? 1200 : 450)
    await page.locator('#pause').click()
    await page.waitForTimeout(900)
    await page.locator('#play').click()
    await page.waitForTimeout(1200)
    await page.locator('#reverse').click()
    await page.waitForTimeout(450)
    await page.locator('#action').click()
    await page.waitForTimeout(1700)
    await page.screenshot({ path: `${output}/web-${mode}.png` })
    await page.locator('#reduced').click()
    await page.locator('#reverse').click()
    await page.waitForTimeout(1000)
    await page.locator('#dispose').click()
    await page.waitForTimeout(1000)
    const video = page.video()
    await context.close()
    if (errors.length) throw new Error(errors.join('\n'))
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-ss',
      '1',
      '-i',
      await video.path(),
      '-vf',
      'fps=30',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '24',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      `${output}/web-${mode}-chromium.mp4`,
    ])
    console.log(`Recorded ${mode}`)
  }
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
