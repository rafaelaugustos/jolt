import { expect, test } from '@playwright/test'
import type {} from './fixture.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
})

test('bounds concurrent nonlinear scale/opacity products in the actual browser effect', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const runtime = lab.createWebRuntime(document, { reducedMotion: 'never' })
    const target = lab.makeTarget()
    runtime.animate(
      target,
      { scale: [1, 2], opacity: [0.1, 1.5] },
      { duration: 3000, ease: 'linear' },
    )
    runtime.animate(
      target,
      { scale: [1, 0.4], opacity: [1, 0.2] },
      { duration: 2600, ease: 'linear', layer: 'feedback' },
    )
    const effect = target.getAnimations()[0]!
    const anchor = Number(effect.startTime)
    const tracks = runtime.inspect(target).tracks!
    effect.pause()
    const errors = Array.from({ length: 91 }, (_, i) => {
      const elapsed = i * 33
      effect.currentTime = elapsed
      let scale = 1,
        opacity = 1
      for (const t of tracks) {
        const fraction = Math.min(
          1,
          Math.max(0, (anchor + elapsed - Number(t.startTime)) / t.duration),
        )
        const end = t.property === 'opacity' ? (t.layer ? 0.2 : 1.5) : t.layer ? 0.4 : 2
        const value = t.from! + (end - t.from!) * fraction
        if (t.property === 'scaleX') scale *= value
        if (t.property === 'opacity') opacity *= value
      }
      const css = getComputedStyle(target)
      return {
        scale: Math.abs(new DOMMatrix(css.transform).a - scale),
        opacity: Math.abs(Number(css.opacity) - Math.max(0, Math.min(1, opacity))),
      }
    })
    runtime.dispose()
    return {
      scale: Math.max(...errors.map((e) => e.scale)),
      opacity: Math.max(...errors.map((e) => e.opacity)),
    }
  })
  expect(result.scale).toBeLessThan(0.0003)
  expect(result.opacity).toBeLessThan(0.0003)
})

test('keeps a paused loop jump constant while other channels continue', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const runtime = lab.createWebRuntime(document, { reducedMotion: 'never' })
    const target = lab.makeTarget()
    const repeated = runtime.animate(
      target,
      { x: [0, 100] },
      { duration: 1000, repeat: 1, ease: 'linear' },
    )
    repeated.pause()
    repeated.progress = 0.5
    runtime.animate(target, { y: [0, 200] }, { duration: 2000, ease: 'linear' })
    const effect = target.getAnimations()[0]!
    effect.pause()
    const values = [0, 100, 1000, 1999, 2000].map((t) => {
      effect.currentTime = t
      const matrix = new DOMMatrix(getComputedStyle(target).transform)
      return { x: matrix.e, y: matrix.f }
    })
    runtime.dispose()
    return values
  })
  for (const value of result) expect(value.x).toBe(0)
  expect(result.at(-1)!.y).toBe(200)
})

test('rolls back a composed budget failure and a browser clock-start exception', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = lab.createWebRuntime(document, {
      reducedMotion: 'never',
      maxKeyframes: 8,
    })
    const target = lab.makeTarget()
    const h = runtime.animate(target, { x: [0, 100] }, { duration: 2000, ease: 'linear' })
    h.pause()
    h.progress = 0.25
    const before = runtime.inspect(target),
      original = target.style.cssText
    const errors: string[] = []
    // Each individual track fits. Their distinct authored knot union does not.
    try {
      runtime.animate(
        target,
        { x: [25, 50, 75, 100, 125, 150], y: [0, 20, 40, 60, 80] },
        {
          duration: 2000,
          ease: 'linear',
          x: { times: [0, 0.1, 0.3, 0.5, 0.7, 1] },
          y: { times: [0, 0.2, 0.4, 0.6, 1] },
        },
      )
    } catch (e) {
      errors.push(String(e))
    }
    const budget = runtime.inspect(target)
    const play = Animation.prototype.play
    Animation.prototype.play = function () {
      if ((this.effect as KeyframeEffect).target === null)
        throw new Error('Injected clock failure')
      return play.call(this)
    }
    try {
      h.play()
    } catch (e) {
      errors.push(String(e))
    } finally {
      Animation.prototype.play = play
    }
    const failed = runtime.inspect(target),
      styles = target.style.cssText
    h.progress = 0.5
    const after = runtime.inspect(target).pose!.x
    h.stop()
    runtime.dispose()
    return { errors, before, budget, failed, original, styles, after, stopped: await h }
  })
  expect(result.errors).toHaveLength(2)
  expect(result.errors[0]).toContain('Composition keyframe budget')
  expect(result.errors[1]).toContain('Injected clock failure')
  expect(result.budget).toEqual(result.before)
  expect(result.failed).toEqual(result.before)
  expect(result.styles).toBe(result.original)
  expect(result.after).toBe(50)
  expect(result.stopped).toBe(false)
})

test('scrubs a completed short channel and prevents partial owners reclaiming replacements', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = lab.createWebRuntime(document, { reducedMotion: 'never' })
    const target = lab.makeTarget()
    const h = runtime.animate(
      target,
      { x: [0, 100], y: [0, 200] },
      { ease: 'linear', x: { duration: 100 }, y: { duration: 1000 } },
    )
    h.pause()
    h.progress = 0.5
    const completedX = runtime.inspect(target).pose!.x
    h.progress = 0.05
    const earlierX = runtime.inspect(target).pose!.x
    runtime.set(target, { x: 700 })
    h.progress = 0.7
    const replacement = runtime.inspect(target).pose
    h.play()
    const completed = await h
    runtime.dispose()
    return { completedX, earlierX, replacement, completed }
  })
  expect(result.completedX).toBe(100)
  expect(result.earlierX).toBeCloseTo(50, 3)
  expect(result.replacement).toMatchObject({ x: 700, y: 140 })
  expect(result.completed).toBe(false)
})

test('uses the owning document clock and isolates disposal across documents', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const frame = document.createElement('iframe')
    document.body.append(frame)
    const doc = frame.contentDocument!,
      child = doc.createElement('div')
    doc.body.append(child)
    const a = lab.createWebRuntime(document, { reducedMotion: 'always' })
    const b = lab.createWebRuntime(doc, { reducedMotion: 'never' })
    let rejected = false
    try {
      a.animate(child, { x: 200 })
    } catch {
      rejected = true
    }
    const h = b.animate(child, { x: [0, 200] }, { duration: 1000, ease: 'linear' })
    h.pause()
    h.progress = 0.5
    a.dispose()
    const matrix = new DOMMatrix(doc.defaultView!.getComputedStyle(child).transform)
    b.dispose()
    frame.remove()
    return { rejected, x: matrix.e, finished: await h, state: b.inspect(child) }
  })
  expect(result.rejected).toBe(true)
  expect(result.x).toBe(100)
  expect(result.finished).toBe(false)
  expect(result.state).toMatchObject({ targets: 0, animations: 0, observers: 0 })
})
