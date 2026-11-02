import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
const root = fileURLToPath(new URL('../../', import.meta.url)),
  capture = root + 'benchmarks/web-gestures/captures'
mkdirSync(capture, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-gestures/server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve)
  server.once('exit', (code) => reject(new Error(`Fixture exited ${code}`)))
})
const browser = await chromium.launch(),
  report = { browser: browser.version(), platform: process.platform, recordings: [] }
const previous = existsSync(`${capture}/report.json`)
  ? JSON.parse(readFileSync(`${capture}/report.json`, 'utf8')).recordings
  : []
if (process.argv[2])
  report.recordings = previous.filter((record) => record.mode !== process.argv[2])
try {
  for (const mode of process.argv[2]
    ? [process.argv[2]]
    : ['drag', 'gesture', 'scroll', 'zoom', 'header', 'reorder']) {
    const context = await browser.newContext({
      viewport: { width: 940, height: 860 },
      recordVideo: { dir: capture, size: { width: 940, height: 860 } },
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto('http://127.0.0.1:4294')
    await page.click(`[data-mode="${mode}"]`)
    await page.waitForTimeout(700)
    const click = async (id, wait = 650) => {
      await page.click('#' + id)
      await page.waitForTimeout(wait)
    }
    const drag = async (selector, dx, dy, steps = 24, hold = 0) => {
      const box = await page.locator(selector).boundingBox(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      if (hold) await page.waitForTimeout(hold)
      for (let i = 1; i <= steps; i++) {
        await page.mouse.move(x + (dx * i) / steps, y + (dy * i) / steps)
        await page.waitForTimeout(22)
      }
      await page.mouse.up()
      await page.waitForTimeout(1100)
    }
    if (mode === 'drag') {
      await drag('#card', 170, 0)
      await drag('#card', -260, 0)
      await drag('#card', 80, 0)
      await page.click('[data-mode="value"]')
      await page.waitForTimeout(500)
      await drag('#surface', 130, 0)
    } else if (mode === 'gesture') {
      const session = await context.newCDPSession(page),
        box = await page.locator('#surface').boundingBox()
      const p = (id, x, y) => ({
        id,
        x: box.x + x,
        y: box.y + y,
        radiusX: 5,
        radiusY: 5,
        force: 1,
      })
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [p(1, 280, 220), p(2, 480, 220)],
      })
      for (let i = 1; i <= 22; i++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [p(1, 280 - i * 3, 220 - i * 2), p(2, 480 + i * 3, 220 + i * 2)],
        })
        await page.waitForTimeout(30)
      }
      await page.waitForTimeout(350)
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [p(1, 214, 176)],
      })
      for (let i = 1; i <= 15; i++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [p(1, 214 + i * 5, 176 + i * 3)],
        })
        await page.waitForTimeout(25)
      }
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await page.waitForTimeout(650)
      await session.detach()
      await click('reset')
      await drag('#surface', 90, -45)
      await page.locator('#surface').dblclick({ position: { x: 80, y: 90 }, delay: 70 })
      await page.waitForTimeout(500)
      await click('reset')
    } else if (mode === 'scroll') {
      const box = await page.locator('#surface').boundingBox(),
        x = box.x + 360,
        start = box.y + 390
      await page.mouse.move(x, start)
      await page.mouse.down()
      for (let i = 1; i <= 28; i++) {
        await page.mouse.move(x, start - i * 10)
        await page.waitForTimeout(28)
      }
      await page.waitForTimeout(450)
      for (let i = 1; i <= 28; i++) {
        await page.mouse.move(x, start - 280 + i * 10)
        await page.waitForTimeout(28)
      }
      await page.mouse.up()
      await page.waitForTimeout(1200)
      await page.locator('#scroll').hover()
      await page.mouse.wheel(0, 350)
      await page.waitForTimeout(800)
      await page.mouse.wheel(0, -350)
      await page.waitForTimeout(800)
    } else if (mode === 'zoom') {
      await page.locator('#surface').dblclick({ position: { x: 540, y: 210 }, delay: 70 })
      await page.waitForTimeout(1100)
      await drag('#surface', 100, 70)
      await click('reset')
      const session = await context.newCDPSession(page),
        box = await page.locator('#surface').boundingBox()
      const p = (id, x, y) => ({
        id,
        x: box.x + x,
        y: box.y + y,
        radiusX: 5,
        radiusY: 5,
        force: 1,
      })
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [p(1, 290, 220), p(2, 470, 220)],
      })
      for (let i = 1; i <= 24; i++) {
        await session.send('Input.dispatchTouchEvent', {
          type: 'touchMove',
          touchPoints: [p(1, 290 - i * 4, 220), p(2, 470 + i * 4, 220)],
        })
        await page.waitForTimeout(28)
      }
      await session.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      })
      await session.detach()
      await page.waitForTimeout(800)
      await click('reset')
      await click('dismiss')
      await click('cancel-dismiss', 1000)
      await page.locator('#surface').focus()
      await page.keyboard.press('+')
      await page.waitForTimeout(800)
      await page.keyboard.press('0')
      await page.waitForTimeout(900)
    } else if (mode === 'header') {
      await click('item', 1000)
      await click('insert', 900)
      await click('top', 1000)
      await drag('#scroll', 0, 125)
      await click('fail', 900)
      await drag('#scroll', 0, 125)
      await click('finish', 900)
      await click('item', 900)
      await click('top', 900)
    } else {
      await drag('[data-key="Alpha"] [data-grip]', 0, 210)
      const grip = page.locator('[data-key="Alpha"] [data-grip]')
      await grip.focus()
      await page.keyboard.press('Space')
      await page.waitForTimeout(400)
      await page.keyboard.press('ArrowUp')
      await page.waitForTimeout(600)
      await page.keyboard.press('Enter')
      await page.waitForTimeout(900)
      const box = await page.locator('[data-key="Bravo"] [data-grip]').boundingBox(),
        list = await page.locator('#list').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2, list.y + list.height - 12, {
        steps: 25,
      })
      await page.waitForTimeout(1300)
      await page.mouse.up()
      await page.waitForTimeout(1200)
      await click('move', 900)
    }
    await page.screenshot({ path: `${capture}/${mode}-final.png` })
    const state = await page.evaluate(() => window.demo.snapshot()),
      raw = await page.video().path()
    await context.close()
    assert.deepEqual(errors, [])
    const output = `${root}docs/public/media/web-gestures-${mode}-chromium.mp4`
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      raw,
      '-vf',
      'fps=30,scale=940:-2',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '25',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      '-an',
      output,
    ])
    execFileSync('ffmpeg', ['-v', 'error', '-i', output, '-f', 'null', '-'])
    const info = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration:stream=codec_name,width,height',
          '-of',
          'json',
          output,
        ],
        { encoding: 'utf8' },
      ),
    )
    report.recordings.push({ mode, output, state, info })
    writeFileSync(`${capture}/report.json`, JSON.stringify(report, null, 2))
    console.log(`Recorded ${mode}: ${info.format.duration}s`)
  }
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
