/** Real browser input; this recording is separate from performance measurements. */
import { chromium, expect } from '@playwright/test'
import { mkdir, rename, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const output = resolve(process.argv[2] || '/tmp/jolt-interaction-browser')
const only = process.argv[3]
await mkdir(output, { recursive: true })
const server = spawn(process.execPath, ['benchmarks/web-interaction-depth/server.mjs'], {
  stdio: 'ignore',
})
let browser
const report = []
try {
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch('http://127.0.0.1:4327')).ok) break
    } catch {}
    await new Promise((r) => setTimeout(r, 100))
  }
  browser = await chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const modes = ['drop', 'board', 'audio', 'inspector', 'path', 'depth', 'shadow']
  for (const mode of only ? [only] : modes) {
    const context = await browser.newContext({
      viewport: { width: 920, height: 740 },
      recordVideo: { dir: output, size: { width: 920, height: 740 } },
    })
    const page = await context.newPage(),
      errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.goto('http://127.0.0.1:4327/?mode=' + mode)
    await page.waitForFunction(() => !!window.depth)
    const wait = (ms) => page.waitForTimeout(ms)
    const click = async (id, ms = 500) => {
      await page.locator('#' + id).click()
      await wait(ms)
    }
    await wait(600)
    if (mode === 'drop') {
      for (const id of ['reject', 'accept']) {
        const a = await page.locator('#source').boundingBox(),
          b = await page.locator('#' + id).boundingBox()
        await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
        await page.mouse.down()
        for (let step = 1; step <= 25; step++) {
          await page.mouse.move(
            a.x + a.width / 2 + ((b.x + b.width / 2 - a.x - a.width / 2) * step) / 25,
            a.y + a.height / 2 + ((b.y + b.height / 2 - a.y - a.height / 2) * step) / 25,
          )
          await wait(25)
        }
        await wait(250)
        await page.mouse.up()
        await wait(1400)
        await expect(page.locator('#status')).toContainText(
          id === 'accept' ? 'Accepted once · drag' : 'Rejected',
        )
      }
      await click('reset')
      await page.locator('#request').focus()
      await page.keyboard.press('Enter')
      await wait(900)
      await click('pause')
      await click('pause')
    } else if (mode === 'board') {
      const center = async (id) => {
        const box = await page.locator('#' + id).boundingBox()
        return { x: box.x + box.width / 2, y: box.y + box.height / 2, box }
      }
      const glide = async (from, to, steps = 30, hold = 300) => {
        await page.mouse.move(from.x, from.y)
        await page.mouse.down()
        for (let step = 1; step <= steps; step++) {
          await page.mouse.move(
            from.x + ((to.x - from.x) * step) / steps,
            from.y + ((to.y - from.y) * step) / steps,
          )
          await wait(25)
        }
        await wait(hold)
        await page.mouse.up()
        await wait(1100)
      }
      await click('open', 600)
      const body = await center('notes')
      await glide(
        { x: body.x - 40, y: body.y - 24 },
        { x: body.x + 120, y: body.y + 40 },
        15,
        100,
      )
      await page.mouse.move(body.x, body.y)
      await page.mouse.wheel(0, 50)
      await wait(500)
      let grip = await center('grip')
      const spec = await center('spec'),
        card = await center('card')
      await glide(grip, { x: grip.x + 6, y: spec.box.y + 4 - (card.y - grip.y) }, 30, 700)
      await expect(page.locator('#status')).toContainText('Dropped in todo')
      grip = await center('grip')
      const done = (await center('done')).box,
        offset = (await center('card')).x - grip.x
      await glide(grip, {
        x: done.x + done.width / 2 - offset,
        y: done.y + done.height + 40,
      })
      await expect(page.locator('#status')).toContainText('Dropped in done')
      grip = await center('grip')
      const locked = await center('locked')
      await glide(grip, { x: locked.x - offset, y: locked.y }, 25, 300)
      await expect(page.locator('#status')).toContainText('Rejected by locked')
      await wait(600)
      await page.locator('#grip').focus()
      await page.keyboard.press('ArrowLeft')
      await wait(1100)
      await click('pause', 600)
      await click('pause', 600)
    } else {
      await click('request', 450)
      await click('pause', 700)
      await click('seek', 600)
      await click('pause', 1600)
      await click('request', 500)
      await click('replace', 2800)
      await click('inspect', 800)
      await click('reset', 700)
      await click('request', 3400)
      await click('inspect', 700)
    }
    await page.screenshot({ path: resolve(output, mode + '-chromium.png') })
    if (errors.length) throw new Error(errors.join('\n'))
    report.push({ mode, status: await page.locator('#status').innerText(), errors })
    const video = page.video()
    await context.close()
    const clip = mode === 'board' ? 'interaction-depth-drop' : 'interaction-' + mode
    await rename(await video.path(), resolve(output, clip + '-web.webm'))
    console.log('Recorded ' + mode)
  }
  await writeFile(resolve(output, 'report.json'), JSON.stringify(report, null, 2))
} finally {
  await browser?.close()
  server.kill()
}
