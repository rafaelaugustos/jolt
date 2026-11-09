import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.goto('/tools')
  await page.waitForFunction(() => (window as any).tools)
})
test('sensor replay uses canonical mappings, pauses and never claims hardware availability', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const t = (window as any).tools,
      { source } = t.make('gyroscope', {
        coordinates: 'interface',
        reducedMotion: 'continue',
      })
    const r = t.replaySensor(
      source,
      [
        { time: 0, values: [1, 0, 0], orientation: 90 },
        { time: 100, values: [2, 0, 0], orientation: 90 },
        { time: 200, values: [3, 0, 0], orientation: 90 },
      ],
      { manual: true },
    )
    r.advanceTo(0)
    const first = source.snapshot()
    source.pause()
    let paused = false
    try {
      r.advanceTo(100)
    } catch {
      paused = true
    }
    source.play()
    r.advanceTo(100)
    const second = source.snapshot()
    r.advanceTo(200)
    const completed = await r.finished,
      last = source.snapshot()
    source.dispose()
    return { first, second, last, paused, completed }
  })
  expect(result.first).toMatchObject({
    backend: 'replay',
    sampleSource: 'replay',
    available: false,
    unit: 'rad/s',
  })
  expect(result.first.values[1]).toBeCloseTo(-1)
  expect(result.second.values[1]).toBeCloseTo(-2)
  expect(result.last.sampleSource).toBe('replay')
  expect(result.last.available).toBe(false)
  expect(result.paused).toBe(true)
  expect(result.completed).toBe(true)
})
test('invalid replacement preserves replay, input is copied and source disposal cancels it', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const t = (window as any).tools,
      { source } = t.make('gravity', { reducedMotion: 'continue' })
    const samples = [
      { time: 0, values: [1, 0, 0] },
      { time: 100, values: [2, 0, 0] },
    ]
    const r = t.replaySensor(source, samples, { manual: true })
    samples[0].values[0] = 99
    let rejected = false
    try {
      t.replaySensor(source, [samples[1], samples[0]], { manual: true })
    } catch {
      rejected = true
    }
    r.advanceTo(0)
    const x = source.x.get()
    source.dispose()
    return { rejected, x, finished: await r.finished, disposed: r.disposed }
  })
  expect(result).toEqual({ rejected: true, x: 1, finished: false, disposed: true })
})
test('replay detaches only its sensor and restores actual event acquisition', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: class SyntheticDeviceMotion {},
    })
    const t = (window as any).tools,
      a = t.make('acceleration', {
        coordinates: 'device',
        reducedMotion: 'continue',
      }).source,
      b = t.make('acceleration', {
        coordinates: 'device',
        reducedMotion: 'continue',
      }).source
    const supported = a.snapshot().backend === 'device-motion'
    const r = t.replaySensor(
      a,
      [
        { time: 0, values: [9, 0, 0] },
        { time: 100, values: [8, 0, 0] },
      ],
      { manual: true },
    )
    r.advanceTo(0)
    t.event(3)
    const during = [a.x.get(), b.x.get()]
    r.stop()
    t.event(4)
    const after = [a.x.get(), b.x.get()]
    a.dispose()
    b.dispose()
    return { supported, during, after }
  })
  expect(result.during[0]).toBe(9)
  if (result.supported) {
    expect(result.during[1]).toBe(3)
    expect(result.after).toEqual([4, 4])
  }
})
test('automatic replay freezes its clock and resumes without duplicate samples', async ({
  page,
}) => {
  await page.evaluate(() => {
    const t = (window as any).tools,
      { source } = t.make('linearAcceleration', { reducedMotion: 'continue' })
    t.source = source
    t.replay = t.replaySensor(source, [
      { time: 0, values: [1, 0, 0] },
      { time: 300, values: [2, 0, 0] },
      { time: 650, values: [3, 0, 0] },
    ])
  })
  await expect
    .poll(() => page.evaluate(() => (window as any).tools.source.snapshot().samples))
    .toBeGreaterThan(0)
  const time = await page.evaluate(() => {
    const r = (window as any).tools.replay
    r.pause()
    return r.time
  })
  await page.waitForTimeout(150)
  expect(await page.evaluate(() => (window as any).tools.replay.time)).toBe(time)
  await page.evaluate(() => (window as any).tools.replay.play())
  expect(await page.evaluate(() => (window as any).tools.replay.finished)).toBe(true)
  expect(await page.evaluate(() => (window as any).tools.source.snapshot().samples)).toBe(
    3,
  )
})
test('inspector samples bounded CSS observations, gaps and explicit replacement markers', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const t = (window as any).tools
    await t.runtime.animate(t.node, { x: 40 }, { duration: 0 }).finished
    const sample = t.inspector.sample('card', 'x', 40, 'replace')
    t.node.remove()
    const gap = t.inspector.sample('card', 'x', null)
    const plot = t.inspector.plot('card', 'x')
    for (let i = 0; i < 50; i++) t.inspector.sample('card', 'x', null)
    const size = t.inspector.samples('card', 'x').length
    t.inspector.dispose()
    let rejected = false
    try {
      t.inspector.sample('card', 'x', 0)
    } catch {
      rejected = true
    }
    return { sample, gap, plot, size, rejected }
  })
  expect(result.sample.observed).toBeCloseTo(40)
  expect(result.sample.source).toBe('computed-style')
  expect(result.gap.observed).toBe(null)
  expect(result.gap.source).toBe('unavailable')
  expect(result.plot).toContain('<title>replace</title>')
  expect(result.size).toBe(32)
  expect(result.rejected).toBe(true)
})

