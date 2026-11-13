import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
const output = process.argv[2]
if (!output) throw Error('Pass an output directory')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch()
async function capture(name, scene, interact) {
  const context = await browser.newContext({
      viewport: { width: 1000, height: 760 },
      recordVideo: { dir: output, size: { width: 1000, height: 760 } },
    }),
    page = await context.newPage(),
    errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.goto('http://127.0.0.1:4341')
  await page.waitForFunction(() => window.lab)
  await page.click(`[data-scene="${scene}"]`)
  await page.waitForTimeout(350)
  await interact(page)
  await page.waitForTimeout(600)
  const video = page.video()
  await context.close()
  const path = await video.path()
  if (errors.length) throw Error(errors.join('\n'))
  execFileSync('ffmpeg', [
    '-y',
    '-v',
    'error',
    '-i',
    path,
    '-an',
    '-c:v',
    'libx264',
    '-crf',
    '22',
    '-pix_fmt',
    'yuv420p',
    '-movflags',
    '+faststart',
    `${output}/${name}.mp4`,
  ])
  console.log(name)
}
try {
  await capture('combined-values-web', 'values', async (p) => {
    await p.click('#combine')
    await p.waitForTimeout(800)
    await p.click('#interrupt-values')
    await p.waitForTimeout(1400)
    await p.click('#combine')
    await p.waitForTimeout(2800)
    await p.click('[data-scene="scroll"]')
    await p.locator('#scroll').hover()
    await p.mouse.wheel(0, 230)
    await p.waitForTimeout(700)
    await p.mouse.wheel(0, 300)
    await p.waitForTimeout(700)
    await p.mouse.wheel(0, -400)
    await p.waitForTimeout(700)
  })
  await capture('layout-exits-web', 'layout', async (p) => {
    await p.click('#mutate')
    await p.waitForTimeout(1100)
    await p.click('#remove')
    await p.waitForTimeout(120)
    await p.click('#remove')
    await p.waitForTimeout(1000)
    await p.click('#reset-layout')
    await p.click('#remove')
    await p.waitForTimeout(200)
    await p.click('#cancel')
    await p.waitForTimeout(500)
    await p.click('[data-scene="group"]')
    await p.click('#group-change')
    await p.waitForTimeout(1100)
    await p.click('#group-change')
    await p.waitForTimeout(1100)
  })
  await capture('list-changes-web', 'list', async (p) => {
    await p.locator('#list').hover()
    await p.mouse.wheel(0, 1050)
    await p.waitForTimeout(700)
    await p.click('#prepend')
    await p.waitForTimeout(900)
    await p.click('#delete-row')
    await p.waitForTimeout(900)
    await p.click('#sort')
    await p.waitForTimeout(180)
    await p.click('#filter')
    await p.waitForTimeout(900)
    await p.click('#reset-list')
    await p.waitForTimeout(900)
    await p.locator('#list').hover()
    await p.mouse.wheel(0, -500)
    await p.waitForTimeout(650)
    await p.click('#delete-row')
    await p.waitForTimeout(180)
    await p.click('#prepend')
    await p.waitForTimeout(1000)
  })
} finally {
  await browser.close()
}
