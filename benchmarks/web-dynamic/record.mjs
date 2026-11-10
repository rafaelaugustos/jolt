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
const server = spawn(process.execPath, ['benchmarks/web-dynamic/server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
try {
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (data) => {
      if (String(data).includes('4285')) resolve()
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
  await page.goto('http://127.0.0.1:4285')
  await page.waitForTimeout(600)
  const stage = await page.locator('#follow-stage').boundingBox()
  await page.mouse.move(stage.x + 65, stage.y + 95)
  await page.mouse.move(stage.x + 310, stage.y + 165, { steps: 36 })
  await page.waitForTimeout(400)
  await page.mouse.move(stage.x + 95, stage.y + 60, { steps: 30 })
  await page.waitForTimeout(700)
  await page.click('#retarget')
  await page.waitForTimeout(180)
  await page.click('#retarget')
  await page.waitForTimeout(750)
  await page.click('#enter')
  await page.waitForTimeout(250)
  let card = await page.locator('#card').boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
  await page.mouse.down()
  await page.waitForTimeout(450)
  await page.keyboard.press('g')
  await page.waitForTimeout(650)
  await page.mouse.move(card.x + card.width / 2 + 95, card.y + card.height / 2 + 42, {
    steps: 22,
  })
  await page.waitForTimeout(200)
  await page.mouse.up()
  await page.waitForTimeout(120)
  card = await page.locator('#card').boundingBox()
  await page.mouse.move(card.x + card.width / 2, card.y + card.height / 2)
  await page.mouse.down()
  await page.mouse.move(card.x + card.width / 2 - 190, card.y + card.height / 2 - 45, {
    steps: 30,
  })
  await page.mouse.up()
  await page.waitForTimeout(1100)
  await page.click('#remove')
  await page.waitForTimeout(600)
  await page.click('#remove')
  await page.waitForTimeout(600)
  await page.click('#pause')
  await page.click('#retarget')
  await page.waitForTimeout(600)
  await page.click('#pause')
  await page.waitForTimeout(800)
  await page.click('#reduce')
  await page.click('#retarget')
  await page.waitForTimeout(750)
  await page.screenshot({ path: dir + 'final.png' })
  assert.deepEqual(errors, [])
  const video = page.video()
  await context.close()
  const raw = dir + 'web-dynamic-chromium.webm'
  await video.saveAs(raw)
  const output = root + '.local/media/web-dynamic-chromium.mp4'
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
    ['scheduler.ts', 'value.ts', 'spring-value.ts', 'drag.ts', 'runtime.ts'].map(
      (file) => [
        file,
        createHash('sha256')
          .update(readFileSync(root + 'src/web/' + file))
          .digest('hex'),
      ],
    ),
  )
  writeFileSync(
    root + 'benchmarks/web-dynamic/recording.json',
    JSON.stringify(
      {
        recordedAt: new Date().toISOString(),
        browser: browser.version(),
        viewport: { width: 1020, height: 640 },
        actions: [
          'pointer follower',
          'rapid target reversal',
          'entrance',
          'held press + G retarget',
          'drag snap',
          'catch snap',
          'remove/mount',
          'pause/resume',
          'reduced motion',
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
