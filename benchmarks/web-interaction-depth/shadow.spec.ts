import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.depth)
})

test('shadow channels compose with color and retain unrelated coordinates when interrupted', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const target = document.createElement('div')
    target.style.cssText =
      'width:120px;height:80px;background:red;box-shadow:0px 4px 8px rgba(0,0,0,.2)'
    document.getElementById('stage')!.append(target)
    const original = target.style.boxShadow,
      runtime = window.depth.runtime
    const animation = runtime.animate(
      target,
      {
        shadowOpacity: 0.8,
        shadowRadius: 16,
        shadowOffsetX: -20,
        shadowOffsetY: 24,
        shadowColor: '#0000ff',
        backgroundColor: '#00ff00',
        x: 100,
      },
      { duration: 1000, ease: 'linear' },
    )
    await animation.ready
    animation.pause()
    animation.progress = 0.5
    const before = getComputedStyle(target).boxShadow
    const replacement = runtime.animate(
      target,
      { shadowOffsetX: 30 },
      { duration: 1000, ease: 'linear' },
    )
    await replacement.ready
    replacement.pause()
    replacement.progress = 0
    const handoff = getComputedStyle(target).boxShadow
    replacement.progress = 1
    const final = getComputedStyle(target).boxShadow
    const x = new DOMMatrix(getComputedStyle(target).transform).m41
    target.style.width = '180px'
    runtime.refresh(target)
    const refreshed = getComputedStyle(target).boxShadow
    runtime.release(target)
    return {
      before,
      handoff,
      final,
      refreshed,
      x,
      restored: target.style.boxShadow === original,
    }
  })
  expect(result.before).toContain('-10px 14px 20px')
  expect(result.handoff).toBe(result.before)
  expect(result.final).toContain('30px 14px 20px')
  expect(result.refreshed).toBe(result.final)
  expect(result.x).toBeCloseTo(50)
  expect(result.restored).toBe(true)
})

test('unsupported shadows and native-only depth fail before replacing existing motion', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.depth.runtime,
      target = document.createElement('div')
    document.getElementById('stage')!.append(target)
    const animation = runtime.animate(target, { x: 100 }, { duration: 1000 })
    await animation.ready
    animation.pause()
    animation.progress = 0.3
    const checks = [
      'inset 0px 4px 8px black',
      '0px 4px 8px 2px black',
      '0px 4px 8px black, 0px 1px 2px red',
    ].map((shadow) => {
      target.style.boxShadow = shadow
      const original = target.style.boxShadow
      try {
        runtime.animate(target, { shadowRadius: 20, x: 300 })
        return false
      } catch {
        return target.style.boxShadow === original && animation.progress === 0.3
      }
    })
    const depth = ['elevation', 'translationZ'].map((p) => {
      try {
        runtime.animate(target, { [p]: 10 })
        return false
      } catch {
        return animation.progress === 0.3
      }
    })
    runtime.release(target)
    return { checks, depth }
  })
  expect(result.checks).toEqual([true, true, true])
  expect(result.depth).toEqual([true, true])
})

test('bindings keep signed offsets, reduced motion settles numeric shadows, and release preserves external edits', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.depth.scope.dispose()
    const runtime = window.depth.runtime,
      target = document.getElementById('source')!
    runtime.release(target)
    target.style.boxShadow = 'none'
    const scope = runtime.scope(),
      x = scope.motionValue(-16),
      opacity = scope.motionValue(0.6)
    scope.bind(target, { shadowOffsetX: x, shadowOpacity: opacity })
    const before = getComputedStyle(target).boxShadow
    runtime.configure({ reducedMotion: 'always' })
    const reduced = runtime.animate(
      target,
      { shadowRadius: 24, shadowOffsetY: 20 },
      { duration: 1000 },
    )
    await reduced.ready
    const final = getComputedStyle(target).boxShadow
    target.style.setProperty('box-shadow', '1px 2px 3px red', 'important')
    const external = target.style.boxShadow
    runtime.release(target)
    scope.dispose()
    return {
      before,
      final,
      reduced: await reduced.finished,
      retained: target.style.boxShadow === external,
      priority: target.style.getPropertyPriority('box-shadow'),
      resources: runtime.diagnostics({ development: true }).snapshot().resources,
    }
  })
  expect(result.before).toContain('-16px 0px 0px')
  expect(result.final).toContain('-16px 20px 48px')
  expect(result.reduced).toBe(true)
  expect(result.retained).toBe(true)
  expect(result.priority).toBe('important')
  expect(result.resources.values).toBe(0)
  expect(result.resources.frameTasks).toBe(0)
})
