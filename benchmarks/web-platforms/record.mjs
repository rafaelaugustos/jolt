// Actual Chromium clicks, keys and drags; no synthetic keyboard geometry in recordings.
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const output = resolve(process.argv[2] ?? 'benchmarks/web-platforms/captures')
mkdirSync(output, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-platforms/server.mjs'], {
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
const records = existsSync(`${output}/recordings.json`)
  ? JSON.parse(readFileSync(`${output}/recordings.json`, 'utf8'))
  : []
try {
  await new Promise((yes, no) => {
    server.stdout.once('data', yes)
    server.once('exit', (code) => no(Error(`Fixture exited ${code}`)))
  })
  browser = await chromium.launch()
  for (const mode of process.argv.slice(3).length
    ? process.argv.slice(3)
    : ['keyboard', 'sheet', 'modal', 'navigation', 'physics', 'symbols']) {
    const context = await browser.newContext({
        viewport: { width: 1000, height: 920 },
        recordVideo: { dir: output, size: { width: 1000, height: 920 } },
      }),
      page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('http://127.0.0.1:4299')
    await page.evaluate(() => window.ready)
    await page.locator(`[data-mode="${mode}"]`).click()
    await page.waitForTimeout(800)
    const drag = async (selector, dx, dy) => {
      const r = await page.locator(selector).boundingBox()
      await page.mouse.move(r.x + r.width / 2, r.y + Math.min(r.height / 2, 28))
      await page.mouse.down()
      await page.mouse.move(
        r.x + r.width / 2 + dx,
        r.y + Math.min(r.height / 2, 28) + dy,
        { steps: 30 },
      )
      await page.waitForTimeout(180)
      await page.mouse.up()
      await page.waitForTimeout(1100)
    }
    if (mode === 'keyboard') {
      await page.locator('#message').click()
      await page
        .locator('#message')
        .pressSequentially('Real input; desktop keyboard', { delay: 60 })
      await page.waitForTimeout(1200)
      await page.locator('#reverse').click()
    }
    if (mode === 'sheet') {
      await page.locator('#action').click()
      await page.waitForTimeout(1200)
      await page.locator('#sheet-handle').focus()
      await page.keyboard.press('End')
      await page.waitForTimeout(1200)
      await page.locator('#content').hover()
      await page.mouse.wheel(0, 220)
      await page.waitForTimeout(800)
      await drag('#sheet-handle', 0, 140)
      await page.locator('#reverse').click()
    }
    if (mode === 'modal') {
      await page.locator('#action').click()
      await page.waitForTimeout(1100)
      await page.locator('#modal-input').fill('Dialog input stays interactive')
      await drag('#modal-handle', 0, 25)
      await drag('#modal-handle', 0, 200)
      await page.locator('#action').click()
      await page.waitForTimeout(1200)
      await page.keyboard.press('Escape')
    }
    if (mode === 'navigation') {
      await page.locator('#action').click()
      await page.waitForTimeout(1600)
      await page.locator('#reverse').click()
      await page.waitForTimeout(1600)
    }
    if (mode === 'physics') {
      await drag('#a', 120, 80)
      await page.locator('#action').click()
      await page.waitForTimeout(1400)
      await page.locator('#pause').click()
      await page.waitForTimeout(800)
      await page.locator('#play').click()
      await page.waitForTimeout(1000)
      await page.locator('#reverse').click()
    }
    if (mode === 'symbols') {
      for (let i = 0; i < 3; i++) {
        await page.locator('#action').click()
        await page.waitForTimeout(1200)
      }
      await page.locator('#pause').click()
      await page.waitForTimeout(600)
      await page.locator('#play').click()
      await page.waitForTimeout(800)
      await page.locator('#reverse').click()
    }
    await page.waitForTimeout(1200)
    await page.locator('#dispose').click()
    await page.waitForTimeout(700)
    const video = page.video()
    await context.close()
    if (errors.length) throw Error(errors.join('\n'))
    const name = `web-${mode}-platforms-chromium.mp4`
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
    const previous = records.findIndex((record) => record.name === name)
    if (previous >= 0) records.splice(previous, 1)
    records.push({
      name,
      browser: browser.version(),
      language: 'en',
      timing: 'real time',
      source: await video.path(),
      errors,
    })
    console.log(`Recorded and decoded ${name}`)
  }
  writeFileSync(`${output}/recordings.json`, JSON.stringify(records, null, 2) + '\n')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
