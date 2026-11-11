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

test('pointer availability follows hover capability; losing it while active or stale input after suspension and disposal returns to rest', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.portable.runtime,
      native = window.matchMedia.bind(window)
    const reported = native('(any-hover: hover)').matches
    const probe = document.createElement('div')
    probe.style.cssText = 'position:fixed;right:0;top:0;width:40px;height:40px'
    document.body.append(probe)
    const plain = runtime.pointerFollow(probe, { spring: false })
    const untouched = plain.available === reported
    plain.dispose()
    probe.remove()
    const hover = Object.assign(new EventTarget(), {
      matches: true,
      media: '(any-hover: hover)',
    })
    let listeners = 0
    const add = hover.addEventListener.bind(hover)
    hover.addEventListener = (
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) => {
      listeners++
      if (typeof options === 'object')
        options.signal?.addEventListener('abort', () => listeners--)
      add(type, listener, options)
    }
    window.matchMedia = ((query: string) =>
      query === hover.media ? hover : native(query)) as typeof window.matchMedia
    const region = document.createElement('div')
    region.style.cssText = 'position:fixed;left:0;bottom:0;width:200px;height:80px'
    document.body.append(region)
    let pointer: ReturnType<typeof runtime.pointerFollow>
    try {
      pointer = runtime.pointerFollow(region, { spring: false })
    } finally {
      window.matchMedia = native
    }
    const b = region.getBoundingClientRect()
    const send = (fraction = 0.75) =>
      region.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: 'mouse',
          clientX: b.left + b.width * fraction,
          clientY: b.top + b.height / 2,
          bubbles: true,
        }),
      )
    const frame = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
    const read = () => [pointer.active, pointer.presence.get(), pointer.x.get()]
    const change = (matches: boolean) => {
      hover.matches = matches
      hover.dispatchEvent(new Event('change'))
    }
    const available = [pointer.available]
    send()
    await frame()
    const active = read()
    change(false)
    const lost = [...read(), pointer.available]
    send(0.25)
    await frame()
    const later = read()
    change(true)
    available.push(pointer.available)
    send()
    pointer.suspend()
    await frame()
    const suspended = [...read(), pointer.available, listeners]
    pointer.resume()
    send()
    await frame()
    const resumed = read()
    send(0.25)
    pointer.dispose()
    await frame()
    send()
    change(false)
    await frame()
    const disposed = [...read(), pointer.available, listeners]
    region.remove()
    const diagnostics = runtime.diagnostics({ development: true })
    const resources = diagnostics.snapshot().resources
    diagnostics.dispose()
    return {
      untouched,
      available,
      active,
      lost,
      later,
      suspended,
      resumed,
      disposed,
      followers: resources.pointerFollowers,
      frameTasks: resources.frameTasks,
    }
  })
  expect(result).toEqual({
    untouched: true,
    available: [true, true],
    active: [true, 1, 0.5],
    lost: [false, 0, 0, false],
    later: [true, 1, -0.5],
    suspended: [false, 0, 0, false, 0],
    resumed: [true, 1, 0.5],
    disposed: [false, 0, 0, false, 0],
    followers: 0,
    frameTasks: 0,
  })
})

