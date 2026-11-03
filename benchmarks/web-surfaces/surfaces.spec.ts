import { test, expect, type Page } from '@playwright/test'
import type {
  WebBlur,
  WebShape,
  WebLiquid,
  WebParticles,
  WebImageEffect,
} from '../../src/web/public.js'
import type {} from './fixture.js'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (error) => messages.push(error.message))
  await page.goto('/')
  await page.evaluate(() => window.ready)
})
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
})

test('paused image owners cancel on source changes after setup has settled', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const f = window.surfaces
      f.reset('image')
      const e = f.runtime.imageEffect(f.photo, 'dissolve', {
        to: f.destination,
        paused: true,
      })
      await new Promise((r) => setTimeout(r, 100))
      f.photo.src = f.second
      return { finished: await e.finished, disposed: e.disposed }
    }),
  ).toEqual({ finished: false, disposed: true })
})

test('live reduced motion pauses liquid and clears a bounded emitter without a backlog', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const f = window.surfaces
      f.reset('liquid')
      const liquid = f.runtime.liquid(f.photo),
        particles = f.runtime.particles(f.surface)
      await new Promise((r) => setTimeout(r, 100))
      f.runtime.configure({ reducedMotion: 'always' })
      const hidden = {
        filter: f.photo.style.filter,
        particles: particles.snapshot().particles,
      }
      const frames = liquid.diagnostics.frames
      await new Promise((r) => setTimeout(r, 100))
      const idle = liquid.diagnostics.frames === frames
      f.runtime.configure({ reducedMotion: 'never' })
      await new Promise((r) => setTimeout(r, 100))
      const resumed = liquid.diagnostics.frames > frames
      liquid.dispose()
      particles.dispose()
      return { hidden, idle, resumed }
    }),
  ).toEqual({ hidden: { filter: 'none', particles: 0 }, idle: true, resumed: true })
})

test('image filters resolve with a base URL and in a shadow tree', async ({ page }) => {
  await page.evaluate(async () => {
    const f = window.surfaces
    f.reset('liquid')
    const base = document.createElement('base')
    base.href = '/another/'
    document.head.append(base)
    const host = document.createElement('div')
    host.id = 'shadow-host'
    document.body.append(host)
    const root = host.attachShadow({ mode: 'open' })
    const image = document.createElement('img')
    image.src = f.first
    image.style.cssText = 'width:300px;height:250px'
    root.append(image)
    await image.decode()
  })
  const original = await page.locator('#shadow-host img').screenshot()
  await page.evaluate(() => {
    const f = window.surfaces
    const image = document
      .querySelector('#shadow-host')!
      .shadowRoot!.querySelector('img')!
    const e = f.runtime.liquid(image)
    f.scope.add(e)
    e.pause()
  })
  await page.waitForTimeout(150)
  expect(await page.locator('#shadow-host img').screenshot()).not.toEqual(original)
  await page.locator('#dispose').click()
  expect(await page.locator('#shadow-host img').screenshot()).toEqual(original)
})

test('external filter writes cancel running blur without overwriting the application', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const f = window.surfaces
      const blur = f.runtime.blur(f.surface)
      const a = blur.animate(1, { duration: 1000 })
      f.surface.style.filter = 'contrast(2)'
      return {
        completed: await a.finished,
        disposed: blur.disposed,
        filter: f.surface.style.filter,
      }
    }),
  ).toEqual({ completed: false, disposed: true, filter: 'contrast(2)' })
})

test('document hiding freezes continuous time and resumes without a burst of missed frames', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const f = window.surfaces
      const p = f.runtime.particles(f.surface, { rate: 100, lifetime: 1000 })
      await new Promise((r) => setTimeout(r, 100))
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
      document.dispatchEvent(new Event('visibilitychange'))
      const frozen = p.snapshot()
      await new Promise((r) => setTimeout(r, 160))
      const still = p.snapshot()
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false })
      document.dispatchEvent(new Event('visibilitychange'))
      await new Promise((r) => setTimeout(r, 50))
      const after = p.snapshot()
      p.dispose()
      return {
        idle: frozen.frames === still.frames,
        bounded: after.particles - frozen.particles < 15,
        resumed: after.frames > still.frames,
      }
    }),
  ).toEqual({ idle: true, bounded: true, resumed: true })
})

test('all six APIs are scoped and callable without replacing content', async ({
  page,
}) => {
  for (const mode of ['particles', 'confetti', 'blur', 'shape', 'liquid', 'image']) {
    await page.evaluate((mode) => {
      window.surfaces.reset(mode)
      window.surfaces.start()
    }, mode)
    await page.waitForTimeout(90)
    expect(await page.evaluate(() => window.surfaces.scope.size)).toBeGreaterThan(0)
    await page.locator('#dispose').click()
    expect(await page.locator('[data-jolt-effect]').count()).toBe(0)
    expect(
      await page.evaluate(() => ({
        size: window.surfaces.scope.size,
        filter: window.surfaces.photo.style.filter,
        position: window.surfaces.surface.style.position,
      })),
    ).toEqual({ size: 0, filter: '', position: '' })
  }
})