test('replay respects no demand, page visibility and system reduced motion', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect
    .poll(() => page.evaluate(() => (window as any).tools.runtime.reducedMotion()))
    .toBe(true)
  const paused = await page.evaluate(() => {
    const t = (window as any).tools,
      source = t.runtime.sensor('gravity')
    t.source = source
    t.replay = t.replaySensor(
      source,
      [
        { time: 0, values: [1, 0, 0] },
        { time: 100, values: [2, 0, 0] },
      ],
      { manual: true },
    )
    const idle = t.replay.paused
    t.off = source.x.subscribe(() => {})
    return { idle, accessibility: t.replay.paused }
  })
  expect(paused).toEqual({ idle: true, accessibility: true })
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect
    .poll(() => page.evaluate(() => (window as any).tools.replay.paused))
    .toBe(false)
  const lifecycle = await page.evaluate(() => {
    const t = (window as any).tools
    t.replay.advanceTo(0)
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
    const hidden = t.replay.paused
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
    const visible = !t.replay.paused
    t.off()
    const undemanded = t.replay.paused
    t.source.dispose()
    return { hidden, visible, undemanded }
  })
  expect(lifecycle).toEqual({ hidden: true, visible: true, undemanded: true })
})
test('synthetic replay preserves denied permission and handles disposal from a status callback', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: class {
        static requestPermission() {
          return Promise.resolve('denied')
        }
      },
    })
    const t = (window as any).tools,
      source = t.make('gravity', { reducedMotion: 'continue' }).source
    await source.requestPermission()
    const r = t.replaySensor(
      source,
      [
        { time: 0, values: [1, 0, 0] },
        { time: 100, values: [2, 0, 0] },
      ],
      { manual: true },
    )
    r.advanceTo(0)
    const synthetic = source.snapshot()
    r.stop()
    const denied = source.status
    source.dispose()
    let disposeOnStart = false,
      other: any
    other = t.runtime.sensor('gravity', {
      reducedMotion: 'continue',
      onStatus(status: string) {
        if (disposeOnStart && status === 'starting') other.dispose()
      },
    })
    other.x.subscribe(() => {})
    disposeOnStart = true
    const cancelled = t.replaySensor(other, [
      { time: 0, values: [1, 0, 0] },
      { time: 100, values: [2, 0, 0] },
    ])
    return {
      synthetic,
      denied,
      cancelled: await cancelled.finished,
      disposed: cancelled.disposed,
    }
  })
  expect(result.synthetic.available).toBe(false)
  expect(result.synthetic.sampleSource).toBe('replay')
  expect(result.denied).toBe('denied')
  expect(result.cancelled).toBe(false)
  expect(result.disposed).toBe(true)
})
test('rotation replay normalizes quaternions and recenters against the next sample', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const t = (window as any).tools,
      source = t.make('rotation', {
        coordinates: 'device',
        reducedMotion: 'continue',
      }).source
    const r = t.replaySensor(
      source,
      [
        { time: 0, values: [0, 0, 0, 2] },
        { time: 100, values: [0, 0, Math.SQRT1_2, Math.SQRT1_2] },
        { time: 200, values: [0, 0, 1, 0] },
      ],
      { manual: true },
    )
    r.advanceTo(0)
    r.advanceTo(100)
    const before = source.snapshot().values
    source.recenter()
    r.advanceTo(200)
    const after = source.snapshot().values
    source.dispose()
    return { before, after }
  })
  expect(result.before[2]).toBeCloseTo(Math.PI / 2)
  expect(result.after.slice(0, 3)).toEqual([0, 0, 0])
  expect(result.after[6]).toBeCloseTo(1)
})
