import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url)),
  capture = root + 'benchmarks/web-attachment/captures'
mkdirSync(capture, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-attachment/server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve)
  server.once('exit', (code) => reject(new Error(`Server exited ${code}`)))
})
const browser = await chromium.launch(),
  report = { browser: browser.version(), platform: process.platform, recordings: [] }
try {
  for (const mode of process.argv[2] ? [process.argv[2]] : ['items', 'horizontal']) {
    const context = await browser.newContext({
      viewport: { width: 920, height: 800 },
      recordVideo: { dir: capture, size: { width: 920, height: 800 } },
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`http://127.0.0.1:4293/?demo=${mode}`)
    await page.waitForTimeout(800)
    const click = async (id, wait = 800) => {
      await page.click('#' + id)
      await page.waitForTimeout(wait)
    }
    if (mode === 'items') {
      await click('recycle', 1100)
      await page.locator('.card').first().click()
      await page.waitForTimeout(600)
      await click('append', 1100)
      await click('reorder', 1000)
      await click('forget', 1100)
      await click('recycle', 1200)
    } else {
      await page.locator('#rail').hover()
      await page.mouse.wheel(500, 0)
      await page.waitForTimeout(1100)
      await page.mouse.wheel(500, 0)
      await page.waitForTimeout(1100)
      await page.mouse.wheel(-450, 0)
      await page.waitForTimeout(1000)
      await click('rtl', 800)
      await page.locator('#rail').hover()
      await page.mouse.wheel(-500, 0)
      await page.waitForTimeout(1100)
      await page.mouse.wheel(-500, 0)
      await page.waitForTimeout(1100)
      await click('reset', 1000)
    }
    await page.screenshot({ path: `${capture}/${mode}-final.png` })
    const raw = await page.video().path()
    await context.close()
    assert.deepEqual(errors, [])
    const output = `${root}docs/public/media/web-attachment-${mode}-chromium.mp4`
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      raw,
      '-vf',
      'fps=30,scale=920:-2',
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
          'format=duration,size',
          '-show_entries',
          'stream=codec_name,width,height',
          '-of',
          'json',
          output,
        ],
        { encoding: 'utf8' },
      ),
    )
    report.recordings.push({ mode, output: output.replace(root, ''), ...info })
    console.log(`Recorded ${mode}`)
  }
  writeFileSync(
    capture + (process.argv[2] ? '/report-' + process.argv[2] + '.json' : '/report.json'),
    JSON.stringify(report, null, 2) + '\n',
  )
} finally {
  await browser.close()
  server.kill('SIGTERM')
}
