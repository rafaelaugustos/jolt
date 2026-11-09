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
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(`http://127.0.0.1:${server.address().port}/${name}`)
    await page.waitForFunction(() => window.fixture || window.tools)
    const pause = (ms = 700) => page.waitForTimeout(ms)
    const click = async (text) => {
      const button = page.getByRole('button', { name: text, exact: true })
      await button.hover()
      await pause(200)
      await button.click()
    }
    await pause(700)
    await page
      .getByRole('button', { name: 'Toggle', exact: true })
      .dblclick({ delay: 100 })
    await pause(700)
    await page.locator('[data-card]').hover()
    await page.mouse.down()
    await pause(400)
    await page.mouse.up()
    await click('Spring right')
    await pause(150)
    await click('Interrupt left')
    await pause(800)
    const region = page.locator('[data-pointer-region]')
    await region.scrollIntoViewIfNeeded()
    const rect = await region.boundingBox()
    await page.mouse.move(rect.x + rect.width * 0.8, rect.y + rect.height * 0.25, {
      steps: 20,
    })
    await pause(500)
    await page.mouse.move(rect.x + rect.width * 0.2, rect.y + rect.height * 0.75, {
      steps: 25,
    })
    await pause(500)
    await page.locator('[data-pointer-status]').hover()
    await pause(500)
    const drag = page.locator('[data-drag]')
    await drag.scrollIntoViewIfNeeded()
    const bounds = await drag.boundingBox()
    await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
    await page.mouse.down()
    await pause(120)
    await page.mouse.move(
      bounds.x + bounds.width / 2 + 73,
      bounds.y + bounds.height / 2,
      { steps: 20 },
    )
    await pause(200)
    await page.mouse.up()
    await pause(900)
    await click('Stagger + cues')
    await expect(page.locator('[data-cues]')).toHaveText('Events: 1')
    await page.getByRole('button', { name: 'Cancel timeline', exact: true }).click()
    await pause(1100)
    await click('Stagger + cues')
    await expect(page.locator('[data-cues]')).toHaveText('Events: 2')
    await pause(800)
    await click('Sequence')
    await pause(1300)
    await click('Toggle shared layout')
    await pause(800)
    await click('Toggle shared layout')
    await pause(800)
    const scroller = page.locator('[data-scroll]')
    await scroller.scrollIntoViewIfNeeded()
    await scroller.hover()
    await page.mouse.wheel(0, 330)
    await pause(700)
    await click('Inspect sample')
    await pause(600)
    await click('Parameterized preset')
    await pause(900)
    await page.screenshot({ path: join(destination, 'expansion-' + name + '.png') })
    const video = page.video()
    await context.close()
    if (errors.length) throw Error(errors.join('\n'))
    const file = join(destination, `web-expansion-${name}.mp4`)
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
