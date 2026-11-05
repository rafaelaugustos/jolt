import { chromium, webkit, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.argv[2] || 'http://127.0.0.1:5181'
const output = resolve(process.env.JOLT_HERO_ARTIFACTS || '/tmp/jolt-hero-startup-review')
await mkdir(output, { recursive: true })
const evidence = []
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await engine.launch()
  try {
    for (const locale of ['', '/pt-BR']) {
      const context = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      })
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', (error) => errors.push(error.message))
      await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
      let release
      const hold = new Promise((resolve) => {
        release = resolve
      })
      await page.route(/\/MotionHome\.[^/]+\.js(?:\?|$)/, async (route) => {
        await hold
        await route.continue()
      })
      await page.goto(`${base}${locale}/`, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'pending')
      await expect(page.locator('.sculpture-fallback')).not.toBeVisible()
      await expect(page.locator('.chrome-canvas')).not.toBeVisible()
      await expect(page.locator('.sculpture-input')).toBeDisabled()
      await page.screenshot({
        path: `${output}/${name}-${locale ? 'pt' : 'en'}-before-hydration.png`,
      })
      release()
      await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'webgl')
      await expect(page.locator('.chrome-canvas')).toBeVisible()
      await expect(page.locator('.sculpture-fallback')).not.toBeVisible()
      await expect(page.locator('.sculpture-input')).toBeEnabled()
      await page.screenshot({
        path: `${output}/${name}-${locale ? 'pt' : 'en'}-painted.png`,
      })
      const turn = page.locator('.sculpture-turn')
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await expect
        .poll(() => turn.evaluate((el) => Number(getComputedStyle(el).opacity)))
        .toBeGreaterThan(0.95)
      await expect(page.locator('.sculpture-fallback')).not.toBeVisible()
      await page.emulateMedia({ reducedMotion: 'no-preference' })
      const before = await turn.evaluate((el) => getComputedStyle(el).transform)
      await page.locator('.sculpture-input').focus()
      await page.keyboard.press('Enter')
      await expect
        .poll(() => turn.evaluate((el) => getComputedStyle(el).transform))
        .not.toBe(before)
      await page
        .locator('.chrome-canvas')
        .evaluate((canvas) =>
          canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext(),
        )
      await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'svg')
      await expect(page.locator('.sculpture-fallback > svg')).toBeVisible()
      await expect(page.locator('.chrome-canvas')).not.toBeVisible()
      expect(errors).toEqual([])
      await context.close()
    }
    const noGpu = await browser.newContext({ viewport: { width: 390, height: 844 } })
    await noGpu.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext
      HTMLCanvasElement.prototype.getContext = function (kind, ...args) {
        return kind === 'webgl' ? null : original.call(this, kind, ...args)
      }
    })
    const page = await noGpu.newPage()
    await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
    await page.goto(base)
    await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'svg')
    await expect(page.locator('.sculpture-fallback > svg')).toBeVisible()
    const before = await page
      .locator('.sculpture-turn')
      .evaluate((el) => getComputedStyle(el).transform)
    await page.locator('.sculpture-input').click()
    await expect
      .poll(() =>
        page.locator('.sculpture-turn').evaluate((el) => getComputedStyle(el).transform),
      )
      .not.toBe(before)
    await noGpu.close()
    const noJs = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 390, height: 844 },
    })
    const staticPage = await noJs.newPage()
    await staticPage.goto(base)
    await expect(staticPage.locator('.sculpture-fallback > svg')).toBeVisible()
    await staticPage.screenshot({ path: `${output}/${name}-no-javascript.png` })
    await noJs.close()
    evidence.push({
      browser: name,
      result: 'passed',
      checks:
        'English and Portuguese production SSR with the MotionHome chunk held; no green fallback or empty canvas before first WebGL frame; input readiness; reduced motion; keyboard interaction; context loss; unavailable WebGL on mobile; static SVG without JavaScript.',
    })
    console.log(`${name}: hero startup and fallback checks passed`)
  } finally {
    await browser.close()
  }
}
await writeFile(`${output}/results.json`, JSON.stringify({ evidence }, null, 2) + '\n')
