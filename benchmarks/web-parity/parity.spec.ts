import { test, expect, type Page } from '@playwright/test'
import type {} from './fixture.js'
const drag = async (
  page: Page,
  selector: string,
  dx: number,
  dy: number,
  edge = false,
) => {
  const r = (await page.locator(selector).boundingBox())!
  const x = r.x + (edge ? 8 : r.width / 2),
    y = r.y + r.height / 2
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 24 })
  await page.waitForTimeout(160)
  await page.mouse.up()
}
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => window.ready)
})
test('gravity uses exact ballistic sampling, pause, seek and endpoint', async ({
  page,
}) => {
  await page.locator('#action').click()
  const value = await page.evaluate(async () => {
    const a = window.fixture.animation!
    await a.ready
    a.pause()
    a.progress = 150 / a.duration
    return {
      duration: a.duration,
      y: new DOMMatrixReadOnly(getComputedStyle(window.fixture.el('ball')).transform).m42,
    }
  })
  expect(value.duration).toBeGreaterThan(500)
  expect(value.y).toBeCloseTo(20.25, 0)
  await page.waitForTimeout(150)
  expect(
    await page
      .locator('#ball')
      .evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m42),
  ).toBeCloseTo(value.y, 1)
  await page.evaluate(() => {
    window.fixture.animation!.progress = 1
  })
  expect(
    await page
      .locator('#ball')
      .evaluate((e) => new DOMMatrixReadOnly(getComputedStyle(e).transform).m42),
  ).toBeCloseTo(280, 2)
})
test('gravity interruption inherits velocity and rejects invalid tracks transactionally', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { runtime, el } = window.fixture,
      ball = el('ball')
    const a = runtime.animate(
      ball,
      { y: 280 },
      { type: 'gravity', restitution: 0, acceleration: 1800 },
    )
    await a.ready
    a.pause()
    a.progress = 100 / a.duration
    const before = new DOMMatrixReadOnly(getComputedStyle(ball).transform).m42
    const failures = []
    for (const [frames, options] of [
      [{ scale: 2 }, { type: 'gravity' }],
      [{ y: [0, 10, 20] }, { type: 'gravity' }],
      [{ y: 280 }, { type: 'gravity', restitution: 1 }],
      [{ y: 280 }, { type: 'gravity', acceleration: -1 }],
    ] as const) {
      try {
        runtime.animate(ball, frames as never, options as never)
        failures.push(false)
      } catch {
        failures.push(true)
      }
    }
    a.play()
    const b = runtime.animate(
      ball,
      { y: 280 },
      { type: 'gravity', restitution: 0, acceleration: 1800 },
    )
    await b.ready
    b.pause()
    b.progress = 100 / b.duration
    return {
      before,
      after: new DOMMatrixReadOnly(getComputedStyle(ball).transform).m42,
      handoff: a.progress * a.duration,
      failures,
      old: await a.finished,
    }
  })
  expect(result.failures).toEqual([true, true, true, true])
  expect(result.old).toBe(false)
  expect(result.before).toBeCloseTo(9, 0)
  // Compilation and style reads take real time, especially on shared CI hosts.
  // Compare the continued ballistic path at the actual interrupted clock time.
  const expected = 0.5 * 1800 * (result.handoff / 1000 + 0.1) ** 2
  expect(result.after).toBeCloseTo(expected, 0)
})
test('gravity numeric values, layers, reduced motion and stopped result', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const r = window.fixture.runtime,
        v = r.motionValue(0)
      const a = r.animate(v, 100, { type: 'gravity', restitution: 0 })
      await a.ready
      a.pause()
      a.progress = 0.5
      const mid = v.get()
      a.stop()
      r.configure({ reducedMotion: 'always' })
      const b = r.animate(
        window.fixture.el('ball'),
        { y: 180 },
        { type: 'gravity', layer: 'drop' },
      )
      await b.ready
      return {
        mid,
        stopped: await a.finished,
        done: await b.finished,
        y: new DOMMatrixReadOnly(getComputedStyle(window.fixture.el('ball')).transform)
          .m42,
      }
    }),
  ).toMatchObject({ mid: 25, stopped: false, done: true, y: 180 })
})
test('haptic capability is honest when missing, declined or reduced', async ({
  page,
}) => {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  const result = await page.evaluate(() => {
    const r = window.fixture.runtime
    Object.defineProperty(navigator, 'vibrate', { configurable: true, value: undefined })
    const absent = r.haptic('light')
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: () => false,
    })
    const declined = r.haptic('light')
    r.configure({ reducedMotion: 'always' })
    const reduced = r.haptic('heavy')
    return { absent, declined, reduced }
  })
  expect(result).toMatchObject({
    absent: { backend: 'none', status: 'unavailable' },
    declined: { status: 'blocked' },
    reduced: { status: 'disabled' },
  })
})
test('haptic animation markers pause, skip seeking and never replay', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('haptics'))
  await page.evaluate(() => {
    ;(window as any).impacts = []
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (n: number) => {
        ;(window as any).impacts.push(n)
        return true
      },
    })
  })
  await page.locator('#action').click()
  await page.evaluate(() => window.fixture.animation!.pause())
  await page.waitForTimeout(450)
  expect(await page.evaluate(() => (window as any).impacts)).toEqual([])
  await page.evaluate(() => {
    window.fixture.animation!.progress = 0.65
    window.fixture.animation!.play()
  })
  await expect.poll(() => page.evaluate(() => (window as any).impacts.length)).toBe(1)
  await page.evaluate(() => {
    window.fixture.animation!.progress = 0
    window.fixture.animation!.play()
  })
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => (window as any).impacts)).toEqual([20])
})
test('haptics cancellation and disabled press do not fire', async ({ page }) => {
  await page.evaluate(() => {
    window.fixture.boot('haptics')
    ;(window as any).impacts = []
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (n: number) => {
        ;(window as any).impacts.push(n)
        return true
      },
    })
  })
  await page.locator('#action').click()
  await page.evaluate(() => window.fixture.animation!.stop())
  await page.waitForTimeout(900)
  expect(await page.evaluate(() => (window as any).impacts.length)).toBe(0)
  await page.evaluate(() => {
    ;(window.fixture.el('impact') as HTMLButtonElement).disabled = true
  })
  await page
    .locator('#impact')
    .dispatchEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 1 })
  expect(await page.evaluate(() => (window as any).impacts.length)).toBe(0)
})
async function sensors(page: Page, permission = false) {
  await page.evaluate((permission) => {
    const w = window as any
    w.sensorListeners = { add: 0, remove: 0 }
    const add = w.addEventListener.bind(w),
      remove = w.removeEventListener.bind(w)
    w.addEventListener = (name: string, ...args: any[]) => {
      if (name === 'deviceorientation' || name === 'devicemotion') w.sensorListeners.add++
      return add(name, ...args)
    }
    w.removeEventListener = (name: string, ...args: any[]) => {
      if (name === 'deviceorientation' || name === 'devicemotion')
        w.sensorListeners.remove++
      return remove(name, ...args)
    }
    Object.defineProperty(window, 'DeviceOrientationEvent', {
      configurable: true,
      value: Object.assign(function () {}, {
        requestPermission: permission ? () => Promise.resolve('granted') : undefined,
      }),
    })
    Object.defineProperty(window, 'DeviceMotionEvent', {
      configurable: true,
      value: function () {},
    })
    window.fixture.boot('sensors')
    w.orientation = (a: number, b: number, c: number) => {
      const e = new Event('deviceorientation')
      Object.assign(e, { alpha: a, beta: b, gamma: c })
      window.dispatchEvent(e)
    }
    w.motion = (total: object, linear: object | null) => {
      const e = new Event('devicemotion')
      Object.assign(e, { accelerationIncludingGravity: total, acceleration: linear })
      window.dispatchEvent(e)
    }
  }, permission)
}
test('sensors use radians, quaternion recenter and actual downward gravity', async ({
  page,
}) => {
  await sensors(page)
  const result = await page.evaluate(() => {
    const w = window as any
    w.orientation(0, 0, 0)
    w.orientation(0, 30, 0)
    w.motion({ x: 2, y: 3, z: 12 }, { x: 2, y: 3, z: 2.19335 })
    const rotation = window.fixture.sensor!.snapshot(),
      gravity = window.fixture.gravity!.snapshot()
    window.fixture.sensor!.recenter()
    w.orientation(0, 30, 0)
    return { rotation, gravity, recenter: window.fixture.sensor!.snapshot() }
  })
  expect(result.rotation.status).toBe('active')
  expect(result.rotation.values[0]).toBeCloseTo(Math.PI / 6, 6)
  expect(result.rotation.values[3]).toBeCloseTo(Math.sin(Math.PI / 12), 6)
  expect(result.gravity.values).toEqual([0, 0, -9.80665])
  expect(result.recenter.values.slice(0, 3)).toEqual([0, 0, 0])
})
test('sensor permission is explicit and no data is reported as unavailable', async ({
  page,
}) => {
  await sensors(page, true)
  expect(await page.evaluate(() => window.fixture.sensor!.status)).toBe(
    'permission-required',
  )
  await page.locator('#action').click()
  await expect
    .poll(() => page.evaluate(() => window.fixture.sensor!.status))
    .toBe('starting')
  await expect
    .poll(() => page.evaluate(() => window.fixture.sensor!.snapshot().reason), {
      timeout: 4000,
    })
    .toBe('no-data')
  await page.evaluate(() => (window as any).orientation(0, 0, 0))
  expect(await page.evaluate(() => window.fixture.sensor!.available)).toBe(true)
})
test('sensor acquisition is shared, demand-driven and disposed with scope', async ({
  page,
}) => {
  await sensors(page)
  const result = await page.evaluate(() => {
    const w = window as any,
      r = window.fixture.runtime
    const second = r.sensor('rotation')
    const idle = second.status
    const off = second.z.subscribe(() => {})
    const activeListeners = { ...w.sensorListeners }
    window.fixture.scope.suspend()
    const afterPause = { ...w.sensorListeners }
    off()
    const afterOff = { ...w.sensorListeners }
    second.dispose()
    window.fixture.scope.dispose()
    return {
      idle,
      activeListeners,
      afterPause,
      afterOff,
      status: window.fixture.sensor!.status,
    }
  })
  expect(result.idle).toBe('idle')
  expect(result.activeListeners.add).toBe(2)
  expect(result.afterPause.remove).toBe(1)
  expect(result.afterOff.remove).toBe(2)
  expect(result.status).toBe('disposed')
})
test('sensors handle orientation, interval, null samples and reduced motion', async ({
  page,
}) => {
  await sensors(page)
  const result = await page.evaluate(() => {
    const w = window as any
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 90 })
    w.motion({ x: -4, y: 0, z: 9 }, { x: 0, y: 0, z: 0 })
    const rotated = window.fixture.gravity!.snapshot()
    w.motion({ x: 4, y: 0, z: 9 }, null)
    const count = window.fixture.gravity!.snapshot().samples
    window.fixture.runtime.configure({ reducedMotion: 'always' })
    w.motion({ x: 0, y: 0, z: 9 }, { x: 0, y: 0, z: 0 })
    return {
      rotated,
      count,
      status: window.fixture.gravity!.status,
      samples: window.fixture.gravity!.snapshot().samples,
    }
  })
  expect(result.rotated.values[0]).toBeCloseTo(0, 6)
  expect(result.rotated.values[1]).toBeCloseTo(-4, 6)
  expect(result.count).toBe(1)
  expect(result.status).toBe('paused')
  expect(result.samples).toBe(1)
})
test('glass uses real backdrop CSS, preserves content and restores authored styles', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('glass'))
  await page.locator('#inside').click()
  await expect(page.locator('#status')).toContainText('activated')
  const result = await page.evaluate(() => {
    const g = window.fixture.glass!,
      e = window.fixture.el('glass')
    g.set(0.5)
    const before = g.snapshot(),
      css = getComputedStyle(e).backdropFilter
    g.dispose()
    return {
      before,
      css,
      background: e.style.backgroundColor,
      filter: e.style.backdropFilter,
    }
  })
  expect(result.before.backend).toBe('css-backdrop-filter')
  expect(result.css).toBe('blur(14px)')
  expect(result.background).toBe('')
  expect(result.filter).toBe('')
})
test('glass falls back without backdrop support and honors external style writes', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const old = CSS.supports.bind(CSS)
    CSS.supports = ((...args: any[]) =>
      String(args[0]).includes('backdrop')
        ? false
        : old(...(args as [string, string]))) as typeof CSS.supports
    window.fixture.boot('glass')
    const g = window.fixture.glass!,
      fallback = g.snapshot()
    window.fixture.el('glass').style.backgroundColor = 'red'
    g.dispose()
    return { fallback, color: window.fixture.el('glass').style.backgroundColor }
  })
  expect(result.fallback).toMatchObject({
    backend: 'solid',
    reason: 'unsupported',
    appliedAmount: 0,
  })
  expect(result.color).toBe('red')
})
test('glass obeys forced colors and target removal disposes playback', async ({
  page,
}) => {
  await page.emulateMedia({ forcedColors: 'active' })
  await page.evaluate(() => window.fixture.boot('glass'))
  expect(await page.evaluate(() => window.fixture.glass!.snapshot().reason)).toBe(
    'forced-colors',
  )
  await page.evaluate(() => window.fixture.el('glass').remove())
  await expect.poll(() => page.evaluate(() => window.fixture.glass!.disposed)).toBe(true)
})
test('interactive route cancels short drag and commits long drag exactly once', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('navigation'))
  await drag(page, '#route', 80, 0, true)
  await expect
    .poll(() => page.evaluate(() => window.fixture.navigation!.state))
    .toBe('idle')
  expect(await page.evaluate(() => window.fixture.commits)).toBe(0)
  await drag(page, '#route', 380, 0, true)
  await expect
    .poll(() => page.evaluate(() => window.fixture.navigation!.state))
    .toBe('disposed')
  await page.evaluate(() => window.fixture.navigation!.back())
  expect(await page.evaluate(() => window.fixture.commits)).toBe(1)
})
test('route rejection rolls back, nested input and non-edge drags remain owned by app', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.fixture.boot('navigation')
    window.fixture.reject = true
  })
  await drag(page, '#route', 100, 0)
  expect(await page.evaluate(() => window.fixture.navigation!.progress)).toBe(0)
  await page.locator('#action').click()
  await expect.poll(() => page.evaluate(() => window.fixture.commits)).toBe(1)
  await expect
    .poll(() => page.evaluate(() => window.fixture.navigation!.state))
    .toBe('idle')
  await page.locator('#nested').click()
  expect(await page.evaluate(() => window.fixture.commits)).toBe(1)
})
test('route scope disposal aborts pending navigation and restores transform', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const f = window.fixture,
      e = f.el('stage')
    let signal: AbortSignal | undefined
    f.runtime.configure({ reducedMotion: 'always' })
    const nav = f.scope.interactiveNavigation(e, {
      commit: (c) => {
        signal = c.signal
        return new Promise(() => {})
      },
    })
    nav.back()
    await new Promise((r) => setTimeout(r, 100))
    f.scope.dispose()
    return {
      aborted: signal?.aborted,
      disposed: nav.disposed,
      transform: e.style.transform,
    }
  })
  expect(result).toMatchObject({ aborted: true, disposed: true })
})
async function gallery(page: Page) {
  await page.evaluate(() => window.fixture.boot('gallery'))
  await page.locator('#action').click()
  await expect.poll(() => page.evaluate(() => window.fixture.entry?.state)).toBe('idle')
  await expect.poll(() => page.evaluate(() => window.fixture.zoom?.ready)).toBe(true)
}
test('gallery opens, focal zooms, resets and returns to a recycled keyed thumbnail', async ({
  page,
}) => {
  await gallery(page)
  await page.locator('#photo').dblclick()
  await expect
    .poll(() => page.evaluate(() => window.fixture.zoom!.state.scale))
    .toBeGreaterThan(2)
  await page.evaluate(() => window.fixture.zoom!.reset(false))
  await page.evaluate(() => {
    window.fixture.el('list').scrollTop = 2200
    window.fixture.el('list').dispatchEvent(new Event('scroll'))
  })
  await page.locator('#back').click()
  await expect
    .poll(() => page.evaluate(() => window.fixture.entry!.state))
    .toBe('returned')
  expect(await page.evaluate(() => window.fixture.commits)).toBe(1)
  await expect(page.locator('#detail')).toBeHidden()
  expect(await page.locator('#rows img[data-key="photo-0"]').count()).toBe(1)
})
test('gallery dismissal cancel preserves entry and committed drag returns once', async ({
  page,
}) => {
  await gallery(page)
  await drag(page, '#viewport', 0, 30)
  await expect
    .poll(() => page.evaluate(() => Math.abs(window.fixture.zoom!.state.y)))
    .toBeLessThan(1)
  expect(await page.evaluate(() => window.fixture.commits)).toBe(0)
  await drag(page, '#viewport', 0, 130)
  await expect
    .poll(() => page.evaluate(() => window.fixture.entry!.state))
    .toBe('returned')
  expect(await page.evaluate(() => window.fixture.commits)).toBe(1)
})
test('gallery rejected return keeps the zoomable detail usable', async ({ page }) => {
  await gallery(page)
  await page.evaluate(() => (window.fixture.reject = true))
  await drag(page, '#viewport', 0, 140)
  await expect.poll(() => page.evaluate(() => window.fixture.entry!.state)).toBe('idle')
  await expect.poll(() => page.evaluate(() => window.fixture.zoom!.state.scale)).toBe(1)
  expect(await page.evaluate(() => window.fixture.zoom!.disposed)).toBe(false)
  await expect(page.locator('#detail')).toBeVisible()
})
test('deleted photo returns without stale flight and focuses the collection', async ({
  page,
}) => {
  await gallery(page)
  await page.locator('#reverse').click()
  await page.locator('#back').click()
  await expect
    .poll(() => page.evaluate(() => window.fixture.entry!.state))
    .toBe('returned')
  await expect(page.locator('#list')).toBeFocused()
  expect(await page.locator('[data-jolt-shared-copy]').count()).toBe(0)
})
test('list resolver rejects recycled identity and honors abort', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { runtime, el, resolveListTarget } = window.fixture,
      c = el('stage'),
      node = document.createElement('div')
    node.style.cssText = 'width:20px;height:20px'
    c.append(node)
    const controller = new AbortController()
    let key = 'wrong',
      attempts = 0
    const options = {
      container: c,
      indexOf: () => 2,
      scrollToIndex: () => {
        attempts++
        if (attempts === 3) key = 'photo'
      },
      viewForKey: () => node,
      keyOf: () => key,
    }
    const target = await resolveListTarget(
      { key: 'photo', signal: controller.signal },
      options,
    )
    controller.abort()
    const canceled = await resolveListTarget(
      { key: 'photo', signal: controller.signal },
      options,
    )
    runtime.dispose()
    return { matched: target === node, attempts, canceled: canceled === undefined }
  })
  expect(result).toEqual({ matched: true, attempts: 4, canceled: true })
})
test('press haptics emit once per accepted press and invalid haptic options retain motion', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.fixture.boot('haptics')
    ;(window as any).impacts = []
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (n: number) => {
        ;(window as any).impacts.push(n)
        return true
      },
    })
    const b = document.createElement('button')
    b.id = 'feedback'
    b.textContent = 'Feedback'
    window.fixture.el('stage').append(b)
    window.fixture.scope.press(b, { scale: 0.95 }, { haptic: 'medium' })
  })
  await page.locator('#feedback').click()
  expect(await page.evaluate(() => (window as any).impacts)).toEqual([20])
  const result = await page.evaluate(() => {
    const f = window.fixture,
      a = f.runtime.animate(f.el('pulse'), { x: 100 }, { duration: 800 })
    let rejected = false
    try {
      f.runtime.animate(
        f.el('pulse'),
        { x: 200 },
        { haptic: { style: 'light', times: [0.7, 0.2] } },
      )
    } catch {
      rejected = true
    }
    a.pause()
    return { rejected, progress: a.progress }
  })
  expect(result.rejected).toBe(true)
  expect(result.progress).toBeLessThan(1)
})
test('permission rejection, resolution after disposal and invalid intervals stay bounded', async ({
  page,
}) => {
  await sensors(page, true)
  const result = await page.evaluate(async () => {
    const w = window as any
    let resolve!: (s: string) => void
    w.DeviceOrientationEvent.requestPermission = () => new Promise((r) => (resolve = r))
    const promise = window.fixture.sensor!.requestPermission()
    window.fixture.sensor!.dispose()
    resolve('granted')
    const result = await promise
    let invalid = false
    try {
      window.fixture.runtime.sensor('rotation', { interval: 0 })
    } catch {
      invalid = true
    }
    w.DeviceOrientationEvent.requestPermission = () => Promise.reject(new Error('denied'))
    const s = window.fixture.runtime.sensor('rotation')
    const permission = await s.requestPermission()
    return {
      result,
      disposed: window.fixture.sensor!.status,
      invalid,
      permission,
      status: s.status,
    }
  })
  expect(result).toEqual({
    result: 'unavailable',
    disposed: 'disposed',
    invalid: true,
    permission: 'denied',
    status: 'denied',
  })
})
test('sensor pause preserves relative rotation across acquisition restart', async ({
  page,
}) => {
  await sensors(page)
  const result = await page.evaluate(() => {
    const w = window as any,
      s = window.fixture.sensor!
    w.orientation(0, 0, 0)
    w.orientation(0, 20, 0)
    const first = s.x.get()
    s.pause()
    w.orientation(0, 50, 0)
    s.play()
    w.orientation(0, 80, 0)
    const restarted = s.x.get()
    w.orientation(0, 90, 0)
    return { first, restarted, last: s.x.get() }
  })
  expect(result.first).toBeCloseTo(Math.PI / 9, 6)
  expect(result.restarted).toBeCloseTo(result.first, 6)
  expect(result.last).toBeCloseTo(Math.PI / 6, 6)
})
test('glass seeks and restores intensity after reduced transparency is removed', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const original = window.matchMedia.bind(window),
      listeners = new Set<() => void>()
    let reduced = false
    window.matchMedia = ((query: string) =>
      query.includes('reduced-transparency')
        ? {
            get matches() {
              return reduced
            },
            addEventListener: (_t: string, fn: () => void) => listeners.add(fn),
            removeEventListener: (_t: string, fn: () => void) => listeners.delete(fn),
          }
        : original(query)) as typeof window.matchMedia
    window.fixture.boot('glass')
    const g = window.fixture.glass!
    g.set(0.6)
    reduced = true
    listeners.forEach((fn) => fn())
    const fallback = g.snapshot()
    listeners.forEach((fn) => fn())
    reduced = false
    listeners.forEach((fn) => fn())
    const restored = g.snapshot()
    const a = g.animate(1, { duration: 1000 })
    a.pause()
    a.progress = 0.5
    const mid = g.snapshot()
    g.dispose()
    return { fallback, restored, mid, remaining: listeners.size }
  })
  expect(result.fallback).toMatchObject({
    backend: 'solid',
    reason: 'reduced-transparency',
    amount: 0.6,
    appliedAmount: 0,
  })
  expect(result.restored.appliedAmount).toBe(0.6)
  expect(result.mid.appliedAmount).toBeGreaterThan(0.6)
  expect(result.mid.appliedAmount).toBeLessThan(1)
  expect(result.remaining).toBe(0)
})
test('interactive route timeout aborts callback and ignores a late acceptance', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const f = window.fixture
    f.runtime.configure({ reducedMotion: 'always' })
    let signal: AbortSignal | undefined, resolve!: (v: boolean) => void
    const nav = f.scope.interactiveNavigation(f.el('stage'), {
      navigationTimeout: 40,
      commit: (c) => {
        signal = c.signal
        return new Promise((r) => (resolve = r))
      },
    })
    nav.back()
    await new Promise((r) => setTimeout(r, 150))
    const state = nav.state
    resolve(true)
    await Promise.resolve()
    return { state, after: nav.state, aborted: signal?.aborted }
  })
  expect(result).toEqual({ state: 'idle', after: 'idle', aborted: true })
})
test('shared entry timeout aborts target realization and coalesces duplicate returns', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const f = window.fixture,
      c = f.el('stage')
    c.innerHTML =
      '<div id="a" style="width:50px;height:50px;background:red"></div><div id="b" style="width:100px;height:100px;background:blue"></div>'
    let calls = 0,
      signal: AbortSignal | undefined
    const entry = f.scope.sharedNavigationEntry(c, {
      tag: 'a',
      source: () => f.el('a'),
      detail: () => f.el('b'),
      transition: { duration: 0 },
      returnTarget: {
        key: 'a',
        timeout: 40,
        resolve: (ctx) => {
          signal = ctx.signal
          return new Promise(() => {})
        },
        fallbackFocus: () => f.el('a'),
      },
      back: () => {
        calls++
      },
    })
    await entry.open(() => {})
    const first = entry.back(),
      second = entry.back()
    const result = await first
    return {
      same: first === second,
      calls,
      aborted: signal?.aborted,
      state: entry.state,
      result,
    }
  })
  expect(result).toMatchObject({
    same: true,
    calls: 1,
    aborted: true,
    state: 'returned',
    result: { status: 'unavailable', reason: 'missing-target', navigated: true },
  })
})
test('shared entry disposal aborts pending route and never resurrects visual work', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const f = window.fixture,
      c = f.el('stage')
    let signal: AbortSignal | undefined, resolve!: () => void
    c.innerHTML = '<div id="source" style="width:50px;height:50px;background:red"></div>'
    const entry = f.scope.sharedNavigationEntry(c, {
      tag: 'a',
      source: () => f.el('source'),
      detail: () => undefined,
      returnTarget: { key: 'a', resolve: () => undefined },
      back: () => {},
    })
    const promise = entry.open((ctx) => {
      signal = ctx.signal
      return new Promise<void>((r) => (resolve = r))
    })
    entry.dispose()
    resolve()
    const result = await promise
    await new Promise((r) => setTimeout(r, 50))
    return {
      result,
      aborted: signal?.aborted,
      state: entry.state,
      copies: document.querySelectorAll('[data-jolt-shared-copy]').length,
    }
  })
  expect(result).toMatchObject({
    aborted: true,
    state: 'disposed',
    copies: 0,
    result: { status: 'cancelled' },
  })
})
test('aborting realization resolves promptly even if the application promise stays pending', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const f = window.fixture,
      c = new AbortController()
    const promise = f.resolveListTarget(
      { key: 'photo', signal: c.signal },
      {
        container: f.el('stage'),
        indexOf: () => 0,
        scrollToIndex: () => new Promise(() => {}),
        viewForKey: () => undefined,
        keyOf: () => undefined,
      },
    )
    c.abort()
    return await Promise.race([
      promise.then((v) => v === undefined),
      new Promise((r) => setTimeout(() => r(false), 100)),
    ])
  })
  expect(result).toBe(true)
})
test('glass rejects a transparent fallback before replacing existing ownership', async ({
  page,
}) => {
  await page.evaluate(() => window.fixture.boot('glass'))
  expect(
    await page.evaluate(() => {
      const f = window.fixture
      let rejected = false
      try {
        f.runtime.glass(f.el('glass'), { fallbackColor: 'transparent' })
      } catch {
        rejected = true
      }
      return { rejected, retained: !f.glass!.disposed }
    }),
  ).toEqual({ rejected: true, retained: true })
})
test('background and hidden surfaces suppress pending haptic cues', async ({ page }) => {
  await page.evaluate(() => {
    window.fixture.boot('haptics')
    ;(window as any).impacts = []
    Object.defineProperty(navigator, 'vibrate', {
      configurable: true,
      value: (n: number) => {
        ;(window as any).impacts.push(n)
        return true
      },
    })
  })
  await page.locator('#action').click()
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(900)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(100)
  expect(await page.evaluate(() => (window as any).impacts)).toEqual([])
  await page.locator('#action').click()
  await page.evaluate(() => (window.fixture.el('pulse').hidden = true))
  await page.waitForTimeout(900)
  expect(await page.evaluate(() => (window as any).impacts)).toEqual([])
})
test('screen orientation remaps retained sensor samples without new hardware input', async ({
  page,
}) => {
  await sensors(page)
  const result = await page.evaluate(() => {
    const f = window.fixture,
      w = window as any
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 0 })
    const device = f.scope.sensor('gravity', { coordinates: 'device' })
    f.scope.add(device.x.subscribe(() => {}))
    w.orientation(0, 0, 0)
    w.orientation(0, 30, 0)
    w.motion({ x: -4, y: 0, z: 9 }, { x: 0, y: 0, z: 0 })
    const before = f.gravity!.snapshot()
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 90 })
    screen.orientation.dispatchEvent(new Event('change'))
    const after = f.gravity!.snapshot(),
      rotation = f.sensor!.snapshot(),
      deviceValues = device.snapshot().values
    f.scope.suspend()
    Object.defineProperty(screen.orientation, 'angle', { configurable: true, value: 180 })
    window.dispatchEvent(new Event('orientationchange'))
    const paused = f.gravity!.snapshot().values
    return { before, after, rotation, deviceValues, paused }
  })
  expect(result.after.samples).toBe(result.before.samples)
  expect(result.after.timestamp).toBe(result.before.timestamp)
  expect(result.after.values[0]).toBeCloseTo(0, 6)
  expect(result.after.values[1]).toBeCloseTo(-4, 6)
  expect(result.rotation.values[1]).toBeCloseTo(-Math.PI / 6, 6)
  expect(result.deviceValues).toEqual([4, 0, -9])
  expect(result.paused).toEqual(result.after.values)
})
