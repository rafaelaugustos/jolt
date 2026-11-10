import assert from 'node:assert/strict'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
const capture = root + 'benchmarks/web-lifecycle/captures'
mkdirSync(capture, { recursive: true })
mkdirSync(`${root}.local/media`, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-lifecycle/server.mjs'], {
  cwd: root,
  env: { ...process.env, JOLT_LIFECYCLE_PORT: '4290' },
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
  for (const mode of [
    'pointer',
    'viewport',
    'scopes',
    'vue',
    'overlay',
    'shared',
    'recipes',
    'diagnostics',
  ]) {
    const context = await browser.newContext({
      viewport: { width: 900, height: 700 },
      recordVideo: { dir: capture, size: { width: 900, height: 700 } },
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (error) => errors.push(String(error)))
    await page.goto(`http://127.0.0.1:4290/?demo=${mode}`)
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
    const drag = async (selector, dx, dy) => {
      const box = await page.locator(selector).boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 3)
      await page.mouse.down()
      await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 3 + dy, {
        steps: 18,
      })
      await page.waitForTimeout(500)
      await page.mouse.up()
      await page.waitForTimeout(1300)
    }
    if (mode === 'pointer') {
      const region = await page.locator('#region').boundingBox()
      for (const [x, y] of [
        [0.8, 0.7],
        [0.2, 0.3],
        [0.5, 0.5],
      ]) {
        await page.mouse.move(region.x + region.width * x, region.y + region.height * y, {
          steps: 20,
        })
        await page.waitForTimeout(900)
      }
      await page.mouse.down()
      await page.waitForTimeout(700)
      await page.mouse.up()
      await page.waitForTimeout(800)
      await click('reduced', 500)
      await page.mouse.move(
        region.x + region.width * 0.8,
        region.y + region.height * 0.7,
        { steps: 20 },
      )
      await page.waitForTimeout(800)
      await click('restore', 400)
      await page.mouse.move(
        region.x + region.width * 0.25,
        region.y + region.height * 0.6,
        { steps: 20 },
      )
      await page.waitForTimeout(1100)
      await click('dispose', 600)
    } else if (mode === 'viewport') {
      await page.locator('#scroller').hover()
      await page.mouse.wheel(0, 350)
      await page.waitForTimeout(1700)
      await page.mouse.wheel(0, -350)
      await page.waitForTimeout(650)
      await page.mouse.wheel(0, 350)
      await page.waitForTimeout(500)
      await click('remove', 900)
      await click('reduced', 600)
      await page.locator('#scroller').hover()
      await page.mouse.wheel(0, -350)
      await page.waitForTimeout(600)
      await page.mouse.wheel(0, 350)
      await page.waitForTimeout(900)
    } else if (mode === 'scopes') {
      await click('retarget')
      await click('retarget', 200)
      await click('remove', 900)
      await click('retarget')
      await click('retarget')
      const box = await page.locator('#target').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      await page.waitForTimeout(800)
      await page.mouse.up()
      await page.waitForTimeout(800)
    } else if (mode === 'vue') {
      await click('vue-retarget')
      await page.click('#vue-card')
      await page.waitForTimeout(900)
      await click('vue-retarget', 150)
      await click('vue-toggle', 700)
      await click('vue-toggle', 800)
      await click('vue-retarget', 300)
      await click('vue-replace', 700)
      await click('vue-retarget')
      await click('unmount', 700)
    } else if (mode === 'overlay') {
      await click('open-overlay', 800)
      await drag('#overlay-sheet', 0, 75)
      await click('overlay-choice', 800)
      await click('open-overlay', 600)
      await drag('#overlay-sheet', 0, 50)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(1000)
    } else if (mode === 'shared') {
      await click('shared-card', 1400)
      await click('shared-back', 1400)
      await click('shared-photo', 1400)
      await click('shared-back', 250)
      await click('shared-back', 1300)
      await click('shared-back', 300)
      await click('shared-cancel', 800)
      await click('shared-missing', 1000)
    } else if (mode === 'recipes') {
      await drag('#recipe-drag', 95, 55)
      await click('recipe-expand', 1000)
      await click('recipe-reorder', 800)
      await click('recipe-expand', 120)
      await click('recipe-expand', 1000)
      await click('recipe-remove', 800)
      await click('reduced', 300)
      await click('recipe-expand', 600)
      await click('dispose', 600)
    } else {
      await click('diagnostic-start', 900)
      await click('diagnostic-replace', 700)
      await click('diagnostic-inspect', 700)
      await click('diagnostic-dispose', 1400)
    }
    await page.screenshot({ path: `${capture}/${mode}-final.png` })
    assert.deepEqual(errors, [])
    const video = page.video()
    await page.close()
    await context.close()
    const raw = await video.path(),
      output = `${root}.local/media/web-lifecycle-${mode}-chromium.mp4`
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
