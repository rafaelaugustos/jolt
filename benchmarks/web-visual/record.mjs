import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const capture = root + 'benchmarks/web-visual/captures'
mkdirSync(capture, { recursive: true })
mkdirSync(`${root}.local/media`, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-visual/server.mjs'], {
  cwd: root,
  stdio: ['ignore', 'pipe', 'inherit'],
})
await new Promise((resolve, reject) => {
  server.stdout.once('data', resolve)
  server.once('exit', (code) => reject(new Error(`Server exited: ${code}`)))
})
const browser = await chromium.launch()
const report = {
  browser: browser.version(),
  platform: process.platform,
  architecture: process.arch,
  recordings: [],
}
try {
  for (const mode of ['paint', 'size', 'layout', 'scene']) {
    const context = await browser.newContext({
      viewport: { width: 900, height: 700 },
      recordVideo: { dir: capture, size: { width: 900, height: 700 } },
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto(`http://127.0.0.1:4287/?demo=${mode}`)
    await page.waitForTimeout(900)
    const click = async (id, wait = 1300) => {
      await page.click(`#${id}`)
      await page.waitForTimeout(wait)
    }
    const slider = async (key) => {
      await page.locator('#progress').focus()
      await page.keyboard.press(key)
      await page.waitForTimeout(1000)
    }
    if (mode === 'paint') {
      await click('paint')
      const box = await page.locator('#paint-card').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(850)
      await page.mouse.up()
      await page.waitForTimeout(650)
      await click('paint', 160)
      await click('paint')
      await slider('End')
      await slider('Home')
      await slider('End')
    } else if (mode === 'size') {
      await click('resize', 350)
      await click('pause', 900)
      await click('resume', 1100)
      await click('resize', 300)
      await click('resize', 200)
      await click('content', 1800)
      await click('resize', 1700)
    } else if (mode === 'layout') {
      await click('reorder')
      await click('density', 220)
      await click('reorder')
      await click('insert')
      await click('remove')
      await click('density')
    } else {
      await click('play', 700)
      await click('pause', 800)
      await slider('End')
      await slider('Home')
      await slider('PageUp')
      await slider('PageUp')
      await click('play', 2300)
    }
    await page.screenshot({ path: `${capture}/${mode}-final.png` })
    assert.deepEqual(errors, [])
    const video = page.video()
    await page.close()
    await context.close()
    const raw = await video.path(),
      output = `${root}.local/media/web-${mode}-chromium.mp4`
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      raw,
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
      output,
    ])
    execFileSync('ffmpeg', ['-v', 'error', '-i', output, '-f', 'null', '-'])
    const metadata = JSON.parse(
      execFileSync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'format=duration,size:stream=codec_name,width,height',
          '-of',
          'json',
          output,
        ],
        { encoding: 'utf8' },
      ),
    )
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-i',
      output,
      '-vf',
      `fps=6/${metadata.format.duration},scale=450:-2,tile=3x2`,
      '-frames:v',
      '1',
      `${capture}/${mode}-review.png`,
    ])
    report.recordings.push({ mode, output, ...metadata })
    console.log(mode, metadata)
  }
} finally {
  await browser.close()
  server.kill('SIGTERM')
  writeFileSync(`${capture}/report.json`, JSON.stringify(report, null, 2) + '\n')
}
