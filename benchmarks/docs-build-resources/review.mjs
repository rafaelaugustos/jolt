import { chromium, webkit, expect } from '@playwright/test'

const base = process.env.JOLT_SITE_URL || 'http://127.0.0.1:5189'
for (const [engineName, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await engine.launch()
  try {
    for (const [prefix, query] of [
      ['', 'motionValue'],
      ['/pt-BR', 'motionValue'],
      ['/es', 'motionValue'],
      ['/zh-Hans', '动画'],
    ]) {
      const page = await browser.newPage()
      const errors = []
      const indexes = []
      page.on('pageerror', (error) => errors.push(error.message))
      page.on('response', (response) => {
        if (response.url().includes('@localSearchIndex')) {
          expect(response.ok(), response.url()).toBe(true)
          indexes.push(response.url())
        }
      })
      await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
      await page.goto(`${base}${prefix}/guide/install`)
      await page.locator('.VPNavBarSearch button').click()
      await page.locator('#localsearch-input').fill(query)
      await expect(page.locator('.VPLocalSearchBox .result').first()).toBeVisible()
      expect(indexes).toHaveLength(1)
      const expectedLocale = prefix ? prefix.slice(1) : 'root'
      expect(indexes[0]).toContain(`@localSearchIndex${expectedLocale}.`)
      await page.locator('.VPLocalSearchBox .result').first().click()
      await expect(page.locator('.VPLocalSearchBox')).toHaveCount(0)
      await expect(page.locator('.vp-doc h1')).toBeVisible()
      expect(errors).toEqual([])
      console.log(
        `${engineName} ${expectedLocale}: full-text search, one locale index and result navigation passed`,
      )
      await page.close()
    }
  } finally {
    await browser.close()
  }
}
