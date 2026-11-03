import { chromium, webkit, expect } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const base = process.env.JOLT_SITE_URL || process.argv[2] || 'http://127.0.0.1:5181'
const output = resolve(process.env.JOLT_SITE_ARTIFACTS || '/tmp/jolt-motion-site-review')
const { version } = JSON.parse(
  await readFile(new URL('../package.json', import.meta.url)),
)
await mkdir(output, { recursive: true })
const failures = []
const evidence = []

for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await engine.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  })
  if (name === 'chromium')
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => {
    if (message.type() === 'error' && message.text().includes('[Jolt site]'))
      errors.push(message.text())
  })
  // Do not contact analytics while reviewing a local site.
  await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
  // The existing production community service does not allow every localhost origin.
  // This visual review exercises the showcase page, not its unchanged backend.
  await page.route(
    'https://manager.getcortexlabs.com/api/v1/public/forms/*/entries*',
    (route) =>
      route.fulfill({
        json: { items: [] },
        headers: { 'access-control-allow-origin': '*' },
      }),
  )
  try {
    await page.goto(base)
    await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
    await expect(page.locator('h1')).toContainText('FEEL')
    await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'webgl')
    await expect(page.locator('#morrow-title')).toHaveText('Morrow.')
    await expect(page.locator('.morrow-phone video')).toHaveAttribute(
      'poster',
      /morrow-native-ios.jpg/,
    )
    await page.locator('.morrow-phone video').hover()
    await page.locator('.morrow-phone video').evaluate(async (video) => {
      video.muted = true
      await video.play()
    })
    await expect
      .poll(() =>
        page.locator('.morrow-phone video').evaluate((video) => video.currentTime),
      )
      .toBeGreaterThan(0.1)
    await page.mouse.move(10, 100)
    expect(
      await page.locator('.morrow-phone video').evaluate((video) => video.paused),
      'Controlled video keeps playing when the pointer leaves',
    ).toBe(false)
    await page.locator('.morrow-phone video').evaluate((video) => video.pause())
    const phonePose = await page
      .locator('.morrow-phone')
      .evaluate((el) => getComputedStyle(el).transform)
    await page.mouse.wheel(0, 180)
    await expect
      .poll(() =>
        page.locator('.morrow-phone').evaluate((el) => getComputedStyle(el).transform),
      )
      .not.toBe(phonePose)
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.locator('.recipe-device video[src]')).toHaveCount(0)
    const sculpture = page.locator('.sculpture-turn')
    const before = await sculpture.evaluate((el) => getComputedStyle(el).transform)
    await sculpture.click()
    await expect
      .poll(() => sculpture.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe(before)
    await page.screenshot({ path: `${output}/${name}-home.png`, fullPage: true })
    await page.screenshot({ path: `${output}/${name}-hero.png` })
    const sculptureInput = page.locator('.sculpture-input')
    const sculptureBox = await sculptureInput.boundingBox()
    await page.mouse.move(
      sculptureBox.x + sculptureBox.width * 0.55,
      sculptureBox.y + sculptureBox.height * 0.55,
    )
    await page.mouse.down()
    await page.mouse.move(
      sculptureBox.x + sculptureBox.width * 0.55 + 95,
      sculptureBox.y + sculptureBox.height * 0.55,
      { steps: 12 },
    )
    await page.mouse.up()
    await expect
      .poll(async () => Number(await sculptureInput.getAttribute('data-drag-position')))
      .toBeGreaterThan(30)
    // A lost GPU context must leave a visible, interactive vector fallback.
    await page
      .locator('.chrome-canvas')
      .evaluate((canvas) =>
        canvas.getContext('webgl').getExtension('WEBGL_lose_context').loseContext(),
      )
    await expect(page.locator('.hero-art')).toHaveAttribute('data-renderer', 'svg')
    await expect(page.locator('.sculpture-fallback > svg')).toBeVisible()

    await page.locator('#playground').scrollIntoViewIfNeeded()
    await page.locator('.replay-button').click()
    await expect
      .poll(() =>
        page
          .locator('.lab-tile')
          .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41),
      )
      .toBeGreaterThan(30)
    await page.locator('.lab-tabs button').filter({ hasText: 'Stagger' }).click()
    await page.locator('.replay-button').click()
    await expect(page.locator('.stagger-block')).toHaveCount(7)
    await expect
      .poll(() =>
        page
          .locator('.stagger-block')
          .last()
          .evaluate((el) => Number(getComputedStyle(el).opacity)),
      )
      .toBeGreaterThan(0.9)
    await page.locator('.lab-tabs button').filter({ hasText: 'Drag & snap' }).click()
    const tile = page.locator('.lab-tile')
    const box = await tile.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 90, box.y + box.height / 2 + 35, {
      steps: 12,
    })
    await expect
      .poll(() =>
        tile.evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41),
      )
      .toBeGreaterThan(40)
    await page.mouse.up()
    await expect
      .poll(() =>
        tile.evaluate((el) =>
          Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m41),
        ),
      )
      .toBeLessThan(2)

    await page.locator('#performance').scrollIntoViewIfNeeded()
    await expect(page.locator('[data-value="jolt"]')).toContainText('6.79')
    await expect(page.locator('[data-value="reanimated"]')).toContainText('14.63')
    await expect(page.locator('.study-delta')).toHaveText('−53.6%')
    await page.locator('[data-metric="memory"]').click()
    await expect(page.locator('[data-value="jolt"]')).toContainText('88.27')
    await expect(page.locator('[data-value="reanimated"]')).toContainText('85.65')
    await expect(page.locator('.study-delta')).toHaveText('+2.62')
    await page.locator('[data-metric="presentation"]').click()
    await expect(page.locator('[data-value="jolt"]')).toContainText('32.43')
    await expect(page.locator('[data-value="reanimated"]')).toContainText('25.28')
    await expect(page.locator('.study-delta')).toHaveText('+7.15')
    await page.locator('[data-metric="cpu"]').click()
    await expect
      .poll(() =>
        page
          .locator('.study-bar.jolt')
          .evaluate((el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11),
      )
      .toBeGreaterThan(0.99)
    await page.screenshot({ path: `${output}/${name}-performance.png` })
    await page.locator('#jolt-drive').scrollIntoViewIfNeeded()
    await expect(page.locator('#jolt-drive h3')).toHaveText('JoltDrive.')
    await expect(
      page.locator('#jolt-drive a[href="https://github.com/rafaelaugustos/jolt-drive"]'),
    ).toBeVisible()
    const driveVideo = page.locator('#jolt-drive video')
    await driveVideo.evaluate(async (video) => {
      video.muted = true
      await video.play()
    })
    await expect
      .poll(() => driveVideo.evaluate((video) => video.currentTime))
      .toBeGreaterThan(0.1)
    await page.screenshot({ path: `${output}/${name}-jolt-drive.png` })
    await driveVideo.evaluate((video) => video.pause())
    await page.locator('.drive-prototype summary').click()
    await expect(page.locator('.drive-prototype video')).toBeVisible()
    await page.locator('.drive-prototype summary').click()
    await page.locator('.site-footer').scrollIntoViewIfNeeded()
    await expect(page.locator('.footer-wordmark, .motion-footer-top')).toHaveCount(0)
    await expect(page.locator('.footer-links a[href$="performance-study"]')).toBeVisible()
    await page.screenshot({ path: `${output}/${name}-footer.png` })
    await page.locator('.footer-top-link').click()
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(120)

    await page.goto(`${base}/recipes/`)
    await expect(page.locator('.recipe-card')).toHaveCount(12)
    await page.getByRole('button', { name: 'Touch & gestures', exact: true }).click()
    await expect(page.locator('.recipe-card')).toHaveCount(3)
    await page.locator('.recipe-card').first().hover()
    await expect
      .poll(() =>
        page
          .locator('.recipe-card')
          .first()
          .locator('video')
          .evaluate((video) => video.currentTime),
      )
      .toBeGreaterThan(0.1)
    await expect(page).toHaveURL(/category=Touch/)
    await page.reload()
    await expect(page.locator('.recipe-card')).toHaveCount(3)
    await page.getByRole('button', { name: 'All motion', exact: true }).click()
    await page.getByRole('searchbox').fill('nonsense-that-is-not-a-recipe')
    await expect(page.locator('.recipe-empty')).toBeVisible()
    await page.getByRole('button', { name: /Reset filters/ }).click()
    await expect(page.locator('.recipe-card')).toHaveCount(12)
    await page.getByRole('searchbox').fill('spring')
    await expect(page.locator('.recipe-card')).toHaveCount(2)
    await page.locator('.recipe-card').first().click()
    await expect(page.locator('.recipe-detail h1')).toContainText('spring')
    await expect(page.locator('.recipe-code')).toContainText('animate(')
    await page.getByRole('button', { name: /Copy AI prompt/ }).click()
    if (name === 'chromium') {
      const prompt = await page.evaluate(() => navigator.clipboard.readText())
      expect(prompt).toContain('NativeScript Vue 3')
      expect(prompt).toContain('motion')
      expect(prompt).toContain(version)
    } else await expect(page.locator('.copy-status')).toHaveText('Copied!')
    await page.locator('.recipe-full-screen video').evaluate(async (el) => {
      el.muted = true
      await el.play()
    })
    await expect
      .poll(() =>
        page.locator('.recipe-full-screen video').evaluate((el) => el.currentTime),
      )
      .toBeGreaterThan(0.1)
    await page.locator('.recipe-full-screen video').evaluate((el) => el.pause())
    await page.screenshot({ path: `${output}/${name}-recipe.png`, fullPage: true })
    await page.getByRole('combobox').selectOption('pt-BR')
    await expect(page).toHaveURL(/pt-BR\/recipes\/spring-feeling/)
    await expect(page.locator('h1')).toContainText('personalidade')

    for (const locale of ['', '/pt-BR', '/es', '/zh-Hans']) {
      await page.goto(`${base}${locale}/`)
      await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 })
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${name} ${locale} overflow at ${width}`,
        ).toBe(true)
      }
      await page.locator('.motion-menu').click()
      await expect(page.locator('.motion-nav-links')).toBeVisible()
      await page.locator('.motion-nav-links a').first().click()
      await expect(page.locator('.recipe-card')).toHaveCount(12)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true)
      await page.locator('.recipe-card').first().click()
      await expect(page.locator('.recipe-code')).toBeVisible()
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBe(true)
    }

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${base}/pt-BR/`)
    await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
    await expect
      .poll(() =>
        page
          .locator('.sculpture-turn')
          .evaluate((element) => Number(getComputedStyle(element).opacity)),
      )
      .toBeGreaterThan(0.95)
    await page.screenshot({ path: `${output}/${name}-mobile-pt.png`, fullPage: true })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(base)
    await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
    await page.locator('.recipe-card').first().hover()
    await expect(page.locator('.recipe-device video[src]')).toHaveCount(0)
    await page.locator('.motion-footer-bottom button').click()
    await expect(page.locator('.motion-site')).toHaveClass(/motion-reduced/)
    await page.reload()
    await expect(page.locator('.motion-site')).toHaveClass(/motion-reduced/)
    await page.goto(`${base}/guide/install`)
    await expect(page.locator('.VPDoc')).toBeVisible()
    await page.goto(`${base}/guide/showcase#morrow`)
    await expect(page.locator('#morrow')).toHaveText('Morrow.')
    for (const locale of ['', '/pt-BR', '/es', '/zh-Hans']) {
      await page.goto(`${base}${locale}/guide/showcase#jolt-drive`)
      await expect(page.locator('#jolt-drive')).toHaveText('Jolt Drive.')
      await expect(page.locator('.showcase-project-links a').first()).toHaveAttribute(
        'href',
        'https://github.com/rafaelaugustos/jolt-drive',
      )
      await expect(page.locator('.drive-screens img')).toHaveCount(3)
      await expect(page.locator('video[src*="film-car-ios"]')).toHaveCount(1)
      for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 900 })
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          `${name} ${locale} showcase overflow at ${width}`,
        ).toBe(true)
        if (width === 768) {
          await page.locator('.VPNavBarHamburger').click()
          await expect(page.locator('#VPNavScreen')).toBeVisible()
          await expect(page.locator('#VPNavScreen a').first()).toBeVisible()
          await page.locator('.VPNavBarHamburger').click()
          await expect(page.locator('#VPNavScreen')).toHaveCount(0)
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${base}/guide/showcase#jolt-drive`)
    const publishedDrive = page.locator('video[src*="jolt-drive-entrance-ios"]')
    await publishedDrive.scrollIntoViewIfNeeded()
    await publishedDrive.evaluate((video) => video.play())
    await expect
      .poll(() => publishedDrive.evaluate((video) => video.currentTime))
      .toBeGreaterThan(0.1)
    await page.screenshot({ path: `${output}/${name}-drive-showcase.png` })
    await page.locator('.drive-screens').scrollIntoViewIfNeeded()
    for (const picture of await page.locator('.drive-screens img').all()) {
      await expect.poll(() => picture.evaluate((img) => img.naturalWidth)).toBe(368)
    }
    await page.screenshot({ path: `${output}/${name}-drive-screens.png` })
    await page.goto(`${base}/guide/performance-study`)
    const physicalVideo = page.locator('video[src*="comparison-jolt-physical-android"]')
    await physicalVideo.scrollIntoViewIfNeeded()
    await physicalVideo.evaluate((video) => video.play())
    await expect
      .poll(() => physicalVideo.evaluate((video) => video.currentTime))
      .toBeGreaterThan(0.1)

    await page.goto(base)
    await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
    expect(errors).toEqual([])
    evidence.push({
      browser: name,
      result: 'passed',
      checks:
        'WebGL sculpture, inertial sculpture drag, context-loss fallback, three-metric performance panel, Jolt Drive project links and native playback, preserved Jolt Car walkthrough, published project images, footer navigation, physical evidence playback, spring, stagger, drag/snap, filtering, search, deep links, clipboard, native video playback, home and showcase in 4 locales × 4 widths, mobile navigation, reduced motion, remount',
    })
    console.log(`${name}: all interaction checks passed`)
  } catch (error) {
    failures.push({ browser: name, error: String(error), errors })
    console.error(`${name}: ${String(error)}`)
    await page
      .screenshot({ path: `${output}/${name}-failure.png`, fullPage: true })
      .catch(() => {})
  } finally {
    await browser.close()
  }
}
await writeFile(`${output}/results.json`, JSON.stringify({ evidence, failures }, null, 2))
if (failures.length) process.exitCode = 1
