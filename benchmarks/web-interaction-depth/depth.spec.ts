import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.depth)
})

test('rotateX/Y compose in a declared order with existing 2D transforms and authored perspective', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const parent = document.createElement('div'),
      target = document.createElement('div')
    parent.style.cssText = 'perspective:800px;perspective-origin:30% 40%;'
    target.style.cssText =
      'width:140px;height:90px;background:teal;transform:translate(9px, 11px) rotate(5deg);transform-origin:20% 30%;'
    parent.append(target)
    document.getElementById('stage')!.append(parent)
    const original = target.style.transform,
      runtime = window.depth.runtime
    const animation = runtime.animate(
      target,
      { x: 40, rotate: 20, rotateX: 60, rotateY: -40, scale: 1.2 },
      { duration: 1000, ease: 'linear' },
    )
    await animation.ready
    const effect = target.getAnimations()[0]!
    effect.pause()
    effect.currentTime = 500
    const matrix = new DOMMatrix(getComputedStyle(target).transform)
    const expected = new DOMMatrix(original)
      .translate(20, 0)
      .rotate(10)
      .rotateAxisAngle(0, 1, 0, -20)
      .rotateAxisAngle(1, 0, 0, 30)
      .scale(1.1)
    const error = Math.max(
      ...Array.from(matrix.toFloat64Array(), (n, i) =>
        Math.abs(n - expected.toFloat64Array()[i]!),
      ),
    )
    animation.pause()
    animation.progress = 0.5
    const before = animation.progress
    target.style.width = '180px'
    runtime.refresh(target)
    const after = animation.progress
    runtime.release(target)
    return {
      error,
      before,
      after,
      perspective: parent.style.perspective,
      restored: target.style.transform === original,
      result: await animation.finished,
    }
  })
  expect(result.error).toBeLessThan(0.001)
  expect(result.after).toBe(result.before)
  expect(result.perspective).toBe('800px')
  expect(result.restored).toBe(true)
  expect(result.result).toBe(false)
})

test('axis replacement preserves unrelated rotation and reduced motion settles spatial tracks', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const target = document.createElement('div')
    target.style.cssText = 'width:120px;height:80px;background:teal'
    document.getElementById('stage')!.append(target)
    const runtime = window.depth.runtime
    const original = runtime.animate(
      target,
      { rotateX: 80, rotateY: 60, opacity: 0.5 },
      { duration: 1000, ease: 'linear' },
    )
    await original.ready
    original.pause()
    original.progress = 0.5
    const replacement = runtime.animate(
      target,
      { rotateX: -40 },
      { duration: 1000, ease: 'linear' },
    )
    await replacement.ready
    replacement.pause()
    replacement.progress = 0
    const start = new DOMMatrix(getComputedStyle(target).transform)
    const expectedStart = new DOMMatrix()
      .rotateAxisAngle(0, 1, 0, 30)
      .rotateAxisAngle(1, 0, 0, 40)
    replacement.progress = 1
    const end = new DOMMatrix(getComputedStyle(target).transform)
    const expectedEnd = new DOMMatrix()
      .rotateAxisAngle(0, 1, 0, 30)
      .rotateAxisAngle(1, 0, 0, -40)
    const error = (a: DOMMatrix, b: DOMMatrix) =>
      Math.max(
        ...Array.from(a.toFloat64Array(), (n, i) => Math.abs(n - b.toFloat64Array()[i]!)),
      )
    const opacity = Number(getComputedStyle(target).opacity)
    runtime.configure({ reducedMotion: 'always' })
    const reduced = runtime.animate(
      target,
      { rotateX: 0, rotateY: 0 },
      { duration: 2000 },
    )
    await reduced.ready
    return {
      start: error(start, expectedStart),
      end: error(end, expectedEnd),
      opacity,
      reduced: await reduced.finished,
      identity: new DOMMatrix(getComputedStyle(target).transform).is2D,
    }
  })
  expect(result.start).toBeLessThan(0.001)
  expect(result.end).toBeLessThan(0.001)
  expect(result.opacity).toBeCloseTo(0.75, 3)
  expect(result.reduced).toBe(true)
  expect(result.identity).toBe(true)
})

test('numeric bindings support both 3D axes and tear down without idle frames', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      target = document.getElementById('source')!
    runtime.release(target)
    const scope = runtime.scope(),
      x = scope.motionValue(20),
      y = scope.motionValue(-30)
    scope.bind(target, { rotateX: x, rotateY: y })
    x.set(45)
    y.set(25)
    Object.assign(window, { depthBindingScope: scope })
  })
  await expect
    .poll(() =>
      page.evaluate(() => {
        const matrix = new DOMMatrix(
          getComputedStyle(document.getElementById('source')!).transform,
        )
        return matrix.m13
      }),
    )
    .toBeCloseTo(-Math.sin((25 * Math.PI) / 180), 4)
  const resources = await page.evaluate(() => {
    const scope = (window as unknown as { depthBindingScope: { dispose(): void } })
      .depthBindingScope
    scope.dispose()
    return window.depth.runtime.diagnostics({ development: true }).snapshot().resources
  })
  expect(resources.values).toBe(0)
  expect(resources.frameTasks).toBe(0)
})

test('3D motion rejects a 2D FLIP inverse without stopping the application owner', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      container = document.createElement('div'),
      target = document.createElement('div')
    target.style.cssText = 'width:100px;height:80px;background:teal'
    container.append(target)
    document.body.append(container)
    const motion = runtime.animate(
      target,
      { rotateX: 50 },
      { duration: 1000, ease: 'linear' },
    )
    await motion.ready
    motion.pause()
    motion.progress = 0.5
    const layout = runtime.animateLayout(container, () => {
      target.style.marginLeft = '50px'
    })
    let error = ''
    try {
      await layout.finished
    } catch (value) {
      error = String(value)
    }
    const matrix = new DOMMatrix(getComputedStyle(target).transform)
    const state = {
      error,
      angle: (Math.atan2(matrix.m23, matrix.m22) * 180) / Math.PI,
      paused: motion.paused,
    }
    runtime.release(target)
    container.remove()
    return state
  })
  expect(result.error).toContain('3D rotation')
  expect(result.angle).toBeCloseTo(25, 2)
  expect(result.paused).toBe(true)
})
