import { chromium, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { selectExperiment, exercisePlaygroundInput } from './playground-interactions.mjs'

const base = process.env.JOLT_SITE_URL || 'http://127.0.0.1:5184'
const output = '/tmp/jolt-playground-recording'
const root = resolve(import.meta.dirname, '..')
await mkdir(output, { recursive: true })
await mkdir(resolve(root, '.local/media'), { recursive: true })
const browser = await chromium.launch()
const captures = []
for (const [group, families] of [
  ['motion', ['motion', 'touch', 'layout']],
  ['effects', ['effects', 'type']],
  ['platform', ['navigation', 'device']],
]) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    reducedMotion: 'no-preference',
    recordVideo: { dir: output, size: { width: 1440, height: 1000 } },
  })
  const page = await context.newPage(),
    video = page.video(),
    errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && /\[Jolt/.test(message.text()))
      errors.push(message.text())
  })
  await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
  await page.goto(`${base}/#playground`)
  await page.locator('#playground').scrollIntoViewIfNeeded()
  await page.waitForTimeout(900)
  const ids = []
  for (const family of families) {
    await page.locator(`[data-family=${family}]`).click()
    const list = await page
      .locator('[data-experiment]')
      .evaluateAll((nodes) => nodes.map((node) => node.dataset.experiment))
    for (const id of list) {
      ids.push(id)
      const demo = await selectExperiment(page, id)
      await page.waitForTimeout(400)
      await demo.locator('.replay-button').click()
      await page.waitForTimeout(id.startsWith('sensor-') ? 2600 : 1900)
      if (id === 'modal') {
        await page.locator('.lab-dialog-input').fill('Make something move.')
        await page.waitForTimeout(500)
        await page.keyboard.press('Escape')
      }
      if (id === 'drag' || id === 'inertia' || id === 'gestures' || id === 'physics') {
        const target = page
          .locator(id === 'physics' ? '.lab-physics-ball' : '.lab-tile')
          .first()
        const b = await target.boundingBox()
        await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
        await page.mouse.down()
        await page.mouse.move(b.x + b.width / 2 + 70, b.y + b.height / 2 - 40, {
          steps: 20,
        })
        await page.waitForTimeout(250)
        await page.mouse.up()
        await page.waitForTimeout(900)
      }
      if (id === 'pointer') {
        const b = await page.locator('.lab-stage').boundingBox()
        await page.mouse.move(b.x + 60, b.y + 70, { steps: 20 })
        await page.mouse.move(b.x + b.width - 70, b.y + 200, { steps: 30 })
        await page.waitForTimeout(600)
      }
      if (id === 'press') {
        await page.locator('.lab-tile').focus()
        await page.keyboard.down('Space')
        await page.waitForTimeout(500)
        await page.keyboard.up('Space')
        await page.waitForTimeout(500)
      }
      for (const action of await demo.locator('[data-action]').all()) {
        await action.click()
        await page.waitForTimeout(900)
      }
      const range = demo.locator('input[type=range]')
      if (await range.count()) {
        await range.focus()
        await range.press('End')
        await page.waitForTimeout(700)
        await range.press('Home')
        await page.waitForTimeout(700)
      }
      await expect(demo).toHaveAttribute('data-demo-error', 'false')
    }
  }
  await page.locator('.lab-families button').first().click()
  if (group === 'platform') await exercisePlaygroundInput(page)
  expect(errors).toEqual([])
  await context.close()
  const source = await video.path(),
    destination = resolve(root, `.local/media/web-playground-${group}-chromium.mp4`)
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-i',
    source,
    '-c:v',
    'libx264',
    '-preset',
    'slow',
    '-crf',
    '23',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    '-an',
    '-y',
    destination,
  ])
  execFileSync('ffmpeg', ['-v', 'error', '-i', destination, '-f', 'null', '-'])
  const info = JSON.parse(
    execFileSync(
      'ffprobe',
      ['-v', 'quiet', '-show_format', '-show_streams', '-of', 'json', destination],
      { encoding: 'utf8' },
    ),
  )
  captures.push({
    group,
    ids,
    source,
    destination,
    duration: info.format.duration,
    browser: 'Chromium',
    platform: 'macOS arm64',
    language: 'English',
    originalTiming: true,
    decoded: true,
    limitations:
      'No physical sensor, keyboard occlusion or vibration was fabricated. Desktop support states only.',
  })
  console.log(`${group}: ${ids.length} experiments, ${info.format.duration}s`)
}
await browser.close()
await writeFile(`${output}/capture.json`, JSON.stringify(captures, null, 2))
