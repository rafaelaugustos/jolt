// Real browser interaction, original timing. No synthetic sensor/haptic inputs in footage.
import { chromium } from '@playwright/test'
import { spawn, execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
const output = resolve(process.argv[2] ?? 'benchmarks/web-parity/captures')
mkdirSync(output, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-parity/server.mjs'], {
  stdio: ['ignore', 'pipe', 'inherit'],
})
let browser
const records = existsSync(`${output}/recordings.json`)
  ? JSON.parse(readFileSync(`${output}/recordings.json`, 'utf8'))
  : []
try {
  await new Promise((yes, no) => {
    server.stdout.once('data', yes)
    server.once('exit', (code) => no(Error(`Fixture exited ${code}`)))
  })
  browser = await chromium.launch()
  for (const mode of process.argv.slice(3).length
    ? process.argv.slice(3)
    : ['gravity', 'haptics', 'sensors', 'glass', 'navigation', 'gallery']) {
    const context = await browser.newContext({
        viewport: { width: 1000, height: 960 },
        recordVideo: { dir: output, size: { width: 1000, height: 960 } },
      }),
      page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('http://127.0.0.1:4301')
    await page.locator(`[data-mode="${mode}"]`).click()
    await page.waitForTimeout(900)
    const drag = async (selector, dx, dy, edge = false) => {
      const r = await page.locator(selector).boundingBox(),
        x = r.x + (edge ? 8 : r.width / 2),
        y = r.y + r.height / 2
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(x + dx, y + dy, { steps: 30 })
      await page.waitForTimeout(180)
      await page.mouse.up()
      await page.waitForTimeout(1200)
    }
    if (mode === 'gravity') {
      await page.locator('#action').click()
      await page.waitForTimeout(280)
      await page.locator('#pause').click()
      await page.waitForTimeout(1000)
      await page.locator('#play').click()
      await page.waitForTimeout(1400)
      await page.locator('#reverse').click()
      await page.waitForTimeout(350)
      await page.locator('#reverse').click()
      await page.waitForTimeout(2300)
    } else if (mode === 'haptics') {
      await page.locator('#impact').click()
      await page.waitForTimeout(1100)
      await page.locator('#reverse').click()
      await page.waitForTimeout(1000)
      await page.locator('#action').click()
      await page.waitForTimeout(250)
      await page.locator('#pause').click()
      await page.waitForTimeout(900)
      await page.locator('#play').click()
      await page.waitForTimeout(1200)
    } else if (mode === 'sensors') {
      await page.locator('#action').click()
      await page.waitForTimeout(2600)
      await page.locator('#pause').click()
      await page.waitForTimeout(1100)
      await page.locator('#play').click()
      await page.waitForTimeout(2300)
      await page.locator('#reverse').click()
      await page.waitForTimeout(1000)
    } else if (mode === 'glass') {
      await page.locator('#reverse').click()
      await page.waitForTimeout(1300)
      await page.locator('#action').click()
      await page.waitForTimeout(400)
      await page.locator('#pause').click()
      await page.waitForTimeout(900)
      await page.locator('#play').click()
      await page.waitForTimeout(1300)
      await page.locator('#inside').click()
      await page.waitForTimeout(1200)
    } else if (mode === 'navigation') {
      await drag('#route', 90, 0, true)
      await drag('#route', 380, 0, true)
      await page.waitForTimeout(900)
    } else {
      await page.locator('#action').click()
      await page.waitForTimeout(1100)
      await page.locator('#photo').dblclick()
      await page.waitForTimeout(1000)
      await drag('#viewport', -75, 0)
      await page.locator('#photo').dblclick()
      await page.waitForTimeout(1000)
      await drag('#viewport', 0, 28)
      await drag('#viewport', 0, 140)
      await page.waitForTimeout(900)
      await page.locator('#list').hover()
      await page.mouse.wheel(0, 1000)
      await page.waitForTimeout(700)
      await page.locator('#rows .thumb').first().click()
      await page.waitForTimeout(1100)
      await page.locator('#reverse').click()
      await page.waitForTimeout(900)
      await page.locator('#back').click()
      await page.waitForTimeout(1000)
    }
    await page.locator('#dispose').click()
    await page.waitForTimeout(900)
    const video = page.video()
    await context.close()
    if (errors.length) throw Error(errors.join('\n'))
    const name = `web-${mode}-parity-chromium.mp4`
    execFileSync('ffmpeg', [
      '-y',
      '-v',
      'error',
      '-ss',
      '0.5',
      '-i',
      await video.path(),
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
      `${output}/${name}`,
    ])
    execFileSync('ffmpeg', ['-v', 'error', '-i', `${output}/${name}`, '-f', 'null', '-'])
    const prior = records.findIndex((record) => record.name === name)
    if (prior >= 0) records.splice(prior, 1)
    records.push({
      name,
      browser: browser.version(),
      language: 'en',
      timing: 'original',
      source: await video.path(),
      errors,
    })
    console.log(`Recorded and decoded ${name}`)
  }
  writeFileSync(`${output}/recordings.json`, JSON.stringify(records, null, 2) + '\n')
} finally {
  await browser?.close()
  server.kill('SIGTERM')
}
