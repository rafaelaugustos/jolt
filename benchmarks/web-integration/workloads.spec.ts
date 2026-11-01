import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => integrationLab.unmount())
})

test('combined partial interruption, controls and press disposal preserve unrelated channels', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const el = document.createElement('button')
    document.body.append(el)
    const runtime = integrationLab.createWebRuntime(document, { reducedMotion: 'never' })
    runtime.set(el, { scale: 1.2 })
    const press = runtime.press(el, { scale: 0.96 })
    const a = runtime.animate(el, { x: 150, y: 90, rotate: 20 }, { duration: 800 })
    await a.ready
    await new Promise((r) => setTimeout(r, 100))
    const before = runtime.inspect(el).tracks!.find((t) => t.property === 'x')!
    const b = runtime.animate(el, { x: 260 }, 'snappy')
    await b.ready
    const after = runtime.inspect(el).tracks!.find((t) => t.property === 'x')!
    const inherited = Math.abs(after.initialVelocity - before.velocity) < 80
    a.pause()
    const paused = runtime
      .inspect(el)
      .tracks!.filter((t) => t.property === 'y' || t.property === 'rotate')
      .every((t) => t.paused)
    a.progress = 0.5
    a.play()
    el.dispatchEvent(
      new PointerEvent('pointerdown', {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        buttons: 1,
        bubbles: true,
      }),
    )
    await press.animation!.finished
    window.dispatchEvent(
      new PointerEvent('pointerup', {
        pointerId: 1,
        isPrimary: true,
        button: 0,
        bubbles: true,
      }),
    )
    press.dispose()
    await Promise.all([a.finished, b.finished])
    const pose = runtime.inspect(el).pose,
      effects = el.getAnimations().length
    runtime.dispose()
    const cleanup = runtime.inspect(el)
    el.remove()
    return { inherited, paused, pose, effects, cleanup }
  })
  expect(result.inherited).toBe(true)
  expect(result.paused).toBe(true)
  expect(result.pose?.x).toBeCloseTo(260, 3)
  expect(result.pose?.y).toBeCloseTo(90, 3)
  expect(result.pose?.scaleX).toBeCloseTo(1.2, 3)
  expect(result.cleanup).toMatchObject({
    targets: 0,
    animations: 0,
    observers: 0,
    pendingFrame: false,
  })
})

test('100-card preparation, effect/keyframe counts and teardown workload', async ({
  page,
  browser,
}, info) => {
  const measurements = await page.evaluate(async () => {
    const samples = []
    for (let round = 0; round < 6; round++) {
      const runtime = integrationLab.createWebRuntime(document, {
        reducedMotion: 'never',
      })
      const nodes = Array.from({ length: 100 }, () => {
        const el = document.createElement('div')
        el.style.cssText = 'width:12px;height:12px;background:#8065ed'
        document.body.append(el)
        return el
      })
      const begin = performance.now()
      const animation = runtime.animate(
        nodes,
        { x: 180, scale: 1.2, opacity: 0.5 },
        'snappy',
      )
      const prepareMs = performance.now() - begin
      await animation.ready
      const stats = nodes.map((el) => runtime.inspect(el))
      const teardown = performance.now()
      runtime.dispose()
      const teardownMs = performance.now() - teardown
      const cleanup = runtime.inspect(nodes[0]!)
      for (const el of nodes) el.remove()
      if (round)
        samples.push({
          prepareMs,
          teardownMs,
          keyframes: stats.reduce((n, s) => n + (s.keyframes ?? 0), 0),
          effects: stats.reduce((n, s) => n + (s.effects ?? 0), 0),
          cleanup,
        })
    }
    return samples
  })
  await info.attach('workload.json', {
    body: JSON.stringify(
      { browser: browser.version(), cards: 100, warmups: 1, samples: measurements },
      null,
      2,
    ),
    contentType: 'application/json',
  })
  for (const m of measurements) {
    // Coarse CI regression ceilings, not a frame-time or mobile smoothness claim.
    expect(m.prepareMs).toBeLessThan(1000)
    expect(m.teardownMs).toBeLessThan(100)
    expect(m.keyframes).toBeLessThanOrEqual(12500)
    expect(m.effects).toBeLessThanOrEqual(200)
    expect(m.cleanup).toMatchObject({
      targets: 0,
      animations: 0,
      observers: 0,
      pendingFrame: false,
    })
  }
})

