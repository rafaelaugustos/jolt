import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { build } from 'esbuild'
import { chromium, firefox, webkit } from '@playwright/test'
const output = resolve('.local/media'),
  folder = resolve(output, 'collection-layouts')
mkdirSync(folder, { recursive: true })
const html = readFileSync(new URL('index.html', import.meta.url), 'utf8')
const js = (
  await build({
    entryPoints: [new URL('web.ts', import.meta.url).pathname],
    bundle: true,
    write: false,
    format: 'esm',
  })
).outputFiles[0].text
for (const [name, engine] of Object.entries({ chromium, firefox, webkit })) {
  const browser = await engine.launch()
  try {
    for (const mode of process.argv.length > 2
      ? process.argv.slice(2)
      : ['Carousel', 'RTL', 'Grid', 'Heights', 'Transfer']) {
      const size = { width: 760, height: 475 },
        context = await browser.newContext({
          viewport: size,
          ...(name === 'chromium' ? { recordVideo: { dir: folder, size } } : {}),
        })
      await context.route('http://jolt.test/**', (route) =>
        route.fulfill(
          route.request().url().endsWith('fixture.js')
            ? { contentType: 'text/javascript', body: js }
            : { contentType: 'text/html', body: html },
        ),
      )
      const p = await context.newPage(),
        errors = []
      p.on('pageerror', (e) => errors.push(e.message))
      await p.goto('http://jolt.test/#' + mode)
      await p.waitForFunction(() => window.snapshot)
      await p.waitForTimeout(500)
      const state = () => p.evaluate(() => window.snapshot())
      async function drag(key, target) {
        const get = async (k) => {
          const box = await p.locator('[data-key="' + k + '"]').boundingBox()
          return [box.x + box.width / 2, box.y + box.height / 2]
        }
        const start = await get(key),
          end = Array.isArray(target) ? target : await get(target)
        await p.mouse.move(...start)
        await p.mouse.down()
        await p.mouse.move(...end, { steps: 24 })
        await p.waitForTimeout(300)
        await p.mouse.up()
        await p.waitForTimeout(500)
      }
      if (mode === 'Transfer') {
        await drag('Atlas', 'Elm')
        assert.equal((await state()).commits, 1)
        await p.getByText('Reject', { exact: true }).click()
        await drag('Birch', 'Dune')
        assert.equal((await state()).commits, 1)
        await p.getByText('Reject', { exact: true }).click()
        await p.getByText('Empty', { exact: true }).click()
        const r = await p.locator('section').last().boundingBox()
        await drag('Birch', [r.x + 60, r.y + 60])
        assert.deepEqual((await state()).right, ['Birch'])
        const settled = await p.locator('[data-key="Birch"]').boundingBox()
        assert(
          settled.x >= r.x && settled.x + settled.width <= r.x + r.width + 1,
          JSON.stringify({
            r,
            settled,
            style: await p.locator('[data-key=Birch]').getAttribute('style'),
          }),
        )
        await p.waitForTimeout(500)
      } else {
        if (mode !== 'Heights') {
          await drag('Card 01', mode === 'Grid' ? 'Card 05' : 'Card 03')
          assert.equal((await state()).commits, 1, name + ' ' + mode)
        }
        await p.getByText('Jump', { exact: true }).click()
        await p.waitForTimeout(300)
        const anchor = async () =>
          p.locator('[data-key="Card 19"]').evaluate((e) => {
            const r = e.getBoundingClientRect()
            return [r.left, r.top]
          })
        const before = await anchor()
        await p.getByText('Insert', { exact: true }).click()
        await p.waitForTimeout(800)
        const after = await anchor()
        const axis = mode === 'Carousel' || mode === 'RTL' ? 0 : 1
        if (mode !== 'Grid')
          assert(
            Math.abs(after[axis] - before[axis]) < 2,
            name + ' ' + mode + ' ' + [before, after],
          )
        await p.getByText('Delete', { exact: true }).click()
        await p.waitForTimeout(500)
        await p.getByText('Move pair', { exact: true }).click()
        await p.waitForTimeout(700)
        assert.equal((await state()).mutations, 3)
      }
      assert.deepEqual(errors, [])
      const video = p.video()
      await context.close()
      if (video)
        execFileSync('ffmpeg', [
          '-y',
          '-v',
          'error',
          '-i',
          await video.path(),
          '-an',
          '-vf',
          'fps=30',
          '-c:v',
          'libx264',
          '-pix_fmt',
          'yuv420p',
          '-movflags',
          '+faststart',
          resolve(output, 'collection-' + mode.toLowerCase() + '-web.mp4'),
        ])
      console.log(name, mode, 'passed')
    }
  } finally {
    await browser.close()
  }
}