test('particles draw, freeze, resume and restore clickable content', async ({ page }) => {
  await page.locator('#action').click()
  await page.waitForTimeout(400)
  await page.locator('#pause').click()
  const snapshot = await page.evaluate(() =>
    (window.surfaces.owner as WebParticles).snapshot(),
  )
  expect(snapshot.backend).toBe('canvas-2d')
  expect(snapshot.particles).toBeGreaterThan(0)
  const a = await page.locator('#surface').screenshot()
  await page.waitForTimeout(100)
  expect(await page.locator('#surface').screenshot()).toEqual(a)
  await page.locator('#inside').click()
  await expect(page.locator('#inside')).toContainText('1')
  await page.locator('#play').click()
  await page.waitForTimeout(150)
  expect(
    (await page.evaluate(() => (window.surfaces.owner as WebParticles).snapshot()))
      .frames,
  ).toBeGreaterThan(snapshot.frames)
  await page.locator('#dispose').click()
  expect(await page.locator('canvas').count()).toBe(0)
})

test('confetti uses a viewport overlay and expires without input interception', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.surfaces.reset('confetti')
    window.surfaces.start()
  })
  const overlay = page.locator('[data-jolt-effect="confetti"]')
  await expect(overlay).toHaveCSS('position', 'fixed')
  await expect(overlay).toHaveAttribute('aria-hidden', 'true')
  await page.locator('#inside').click()
  await expect(page.locator('#inside')).toContainText('1')
  expect(
    await page.evaluate(
      async () => await (window.surfaces.owner as WebParticles).finished,
    ),
  ).toBe(true)
  await expect(overlay).toHaveCount(0)
  expect(await page.evaluate(() => window.surfaces.scope.size)).toBe(0)
})

test('particle options fail atomically and finite populations remain bounded after resize', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const { runtime, surface } = window.surfaces
      const old = runtime.particles(surface, { rate: 100, lifetime: 100, duration: 100 })
      let rejected = 0
      for (const input of [
        { rate: Infinity },
        { colors: [] },
        { shape: 'bad' },
        { rate: 10000, lifetime: 60000 },
        { fadeOut: 1 },
      ]) {
        try {
          runtime.particles(surface, input as never)
        } catch {
          rejected++
        }
      }
      const survived = !old.disposed
      surface.style.width = '360px'
      const completed = await old.finished
      return { rejected, survived, completed, particles: old.snapshot().particles }
    }),
  ).toEqual({ rejected: 5, survived: true, completed: true, particles: 0 })
})

test('blur preserves existing filters, seeks and retargets the displayed intensity', async ({
  page,
}) => {
  const original = await page.locator('#surface').screenshot()
  const result = await page.evaluate(async () => {
    const { runtime, surface } = window.surfaces
    surface.style.filter = 'brightness(0.8)'
    const blur = runtime.blur(surface, { radius: 24 })
    const first = blur.animate(1, { duration: 1000, ease: 'linear' })
    first.pause()
    first.progress = 0.4
    const held = blur.snapshot().amount
    const next = blur.animate(0, { duration: 1000, ease: 'linear' })
    next.pause()
    const continued = blur.snapshot().amount
    window.surfaces.scope.add(blur)
    return {
      held,
      continued,
      cancelled: await first.finished,
      filter: surface.style.filter,
    }
  })
  expect(result.held).toBeCloseTo(0.4, 2)
  expect(result.continued).toBeCloseTo(0.4, 2)
  expect(result.cancelled).toBe(false)
  expect(result.filter).toContain('brightness(0.8)')
  expect(result.filter).toContain('blur(')
  expect(await page.locator('#surface').screenshot()).not.toEqual(original)
  await page.locator('#dispose').click()
  await expect(page.locator('#surface')).toHaveCSS('filter', 'brightness(0.8)')
})

test('blur never restores over external writes and backdrop reports its backend', async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const { runtime, surface } = window.surfaces
      const blur = runtime.blur(surface, { amount: 0.8 })
      surface.style.setProperty('filter', 'contrast(2)', 'important')
      blur.dispose()
      const backdrop = runtime.blur(surface, { mode: 'backdrop', amount: 0.5 })
      const backend = backdrop.snapshot().backend
      backdrop.dispose()
      return {
        filter: surface.style.filter,
        priority: surface.style.getPropertyPriority('filter'),
        backend,
      }
    }),
  ).toEqual({
    filter: 'contrast(2)',
    priority: 'important',
    backend: 'css-backdrop-filter',
  })
})

