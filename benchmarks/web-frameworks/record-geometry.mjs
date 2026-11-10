// Run after a successful packed browser suite. Serves the exact tested consumer.
import { chromium, expect } from '@playwright/test'
import { createServer } from 'node:http'
import { readFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const { output } = JSON.parse(
  readFileSync(new URL('./results/consumer.json', import.meta.url)),
)
const destination = new URL('./captures/', import.meta.url).pathname
mkdirSync(destination, { recursive: true })
const server = createServer((req, res) => {
  const name = new URL(req.url, 'http://localhost').pathname.slice(1)
  if (!/^(react|angular|svelte|solid|tools)(\.js)?$|^styles\.css$/.test(name)) {
    res.writeHead(404).end()
    return
  }
  res.setHeader(
    'Content-Type',
    name.endsWith('.js')
      ? 'text/javascript'
      : name.endsWith('.css')
        ? 'text/css'
        : 'text/html',
  )
  res.end(readFileSync(join(output, name.includes('.') ? name : name + '.html')))
})
await new Promise((r) => server.listen(0, '127.0.0.1', r))
const browser = await chromium.launch()
try {
  for (const name of ['react', 'angular', 'svelte', 'solid']) {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 800 },
      recordVideo: { dir: destination, size: { width: 1000, height: 800 } },
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/${name}?geometry`)
    await page.waitForFunction(() => window.geometryOwners?.length)
    const pause = (ms = 700) => page.waitForTimeout(ms)
    const click = async (key) => {
      await page.locator(`[data-${key}]`).click()
      await pause()
    }
    await page
      .locator('[data-geometry]')
      .evaluate((n) => n.scrollIntoView({ block: 'start' }))
    await pause()
    await click('panel-open')
    await page.keyboard.press('End')
    await pause(1000)
    await page.locator('[data-panel-scroll]').hover()
    await page.mouse.wheel(0, 220)
    await pause(900)
    await page.mouse.wheel(0, -500)
    await pause(700)
    await page.locator('[data-panel-note]').fill('Bring a camera')
    await pause()
    await click('panel-compact')
    const h = await page.locator('[data-panel-handle]').boundingBox()
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2)
    await page.mouse.down()
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2 - 170, { steps: 24 })
    await pause(180)
    await page.mouse.up()
    await pause(900)
    await page.locator('[data-panel-handle]').focus()
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-panel-open]')).toBeFocused()
    await pause()
    await page
      .locator('.geometry-curve')
      .evaluate((n) => n.scrollIntoView({ block: 'start' }))
    await click('curve-play')
    await expect(page.locator('[data-curve-status]')).toHaveText('completed')
    await pause()
    await click('curve-reverse')
    await click('curve-cancel')
    await click('curve-reverse')
    await expect(page.locator('[data-curve-status]')).toHaveText('completed')
    const drag = async (from, to) => {
      const a = await page
        .locator(`[data-measured-key="Stop ${from}"] [data-measured-handle]`)
        .boundingBox()
      const b = await page
        .locator(`[data-measured-key="Stop ${to}"] [data-measured-handle]`)
        .boundingBox()
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await pause(150)
      await page.mouse.down()
      await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 + 12, { steps: 24 })
      await pause(150)
      await page.mouse.up()
      await pause(900)
    }
    await page.locator('[data-measured-list]').scrollIntoViewIfNeeded()
    await drag(1, 3)
    await expect(page.locator('[data-measured-status]')).toHaveText(
      'Stop 2, Stop 3, Stop 1',
    )
    await click('measured-reset')
    await click('measured-resize')
    await page
      .locator('[data-measured-key="Stop 1"] [data-measured-handle]')
      .scrollIntoViewIfNeeded()
    await drag(1, 2)
    await expect(page.locator('[data-measured-status]')).toHaveText(
      'Stop 2, Stop 1, Stop 3',
    )
    await click('measured-reset')
    await click('measured-resize')
    await page.locator('[data-measured-key="Stop 1"] [data-measured-handle]').focus()
    await page.keyboard.press('Space')
    await pause(250)
    await page.keyboard.press('ArrowDown')
    await pause(250)
    await page.keyboard.press('Space')
    await pause(900)
    const video = page.video()
    await context.close()
    if (errors.length) throw Error(errors.join('\n'))
    const file = join(destination, `web-geometry-${name}.mp4`)
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-i',
        await video.path(),
        '-an',
        '-c:v',
        'libx264',
        '-crf',
        '22',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        file,
      ],
      { stdio: 'pipe' },
    )
    execFileSync('ffmpeg', ['-v', 'error', '-i', file, '-f', 'null', '-'], {
      stdio: 'pipe',
    })
    console.log(file)
  }
} finally {
  await browser.close()
  server.close()
}
