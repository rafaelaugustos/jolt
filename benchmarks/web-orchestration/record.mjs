import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'
const root = fileURLToPath(new URL('../../', import.meta.url)),
  capture = root + 'benchmarks/web-orchestration/captures'
mkdirSync(capture, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-orchestration/server.mjs'], {
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
  for (const mode of process.argv[2]
    ? [process.argv[2]]
    : ['values', 'decay', 'groups', 'states', 'stroke']) {
    const context = await browser.newContext({
      viewport: { width: 920, height: 800 },
      recordVideo: { dir: capture, size: { width: 920, height: 800 } },
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto(`http://127.0.0.1:4291/?demo=${mode}`)
    await page.waitForTimeout(800)
    const click = async (id, wait = 800) => {
      await page.click('#' + id)
      await page.waitForTimeout(wait)
    }
    if (mode === 'stroke') {
      await click('draw', 800)
      await click('pause', 900)
      await click('seek', 700)
      await click('geometry', 700)
      await click('resume', 500)
      await click('reverse', 1200)
      await click('draw', 2900)
      await click('reverse', 600)
      await click('reduced', 900)
    } else if (mode === 'values') {
      await click('play', 600)
      await click('layer', 500)
      await click('pause', 1000)
      await click('seek', 700)
      await click('resume', 1300)
      await click('stop-layer', 800)
      await click('play', 900)
      await click('replace', 2000)
    } else if (mode === 'decay') {
      const box = await page.locator('#card').boundingBox(),
        x = box.x + box.width / 2,
        y = box.y + box.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.waitForTimeout(350)
      for (let step = 1; step <= 12; step++) {
        await page.mouse.move(x + step * 18, y)
        await page.waitForTimeout(22)
      }
      await page.mouse.up()
      await page.waitForTimeout(1900)
      await click('left', 350)
      await click('pause', 900)
      await click('resume', 1800)
      await click('right', 300)
      await click('stop', 800)
    } else if (mode === 'groups') {
      await click('timeline', 600)
      await click('pause', 1900)
      await click('resume', 3300)
      await click('sequence', 3900)
      await click('timeline', 400)
      await click('stop', 1800)
    } else {
      await click('work', 600)
      await click('error', 2600)
      await click('work', 600)
      await click('pause', 700)
      await click('replace', 1000)
      await click('resume', 2600)
      await click('done', 2500)
    }
    await page.screenshot({ path: `${capture}/${mode}-final.png` })
    const raw = await page.video().path()
    await context.close()
    assert.deepEqual(errors, [])
    const output = `${root}docs/public/media/web-orchestration-${mode}-chromium.mp4`
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
