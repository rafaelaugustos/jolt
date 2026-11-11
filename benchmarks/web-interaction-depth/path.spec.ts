import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.depth)
})

test('path follows authored local coordinates through transformed ancestors, seeking and refresh', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const parent = document.createElement('div'),
      target = document.createElement('div')
    parent.style.cssText = 'transform:rotate(15deg) scale(1.3);width:400px;height:240px'
    target.style.cssText =
      'width:40px;height:30px;background:teal;transform:translate(7px,9px)'
    parent.append(target)
    document.getElementById('stage')!.append(parent)
    const runtime = window.depth.runtime
    const animation = runtime.animate(
      target,
      { path: 'M0 0 L100 0 L100 100', orient: true, opacity: [0.4, 1] },
      { duration: 1000, ease: 'linear' },
    )
    await animation.ready
    animation.pause()
    animation.progress = 0.75
    const matrix = new DOMMatrix(getComputedStyle(target).transform)
    parent.style.width = '500px'
    runtime.refresh(target)
    const refreshed = new DOMMatrix(getComputedStyle(target).transform)
    const next = runtime.animate(target, { x: 180 }, { duration: 1000, ease: 'linear' })
    await next.ready
    next.pause()
    next.progress = 0
    const replaced = new DOMMatrix(getComputedStyle(target).transform)
    next.progress = 1
    const end = new DOMMatrix(getComputedStyle(target).transform)
    runtime.release(target)
    return {
      matrix: [matrix.m41, matrix.m42, matrix.m11, matrix.m12],
      refreshed: [refreshed.m41, refreshed.m42],
      replaced: [replaced.m41, replaced.m42],
      end: [end.m41, end.m42],
      restored: target.style.transform,
    }
  })
  expect(result.matrix[0]).toBeCloseTo(107, 2)
  expect(result.matrix[1]).toBeCloseTo(59, 2)
  expect(result.matrix[2]).toBeCloseTo(0, 3)
  expect(result.matrix[3]).toBeCloseTo(1, 3)
  expect(result.refreshed).toEqual(result.matrix.slice(0, 2))
  expect(result.replaced).toEqual(result.matrix.slice(0, 2))
  expect(result.end[0]).toBeCloseTo(187, 2)
  expect(result.end[1]).toBeCloseTo(59, 2)
  expect(result.restored).toBe('translate(7px, 9px)')
})

test('relative reverse paths, repeat holds and reduced motion keep coordinated endpoints', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      target = document.getElementById('source')!
    runtime.release(target)
    runtime.set(target, { x: 20, y: 30 })
    const animation = runtime.animate(
      target,
      { path: 'M0 0 L100 100', orient: true },
      {
        relative: true,
        duration: 1000,
        ease: 'linear',
        repeat: 1,
        repeatType: 'reverse',
        repeatDelay: 200,
        delay: 100,
      },
    )
    await animation.ready
    animation.pause()
    animation.progress = 1200 / animation.duration
    const held = new DOMMatrix(getComputedStyle(target).transform)
    animation.progress = 1
    const end = new DOMMatrix(getComputedStyle(target).transform)
    runtime.configure({ reducedMotion: 'always' })
    const reduced = runtime.animate(
      target,
      { path: 'M0 0 Q100 100 200 0', orient: true },
      { duration: 2000 },
    )
    await reduced.ready
    const final = new DOMMatrix(getComputedStyle(target).transform)
    return {
      duration: animation.duration,
      held: [held.m41, held.m42],
      end: [end.m41, end.m42],
      reduced: await reduced.finished,
      final: [final.m41, final.m42],
    }
  })
  expect(result.duration).toBe(2300)
  expect(result.held).toEqual([120, 130])
  expect(result.end).toEqual([20, 30])
  expect(result.reduced).toBe(true)
  expect(result.final).toEqual([200, 0])
})

test('scene paths scrub in sync and invalid descriptors retain the previous ownership', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      target = document.getElementById('source')!
    runtime.release(target)
    const scene = runtime.seekableTimeline(
      [
        {
          at: 200,
          target,
          keyframes: { path: 'M0 0 L120 60' },
          transition: { duration: 1000, ease: 'linear' },
        },
      ],
      { paused: true },
    )
    await scene.ready
    scene.progress = 700 / scene.duration
    const start = new DOMMatrix(getComputedStyle(target).transform)
    const invalid = [
      () => runtime.animate(target, { path: 'M0 0 L10 10', x: 20 }),
      () => runtime.animate(target, { path: 'M0 0 L10 10', orient: true, rotate: 20 }),
      () => runtime.animate(target, { path: 'M0 0 L10 10' }, { x: { duration: 100 } }),
      () => runtime.animate(target, { path: 'M0 0 L10 10' }, { layer: 'path' }),
      () => runtime.animate(target, { path: 'broken' }),
      () => runtime.animate(target, { path: 'M0 0 L100 100' }, { repeat: 1001 }),
    ].map((fn) => {
      try {
        fn()
        return false
      } catch {
        return true
      }
    })
    const kept = scene.progress
    scene.progress = 0
    scene.progress = 1
    const final = new DOMMatrix(getComputedStyle(target).transform)
    runtime.release(target)
    return {
      start: [start.m41, start.m42],
      invalid,
      kept,
      final: [final.m41, final.m42],
      resources: runtime.diagnostics({ development: true }).snapshot().resources,
    }
  })
  expect(result.start).toEqual([60, 30])
  expect(result.invalid).toEqual(Array(6).fill(true))
  expect(result.kept).toBeCloseTo(700 / 1200)
  expect(result.final).toEqual([120, 60])
  expect(result.resources.frameTasks).toBe(0)
})

test('an immediate animate replacing a running or paused path settles the rendered transform', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.depth.runtime
    const path = 'M 0 0 Q 36 -76 88 -12 C 128 36 172 -64 196 0'
    const rendered = (target: HTMLElement) => {
      const m = new DOMMatrix(getComputedStyle(target).transform)
      return [m.e, m.f, (Math.atan2(m.b, m.a) * 180) / Math.PI].map(
        (n) => Math.round(n * 10) / 10 || 0,
      )
    }
    const results: Record<string, number[][]> = {}
    for (const phase of ['running', 'paused'] as const) {
      const target = document.createElement('div')
      target.style.cssText = 'width:40px;height:30px;background:teal'
      document.getElementById('stage')!.append(target)
      const animation = runtime.animate(
        target,
        { path, orient: true },
        { duration: 1400, ease: 'easeInOut' },
      )
      await animation.ready
      animation.pause()
      animation.progress = 0.43
      if (phase === 'running') animation.play()
      const before = rendered(target)
      runtime.animate(target, { x: 0, y: 0, rotate: 0 }, { duration: 0 })
      await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)))
      results[phase] = [before, rendered(target)]
      runtime.release(target)
      target.remove()
    }
    return results
  })
  for (const [before, after] of Object.values(result)) {
    expect(Math.abs(before![1]!)).toBeGreaterThan(5)
    expect(after).toEqual([0, 0, 0])
  }
})
