import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
const root = resolve(import.meta.dirname, '../..')
const output = resolve(root, '.local/media/collections-web')
mkdirSync(output, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-gestures/server.mjs'], {
  cwd: root,
  stdio: 'ignore',
})
let browser
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4294')).ok) break
    } catch {}
    await new Promise((done) => setTimeout(done, 100))
  }
  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 920, height: 740 },
    recordVideo: { dir: output, size: { width: 920, height: 740 } },
  })
  const page = await context.newPage(),
    errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto('http://127.0.0.1:4294')
  for (const rtl of [false, true]) {
    await page.evaluate((rtl) => {
      window.demo.setup('reorder', { axis: 'x', rtl })
      document.querySelector('h1').textContent =
        `Horizontal reorder · ${rtl ? 'RTL' : 'LTR'}`
      document.querySelector('main > p').textContent =
        'Variable widths · stable keys · reverse edge scrolling · cancel with Escape'
    }, rtl)
    await page.waitForTimeout(1000)
    const drag = async (key, distance) => {
      const grip = await page.locator(`[data-key="${key}"] [data-grip]`).boundingBox()
      await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2)
      await page.mouse.down()
      for (let i = 1; i <= 25; i++) {
        await page.mouse.move(
          grip.x + grip.width / 2 + (distance * i) / 25,
          grip.y + grip.height / 2,
        )
        await page.waitForTimeout(30)
      }
      await page.mouse.up()
      await page.waitForTimeout(1000)
    }
    await drag('Alpha', rtl ? -170 : 170)
    const state = await page.evaluate(() => window.demo.snapshot())
    if (state.order[0] !== 'Bravo') throw new Error('Missing keyed move')
    const grip = await page.locator('[data-key="Bravo"] [data-grip]').boundingBox()
    const list = await page.locator('#list').boundingBox()
    await page.mouse.move(grip.x + 10, grip.y + 10)
    await page.mouse.down()
    await page.mouse.move(rtl ? list.x + 6 : list.x + list.width - 6, grip.y + 10, {
      steps: 24,
    })
    await page.waitForTimeout(1300)
    await page.mouse.move(rtl ? list.x + list.width - 6 : list.x + 6, grip.y + 10, {
      steps: 24,
    })
    await page.waitForTimeout(1300)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await page.waitForTimeout(1000)
  }
  if (errors.length) throw new Error(errors.join('\n'))
  const video = page.video()
  await context.close()
  const target = resolve(root, '.local/media/horizontal-reorder-web.mp4')
  execFileSync('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    await video.path(),
    '-an',
    '-vf',
    'fps=30',
    '-c:v',
    'libx264',
    '-crf',
    '20',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    target,
  ])
  writeFileSync(
    resolve(output, 'acceptance.json'),
    JSON.stringify(
      {
        browser: 'Chromium',
        errors,
        scenarios: ['LTR commit/edge reversal/cancel', 'RTL commit/edge reversal/cancel'],
      },
      null,
      2,
    ),
  )
  console.log(target)
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
