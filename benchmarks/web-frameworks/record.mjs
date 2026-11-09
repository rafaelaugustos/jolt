// Run after a successful packed browser suite. Serves the exact tested consumer.
import { chromium } from '@playwright/test'
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
  for (const name of ['react', 'angular', 'svelte', 'solid', 'tools', 'preset']) {
    const context = await browser.newContext({
      viewport: { width: 1000, height: 740 },
      recordVideo: { dir: destination, size: { width: 1000, height: 740 } },
      reducedMotion: 'no-preference',
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(
      `http://127.0.0.1:${server.address().port}/${['tools', 'preset'].includes(name) ? 'tools' : name}`,
    )
    await page.waitForFunction(() => window.fixture || window.tools)
    const pause = (ms = 700) => page.waitForTimeout(ms)
    const click = async (text) => {
      const button = page.getByRole('button', { name: text, exact: true })
      await button.hover()
      await pause(200)
      await button.click()
    }
    await pause(700)
    if (name === 'tools') {
      await click('Replay samples')
      await pause(200)
      await click('Pause')
      await pause(800)
      await click('Resume')
      await pause(250)
      await click('Sample now')
      await pause(600)
      await click('Interrupt motion')
      await pause(250)
      await click('Sample now')
      await pause(500)
      await click('Sample now')
      await click('Dispose')
      await pause(900)
    } else if (name === 'preset') {
      for (let i = 0; i < 3; i++) {
        await click('Play shared preset')
        await pause(1000)
      }
    } else {
      await click('Move')
      await pause(120)
      await click('Interrupt')
      await pause(800)
      await page.locator('[data-card]').hover()
      await page.mouse.down()
      await pause(300)
      await page.mouse.up()
      await pause(300)
      await click('Replace')
      await pause(800)
      await click('Toggle')
      await pause(650)
      await click('Toggle')
      await pause(800)
      await click('Reduce motion')
      await click('Move')
      await pause(900)
    }
    await page.screenshot({ path: join(destination, name + '.png') })
    const video = page.video()
    await context.close()
    if (errors.length) throw Error(errors.join('\n'))
    const file = join(destination, `web-${name}.mp4`)
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
