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
  await context.addInitScript(() => {
    // Fixture only the unchanged community listing; no cross-origin request to
    // cancel while the visual review navigates between pages.
    const originalFetch = window.fetch.bind(window)
    window.fetch = (input, init) => {
      const url = input instanceof Request ? input.url : String(input)
      if (
        /^https:\/\/manager\.getcortexlabs\.com\/api\/v1\/public\/forms\/[^/]+\/entries(?:\?|$)/.test(
          url,
        ) &&
        (init?.method ?? (input instanceof Request ? input.method : 'GET')) === 'GET'
      )
        return Promise.resolve(
          new Response(JSON.stringify({ items: [] }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          }),
        )
      return originalFetch(input, init)
    }
  })
  try {
    await page.goto(base)
    await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
    await expect(page.locator('h1')).toContainText('FEEL')
    await expect(page.locator('.hero-topline a')).toContainText(
      version.replace('0.1.0-', '').toUpperCase(),
    )
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
    await page.locator('.install-card button').click()
    if (name === 'chromium')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        `npm install @rafaelaugusto/jolt@${version}`,
      )
    await expect(page.locator('.footer-wordmark, .motion-footer-top')).toHaveCount(0)
    await expect(page.locator('.footer-links a[href$="performance-study"]')).toBeVisible()
    await page.screenshot({ path: `${output}/${name}-footer.png` })
    await page.locator('.footer-top-link').click()
    await expect.poll(() => page.evaluate(() => scrollY)).toBeLessThan(120)

    await page.goto(`${base}/recipes/`)
    await expect(page.locator('.recipe-card')).toHaveCount(18)
    await page.getByRole('button', { name: 'Touch & gestures', exact: true }).click()
    await expect(page.locator('.recipe-card')).toHaveCount(6)
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
    await expect(page.locator('.recipe-card')).toHaveCount(6)
    await page.getByRole('button', { name: 'All motion', exact: true }).click()
    await page.getByRole('searchbox').fill('nonsense-that-is-not-a-recipe')
    await expect(page.locator('.recipe-empty')).toBeVisible()
    await page.getByRole('button', { name: /Reset filters/ }).click()
    await expect(page.locator('.recipe-card')).toHaveCount(18)
    await page.getByRole('searchbox').fill('spring')
    await expect(page.locator('.recipe-card')).toHaveCount(4)
    await page.locator('a.recipe-card[href="/recipes/spring-feeling"]').click()
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

    await page.goto(`${base}/recipes/?q=Jolt%20Drive`)
    await expect(page.locator('.recipe-card')).toHaveCount(4)
    await page.reload()
    await expect(page.locator('.recipe-card')).toHaveCount(4)
    await page.screenshot({ path: `${output}/${name}-drive-recipes.png`, fullPage: true })
    for (const [slug, source] of [
      ['cockpit', 'src/pages/Home/useCockpitGesture.ts'],
      ['atmosphere', 'src/pages/Home/AtmosphereOption.vue'],
      ['charge-sheet', 'src/pages/Home/EnergyPlan.vue'],
      ['cabin', 'src/components/scene/Car3D.vue'],
    ]) {
      await page.goto(`${base}/recipes/drive-${slug}`)
      const snapshot = await readFile(
        new URL(
          `../docs/recipes/sources/rafaelaugustos/jolt-drive/${source}.txt`,
          import.meta.url,
        ),
        'utf8',
      )
      expect(await page.locator('.recipe-code pre code').textContent()).toBe(snapshot)
      await expect(page.locator('.recipe-requirements')).toBeVisible()
      await expect(page.locator('.recipe-actions a')).toHaveAttribute(
        'href',
        `https://github.com/rafaelaugustos/jolt-drive/blob/2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f/${source}`,
      )
      await page.locator('.code-topline button').click()
      if (name === 'chromium')
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(snapshot)
      await page.getByRole('button', { name: /Copy AI prompt/ }).click()
      if (name === 'chromium') {
        const prompt = await page.evaluate(() => navigator.clipboard.readText())
        expect(prompt).toContain('2d9cc4afeec1d1fa04b85e5dbe063db07e3db29f')
        expect(prompt).toContain('Required context:')
        expect(prompt).toContain(snapshot)
      } else await expect(page.locator('.copy-status')).toHaveText('Copied!')
      const clip = page.locator('.recipe-full-screen video')
      await clip.scrollIntoViewIfNeeded()
      await expect(clip).toBeInViewport()
      await clip.evaluate(async (video) => {
        await new Promise(requestAnimationFrame)
        video.muted = true
        await video.play()
      })
      await expect
        .poll(() => clip.evaluate((video) => video.currentTime))
        .toBeGreaterThan(0.1)
      await page.screenshot({ path: `${output}/${name}-drive-${slug}.png` })
      for (const locale of ['', '/pt-BR', '/es', '/zh-Hans']) {
        await page.goto(`${base}${locale}/recipes/drive-${slug}`)
        await expect(page.locator('.recipe-code pre code')).toContainText(
          snapshot.slice(0, 35),
        )
        for (const width of [1440, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 })
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${name} ${locale} drive-${slug} overflow at ${width}`,
          ).toBe(true)
        }
      }
      await page.setViewportSize({ width: 1440, height: 1000 })
    }

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
      await expect(page.locator('.recipe-card')).toHaveCount(18)
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
    await expect(page.locator('[data-showcase-ready="true"]')).toBeVisible()
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
        if (width === 390) {
          await page.locator('.motion-menu').click()
          await expect(page.locator('.motion-nav-links')).toBeVisible()
          await page.locator('.motion-menu').click()
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

    // Shared documentation shell: prose, API tables, code, clips and mobile navigation.
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.evaluate(() => localStorage.removeItem('jolt-reduce-motion'))
    for (const locale of ['', '/pt-BR', '/es', '/zh-Hans']) {
      for (const slug of [
        '',
        'frameworks',
        'api',
        'install',
        'device-sensors',
        'web-support',
        'image-effects',
        'not-there-yet',
      ]) {
        await page.goto(`${base}${locale}/guide/${slug}`)
        await expect(page.locator('[data-doc-motion-ready="true"]')).toBeVisible()
        await expect(page.locator('.doc-context')).toContainText(version)
        for (const width of [1440, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 1000 })
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${name} ${locale} ${slug} docs overflow at ${width}`,
          ).toBe(true)
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${base}/pt-BR/guide/frameworks`)
    await expect(page.locator('[data-doc-motion-ready="true"]')).toBeVisible()
    await expect(page.locator('.vp-doc')).toContainText('Disponíveis desde a')
    await expect(page.locator('.vp-doc')).not.toContainText('ainda não estão na RC.10')
    const progress = page.locator('.doc-reading-progress')
    const beforeProgress = await progress.evaluate(
      (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11,
    )
    await page.mouse.wheel(0, 600)
    await expect
      .poll(() =>
        progress.evaluate(
          (el) => new DOMMatrixReadOnly(getComputedStyle(el).transform).m11,
        ),
      )
      .toBeGreaterThan(beforeProgress)
    await page.evaluate(() => scrollTo(0, 0))
    await page.screenshot({ path: `${output}/${name}-documentation.png` })
    const wasDark = await page
      .locator('html')
      .evaluate((el) => el.classList.contains('dark'))
    await page.locator('.VPSwitchAppearance').first().click()
    await expect
      .poll(() => page.locator('html').evaluate((el) => el.classList.contains('dark')))
      .toBe(!wasDark)
    await page.screenshot({ path: `${output}/${name}-documentation-other-theme.png` })
    await page.locator('.VPSwitchAppearance').first().click()
    await page.setViewportSize({ width: 768, height: 1000 })
    await page.locator('.VPNavBarHamburger').click()
    await expect(page.locator('#VPNavScreen')).toBeVisible()
    await page.locator('.VPNavBarHamburger').click()
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(`${base}/guide/showcase#morrow`)
    await expect(page.locator('[data-showcase-ready="true"]')).toBeVisible()
    const morrow = page.locator('[aria-labelledby="morrow"] video')
    await morrow.scrollIntoViewIfNeeded()
    await expect.poll(() => morrow.evaluate((v) => v.currentTime)).toBeGreaterThan(0.1)
    const stage = page.locator('[aria-labelledby="morrow"] .showcase-stage')
    const stageBefore = await stage.evaluate((el) => getComputedStyle(el).transform)
    await page.mouse.wheel(0, 100)
    await expect
      .poll(() => stage.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe(stageBefore)
    await page.screenshot({ path: `${output}/${name}-morrow-showcase.png` })
    await page.locator('.showcase-community').scrollIntoViewIfNeeded()
    await expect.poll(() => morrow.evaluate((v) => v.paused)).toBe(true)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await morrow.scrollIntoViewIfNeeded()
    await expect.poll(() => morrow.evaluate((v) => v.paused)).toBe(true)
    await page.locator('[data-watch="morrow"]').click()
    await expect.poll(() => morrow.evaluate((v) => v.paused)).toBe(false)
    await page.getByRole('combobox').selectOption('pt-BR')
    await expect(page).toHaveURL(/pt-BR\/guide\/showcase#morrow/)
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    // A second source project must keep its own showcase, snapshot and lifecycle.
    await page.goto(base)
    await expect(page.locator('[data-hexdrop-ready="true"]')).toBeVisible()
    await page.locator('.hexdrop-feature').scrollIntoViewIfNeeded()
    const hexPhone = page.locator('.hexdrop-phone')
    const hexPose = await hexPhone.evaluate((el) => getComputedStyle(el).transform)
    await page.mouse.wheel(0, 140)
    await expect
      .poll(() => hexPhone.evaluate((el) => getComputedStyle(el).transform))
      .not.toBe(hexPose)
    const hexVideo = hexPhone.locator('video')
    await hexVideo.evaluate(async (video) => {
      video.muted = true
      await video.play()
    })
    await expect.poll(() => hexVideo.evaluate((v) => v.currentTime)).toBeGreaterThan(0.1)
    await page.screenshot({ path: `${output}/${name}-hexdrop-home.png` })
    await page.locator('.hexdrop-primary').click()
    await expect(page).toHaveURL(/guide\/showcase#hexdrop/)
    await expect(page.locator('#hexdrop')).toHaveText('Hexdrop.')
    await page.locator('[data-watch="hexdrop"]').click()
    const hexNative = page.locator('[aria-labelledby="hexdrop"] video')
    await expect.poll(() => hexNative.evaluate((v) => v.currentTime)).toBeGreaterThan(0.1)
    await page.screenshot({ path: `${output}/${name}-hexdrop-showcase.png` })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect.poll(() => hexNative.evaluate((v) => v.paused)).toBe(true)
    await page.locator('[data-watch="hexdrop"]').click()
    await expect.poll(() => hexNative.evaluate((v) => v.paused)).toBe(false)
    await page.getByRole('combobox').selectOption('pt-BR')
    await expect(page).toHaveURL(/pt-BR\/guide\/showcase#hexdrop/)
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.goto(`${base}/recipes/?q=Hexdrop`)
    await expect(page.locator('.recipe-card')).toHaveCount(2)
    await page.locator('a[href="/recipes/hexdrop-drag"]').click()
    await expect(page.locator('.recipe-project-link')).toHaveAttribute(
      'href',
      '/guide/showcase#hexdrop',
    )
    const hexSnapshot = await readFile(
      new URL(
        '../docs/recipes/sources/rafaelaugustos/hexdrop/src/composables/useIngredientDrag.ts.txt',
        import.meta.url,
      ),
      'utf8',
    )
    expect(await page.locator('.recipe-code pre code').textContent()).toBe(hexSnapshot)
    await page.locator('.code-topline button').click()
    if (name === 'chromium')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(hexSnapshot)
    await page.getByRole('button', { name: /Copy AI prompt/ }).click()
    if (name === 'chromium') {
      const prompt = await page.evaluate(() => navigator.clipboard.readText())
      expect(prompt).toContain('ebdc02a2652051c982779ea43ba3d76cf99bb538')
      expect(prompt).toContain('transformedRect')
      expect(prompt).toContain('0.1.0-rc.11')
      expect(prompt).toContain(hexSnapshot)
    }
    await expect(page.locator('.recipe-actions a')).toHaveAttribute(
      'href',
      'https://github.com/rafaelaugustos/hexdrop/blob/ebdc02a2652051c982779ea43ba3d76cf99bb538/src/composables/useIngredientDrag.ts',
    )
    await page.screenshot({ path: `${output}/${name}-hexdrop-recipe.png` })
    await page.goto(`${base}/recipes/hexdrop-launch`)
    const launchSnapshot = await readFile(
      new URL(
        '../docs/recipes/sources/rafaelaugustos/hexdrop/src/launch/launch-animation.ts.txt',
        import.meta.url,
      ),
      'utf8',
    )
    expect(await page.locator('.recipe-code pre code').textContent()).toBe(launchSnapshot)
    await expect(page.locator('.recipe-project-link')).toHaveAttribute(
      'href',
      '/guide/showcase#hexdrop',
    )
    await page.locator('.code-topline button').click()
    if (name === 'chromium')
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
        launchSnapshot,
      )
    await page.getByRole('button', { name: /Copy AI prompt/ }).click()
    if (name === 'chromium') {
      const prompt = await page.evaluate(() => navigator.clipboard.readText())
      expect(prompt).toContain('LaunchScreen.vue')
      expect(prompt).toContain('nextTick')
      expect(prompt).toContain(launchSnapshot)
    }
    const launchVideo = page.locator('.recipe-full-screen video')
    await launchVideo.scrollIntoViewIfNeeded()
    await launchVideo.evaluate(async (video) => {
      video.muted = true
      await video.play()
    })
    await expect
      .poll(() => launchVideo.evaluate((v) => v.currentTime))
      .toBeGreaterThan(0.1)
    await page.screenshot({ path: `${output}/${name}-hexdrop-launch.png` })
    for (const locale of ['', '/pt-BR', '/es', '/zh-Hans']) {
      for (const path of [
        '/',
        '/guide/showcase#hexdrop',
        '/recipes/hexdrop-drag',
        '/recipes/hexdrop-launch',
        '/guide/hexdrop-recipes',
      ]) {
        await page.goto(`${base}${locale}${path}`)
        for (const width of [1440, 768, 390, 320]) {
          await page.setViewportSize({ width, height: 900 })
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
            `${name} ${locale}${path} overflow at ${width}`,
          ).toBe(true)
        }
        if (path === '/') {
          await page.locator('.hexdrop-feature').scrollIntoViewIfNeeded()
          await page.screenshot({
            path: `${output}/${name}-hexdrop-mobile-${locale.slice(1) || 'en'}.png`,
          })
        }
      }
    }
    await page.setViewportSize({ width: 1440, height: 1000 })
    await page.goto(base)
    await expect(page.locator('[data-motion-ready="true"]')).toHaveCount(2)
    expect(errors).toEqual([])
    evidence.push({
      browser: name,
      result: 'passed',
      checks:
        'Hexdrop home scroll animation, native playback, showcase, reduced motion, pinned source and clipboard prompt, project-specific backlink, localized home/showcase/recipe/guide in 4 locales × 4 widths; WebGL sculpture, inertial sculpture drag, context-loss fallback, three-metric performance panel, global documentation shell with light/dark themes, reading progress and responsive API/guide pages; animated showcase with reduced-motion playback and preserved anchors; four Jolt Drive recipes with snapshot, clipboard, pinned source, requirements and native playback in four locales, Jolt Drive project links and native playback, preserved Jolt Car walkthrough, published project images, footer navigation, physical evidence playback, spring, stagger, drag/snap, filtering, search, deep links, clipboard, native video playback, home and showcase in 4 locales × 4 widths, mobile navigation, reduced motion, remount',
    })
    console.log(`${name}: all interaction checks passed`)
  } catch (error) {
    failures.push({ browser: name, error: error.stack || String(error), errors })
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