test('repeated mount/press/unmount returns observers, listeners and frames to baseline', async ({
  page,
  browserName,
  browser,
}, info) => {
  await page.evaluate(() => {
    const nativeAdd = EventTarget.prototype.addEventListener,
      nativeRemove = EventTarget.prototype.removeEventListener
    const entries = new Set<any>(),
      interesting = new Set([
        'pointerdown',
        'pointerup',
        'pointercancel',
        'lostpointercapture',
        'pointerleave',
        'pointermove',
        'keydown',
        'keyup',
        'blur',
        'visibilitychange',
        'scroll',
        'change',
      ])
    EventTarget.prototype.addEventListener = function (type, cb, options) {
      if (interesting.has(type) && cb) {
        const capture = typeof options === 'boolean' ? options : !!options?.capture
        const entry = { target: this, type, cb, capture }
        entries.add(entry)
        if (typeof options === 'object' && options.signal)
          nativeAdd.call(options.signal, 'abort', () => entries.delete(entry), {
            once: true,
          })
      }
      return nativeAdd.call(this, type, cb, options)
    }
    EventTarget.prototype.removeEventListener = function (type, cb, options) {
      const capture = typeof options === 'boolean' ? options : !!options?.capture
      for (const entry of entries)
        if (
          entry.target === this &&
          entry.type === type &&
          entry.cb === cb &&
          entry.capture === capture
        )
          entries.delete(entry)
      return nativeRemove.call(this, type, cb, options)
    }
    const NativeObserver = MutationObserver,
      live = new Set<any>()
    globalThis.MutationObserver = class extends NativeObserver {
      observe(...args: Parameters<MutationObserver['observe']>) {
        live.add(this)
        super.observe(...args)
      }
      disconnect() {
        live.delete(this)
        super.disconnect()
      }
    }
    globalThis.resourceAudit = () => ({
      listeners: entries.size,
      observers: live.size,
      animations: document.getAnimations().length,
    })
  })
  const client =
    browserName === 'chromium' ? await page.context().newCDPSession(page) : null
  if (client) {
    await client.send('HeapProfiler.collectGarbage')
    await client.send('HeapProfiler.startSampling', {
      samplingInterval: 32768,
      includeObjectsCollectedByMajorGC: true,
      includeObjectsCollectedByMinorGC: true,
    })
  }
  const before = client ? await client.send('Runtime.getHeapUsage') : null
  for (let round = 0; round < 30; round++) {
    await page.evaluate(async () => {
      const s = integrationLab.mount({ duration: 90 })
      await s.nextTick()
      const el = s.target.value!
      el.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 1,
          isPrimary: true,
          button: 0,
          buttons: 1,
          bubbles: true,
        }),
      )
      s.motion.animate({ scale: 1.2, x: 40 }, 'snappy')
      s.show.value = false
      await s.nextTick()
      integrationLab.unmount()
    })
  }
  await page.waitForTimeout(200)
  const resources = await page.evaluate(() => globalThis.resourceAudit())
  expect(resources).toEqual({ listeners: 0, observers: 0, animations: 0 })
  const heapBeforeGC = client ? await client.send('Runtime.getHeapUsage') : null
  const allocationProfile = client
    ? (await client.send('HeapProfiler.stopSampling')).profile
    : null
  const sampledAllocatedBytes =
    allocationProfile?.samples.reduce((n, s) => n + s.size, 0) ?? null
  if (client) await client.send('HeapProfiler.collectGarbage')
  const after = client ? await client.send('Runtime.getHeapUsage') : null
  const retainedBytes = before && after ? after.usedSize - before.usedSize : null
  // Browser/JIT warmup is included. This detects runaway retention, not zero allocation.
  if (retainedBytes !== null) expect(retainedBytes).toBeLessThan(2_000_000)
  if (sampledAllocatedBytes !== null)
    expect(sampledAllocatedBytes).toBeLessThan(200_000_000)
  await info.attach('cleanup.json', {
    body: JSON.stringify(
      {
        browser: browser.version(),
        cycles: 30,
        resources,
        heapBefore: before,
        heapBeforeGC,
        sampledAllocatedBytes,
        heapAfter: after,
        retainedBytes,
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})

test('real pointer input records handler preparation and next presentation opportunity', async ({
  page,
  browser,
}, info) => {
  await page.evaluate(async () => {
    const s = integrationLab.mount({ duration: 0 })
    await s.nextTick()
    globalThis.inputSamples = []
    const el = s.target.value!
    let handlerAt = 0
    el.addEventListener(
      'pointerdown',
      () => {
        handlerAt = performance.now()
      },
      { capture: true },
    )
    window.addEventListener('pointerdown', (event) => {
      const preparedAt = performance.now()
      requestAnimationFrame(() =>
        globalThis.inputSamples.push({
          eventToHandlerMs: handlerAt - event.timeStamp,
          handlerToPreparedMs: preparedAt - handlerAt,
          eventToFrameCallbackMs: performance.now() - event.timeStamp,
        }),
      )
    })
  })
  const box = (await page.locator('#card').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 5; i++) {
    await page.mouse.down()
    await page.waitForTimeout(120)
    await page.mouse.up()
    await page.waitForTimeout(120)
  }
  const samples = await page.evaluate(() => globalThis.inputSamples)
  expect(samples).toHaveLength(5)
  for (const s of samples) expect(s.handlerToPreparedMs).toBeLessThan(100)
  await info.attach('input.json', {
    body: JSON.stringify(
      {
        browser: browser.version(),
        samples,
        note: 'rAF callback latency is not display latency or compositor smoothness.',
      },
      null,
      2,
    ),
    contentType: 'application/json',
  })
})
