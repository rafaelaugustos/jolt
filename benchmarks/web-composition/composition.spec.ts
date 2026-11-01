import { expect, test } from '@playwright/test'
import type {} from './fixture.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.proof.reset())
})

test('records browser versions and compares individual/additive candidates', async ({
  page,
  browser,
}, info) => {
  const candidates = await page.evaluate(() => window.proof.candidates())
  await info.attach('strategy-observations', {
    body: JSON.stringify(
      { browser: info.project.name, version: browser.version(), ...candidates },
      null,
      2,
    ),
    contentType: 'application/json',
  })
  // Two replace effects on individual translate do not own separate x/y channels.
  expect(candidates.individual).toBe('0px 25px')
  expect(candidates.translateThenRotate.x).toBeCloseTo(50)
  expect(candidates.translateThenRotate.y).toBeCloseTo(0)
  expect(candidates.rotateThenTranslate.x).toBeCloseTo(0)
  expect(candidates.rotateThenTranslate.y).toBeCloseTo(50)
  expect(Number.parseFloat(candidates.additiveIndividualScale)).toBeCloseTo(1.056, 5)
})

test('groups independent x/y/scale timelines without losing channels', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const p = window.proof
    for (const [id, property, to, time] of [
      ['x', 'x', 120, 250],
      ['y', 'y', 80, 500],
      ['scale', 'scaleX', 1.2, 750],
    ] as const) {
      p.animate(id, property, to, { duration: 1000, ease: 'linear' })
      p.command(id, 'pause')
      p.command(id, 'seek', time)
    }
    return { model: p.model(), presented: p.presented() }
  })
  expect(result.presented.x).toBeCloseTo(30)
  expect(result.presented.y).toBeCloseTo(40)
  expect(result.presented.a).toBeCloseTo(1.15, 5)
  expect(result.model).toMatchObject({ x: 30, y: 40, scaleX: 1.15 })
})

test('retargets x from its source position and velocity while y and scale keep their clocks', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const p = window.proof
    p.animate('old', 'x', 240, { type: 'spring', duration: 1100, bounce: 0.2 })
    p.command('old', 'seek', 260)
    p.animate('y', 'y', 160, { duration: 1800, ease: 'linear' })
    p.command('y', 'seek', 430)
    p.animate('scale', 'scaleX', 1.4, { duration: 1500, ease: 'linear' })
    p.command('scale', 'seek', 700)
    const before = {
      x: p.read('old'),
      y: p.read('y'),
      scale: p.read('scale'),
      rendered: p.presented(),
    }
    const next = p.animate('new', 'x', -80, {
      type: 'spring',
      duration: 800,
      bounce: 0.2,
    })
    const after = { y: p.read('y'), scale: p.read('scale'), rendered: p.presented() }
    p.command('old', 'late')
    return { before, next, after, late: p.presented() }
  })
  expect(result.next.position).toBeCloseTo(result.before.x.position, 8)
  expect(Math.abs(result.next.velocity - result.before.x.velocity)).toBeLessThan(0.5)
  expect(Math.abs(result.after.rendered.x - result.before.rendered.x)).toBeLessThan(0.3)
  expect(result.after.y).toEqual(result.before.y)
  expect(result.after.scale).toEqual(result.before.scale)
  expect(result.late).toEqual(result.after.rendered)
  expect(await page.evaluate(() => window.proof.finished('old'))).toBe(false)
})

test('pause/seek holds only its channel, then resumes from browser local time', async ({
  page,
}) => {
  await page.evaluate(() => {
    const p = window.proof
    p.animate('x', 'x', 200, { duration: 1600, ease: 'linear' })
    p.command('x', 'pause')
    p.command('x', 'seek', 400)
    p.animate('y', 'y', 120, { duration: 1800, ease: 'linear' })
  })
  const before = await page.evaluate(() => ({
    x: window.proof.read('x'),
    y: window.proof.read('y'),
  }))
  await page.waitForTimeout(100)
  const held = await page.evaluate(() => ({
    x: window.proof.read('x'),
    y: window.proof.read('y'),
    rendered: window.proof.presented(),
  }))
  expect(held.x.time).toBe(before.x.time)
  expect(held.y.time).toBeGreaterThan(before.y.time + 30)
  expect(held.rendered.x).toBeCloseTo(50, 3)
  await page.evaluate(() => window.proof.command('x', 'play'))
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => window.proof.read('x').time)).toBeGreaterThan(430)
})

