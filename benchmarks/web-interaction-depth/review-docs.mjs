import { chromium, webkit, expect } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const base = process.argv[2] || 'http://127.0.0.1:5197'
const output = process.argv[3] || '/tmp/jolt-interaction-docs-review'
await mkdir(output, { recursive: true })
const report = []
for (const [name, engine] of [
  ['chromium', chromium],
  ['webkit', webkit],
]) {
  const browser = await engine.launch()
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e)))
    await page.route(/googletagmanager|google-analytics/, (r) => r.abort())
    await page.goto(base + '/#playground')
    await expect(page.locator('#playground')).toHaveAttribute('data-motion-ready', 'true')
    for (const id of [
      'drop-zones',
      'timeline-cues',
      'motion-path',
      'rotate-3d',
      'shadow-channels',
    ]) {
      await page.locator(`[data-experiment="${id}"]`).click()
      const demo = page.locator(`[data-demo="${id}"]`)
      await expect(demo).toHaveAttribute('data-demo-ready', 'true')
      await demo.locator('.replay-button').click()
      await page.waitForTimeout(800)
      for (const action of await demo.locator('[data-action]').all()) {
        await action.click()
        await page.waitForTimeout(200)
      }
      await expect(demo).toHaveAttribute('data-demo-error', 'false')
      await page.screenshot({ path: `${output}/${name}-${id}.png` })
      report.push({ browser: name, experiment: id, passed: true })
    }
    await page.goto(base + '/guide/interaction-depth')
    const videos = page.locator('video')
    await expect(videos).toHaveCount(23)
    // Play every reviewed artifact through an actual browser decoder, at normal speed.
    await page.evaluate(async () => {
      const videos = [...document.querySelectorAll('video')]
      if (videos.some((video) => video.autoplay))
        throw new Error('This guide must not autoplay all recordings.')
      await Promise.all(
        videos.map(
          (video) =>
            new Promise((resolve, reject) => {
              video.muted = true
              video.loop = false
              const timeout = setTimeout(
                () => reject(new Error('Video timeout: ' + video.currentSrc)),
                40000,
              )
              video.addEventListener(
                'ended',
                () => {
                  clearTimeout(timeout)
                  resolve(true)
                },
                { once: true },
              )
              video.addEventListener(
                'error',
                () => {
                  clearTimeout(timeout)
                  reject(new Error('Video error: ' + video.currentSrc))
                },
                { once: true },
              )
              const source = video.querySelector('source')
              if (source?.dataset.src) source.src = source.dataset.src
              video.load()
              video.play().catch(reject)
            }),
        ),
      )
    })
    if (errors.length) throw new Error(errors.join('\n'))
    report.push({ browser: name, videosPlayed: 23, errors })
  } finally {
    await browser.close()
  }
}
await writeFile(`${output}/report.json`, JSON.stringify(report, null, 2) + '\n')
console.log(
  'Five playground experiments and all 23 videos passed in Chromium and WebKit.',
)
