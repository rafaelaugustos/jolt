import { chromium, webkit, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import {
  exercisePlaygroundInput,
  reviewPlaygroundShell,
} from './playground-interactions.mjs'

const base = process.env.JOLT_SITE_URL || 'http://127.0.0.1:5184'
const output = process.env.JOLT_PLAYGROUND_ARTIFACTS || '/tmp/jolt-playground-review'
await mkdir(output, { recursive: true })
const failures = []
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await engine.launch()
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'no-preference',
  })
  const page = await context.newPage()
  const errors = []
  let currentDemo = 'startup'
  page.on('pageerror', (error) => errors.push(`${currentDemo}: ${error.stack}`))
  page.on('console', (message) => {
    if (message.type() === 'error' && /\[Jolt/.test(message.text()))
      errors.push(`${currentDemo}: ${message.text()}`)
  })
  await page.route(/googletagmanager|google-analytics/, (route) => route.abort())
  await page.goto(`${base}/#playground`)
  await expect(page.locator('#playground')).toHaveAttribute('data-motion-ready', 'true')
  await page.locator('#playground').scrollIntoViewIfNeeded()
  const ids = await page
    .locator('[data-experiment]')
    .evaluateAll((nodes) => nodes.map((node) => node.dataset.experiment))
  for (const id of process.env.JOLT_PLAYGROUND_INPUT_ONLY ? [] : ids) {
    currentDemo = id
    try {
      await page.locator(`[data-experiment="${id}"]`).click()
      const demo = page.locator(`[data-demo="${id}"]`)
      await demo.locator('.lab-stage').scrollIntoViewIfNeeded()
      await expect(demo).toHaveAttribute('data-demo-ready', 'true')
      await expect(demo).toHaveAttribute('data-demo-error', 'false')
      await demo.locator('.replay-button').click()
      await page.waitForTimeout(id.startsWith('sensor-') ? 2300 : 650)
      if (id === 'modal') {
        await expect(page.locator('.lab-dialog')).toBeVisible()
        await page.keyboard.press('Escape')
      }
      for (const action of await demo.locator('[data-action]').all()) {
        await action.click()
        await page.waitForTimeout(180)
      }
      const range = demo.locator('input[type=range]')
      if (await range.count()) {
        await range.focus()
        await range.press('ArrowRight')
      }
      await expect(demo).toHaveAttribute('data-demo-error', 'false')
      await page.screenshot({ path: `${output}/${name}-${id}.png` })
      console.log(`${name}: ${id}`)
    } catch (error) {
      failures.push(`${name}/${id}: ${error.message}`)
      await page.screenshot({ path: `${output}/${name}-${id}-failed.png` })
      console.error(`${name}: ${id}: ${error.message.split('\n')[0]}`)
      await page.keyboard.press('Escape')
    }
  }
  try {
    currentDemo = 'gesture and shell review'
    await exercisePlaygroundInput(page)
    await reviewPlaygroundShell(page, base, name)
  } catch (error) {
    failures.push(`${name}/interaction: ${error.message}`)
    await page.screenshot({ path: `${output}/${name}-interaction-failed.png` })
  }
  if (errors.length) failures.push(`${name} browser errors:\n${errors.join('\n')}`)
  await browser.close()
}
await writeFile(`${output}/results.json`, JSON.stringify({ failures }, null, 2))
if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else console.log('All playground experiments passed in Chromium and WebKit.')