test('composes application scale and press, including a base change while held', async ({
  page,
}) => {
  const animateScale = async (id: string, value: number, layer = 'base') => {
    await page.evaluate(
      ({ id, value, layer }) => {
        const p = window.proof
        p.animate(id + 'x', 'scaleX', value, { duration: 70, ease: 'linear' }, layer)
        p.animate(id + 'y', 'scaleY', value, { duration: 70, ease: 'linear' }, layer)
      },
      { id, value, layer },
    )
    await page.evaluate(
      (id) =>
        Promise.all([window.proof.finished(id + 'x'), window.proof.finished(id + 'y')]),
      id,
    )
  }
  await animateScale('base', 1.1)
  expect((await page.evaluate(() => window.proof.presented())).a).toBeCloseTo(1.1, 5)
  await animateScale('press', 0.96, 'press')
  expect((await page.evaluate(() => window.proof.presented())).a).toBeCloseTo(1.056, 5)
  await animateScale('newbase', 1.2)
  expect((await page.evaluate(() => window.proof.presented())).a).toBeCloseTo(1.152, 5)
  await animateScale('release', 1, 'press')
  const end = await page.evaluate(() => ({
    matrix: window.proof.presented(),
    model: window.proof.model(),
  }))
  expect(end.matrix.a).toBeCloseTo(1.2, 5)
  expect(end.matrix.d).toBeCloseTo(1.2, 5)
  expect(end.model).toMatchObject({ channels: 0, effects: 0 })
})

test('multiplies two changing source curves and preserves the held contribution on retarget', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const p = window.proof
    p.animate('base', 'scaleX', 1.4, { duration: 1000, ease: 'linear' })
    p.command('base', 'pause')
    p.command('base', 'seek', 300)
    p.animate('press', 'scaleX', 0.96, { duration: 800, ease: 'linear' }, 'press')
    p.command('press', 'pause')
    p.command('press', 'seek', 400)
    const before = p.presented(),
      factor = p.read('press')
    p.animate('next', 'scaleX', 1.2, { type: 'spring', duration: 650 })
    return { before, after: p.presented(), factor, afterFactor: p.read('press') }
  })
  expect(result.before.a).toBeCloseTo(1.12 * 0.98, 5)
  expect(result.after.a).toBeCloseTo(result.before.a, 5)
  expect(result.afterFactor).toEqual(result.factor)
})

test('honors a static CSS baseline, transform order and non-central origin', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const p = window.proof
    p.reset(
      'transform: translate(15px, 7px) rotate(20deg) skewX(8deg); transform-origin: 25px 30px',
    )
    const original = p.target.style.transform
    const baseline = new DOMMatrix(getComputedStyle(p.target).transform)
    for (const [id, property, to] of [
      ['x', 'x', 80],
      ['y', 'y', 40],
      ['r', 'rotate', 60],
      ['sx', 'scaleX', 1.4],
      ['sy', 'scaleY', 0.6],
    ] as const) {
      p.animate(id, property, to, { duration: 1000, ease: 'linear' })
      p.command(id, 'pause')
      p.command(id, 'seek', 500)
    }
    const expected = baseline.translate(40, 20).rotate(30).scale(1.2, 0.8)
    const points = [
      [0, 0],
      [100, 0],
      [0, 80],
      [100, 80],
    ].map(([x, y]) => new DOMPoint(x! - 25, y! - 30).matrixTransform(expected))
    const rect = p.target.getBoundingClientRect(),
      matrix = p.presented()
    const bounds = {
      left: 20 + 25 + Math.min(...points.map((p) => p.x)),
      top: 20 + 30 + Math.min(...points.map((p) => p.y)),
      width: Math.max(...points.map((p) => p.x)) - Math.min(...points.map((p) => p.x)),
      height: Math.max(...points.map((p) => p.y)) - Math.min(...points.map((p) => p.y)),
    }
    p.dispose()
    return {
      matrix,
      expected: {
        a: expected.a,
        b: expected.b,
        c: expected.c,
        d: expected.d,
        x: expected.e,
        y: expected.f,
      },
      rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      bounds,
      original,
      restored: p.target.style.transform,
    }
  })
  for (const key of ['a', 'b', 'c', 'd', 'x', 'y'] as const)
    expect(result.matrix[key]).toBeCloseTo(result.expected[key], 3)
  // Bounding rectangles include engine-specific layout-unit rounding.
  for (const key of ['left', 'top', 'width', 'height'] as const)
    expect(Math.abs(result.rect[key] - result.bounds[key])).toBeLessThan(0.02)
  expect(result.restored).toBe(result.original)
})

