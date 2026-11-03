import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
const dir = 'benchmarks/web-support/captures/'
mkdirSync(dir, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-support/server.mjs'], {
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => {
      if (String(data).includes('4286')) resolve()
    })
    server.on('error', reject)
    server.on('exit', (code) => reject(new Error('Server exited ' + code)))
  })
  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1020, height: 760 },
    recordVideo: { dir, size: { width: 1020, height: 760 } },
  })
  const page = await context.newPage(),
    errors = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto('http://127.0.0.1:4286/?element-range')
  await page.waitForTimeout(900)
  await page.locator('#range-source').hover()
  await page.mouse.wheel(0, 400)
  await page.waitForTimeout(1300)
  await page.click('#insert')
  await page.waitForTimeout(1400)
  await page.click('#grow')
  await page.waitForTimeout(1400)
  await page.locator('#range-source').hover()
  await page.mouse.wheel(0, 450)
  await page.waitForTimeout(1300)
  await page.mouse.wheel(0, -850)
  await page.waitForTimeout(1200)
  await page.click('#conflict')
  await page.waitForTimeout(2800)
  assert.match(
    await page.locator('#diagnostic').innerText(),
    /transform-origin.*observeGeometry/,
  )
  await page.click('#observe')
  await page.waitForTimeout(1800)
  assert.deepEqual(errors, [])
  const video = page.video()
  await context.close()
  await video.saveAs(dir + 'web-element-range-chromium.webm')
  const output = 'docs/public/media/web-element-range-chromium.mp4'
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-i',
      dir + 'web-element-range-chromium.webm',
      '-an',
      '-c:v',
      'libx264',
      '-preset',
      'fast',
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
  execFileSync(
    'ffmpeg',
    [
      '-y',
      '-ss',
      '2',
      '-i',
      output,
      '-frames:v',
      '1',
      'docs/public/media/web-element-range-chromium.jpg',
    ],
    { stdio: 'pipe' },
  )
  const hash = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
  writeFileSync(
    'benchmarks/web-support/element-recording.json',
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        browser: browser.version(),
        scope: 'Desktop browser, English UI, actual wheel/click input, original speed',
        actions: [
          'wheel scroll',
          'insert content above anchor',
          'resize anchor',
          'scroll forward/back',
          'show detailed geometry conflict',
          'observe geometry and resize',
        ],
        sources: Object.fromEntries(
          ['runtime', 'scroll', 'scroll-range', 'surface-conflict'].map((f) => [
            f,
            hash('src/web/' + f + '.ts'),
          ]),
        ),
        videoSHA256: hash(output),
      },
      null,
      2,
    ) + '\n',
  )
  console.log(output)
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
