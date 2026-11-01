import { expect, test } from '@playwright/test'
import type {} from './fixture.js'

test('retargets at event time under main-thread load, against a live WAAPI reference', async ({
  page,
}, info) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const runtime = lab.createWebRuntime(document, { reducedMotion: 'never' })
    const target = lab.makeTarget(),
      reference = lab.makeTarget('top: 100px')
    const first = runtime.animate(
      [target, reference],
      { x: [0, 10000] },
      { duration: 5000, ease: 'linear' },
    )
    await Promise.all(
      [...target.getAnimations(), ...reference.getAnimations()].map((a) => a.ready),
    )
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const before = runtime.inspect(reference).tracks![0]!
    const busyEnd = performance.now() + 55
    while (performance.now() < busyEnd) {
      /* Deliberately keep the last timeline tick stale. */
    }
    const config = { type: 'spring' as const, duration: 650, bounce: 0.2 }
    runtime.animate(target, { x: -300 }, config)
    const next = runtime.inspect(target).tracks![0]!
    const source = lab.createTrack(
      'x',
      [next.from!, -300],
      lab.resolveTransition(config, 'x', 2),
      2000,
      { timeScale: 1, reducedMotion: false },
    )
    const anchor = Number(next.startTime),
      oldAnchor = Number(before.startTime)
    const samples: {
      observed: number
      expected: number
      earliest: number
      latest: number
      residual: number
    }[] = []
    for (let i = 0; i < 12; i++) {
      await new Promise<void>((r) => requestAnimationFrame(() => r()))
      // A continuing linear WAAPI effect supplies presentation time independently
      // of Jolt's clock. Bracket the target read: WebKit's live style reads can
      // cross a millisecond even inside one rAF. Never charge that interval to
      // the numerical curve tolerance or derive the inherited velocity from CSS.
      const referenceX = new DOMMatrix(getComputedStyle(reference).transform).e
      const observed = new DOMMatrix(getComputedStyle(target).transform).e
      const referenceAfter = new DOMMatrix(getComputedStyle(reference).transform).e
      const earliest = oldAnchor + referenceX / 2 - anchor
      const latest = oldAnchor + referenceAfter / 2 - anchor
      const values = [source.valueAt(earliest), source.valueAt(latest)]
      // Include possible turning points inside this measured observation interval.
      for (let t = earliest + 0.05; t < latest; t += 0.05) values.push(source.valueAt(t))
      const low = Math.min(...values),
        high = Math.max(...values)
      samples.push({
        observed,
        expected: values[0]!,
        earliest,
        latest,
        residual: Math.max(0, low - observed, observed - high),
      })
    }
    first.stop()
    runtime.dispose()
    return {
      anchorError: Math.abs(next.from! - (anchor - oldAnchor) * 2),
      inheritedVelocity: next.initialVelocity,
      elapsedPastCachedTick: next.from! / 2 - Number(before.clockTime),
      maxUnbracketedError: Math.max(
        ...samples.map((s) => Math.abs(s.observed - s.expected)),
      ),
      maxObservationIntervalMs: Math.max(...samples.map((s) => s.latest - s.earliest)),
      maxCurveResidual: Math.max(...samples.map((s) => s.residual)),
      samples,
    }
  })
  await info.attach('event-time-interruption', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  })
  expect(result.anchorError).toBeLessThan(0.001)
  expect(Math.abs(result.inheritedVelocity - 2000)).toBeLessThan(0.5)
  expect(result.elapsedPastCachedTick).toBeGreaterThan(45)
  expect(result.maxObservationIntervalMs).toBeLessThan(10)
  expect(result.maxCurveResidual).toBeLessThan(0.3)
})

test('holds controls while the document timeline is unresolved and releases pending resources', async ({
  page,
}) => {
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const runtime = lab.createWebRuntime(document, { reducedMotion: 'never' })
    const target = lab.makeTarget()
    Object.defineProperty(document.timeline, 'currentTime', {
      configurable: true,
      get: () => null,
    })
    const animation = runtime.animate(
      target,
      { x: [0, 100] },
      { duration: 200, ease: 'linear' },
    )
    animation.pause()
    animation.progress = 0.6
    const pending = runtime.inspect(target)
    delete (document.timeline as unknown as Record<string, unknown>).currentTime
    await animation.ready
    const ready = runtime.inspect(target)
    animation.play()
    const completed = await animation
    runtime.release(target)
    Object.defineProperty(document.timeline, 'currentTime', {
      configurable: true,
      get: () => null,
    })
    const cancelled = runtime.animate(target, { x: 200 }, { duration: 1000 })
    runtime.dispose()
    delete (document.timeline as unknown as Record<string, unknown>).currentTime
    return {
      pending,
      ready,
      completed,
      cancelled: await cancelled,
      disposed: runtime.inspect(target),
    }
  })
  expect(result.pending).toMatchObject({ pendingFrame: true, pose: { x: 60 } })
  expect(result.pending.tracks![0]).toMatchObject({ paused: true, pending: true })
  expect(result.ready.pose!.x).toBe(60)
  expect(result.ready.tracks![0]).toMatchObject({ paused: true, pending: false })
  expect(result.completed).toBe(true)
  expect(result.cancelled).toBe(false)
  expect(result.disposed).toMatchObject({
    targets: 0,
    animations: 0,
    observers: 0,
    pendingFrame: false,
  })
})
