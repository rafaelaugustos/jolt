import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { arch, platform, release } from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('../../', import.meta.url))
const captures = fileURLToPath(new URL('./captures/', import.meta.url))
mkdirSync(captures, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-press/server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => {
      if (String(data).includes('http://127.0.0.1:4283')) resolve()
    })
    server.once('error', reject)
    server.once('exit', (code) => reject(new Error(`Fixture server exited: ${code}`)))
  })
  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 920, height: 740 },
    recordVideo: { dir: captures, size: { width: 920, height: 740 } },
  })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto('http://127.0.0.1:4283')
  await page.locator('#card').waitFor()
  await page.screenshot({ path: `${captures}/ready.png` })
  await page.waitForTimeout(800)
  const samples = []
  const sample = async (name, expected) => {
    const actual = await page
      .locator('#card')
      .evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)
    assert(Math.abs(actual - expected) < 0.001, `${name}: ${actual} != ${expected}`)
    samples.push({ name, scale: actual })
    await page.screenshot({ path: `${captures}/${name}.png` })
  }
  const hold = async () => {
    const box = await page.locator('#card').boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.waitForTimeout(1000)
  }
  await sample('application', 1.1)
  await hold()
  await sample('pressed', 1.056)
  await page.keyboard.press('g')
  await page.waitForTimeout(1200)
  await sample('retarget-held', 1.152)
  await page.mouse.up()
  await page.waitForTimeout(1200)
  await sample('released', 1.2)
  await page.keyboard.down('Space')
  await page.waitForTimeout(1000)
  await sample('space-held', 1.152)
  await page.keyboard.up('Space')
  await page.waitForTimeout(900)
  await page.keyboard.press('Enter', { delay: 800 })
  await page.waitForTimeout(900)
  await hold()
  await page.mouse.move(40, 40, { steps: 12 })
  await page.mouse.up()
  await page.waitForTimeout(1000)
  await sample('release-outside', 1.2)
  await hold()
  await page.keyboard.press('d')
  await page.waitForTimeout(1000)
  await sample('disposed-held', 1.2)
  await page.mouse.up()
  await page.waitForTimeout(900)
  await page.click('#reset')
  await page.waitForTimeout(800)
  await hold()
  await page.keyboard.press('l')
  await page.waitForTimeout(1000)
  await sample('loading', 1.1)
  await page.mouse.up()
  await page.waitForTimeout(700)
  assert.deepEqual(errors, [])
  const video = page.video()
  await context.close()
  const raw = `${captures}/web-press-chromium.webm`
  await video.saveAs(raw)
  const output = `${root}/docs/public/media/web-press-chromium.mp4`
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      raw,
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      '22',
      '-pix_fmt',
      'yuv420p',
      '-movflags',
      '+faststart',
      output,
    ],
    { stdio: 'pipe' },
  )
  execFileSync('ffmpeg', ['-v', 'error', '-i', output, '-f', 'null', '-'], {
    stdio: 'pipe',
  })
  const files = [
    '../../src/web/runtime.ts',
    '../../src/web/compose.ts',
    '../../src/web/curve.ts',
    '../../src/web/plan.ts',
    '../../src/web/press.ts',
    '../../src/web/public.ts',
    'fixture.ts',
    'index.html',
  ]
  const sourceSHA256 = Object.fromEntries(
    files.map((name) => [
      name,
      createHash('sha256')
        .update(readFileSync(new URL(name, import.meta.url)))
        .digest('hex'),
    ]),
  )
  const metadata = {
    recordedAt: new Date().toISOString(),
    browser: 'Chromium',
    version: browser.version(),
    os: { platform: platform(), release: release(), arch: arch() },
    viewport: { width: 920, height: 740 },
    actions: samples,
    sourceSHA256,
    videoSHA256: createHash('sha256').update(readFileSync(output)).digest('hex'),
    notes:
      'Real Chromium playback with Playwright pointer holds, release outside, Space/Enter and application keyboard actions. Original speed, no generated or interpolated animation. Native behavior is documented with preserved native recordings.',
  }
  writeFileSync(
    new URL('./recording.json', import.meta.url),
    JSON.stringify(metadata, null, 2) + '\n',
  )
  console.log(JSON.stringify({ output, browser: metadata.version, samples }))
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
