import { test, expect } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

test('Chromium presentation during a blocked main thread', async ({
  page,
  browserName,
  browser,
}, info) => {
  test.skip(
    browserName !== 'chromium',
    'CDP presentation/trace probe is Chromium-only; no compositor claim for other engines.',
  )
  await page.goto('/')
  await page.evaluate(() => {
    integrationLab.unmount()
    document.body.replaceChildren()
    document.body.style.cssText = 'margin:0;padding:0;background:black'
    const el = document.createElement('div')
    el.id = 'probe'
    el.style.cssText =
      'position:absolute;left:20px;top:120px;width:80px;height:80px;background:white;will-change:transform'
    document.body.append(el)
  })
  const client = await page.context().newCDPSession(page)
  const frames: { timestamp: number; data: string }[] = [],
    events: any[] = []
  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    if (metadata.timestamp !== undefined)
      frames.push({ timestamp: metadata.timestamp * 1000, data })
    void client.send('Page.screencastFrameAck', { sessionId })
  })
  client.on('Tracing.dataCollected', ({ value }) => events.push(...value))
  await client.send('Tracing.start', {
    categories:
      'devtools.timeline,blink.user_timing,cc,disabled-by-default-devtools.timeline',
    transferMode: 'ReportEvents',
  })
  await client.send('Page.startScreencast', {
    format: 'png',
    maxWidth: 920,
    maxHeight: 740,
    everyNthFrame: 1,
  })
  const block = await page.evaluate(async () => {
    const runtime = integrationLab.createWebRuntime(document, { reducedMotion: 'never' })
    const el = document.querySelector<HTMLElement>('#probe')!
    const animation = runtime.animate(el, { x: 650 }, { duration: 1400, ease: 'linear' })
    await animation.ready
    await new Promise((r) => setTimeout(r, 200))
    performance.mark('jolt-block-start')
    const start = Date.now(),
      until = performance.now() + 700
    while (performance.now() < until) {
      /* Deliberate main-thread blocking, not animation work. */
    }
    const end = Date.now()
    performance.mark('jolt-block-end')
    await animation.finished
    runtime.dispose()
    return { start, end }
  })
  await client.send('Page.stopScreencast')
  const ended = new Promise<void>((r) =>
    client.once('Tracing.tracingComplete', () => r()),
  )
  await client.send('Tracing.end')
  await ended
  const during = frames.filter(
    (f) => f.timestamp > block.start + 50 && f.timestamp < block.end - 50,
  )
  const unique = [...new Map(during.map((f) => [f.data, f])).values()]
  // Decode actual pixels after playback, outside the measured blocking interval.
  const centers = await page.evaluate(
    async (images) => {
      const result: number[] = []
      for (const data of images) {
        const bitmap = await createImageBitmap(
          await (await fetch('data:image/png;base64,' + data)).blob(),
        )
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
        const context = canvas.getContext('2d')!
        context.drawImage(bitmap, 0, 0)
        const pixels = context.getImageData(0, 0, bitmap.width, bitmap.height).data
        let sum = 0,
          count = 0
        for (let i = 0; i < pixels.length; i += 4)
          if (pixels[i]! > 240 && pixels[i + 1]! > 240 && pixels[i + 2]! > 240) {
            sum += (i / 4) % bitmap.width
            count++
          }
        result.push(count ? sum / count : -1)
        bitmap.close()
      }
      return result
    },
    unique.map((frame) => frame.data),
  )
  expect(centers.every((x) => x >= 0)).toBe(true)
  expect(Math.max(...centers) - Math.min(...centers)).toBeGreaterThan(100)
  await writeFile(info.outputPath('trace.json'), JSON.stringify({ traceEvents: events }))
  await info.attach('browser-trace', {
    path: info.outputPath('trace.json'),
    contentType: 'application/json',
  })
  for (let i = 0; i < Math.min(unique.length, 8); i++)
    await info.attach(`presentation-${i}.png`, {
      body: Buffer.from(
        unique[Math.floor((i * unique.length) / Math.min(unique.length, 8))]!.data,
        'base64',
      ),
      contentType: 'image/png',
    })
  await info.attach('presentation.json', {
    body: JSON.stringify(
      {
        browser: browser.version(),
        block,
        presentedFrames: during.length,
        distinctPresentations: unique.length,
        whiteBoxCenters: centers,
        note: 'Real CDP compositor screencast frames during the marked busy loop; inspect trace in Performance/Perfetto. A single Chromium scene, not a universal GPU promise.',
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
  expect(block.end - block.start).toBeGreaterThanOrEqual(690)
  expect(unique.length).toBeGreaterThanOrEqual(3)
})
