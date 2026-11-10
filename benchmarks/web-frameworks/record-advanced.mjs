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
    await page.goto(`http://127.0.0.1:${server.address().port}/${name}?advanced`)
    await page.waitForFunction(() => window.advancedOwners?.length)
    await page.locator('[data-advanced]').scrollIntoViewIfNeeded()
    const pause = (ms = 700) => page.waitForTimeout(ms)
    const click = async (selector) => {
      const button = page.locator(`[data-${selector}]`)
      await button.hover()
      await pause(150)
      await button.click()
    }
    await click('map-right')
    await pause(1100)
    await click('map-left')
    await pause(1100)
    await click('group-right')
    await pause(900)
    await click('group-left')
    await pause(900)
    await click('state-focus')
    await pause(600)
    await click('state-rest')
    await pause(600)
    await click('pet')
    await pause(350)
    await click('dress')
    await pause(350)
    await click('eat')
    await expect(page.locator('[data-behavior]')).toHaveText('eat: blocked')
    await expect(page.locator('[data-behavior]')).toHaveText('Behavior: rest')
    await pause(650)
    await click('seek-quarter')
    await pause(600)
    await click('seek-threequarters')
    await pause(600)
    await click('seek-quarter')
    await click('seek-play')
    await pause(3300)
    await page.locator('[data-gradient]').scrollIntoViewIfNeeded()
    await click('drawing-play')
    await pause(600)
    await click('drawing-pause')
    await pause(600)
    await click('drawing-resume')
    await pause(2300)
    const drag = page.locator('[data-inertia]')
    await drag.scrollIntoViewIfNeeded()
    const box = await drag.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, {
      steps: 12,
    })
    await page.mouse.up()
    await pause(1000)
    const viewport = page.locator('[data-viewport]')
    await viewport.scrollIntoViewIfNeeded()
    await viewport.hover()
    await page.mouse.wheel(0, 420)
    await pause(1100)
    await page.mouse.wheel(0, -420)
    await pause(700)
    await page.mouse.wheel(0, 420)
    await pause(1100)
    await click('drawing-clear')
    await pause(800)
    const video = page.video()
    await context.close()
    if (errors.length) throw Error(errors.join('\n'))
    const file = join(destination, `web-advanced-${name}.mp4`)
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
