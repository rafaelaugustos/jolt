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
mkdirSync(`${root}.local/media`, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-composition/server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => {
      if (String(data).includes('http://127.0.0.1:4280')) resolve()
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
  await page.goto('http://127.0.0.1:4280')
  await page.locator('#card').waitFor()
  await page.screenshot({ path: `${captures}/ready.png` })
  await page.waitForTimeout(600)
  await page.click('#move')
  await page.waitForTimeout(650)
  await page.click('#retarget')
  await page.waitForTimeout(1800)
  for (const id of ['scale', 'hold', 'grow', 'release']) {
    await page.click(`#${id}`)
    await page.waitForTimeout(1800)
    await page.screenshot({ path: `${captures}/${id}.png` })
  }
  const displayed = await page.locator('#card').evaluate((element) => {
    const m = new DOMMatrix(getComputedStyle(element).transform)
    return { scaleX: m.a, scaleY: m.d, x: m.e, y: m.f }
  })
  assert.deepEqual(errors, [])
  assert(
    Math.abs(displayed.scaleX - 1.2) < 0.001 && Math.abs(displayed.scaleY - 1.2) < 0.001,
  )
  const video = page.video()
  await context.close()
  const raw = `${captures}/web-composition-chromium.webm`
  await video.saveAs(raw)
  const output = `${root}/.local/media/web-composition-chromium.mp4`
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
  const files = ['surface.ts', 'fixture.ts', 'index.html']
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
    actions: ['move', 'retarget', 'scale', 'hold', 'grow', 'release'],
    finalPresentation: displayed,
    sourceSHA256,
    videoSHA256: createHash('sha256').update(readFileSync(output)).digest('hex'),
    notes:
      'Real Playwright browser playback and clicks at real-time speed. Buttons apply/release the press contribution; full press input recognition is deferred to #283. No fabricated or interpolated footage.',
  }
  writeFileSync(
    new URL('./recording.json', import.meta.url),
    JSON.stringify(metadata, null, 2) + '\n',
  )
  console.log(
    JSON.stringify({ output, browser: metadata.version, finalPresentation: displayed }),
  )
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