test('real pointer movement keeps application focus and an unrelated drag; Reduced Motion and teardown leave rest', async ({
  page,
}) => {
  await page.evaluate(() => {
    window.portable.boot('pointer')
    const field = document.createElement('input')
    field.id = 'field'
    field.style.cssText = 'position:fixed;right:8px;top:8px'
    document.body.append(field)
    field.focus()
    const knob = document.createElement('div')
    knob.id = 'knob'
    knob.style.cssText =
      'position:absolute;left:24px;top:24px;width:56px;height:56px;background:#ffc572'
    document.getElementById('region')!.append(knob)
    const log: string[] = []
    Object.assign(window, { gestureLog: log })
    window.portable.scope.drag(knob, {
      onStart: () => log.push('start'),
      onRelease: (event) => log.push(`release ${Math.round(event.x)}`),
    })
  })
  const knob = (await page.locator('#knob').boundingBox())!
  await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2, { steps: 4 })
  await expect(page.locator('#status')).toContainText('Presence 1')
  expect(await page.evaluate(() => document.activeElement?.id)).toBe('field')
  await page.mouse.down()
  await page.mouse.move(knob.x + knob.width / 2 + 60, knob.y + knob.height / 2, {
    steps: 6,
  })
  await page.mouse.up()
  await expect(page.locator('#status')).toContainText('Presence 1')
  const log = await page.evaluate(
    () => (window as unknown as { gestureLog: string[] }).gestureLog,
  )
  expect(log[0]).toBe('start')
  expect(log[1]).toMatch(/^release (5[0-9]|6[0-9])$/)
  const reduced = await page.evaluate(async () => {
    const { runtime, scope } = window.portable
    const region = document.getElementById('region')!
    const pointer = scope.pointerFollow(region, { spring: false })
    const b = region.getBoundingClientRect()
    const send = () =>
      region.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: 'mouse',
          clientX: b.left + b.width * 0.75,
          clientY: b.top + b.height / 2,
          bubbles: true,
        }),
      )
    const frame = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
    send()
    await frame()
    const before = [pointer.presence.get(), pointer.available]
    runtime.configure({ reducedMotion: 'always' })
    const after = [pointer.presence.get(), pointer.x.get(), pointer.available]
    send()
    await frame()
    const ignored = pointer.presence.get()
    runtime.configure({ reducedMotion: 'never' })
    send()
    await frame()
    const restored = pointer.presence.get()
    for (let i = 0; i < 25; i++) {
      const child = runtime.scope()
      child.pointerFollow(region, { spring: i % 2 ? false : undefined })
      child.dispose()
    }
    scope.dispose()
    const diagnostics = runtime.diagnostics({ development: true })
    const resources = diagnostics.snapshot().resources
    diagnostics.dispose()
    return {
      before,
      after,
      ignored,
      restored,
      disposed: pointer.disposed,
      followers: resources.pointerFollowers,
      values: resources.values,
    }
  })
  expect(reduced).toEqual({
    before: [1, true],
    after: [0, 0, false],
    ignored: 0,
    restored: 1,
    disposed: true,
    followers: 0,
    values: 0,
  })
})

test('a behavior run owns its pointer: the lane suspends it and interruption disposes it', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.portable.runtime,
      region = document.createElement('div')
    region.style.cssText = 'position:fixed;left:0;bottom:0;width:200px;height:80px'
    document.body.append(region)
    let pointer!: ReturnType<typeof runtime.pointerFollow>
    const behaviors = runtime.motionBehaviors({
      hover: {
        run(context) {
          pointer = context.scope.pointerFollow(region, { spring: false })
          return context.wait(new Promise(() => {}))
        },
      },
      press: { priority: 1, run: () => undefined },
    })
    const b = region.getBoundingClientRect()
    const send = () =>
      region.dispatchEvent(
        new PointerEvent('pointermove', {
          pointerType: 'mouse',
          clientX: b.left + b.width * 0.75,
          clientY: b.top + b.height / 2,
          bubbles: true,
        }),
      )
    const frame = () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      )
    const hover = behaviors.request('hover')
    send()
    await frame()
    const active = pointer.presence.get()
    behaviors.pause()
    const paused = [pointer.suspended, pointer.presence.get()]
    send()
    await frame()
    const ignored = pointer.presence.get()
    behaviors.play()
    send()
    await frame()
    const resumed = [pointer.suspended, pointer.presence.get()]
    behaviors.request('press')
    const status = (await hover.finished).status
    send()
    await frame()
    const after = [pointer.disposed, pointer.presence.get()]
    behaviors.dispose()
    region.remove()
    return { active, paused, ignored, resumed, status, after }
  })
  expect(result).toEqual({
    active: 1,
    paused: [true, 0],
    ignored: 0,
    resumed: [false, 1],
    status: 'interrupted',
    after: [true, 0],
  })
})

