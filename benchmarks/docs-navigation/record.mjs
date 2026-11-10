// Build/preview docs first. Captures real browser input at the original speed.
// JOLT_DOCS_URL may select a dedicated preview; output defaults to /tmp.
import { chromium, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const base = process.env.JOLT_DOCS_URL ?? 'http://127.0.0.1:5187'
const output = process.env.JOLT_DOCS_CAPTURE_DIR ?? '/tmp/jolt-docs-navigation'
mkdirSync(output, { recursive: true })
const browser = await chromium.launch()
try {
  for (const mobile of [false, true]) {
    const viewport = mobile ? { width: 390, height: 844 } : { width: 1320, height: 900 }
    const context = await browser.newContext({
      viewport,
      colorScheme: 'light',
      isMobile: mobile,
      hasTouch: mobile,
      recordVideo: { dir: output, size: viewport },
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`${base}/guide/install`)
    await expect(page.locator('h1')).toBeVisible()
    const theme = async (dark) => {
      if (
        (await page.locator('html').evaluate((n) => n.classList.contains('dark'))) ===
        dark
      )
        return
      if (mobile) await page.locator('.VPNavBarHamburger').tap()
      const toggle = page.locator('.VPSwitchAppearance:visible')
      if (mobile) await toggle.tap()
      else await toggle.click()
      if (mobile) await page.locator('.VPNavBarHamburger').tap()
    }
    await theme(false)
    await page.waitForTimeout(900)
    const sidebar = page.locator('.VPSidebar')
    for (const [path, label] of [
      ['portable-composition', 'New'],
      ['reorder', 'Updated'],
      ['swiftui-geometry', 'Beta'],
    ]) {
      if (mobile) await page.locator('.VPLocalNav .menu').tap()
      const link = sidebar.locator(`a[href="/guide/${path}"]`)
      await link.scrollIntoViewIfNeeded()
      await expect(link.locator('.jolt-nav-status')).toHaveText(label)
      await page.waitForTimeout(1100)
      if (mobile) {
        await link.tap()
      } else {
        await link.hover()
        await page.waitForTimeout(700)
        await link.focus()
        await page.keyboard.press('Enter')
      }
      await expect(page).toHaveURL(new RegExp(`/guide/${path}$`))
      await expect(page.locator('h1')).toBeVisible()
      await page.waitForTimeout(1200)
    }
    await theme(true)
    if (mobile) await page.locator('.VPLocalNav .menu').tap()
    await expect(page.locator('html')).toHaveClass(/dark/)
    await sidebar.locator('a[href="/guide/swiftui-geometry"]').scrollIntoViewIfNeeded()
    await page.waitForTimeout(1600)
    const video = page.video()
    await context.close()
    if (errors.length) throw new Error(errors.join('\n'))
    const target = join(output, `docs-navigation-${mobile ? 'mobile' : 'desktop'}.mp4`)
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
        target,
      ],
      { stdio: 'pipe' },
    )
    execFileSync('ffmpeg', ['-v', 'error', '-i', target, '-f', 'null', '-'], {
      stdio: 'pipe',
    })
    console.log(target)
  }
} finally {
  await browser.close()
}
