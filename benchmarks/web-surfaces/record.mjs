// Real Chromium playback and pointer input; encoding preserves the capture clock.
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const output = resolve(process.argv[2] ?? 'benchmarks/web-surfaces/captures')
mkdirSync(output, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-surfaces/server.mjs'], {
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
const records = []
try {
  await new Promise((yes, no) => {
    server.stdout.once('data', yes)
    server.once('exit', (code) => no(new Error(`Fixture exited ${code}`)))
  })
  browser = await chromium.launch()
  for (const mode of ['particles', 'confetti', 'blur', 'shape', 'liquid', 'image']) {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 920 },
      recordVideo: { dir: output, size: { width: 1000, height: 920 } },
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto('http://127.0.0.1:4298')
    await page.evaluate(() => window.ready)
    await page.locator(`[data-mode="${mode}"]`).click()
    await page.waitForTimeout(1000)
    await page.locator('#action').click()
    await page.waitForTimeout(mode === 'confetti' ? 450 : 700)
    await page.locator('#pause').click()
    await page.waitForTimeout(700)
    await page.locator('#play').click()
    await page.waitForTimeout(1800)
    await page.locator('#reverse').click()
    await page.waitForTimeout(mode === 'image' ? 2800 : 1600)
    if (mode === 'image') {
      await page.locator('#reverse').click()
      const rect = await page.locator('#photo').boundingBox()
      await page.mouse.move(rect.x + 130, rect.y + 110)
      await page.mouse.down()
      await page.mouse.move(rect.x + 190, rect.y + 145, { steps: 18 })
      await page.waitForTimeout(900)
      await page.mouse.up()
      await page.waitForTimeout(2200)
    }
    if (mode === 'particles' || mode === 'confetti') {
      await page.locator('#inside').click()
      await page.waitForTimeout(500)
    }
    await page.screenshot({ path: `${output}/web-${mode}.png` })
    await page.locator('#reduced').click()
    await page.locator('#action').click()
    await page.waitForTimeout(1100)
    await page.locator('#dispose').click()
    await page.waitForTimeout(1000)
    const video = page.video()
    await context.close()
    if (errors.length) throw new Error(errors.join('\n'))
    const name = `web-${mode}-surfaces-chromium.mp4`
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-ss',
      '0.5',
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
      `${output}/${name}`,
    ])
    execFileSync('ffmpeg', ['-v', 'error', '-i', `${output}/${name}`, '-f', 'null', '-'])
    records.push({
      name,
      browser: browser.version(),
      language: 'en',
      source: await video.path(),
      timing: 'real time',
      errors,
    })
    console.log(`Recorded and decoded ${name}`)
  }
  writeFileSync(`${output}/recordings.json`, JSON.stringify(records, null, 2) + '\n')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
