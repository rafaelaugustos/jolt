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
    await page.goto(`http://127.0.0.1:${server.address().port}/${name}?characters`)
    await page.waitForFunction(() => window.characterOwners?.length)
    const pause = (ms = 700) => page.waitForTimeout(ms)
    const click = async (selector) => {
      const button = page.locator(`[data-${selector}]`)
      await button.hover()
      await pause(120)
      await button.click()
    }
    await page
      .locator('[data-characters]')
      .evaluate((node) => node.scrollIntoView({ block: 'start' }))
    await pause()
    await click('key-play')
    await pause(650)
    await click('key-pause')
    await pause()
    await click('key-resume')
    await expect(page.locator('[data-key-status]')).toHaveText('completed')
    const drag = async (source, target, extra = 0) => {
      await page.locator(source).scrollIntoViewIfNeeded()
      const a = await page.locator(source).boundingBox(),
        b = await page.locator(target).boundingBox()
      await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
      await pause(180)
      await page.mouse.down()
      await page.mouse.move(b.x + b.width / 2 + extra, b.y + b.height / 2 + 10, {
        steps: 24,
      })
      await pause(160)
      await page.mouse.up()
    }
    await drag('[data-gesture]', '[data-gesture]', 60)
    await pause()
    await click('gesture-zoom')
    await pause(900)
    await click('gesture-turn')
    await pause(900)
    await click('gesture-reset')
    await pause(900)
    await drag('[data-gift]', '[data-locked]')
    await pause(1100)
    await drag('[data-gift]', '[data-basket]')
    await expect(page.locator('[data-drop-status]')).toContainText('accepted')
    await pause()
    await click('drop-return')
    await pause()
    const handle = page.locator('[data-key="Item 1"] [data-handle]')
    await handle.focus()
    await page.keyboard.press('Space')
    await pause(250)
    await page.keyboard.press('ArrowDown')
    await pause(250)
    await page.keyboard.press('ArrowDown')
    await pause(250)
    await page.keyboard.press('Space')
    await pause(800)
    await click('order-reset')
    await pause(800)
    await drag('[data-key="Item 1"] [data-handle]', '[data-key="Item 3"] [data-handle]')
    await pause(800)
    await page.locator('[data-character]').scrollIntoViewIfNeeded()
    await click('rig-wave')
    await pause(1000)
    await click('rig-blend')
    await pause(1000)
    await click('rig-rest')
    await pause(900)
    await click('celebrate')
    await pause(850)
    await click('effect-cancel')
    await pause(700)
    await click('celebrate')
    await pause(2700)
    await click('emit')
    await pause(3400)
    const video = page.video()
    await context.close()
    if (errors.length) throw Error(errors.join('\n'))
    const file = join(destination, `web-characters-${name}.mp4`)
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
