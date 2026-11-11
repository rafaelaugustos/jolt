import { expect, test } from '@playwright/test'
import type {} from './fixture.js'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.portable)
})

test('group validation is transactional; seek, replacement and activity share one lifetime', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.portable.runtime
    const a = { value: 0 },
      b = { value: 10 },
      unrelated = { value: 0 }
    const definition = {
      name: 'test/value',
      units: ['number'],
      read: (t: object) => (t as typeof a).value,
      write: (t: object, n: number) => {
        ;(t as typeof a).value = n
      },
      encode: (n: number) => [n],
      decode: (v: readonly number[]) => v[0]!,
    }
    const pa = runtime.property(a, definition),
      pb = runtime.property(b, definition),
      pc = runtime.property(unrelated, definition)
    const group = runtime.propertyGroup({ a: pa, b: pb }),
      transitions: boolean[] = []
    let redraws = 0
    const activity = runtime.renderActivity({
      change(active) {
        transitions.push(active)
      },
      redraw() {
        redraws++
      },
    })
    const motion = group.animate(
      { a: 100, b: 210 },
      { duration: 2000, ease: 'linear', delay: 200 },
    )
    const other = pc.animate(100, { duration: 10000 })
    activity.track(motion)
    let rejected = false
    try {
      group.animate({ a: 200, b: NaN })
    } catch {
      rejected = true
    }
    motion.pause()
    motion.progress = 0.5
    const seek = [a.value, b.value],
      observedPaused = activity.active
    motion.play()
    pa.set(42)
    const cancelled = await motion.finished,
      after = transitions.slice(),
      leftRunning = other.progress < 1
    group.dispose()
    const borrowed = pa.get()
    other.stop()
    activity.dispose()
    pa.dispose()
    pb.dispose()
    pc.dispose()
    return {
      rejected,
      seek,
      observedPaused,
      cancelled,
      after,
      leftRunning,
      borrowed,
      redraws,
    }
  })
  expect(result.rejected).toBe(true)
  expect(result.seek[0]).toBeCloseTo(45, 5)
  expect(result.seek[1]).toBeCloseTo(100, 5)
  expect(result.observedPaused).toBe(false)
  expect(result.cancelled).toBe(false)
  expect(result.after).toEqual([true, false, true, false])
  expect(result.leftRunning).toBe(true)
  expect(result.borrowed).toBe(42)
  expect(result.redraws).toBeGreaterThan(2)
})

test('groups restore partial setter failures, reject duplicate channels and stop on reduced motion', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.portable.runtime
    const targets = [{ value: 1 }, { value: 2 }]
    const definition = {
      name: 'test/spatial',
      units: ['px'],
      spatial: true,
      read: (t: object) => (t as { value: number }).value,
      write: (t: object, value: number) => {
        ;(t as { value: number }).value = value
        if (value === 99) throw new Error('setter failed')
      },
      encode: (n: number) => [n],
      decode: (v: readonly number[]) => v[0]!,
    }
    const a = runtime.property(targets[0]!, definition),
      b = runtime.property(targets[1]!, definition)
    const group = runtime.propertyGroup({ a, b })
    let rollback = false,
      duplicate = false
    try {
      group.set({ a: 90, b: 99 })
    } catch {
      rollback = targets[0]!.value === 1 && targets[1]!.value === 2
    }
    try {
      runtime.propertyGroup({ a, alias: runtime.property(targets[0]!, definition) })
    } catch {
      duplicate = true
    }
    const motion = group.animate({ a: 10, b: 20 }, { duration: 20000 })
    runtime.configure({ reducedMotion: 'always' })
    const finished = await motion.finished
    const final = group.get()
    runtime.dispose()
    return { rollback, duplicate, finished, final }
  })
  expect(result).toEqual({
    rollback: true,
    duplicate: true,
    finished: true,
    final: { a: 10, b: 20 },
  })
})

test('scope ownership survives idle, isolates child demand and cleans recurring setup', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.portable.runtime,
      scope = runtime.scope(),
      changes: boolean[] = []
    const activity = scope.renderActivity({
      change(active) {
        changes.push(active)
      },
      redraw() {},
    })
    const one = activity.scope(),
      two = activity.scope()
    const releaseOne = one.hold(),
      releaseTwo = two.hold()
    one.suspend()
    releaseTwo()
    const idle = !activity.active
    one.resume()
    scope.suspend()
    scope.resume()
    releaseOne()
    const settled = !activity.active
    scope.dispose()
    for (let i = 0; i < 25; i++) {
      const child = runtime.scope()
      const property = child.property(
        { n: 0 },
        {
          name: 'test/value',
          units: ['number'],
          read: (t) => (t as { n: number }).n,
          write: (t, n: number) => {
            ;(t as { n: number }).n = n
          },
          encode: (n) => [n],
          decode: (v) => v[0]!,
        },
      )
      const group = child.propertyGroup({ property })
      child
        .renderActivity({ change() {}, redraw() {} })
        .track(group.animate({ property: 1 }, { duration: 5000 }))
      child.dispose()
    }
    return { idle, settled, disposed: activity.disposed, changes }
  })
  expect(result.idle && result.settled && result.disposed).toBe(true)
  expect(result.changes).toEqual([true, false, true, false, true, false])
})