test('shape morph changes pixels and preserves fill during stroke trim', async ({
  page,
}) => {
  await page.evaluate(() => {
    const f = window.surfaces
    f.reset('shape')
    f.start()
    f.playback!.pause()
    f.playback!.progress = 0
  })
  const first = await page.locator('#surface').screenshot()
  await page.evaluate(() => {
    window.surfaces.playback!.progress = 0.5
  })
  expect(await page.locator('#surface').screenshot()).not.toEqual(first)
  expect(
    await page.evaluate(() => (window.surfaces.owner as WebShape).snapshot().d),
  ).not.toBe('M20 30 L80 30 L80 90 L20 90 Z')
  await page.evaluate(() =>
    (window.surfaces.owner as WebShape).set({ strokeStart: 1, strokeEnd: 1 }),
  )
  await expect(page.locator('[data-jolt-effect="shape"] path').nth(1)).toHaveCSS(
    'visibility',
    'hidden',
  )
  await expect(page.locator('[data-jolt-effect="shape"] path').nth(0)).toHaveAttribute(
    'fill',
    'rgba(104, 72, 168, 1)',
  )
})

test('shape rejects mismatched morph topology before interrupting and set accepts it', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const { runtime, surface, paths } = window.surfaces
      const shape = runtime.shape(surface, { d: paths[0]!, viewBox: [0, 0, 100, 120] })
      const a = shape.animate({ d: paths[1]! }, { duration: 200 })
      a.pause()
      let error = false
      try {
        shape.animate({ d: 'M0 0 C0 30 20 40 60 50' })
      } catch {
        error = true
      }
      const paused = a.paused
      shape.set({ d: 'M0 0 C0 30 20 40 60 50' })
      const d = shape.snapshot().d
      shape.dispose()
      return { error, paused, d, completed: await a.finished }
    }),
  ).toEqual({ error: true, paused: true, d: 'M0 0 C0 30 20 40 60 50', completed: false })
})

test('liquid displaces actual image pixels, holds on pause and restores the original', async ({
  page,
}) => {
  await page.evaluate(() => window.surfaces.reset('liquid'))
  await page.evaluate(() => window.surfaces.photo.decode())
  const original = await page.locator('#photo').screenshot()
  await page.locator('#action').click()
  await page.waitForTimeout(350)
  await page.locator('#pause').click()
  await page.waitForTimeout(150)
  expect(
    await page.evaluate(() => (window.surfaces.owner as WebLiquid).diagnostics.backend),
  ).toBe('svg-filter')
  const altered = await page.locator('#photo').screenshot()
  expect(altered).not.toEqual(original)
  await page.waitForTimeout(150)
  expect(await page.locator('#photo').screenshot()).toEqual(altered)
  await page.locator('#dispose').click()
  expect(await page.locator('#photo').screenshot()).toEqual(original)
})

test('ripple finite seek changes pixels; reverse returns to the source', async ({
  page,
}) => {
  await page.evaluate(() => window.surfaces.reset('image'))
  await page.evaluate(() => window.surfaces.photo.decode())
  const original = await page.locator('#photo').screenshot()
  await page.evaluate(() => {
    window.surfaces.start()
    window.surfaces.playback!.pause()
    window.surfaces.playback!.progress = 0.4
  })
  await page.waitForTimeout(150)
  expect(await page.locator('#photo').screenshot()).not.toEqual(original)
  expect(
    await page.evaluate(async () => {
      const e = window.surfaces.owner as WebImageEffect
      e.reverse()
      e.finish()
      return await e.finished
    }),
  ).toBe(true)
  expect(await page.locator('#photo').screenshot()).toEqual(original)
})

test('dissolve renders both images at midpoint and commits only on forward success', async ({
  page,
}) => {
  await page.evaluate(() => window.surfaces.reset('image'))
  await page.evaluate(() => window.surfaces.photo.decode())
  const original = await page.locator('#photo').screenshot()
  await page.evaluate(() => {
    const f = window.surfaces
    const e = f.runtime.imageEffect(f.photo, 'dissolve', {
      to: f.destination,
      paused: true,
      duration: 1000,
    })
    f.scope.add(e)
    e.progress = 0.5
    ;(window as any).imageHandle = e
  })
  await page.waitForTimeout(150)
  const mid = await page.locator('#photo').screenshot()
  expect(mid).not.toEqual(original)
  expect(
    await page.evaluate(() => window.surfaces.photo.src === window.surfaces.first),
  ).toBe(true)
  await page.evaluate(() => (window as any).imageHandle.finish())
  await page.evaluate(() => window.surfaces.photo.decode())
  expect(
    await page.evaluate(() => window.surfaces.photo.src === window.surfaces.second),
  ).toBe(true)
  const final = await page.locator('#photo').screenshot()
  expect(mid).not.toEqual(final)
  await page.evaluate(() => {
    const f = window.surfaces
    f.photo.src = f.first
  })
  await page.evaluate(() => window.surfaces.photo.decode())
  expect(
    await page.evaluate(async () => {
      const f = window.surfaces
      const e = f.runtime.imageEffect(f.photo, 'dissolve', {
        to: f.destination,
        paused: true,
      })
      e.progress = 0.6
      e.stop()
      return { finished: await e.finished, source: f.photo.src === f.first }
    }),
  ).toEqual({ finished: false, source: true })
})

