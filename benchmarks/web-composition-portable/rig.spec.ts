import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.composition?.rig)
})

test('shared rig clamps spring samples, interrupts current presentation and keeps sockets on the hand', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { rig, rigTargets, flower } = window.composition,
      hand = rigTargets.hand!
    const first = rig.to('wave', { duration: 1000, ease: 'linear' })
    first.pause()
    first.progress = 0.5
    const angle = () =>
      (Math.atan2(
        new DOMMatrixReadOnly(getComputedStyle(hand).transform).b,
        new DOMMatrixReadOnly(getComputedStyle(hand).transform).a,
      ) *
        180) /
      Math.PI
    const before = angle(),
      second = rig.to('reach', 'bouncy')
    second.pause()
    second.progress = 0
    const after = angle()
    const samples = Array.from({ length: 101 }, (_, i) => {
      second.progress = i / 100
      return angle()
    })
    second.progress = 0.8
    const point = rig.point('grip'),
      stage = document.querySelector('#rig-stage')!.getBoundingClientRect(),
      rect = flower.getBoundingClientRect()
    const delta = [
      point.x + stage.left - (rect.left + rect.width / 2),
      point.y + stage.top - (rect.top + rect.height / 2),
    ]
    second.stop()
    return {
      before,
      after,
      first: await first.finished,
      second: await second.finished,
      samples,
      delta,
    }
  })
  expect(result.before).toBeCloseTo(-27.5, 1)
  expect(result.after).toBeCloseTo(result.before, 1)
  expect(result.samples.length).toBeGreaterThan(2)
  expect(result.samples.every((n) => n >= -70.001 && n <= 70.001)).toBe(true)
  expect(result.first).toBe(false)
  expect(result.second).toBe(false)
  expect(Math.abs(result.delta[0]!)).toBeLessThan(1)
  expect(Math.abs(result.delta[1]!)).toBeLessThan(1)
})

test('rig validation is transactional and teardown preserves newer application channels', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { runtime, rig, rigTargets } = window.composition,
      hand = rigTargets.hand!
    const run = rig.to('wave', { duration: 1000 })
    run.pause()
    run.progress = 0.3
    let duplicate = false,
      pose = false
    try {
      rig.attach({ head: hand })
    } catch {
      duplicate = true
    }
    try {
      rig.to('missing')
    } catch {
      pose = true
    }
    const external = runtime.animate(
      hand,
      { rotate: 20, opacity: 0.5 },
      { duration: 1000 },
    )
    external.pause()
    external.progress = 0.4
    const before = getComputedStyle(hand).transform
    rig.dispose()
    const after = getComputedStyle(hand).transform
    external.progress = 1
    external.play()
    return {
      duplicate,
      pose,
      before,
      after,
      completed: await external.finished,
      opacity: getComputedStyle(hand).opacity,
      disposed: rig.disposed,
    }
  })
  expect(result.duplicate).toBe(true)
  expect(result.pose).toBe(true)
  expect(result.after).toBe(result.before)
  expect(result.completed).toBe(true)
  expect(result.opacity).toBe('0.5')
  expect(result.disposed).toBe(true)
})

test('reduced motion settles poses and pause survives scope suspension', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { runtime, rig, rigTargets } = window.composition,
      scope = runtime.scope()
    scope.retain(rig)
    rig.pause()
    scope.suspend()
    scope.resume()
    const held = rig.paused
    rig.play()
    runtime.configure({ reducedMotion: 'always' })
    const completed = await rig.to('reach').finished
    const matrix = new DOMMatrixReadOnly(getComputedStyle(rigTargets.hand!).transform)
    const angle = (Math.atan2(matrix.b, matrix.a) * 180) / Math.PI
    scope.dispose()
    return { held, completed, angle, disposed: rig.disposed }
  })
  expect(result.held).toBe(true)
  expect(result.completed).toBe(true)
  expect(result.angle).toBeCloseTo(70, 2)
  expect(result.disposed).toBe(true)
})
