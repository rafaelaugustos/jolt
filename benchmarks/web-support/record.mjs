import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'
const root = fileURLToPath(new URL('../../', import.meta.url)),
  dir = fileURLToPath(new URL('./captures/', import.meta.url))
mkdirSync(dir, { recursive: true })
mkdirSync(`${root}.local/media`, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-support/server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => {
      if (String(data).includes('4286')) resolve()
    })
    server.on('error', reject)
    server.on('exit', (code) => reject(new Error('Server exited: ' + code)))
  })
  browser = await chromium.launch()
  const context = await browser.newContext({
    viewport: { width: 1020, height: 640 },
    recordVideo: { dir, size: { width: 1020, height: 640 } },
  })
  const page = await context.newPage(),
    errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto('http://127.0.0.1:4286')
  await page.waitForTimeout(600)
  await page.locator('#progress').focus()
  await page.keyboard.press('End')
  await page.waitForTimeout(700)
  await page.keyboard.press('Home')
  await page.waitForTimeout(700)
  await page.click('#retarget')
  await page.waitForTimeout(500)
  await page.locator('#mapped').focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(800)
  await page.keyboard.up('Space')
  await page.waitForTimeout(400)
  await page.click('#resize')
  await page.waitForTimeout(650)
  await page.click('#retarget')
  await page.waitForTimeout(750)
  await page.locator('#mapped').focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(700)
  await page.keyboard.up('Space')
  await page.waitForTimeout(450)
  await page.locator('#scroller').hover()
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(900)
  await page.mouse.wheel(0, 300)
  await page.waitForTimeout(900)
  await page.locator('#scroll-card').focus()
  await page.keyboard.down('Space')
  await page.waitForTimeout(700)
  await page.keyboard.up('Space')
  await page.waitForTimeout(500)
  await page.locator('#scroller').hover()
  await page.mouse.wheel(0, -600)
  await page.waitForTimeout(1000)
  await page.click('#resize')
  await page.waitForTimeout(500)
  await page.click('#cleanup')
  await page.waitForTimeout(800)
  await page.screenshot({ path: dir + 'final.png' })
  assert.deepEqual(errors, [])
  const video = page.video()
  await context.close()
  const raw = dir + 'web-support-chromium.webm'
  await video.saveAs(raw)
  const output = root + '.local/media/web-support-chromium.mp4'
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
  const sourceSHA256 = Object.fromEntries(
    ['scheduler.ts', 'value.ts', 'spring-value.ts', 'scroll.ts', 'runtime.ts'].map(
      (file) => [
        file,
        createHash('sha256')
          .update(readFileSync(root + 'src/web/' + file))
          .digest('hex'),
      ],
    ),
  )
  writeFileSync(
    root + 'benchmarks/web-support/recording.json',
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        browser: browser.version(),
        viewport: { width: 1020, height: 640 },
        actions: [
          'slider endpoints',
          'spring retarget',
          'held keyboard press',
          'responsive label size',
          'wheel scroll down',
          'press at scroll endpoint',
          'reverse scroll',
          'dispose',
        ],
        sourceSHA256,
        videoSHA256: createHash('sha256').update(readFileSync(output)).digest('hex'),
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