test('pointer presence follows real mouse entry/exit, keeps clicks and suppresses touch', async ({
  page,
}) => {
  await page.evaluate(() => window.portable.boot('pointer'))
  const box = await page.locator('#region').boundingBox()
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2)
  await expect(page.locator('#status')).toContainText('Presence 1')
  await page.mouse.move(5, 5)
  await expect(page.locator('#status')).toContainText('Presence 0')
  await page.locator('#inside').click()
  await expect(page.locator('#inside')).toHaveAttribute('data-actions', '1')
  // Away from the real cursor on #inside, whose late events under load would reach #region.
  const result = await page.evaluate(async () => {
    const runtime = window.portable.runtime,
      region = document.createElement('div')
    region.style.cssText = 'position:fixed;left:0;bottom:0;width:200px;height:80px'
    document.body.append(region)
    const pointer = runtime.pointerFollow(region, { spring: false })
    const b = region.getBoundingClientRect()
    const send = (type: string) =>
      region.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: type,
          clientX: b.left + b.width * 0.75,
          clientY: b.top + b.height * 0.5,
          bubbles: true,
        }),
      )
    const frame = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
    send('touch')
    await frame()
    const touch = pointer.presence.get()
    send('mouse')
    await frame()
    const mouse = [pointer.x.get(), pointer.y.get(), pointer.presence.get()]
    pointer.suspend()
    const paused = pointer.presence.get()
    pointer.resume()
    region.style.width = '0px'
    pointer.refresh()
    send('mouse')
    await frame()
    const zero = pointer.presence.get()
    pointer.dispose()
    region.remove()
    return { touch, mouse, paused, zero }
  })
  expect(result.touch).toBe(0)
  expect(result.mouse).toEqual([0.5, 0, 1])
  expect(result.paused).toBe(0)
  expect(result.zero).toBe(0)
})

test('batch preserves ordered items, targeted identity, validation and disposal', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const runtime = window.portable.runtime,
      target = document.getElementById('stage')!
    const items = window.portable.dots(259)
    const drawing = runtime.drawBatch(target, {
      viewBox: [0, 0, 760, 300],
      styles: { dots: { fill: '#63e3c2', strokeWidth: 0 } },
      items,
    })
    const first = target.querySelector('[data-jolt-item="dot-0"]'),
      second = target.querySelector('[data-jolt-item="dot-1"]')
    drawing.update([{ ...items[0]!, kind: 'circle', cx: 20, cy: 50, radius: 8 }])
    const targeted =
      first !== target.querySelector('[data-jolt-item="dot-0"]') &&
      second === target.querySelector('[data-jolt-item="dot-1"]')
    let rejected = false
    try {
      drawing.set({ items: [...items, items[0]!] })
    } catch {
      rejected = true
    }
    const count = drawing.snapshot().items
    drawing.set({ items: [...items.slice(0, 3)].reverse() })
    const order = [...target.querySelectorAll('[data-jolt-item]')].map(
      (n) => (n as SVGPathElement).dataset.joltItem,
    )
    drawing.suspend()
    drawing.set({ items: [] })
    const retained = target.querySelectorAll('[data-jolt-item]').length
    drawing.resume()
    const cleared = target.querySelectorAll('[data-jolt-item]').length
    drawing.set({ items })
    drawing.dispose()
    return {
      targeted,
      rejected,
      count,
      order,
      retained,
      cleared,
      removed: !target.querySelector('[data-jolt-effect="drawing"]'),
    }
  })
  expect(result).toEqual({
    targeted: true,
    rejected: true,
    count: 259,
    order: ['dot-2', 'dot-1', 'dot-0'],
    retained: 3,
    cleared: 0,
    removed: true,
  })
})

test('browser shape remains local after transformed resize, and press does not duplicate application clicks', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.portable.runtime,
      target = document.createElement('div')
    target.style.cssText =
      'position:relative;width:200px;height:200px;transform:scale(1.25) rotate(35deg)'
    document.body.append(target)
    const shape = runtime.shape(target, {
      viewBox: [0, 0, 100, 100],
      d: 'M0 0L100 0L100 100L0 100Z',
      fill: '#ffffff',
    })
    target.style.width = target.style.height = '240px'
    await new Promise((resolve) => requestAnimationFrame(resolve))
    const svg = target.querySelector('svg')!
    const local = [
      parseFloat(getComputedStyle(svg).width),
      parseFloat(getComputedStyle(svg).height),
    ]
    shape.dispose()
    target.remove()
    return local
  })
  expect(result).toEqual([240, 240])
  await page.evaluate(() => window.portable.boot('pointer'))
  for (let i = 1; i <= 4; i++) {
    await page.locator('#inside').click()
    await expect(page.locator('#inside')).toHaveAttribute('data-actions', String(i))
  }
})

test('actual WebGL uniforms reach their destination and the renderer stops at idle', async ({
  page,
}) => {
  const available = await page.evaluate(() => window.portable.sceneValues().length)
  expect(available, 'This backend must expose the recorded WebGL example').toBe(3)
  await page.locator('#run').click()
  await expect(page.locator('#status')).toContainText('idle', { timeout: 5000 })
  const before = await page.evaluate(() => ({
    frames: window.portable.sceneFrames(),
    values: window.portable.sceneValues(),
  }))
  expect(before.frames).toBeGreaterThan(10)
  for (const [index, value] of [0.8, 0.4, 1].entries())
    expect(before.values[index]).toBeCloseTo(value, 5)
  await page.waitForTimeout(250)
  expect(await page.evaluate(() => window.portable.sceneFrames())).toBe(before.frames)
})