test('rejects unsupported CSS and preserves externally written styles during disposal', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const p = window.proof,
      errors: string[] = []
    for (const style of [
      'translate: 10px 0',
      'rotate: 20deg',
      'scale: 1.2',
      'transform: perspective(200px) rotateY(10deg)',
      'transition: transform 1s',
      'transform: scale(2) !important',
    ]) {
      try {
        p.reset(style)
      } catch (error) {
        errors.push(String(error))
      }
    }
    p.reset()
    p.animate('x', 'x', 100, { duration: 1000 })
    p.target.style.transform = 'translateX(77px)'
    try {
      p.animate('y', 'y', 100)
    } catch (error) {
      errors.push(String(error))
    }
    p.dispose()
    return { errors, transform: p.target.style.transform }
  })
  expect(result.errors).toHaveLength(7)
  expect(result.transform).toBe('translateX(77px)')
})

test('cancels once and ignores old callbacks after replacement and disposal', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const p = window.proof
    p.animate('old', 'x', 300, { duration: 1000 })
    p.command('old', 'pause')
    p.command('old', 'seek', 300)
    p.animate('next', 'x', -30, { duration: 1000 })
    p.command('next', 'pause')
    p.command('next', 'seek', 200)
    const before = p.presented()
    p.command('old', 'late')
    const after = p.presented()
    const old = await p.finished('old')
    p.recreate()
    p.animate('replacement', 'x', 80, { duration: 1000, ease: 'linear' })
    p.command('replacement', 'pause')
    p.command('replacement', 'seek', 500)
    p.command('next', 'late')
    const next = await p.finished('next'),
      replacement = p.presented()
    p.dispose()
    p.dispose()
    const cancelled = await p.finished('replacement')
    return {
      before,
      after,
      old,
      next,
      replacement,
      cancelled,
      effects: p.target.getAnimations().length,
    }
  })
  expect(result.before).toEqual(result.after)
  expect(result.old).toBe(false)
  expect(result.next).toBe(false)
  expect(result.cancelled).toBe(false)
  expect(result.replacement.x).toBeCloseTo(40, 3)
  expect(result.effects).toBe(0)
})

test('browser playback advances with no per-frame transform writes or rebuilds', async ({
  page,
}) => {
  const before = await page.evaluate(() => {
    const p = window.proof
    p.animate('x', 'x', 240, { duration: 1200, ease: 'linear' })
    return { rendered: p.presented(), model: p.model() }
  })
  const result = await page.evaluate(async () => {
    let writes = 0
    const observer = new MutationObserver((records) => {
      writes += records.length
    })
    observer.observe(window.proof.target, {
      attributes: true,
      attributeFilter: ['style'],
    })
    await new Promise((resolve) => setTimeout(resolve, 150))
    observer.disconnect()
    return { writes, rendered: window.proof.presented(), model: window.proof.model() }
  })
  expect(result.rendered.x).toBeGreaterThan(before.rendered.x + 10)
  expect(result.writes).toBe(0)
  expect(result.model.rebuilds).toBe(before.model.rebuilds)
  expect(result.model.fallback).toBe(false)
  expect(result.model.keyframes).toBeLessThanOrEqual(6001)
})