test('overlapping groups, partial replacement and a lost target settle each run exactly once', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = window.portable.runtime
    const targets = [0, 1, 2].map(() => ({ value: 0, alive: true }))
    const writes = [0, 0, 0]
    const definition = {
      name: 'test/overlap',
      units: ['number'],
      read: (t: object) => (t as (typeof targets)[number]).value,
      write: (t: object, n: number) => {
        const target = t as (typeof targets)[number]
        target.value = n
        writes[targets.indexOf(target)]!++
      },
      alive: (t: object) => (t as (typeof targets)[number]).alive,
      encode: (n: number) => [n],
      decode: (v: readonly number[]) => v[0]!,
    }
    const errors: string[] = []
    const report = (event: ErrorEvent) => {
      event.preventDefault()
      errors.push(String(event.error?.message ?? event.message))
    }
    window.addEventListener('error', report)
    const frames = async (count = 3) => {
      for (let i = 0; i < count; i++)
        await new Promise((resolve) => requestAnimationFrame(resolve))
    }
    const [a, b, c] = targets.map((target) => runtime.property(target, definition))
    const first = runtime.propertyGroup({ a: a!, b: b! }),
      second = runtime.propertyGroup({ b: b!, c: c! })
    const settled: string[] = []
    const older = first.animate({ a: 10, b: 10 }, { duration: 1000, ease: 'linear' })
    void older.then((done) => settled.push(`older ${done}`))
    await frames()
    const newer = second.animate({ b: -10, c: -10 }, { duration: 300, ease: 'linear' })
    void newer.then((done) => settled.push(`newer ${done}`))
    const olderResult = await older.finished
    const frozen = [targets[0]!.value, writes[0]]
    first.stop()
    const newerResult = await newer.finished
    const afterNewer = targets.slice(1).map((target) => target.value)
    newer.stop()
    newer.progress = 1
    await frames()
    const untouched = targets[0]!.value === frozen[0] && writes[0] === frozen[1]
    const settledWrites = writes.slice()
    await frames()
    const idle = writes.every((count, i) => count === settledWrites[i])
    const third = first.animate({ a: 5, b: 5 }, { duration: 1000 })
    void third.then((done) => settled.push(`third ${done}`))
    a!.animate(1, { duration: 50 })
    const thirdResult = await third.finished
    const lost = second.animate({ b: 4, c: 4 }, { duration: 1000 })
    void lost.then((done) => settled.push(`lost ${done}`))
    await frames()
    targets[2]!.alive = false
    const beforeLoss = targets[1]!.value
    await frames()
    const lostResult = await lost.finished
    await frames()
    const memberFrozen = targets[1]!.value === beforeLoss
    let rejected = ''
    try {
      second.animate({ b: 0, c: 0 })
    } catch (error) {
      rejected = (error as Error).message
    }
    const reusable = b!.animate(2, { duration: 50 })
    const reusableResult = await reusable.finished
    window.removeEventListener('error', report)
    first.dispose()
    second.dispose()
    second.dispose()
    ;[a, b, c].forEach((property) => property!.dispose())
    const refused: string[] = []
    const foreign = [{ a: a!, x: {} }, { b: b! }] as unknown as Record<
      string,
      NonNullable<typeof a>
    >[]
    for (const members of foreign)
      try {
        runtime.propertyGroup(members)
      } catch (error) {
        refused.push((error as Error).message)
      }
    return {
      refused,
      olderResult,
      untouched,
      newerResult,
      idle,
      afterNewer,
      final: targets.slice(0, 2).map((target) => target.value),
      thirdResult,
      lostResult,
      memberFrozen,
      rejected,
      reusableResult,
      settled,
      errors,
    }
  })
  expect(result).toMatchObject({
    olderResult: false,
    untouched: true,
    newerResult: true,
    idle: true,
    thirdResult: false,
    lostResult: false,
    memberFrozen: true,
    reusableResult: true,
    settled: ['older false', 'newer true', 'third false', 'lost false'],
  })
  expect(result.afterNewer).toEqual([-10, -10])
  expect(result.final).toEqual([1, 2])
  expect(result.refused).toHaveLength(2)
  for (const message of result.refused) expect(message).toMatch(/live property adapters/)
  expect(result.rejected).toMatch(/lost its target/)
  expect(result.errors).toHaveLength(1)
  expect(result.errors[0]).toMatch(/lost its target/)
})
