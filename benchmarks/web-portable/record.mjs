/** Real Chromium interaction; recorded separately from timed measurements. */
import { chromium } from '@playwright/test'
import { mkdir, rename } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const output = resolve(process.argv[2] || '/tmp/jolt-portable-browser')
await mkdir(output, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-portable/server.mjs'], {
  stdio: 'ignore',
})
let browser
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4326')).ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  browser = await chromium.launch()
  for (const mode of ['groups', 'drawing', 'pointer']) {
    const context = await browser.newContext({
      viewport: { width: 920, height: 740 },
      recordVideo: { dir: output, size: { width: 920, height: 740 } },
    })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:4326/?mode=' + mode)
    await page.waitForFunction(() => !!window.portable)
    const wait = (ms) => page.waitForTimeout(ms)
    if (mode === 'pointer') {
      for (const [x, y] of [
        [150, 250],
        [700, 430],
        [450, 300],
        [50, 550],
      ]) {
        await page.mouse.move(x, y, { steps: 25 })
        await wait(900)
      }
      await page.locator('#inside').click()
      await wait(700)
      await page.locator('#run').click()
      await page.mouse.move(700, 280, { steps: 20 })
      await wait(900)
      await page.locator('#pause').click()
      await page.mouse.move(300, 400, { steps: 20 })
      await wait(700)
      await page.locator('#resume').click()
      await page.mouse.move(600, 300, { steps: 20 })
      await wait(900)
    } else {
      await page.locator('#run').click()
      await wait(500)
      await page.locator('#pause').click()
      await wait(800)
      await page.locator('#resume').click()
      await wait(1800)
      await page.locator('#run').click()
      await wait(500)
      await page.locator('#run').click()
      await wait(1800)
      if (mode === 'drawing') {
        await page.locator('#variant').click()
        await wait(1200)
        await page.locator('#variant').click()
        await wait(900)
      }
    }
    await page.locator('#reset').click()
    await page.locator('#run').click()
    await wait(1800)
    if (mode === 'pointer') {
      await page.mouse.move(400, 250, { steps: 20 })
      await wait(900)
      await page.mouse.move(10, 10, { steps: 15 })
      await wait(700)
    }
    const video = page.video()
    await context.close()
    await rename(await video.path(), resolve(output, mode + '-chromium.webm'))
    console.log('Recorded ' + mode)
  }
} finally {
  await browser?.close()
  server.kill()
}