test('keeps delay and seeks on the same browser clock', async ({ page }) => {
  const result = await page.evaluate(() => {
    const p = window.proof
    p.animate('x', 'x', 100, { duration: 800, delay: 200, ease: 'linear' })
    p.command('x', 'pause')
    p.command('x', 'seek', 100)
    const delayed = { model: p.read('x'), rendered: p.presented() }
    p.command('x', 'seek', 400)
    return { delayed, seeked: p.presented() }
  })
  expect(result.delayed.model.position).toBe(0)
  expect(result.delayed.model.velocity).toBe(0)
  expect(result.delayed.rendered.x).toBe(0)
  expect(result.seeked.x).toBeCloseTo(25, 3)
})

test('measures source-model error separately from composed browser presentation', async ({
  page,
}, info) => {
  const errors = await page.evaluate(() => {
    const p = window.proof
    const x = p.animate('x', 'x', 240, { type: 'spring', duration: 1000, bounce: 0.3 })
    const scale = p.animate('scale', 'scaleX', 1.4, {
      type: 'spring',
      duration: 1200,
      bounce: 0.2,
    })
    const press = p.animate(
      'press',
      'scaleX',
      0.96,
      { type: 'spring', duration: 600, bounce: 0.1 },
      'press',
    )
    for (const id of ['x', 'scale', 'press']) p.command(id, 'pause')
    let positionError = 0,
      scaleError = 0
    for (let i = 1; i < 40; i++) {
      p.command('x', 'seek', (x.duration * i) / 40)
      p.command('scale', 'seek', (scale.duration * i) / 40)
      p.command('press', 'seek', (press.duration * i) / 40)
      const model = p.model(),
        rendered = p.presented()
      positionError = Math.max(positionError, Math.abs(rendered.x - model.x))
      scaleError = Math.max(scaleError, Math.abs(rendered.a - model.scaleX))
    }
    return { positionError, scaleError }
  })
  await info.attach('source-presentation-errors', {
    body: JSON.stringify(errors),
    contentType: 'application/json',
  })
  expect(errors.positionError).toBeLessThan(0.3)
  expect(errors.scaleError).toBeLessThan(0.002)
})

test('completion preserves externally changed styles and cancels retired work', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const p = window.proof
    p.animate('x', 'x', 100, { duration: 80, ease: 'linear' })
    p.target.style.transform = 'scale(1.3)'
    const completed = await p.finished('x')
    return {
      completed,
      transform: p.target.style.transform,
      effects: p.target.getAnimations().length,
    }
  })
  expect(result).toEqual({ completed: false, transform: 'scale(1.3)', effects: 0 })
})

test('samples the compiled product effect at explicit browser local times', async ({
  page,
}, info) => {
  const errors = await page.evaluate(() => {
    const p = window.proof
    const durations = [
      p.animate('x', 'x', 240, { type: 'spring', duration: 1000, bounce: 0.3 }).duration,
      p.animate('scale', 'scaleX', 1.4, { type: 'spring', duration: 1200, bounce: 0.2 })
        .duration,
      p.animate(
        'press',
        'scaleX',
        0.96,
        { type: 'spring', duration: 600, bounce: 0.1 },
        'press',
      ).duration,
    ]
    // Sample the already compiled effect, without rebuilding between observations.
    // Explicit times avoid comparing a live compositor style with a cached timeline tick.
    const effect = p.target.getAnimations()[0]!
    effect.pause()
    const samples = Array.from({ length: 39 }, (_, index) => {
      const time = (Math.min(...durations) * (index + 1)) / 40
      effect.currentTime = time
      return { time, rendered: p.presented() }
    })
    for (const id of ['x', 'scale', 'press']) p.command(id, 'pause')
    let positionError = 0,
      scaleError = 0
    for (const { time, rendered } of samples) {
      for (const id of ['x', 'scale', 'press']) p.command(id, 'seek', time)
      const model = p.model()
      positionError = Math.max(positionError, Math.abs(rendered.x - model.x))
      scaleError = Math.max(scaleError, Math.abs(rendered.a - model.scaleX))
    }
    return { positionError, scaleError, observations: samples.length }
  })
  await info.attach('compiled-presentation-errors', {
    body: JSON.stringify(errors),
    contentType: 'application/json',
  })
  expect(errors.positionError).toBeLessThan(0.3)
  expect(errors.scaleError).toBeLessThan(0.002)
})