test('pointer distortion uses real capture and restores touch styles on cancellation', async ({
  page,
}) => {
  await page.evaluate(() => {
    const f = window.surfaces
    f.reset('image')
    f.scope.add(
      f.runtime.imageEffect(f.photo, 'distortion', { amplitude: 60, radius: 200 }),
    )
  })
  const original = await page.locator('#photo').screenshot()
  const rect = (await page.locator('#photo').boundingBox())!
  await page.mouse.move(rect.x + 120, rect.y + 100)
  await page.mouse.down()
  await page.mouse.move(rect.x + 180, rect.y + 120, { steps: 5 })
  await page.waitForTimeout(150)
  expect(await page.locator('#photo').screenshot()).not.toEqual(original)
  await page.mouse.up()
  await page.locator('#dispose').click()
  expect(
    await page.evaluate(() => ({
      touch: window.surfaces.photo.style.touchAction,
      filter: window.surfaces.photo.style.filter,
    })),
  ).toEqual({ touch: '', filter: '' })
})

test('image replacement and source changes cancel all owned resources', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const f = window.surfaces
      f.reset('image')
      const a = f.runtime.liquid(f.photo)
      let rejected = false
      try {
        f.runtime.imageEffect(f.photo, 'ripple', { amplitude: -1 })
      } catch {
        rejected = true
      }
      const survived = !a.disposed
      const b = f.runtime.imageEffect(f.photo, 'ripple', { duration: 2000 })
      const replaced = a.disposed
      f.photo.src = f.second
      await new Promise((r) => setTimeout(r, 100))
      return {
        rejected,
        survived,
        replaced,
        finished: await b.finished,
        layers: document.querySelectorAll('[data-jolt-effect]').length,
      }
    }),
  ).toEqual({
    rejected: true,
    survived: true,
    replaced: true,
    finished: false,
    layers: 0,
  })
})

test('reduced motion suppresses decorations and commits dissolve content', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const f = window.surfaces
      f.reset('image')
      f.runtime.configure({ reducedMotion: 'always' })
      const ripple = f.runtime.imageEffect(f.photo, 'ripple')
      const dissolve = f.runtime.imageEffect(f.photo, 'dissolve', {
        to: f.destination,
        paused: true,
      })
      const confetti = f.runtime.confetti(f.surface)
      return {
        ripple: await ripple.finished,
        reason: ripple.diagnostics.reason,
        dissolve: await dissolve.finished,
        committed: f.photo.src === f.second,
        confetti: confetti.disposed,
        layers: document.querySelectorAll('[data-jolt-effect]').length,
      }
    }),
  ).toEqual({
    ripple: false,
    reason: 'reduced-motion',
    dissolve: true,
    committed: true,
    confetti: true,
    layers: 0,
  })
})

test('removing targets disposes every renderer and runtime tasks drain', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const f = window.surfaces
      f.reset('liquid')
      const liquid = f.runtime.liquid(f.photo)
      const shape = f.runtime.shape(f.surface, {
        d: f.paths[0]!,
        viewBox: [0, 0, 100, 120],
      })
      const particles = f.runtime.particles(f.surface)
      f.surface.remove()
      await new Promise((r) => setTimeout(r, 100))
      f.runtime.dispose()
      return {
        liquid: liquid.disposed,
        shape: shape.disposed,
        particles: particles.disposed,
        layers: document.querySelectorAll('[data-jolt-effect]').length,
      }
    }),
  ).toEqual({ liquid: true, shape: true, particles: true, layers: 0 })
})

test('independent runtimes cannot steal an effect target', async ({ page }) => {
  expect(
    await page.evaluate(() => {
      const f = window.surfaces
      const other = f.createRuntime(document)
      const p = f.runtime.particles(f.surface)
      let error = false
      try {
        other.particles(f.surface)
      } catch {
        error = true
      }
      const alive = !p.disposed
      other.dispose()
      p.dispose()
      return { error, alive }
    }),
  ).toEqual({ error: true, alive: true })
})
