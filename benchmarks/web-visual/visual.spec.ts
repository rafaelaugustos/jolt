import { test, expect, type Page } from '@playwright/test'
const errors = new WeakMap<Page, string[]>()
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  errors.set(page, [])
  page.on('pageerror', (error) => errors.get(page)!.push(String(error)))
  await page.goto('/?test')
  await page.evaluate(() => {
    window.rt = lab.createWebRuntime(document, { reducedMotion: 'never' })
    window.target = lab.makeTarget()
  })
})
test.afterEach(async ({ page }) => {
  await page.evaluate(() => rt.dispose())
  await page.waitForTimeout(20)
  expect(errors.get(page)).toEqual([])
})
test('paint channels share playback, seek, independent takeover and restore', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const original = target.style.cssText
    const a = rt.animate(
      target,
      {
        backgroundColor: ['#f00', '#00f'],
        color: ['white', 'black'],
        borderColor: ['red', 'blue'],
        x: [0, 100],
      },
      { duration: 1000, ease: 'linear' },
    )
    a.pause()
    a.progress = 0.5
    const middle = getComputedStyle(target).backgroundColor
    const b = rt.set(target, { borderLeftColor: 'lime' })
    const left = getComputedStyle(target).borderLeftColor
    a.progress = 0.8
    const right = getComputedStyle(target).borderRightColor
    const pose = rt.inspect(target).pose
    rt.release(target)
    return { middle, left, right, pose, original, restored: target.style.cssText }
  })
  expect(result.middle).not.toBe('rgb(255, 0, 0)')
  expect(result.middle).not.toBe('rgb(0, 0, 255)')
  expect(result.left).toBe('rgb(0, 255, 0)')
  expect(result.right).not.toBe(result.left)
  expect(result.pose!.x).toBeCloseTo(80, 1)
  expect(result.restored).toBe(result.original)
})
test('nonuniform elliptical radii, CSS lengths and independent border sides', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    rt.set(target, {
      borderRadius: '10% 20% 30% 40% / 10% 20% 30% 40%',
      borderWidth: '2px 4px 6px 8px',
    })
    const first = getComputedStyle(target).borderTopRightRadius
    rt.set(target, { borderTopLeftRadius: '12px 25px', borderRightWidth: 10 })
    const css = getComputedStyle(target)
    return {
      first,
      corner: css.borderTopLeftRadius,
      other: css.borderTopRightRadius,
      widths: [
        css.borderTopWidth,
        css.borderRightWidth,
        css.borderBottomWidth,
        css.borderLeftWidth,
      ],
    }
  })
  expect(result.first).toBe('32px 20px')
  expect(result.corner).toBe('12px 25px')
  expect(result.other).toBe(result.first)
  expect(result.widths).toEqual(['2px', '10px', '6px', '8px'])
})
test('continuous perceptual color and radius bindings keep press and release cleanly', async ({
  page,
}) => {
  await page.evaluate(() => {
    const input = rt.motionValue(0)
    rt.bind(target, {
      backgroundColor: input.to([0, 1], ['red', 'blue']),
      borderTopLeftRadius: input.to([0, 1], [0, 30]),
      scale: input.to([0, 1], [1, 1.2]),
    })
    rt.press(target)
    input.set(0.5)
  })
  await expect
    .poll(() => page.evaluate(() => getComputedStyle(target).borderTopLeftRadius))
    .toBe('15px')
  const result = await page.evaluate(() => {
    const css = getComputedStyle(target)
    const out = { color: css.backgroundColor, scale: new DOMMatrix(css.transform).a }
    rt.release(target)
    return out
  })
  expect(result.color).not.toBe('rgb(255, 0, 0)')
  expect(result.scale).toBeCloseTo(1.1, 3)
})

test('real width and auto height reflow text and restore semantic auto', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    target.style.cssText =
      'width:240px;height:40px;overflow:hidden;display:block;flex:none'
    target.textContent = 'Real text reflows through width changes. '.repeat(8)
    const a = rt.animateSize(
      target,
      { width: 120, height: 'auto' },
      { duration: 160, ease: 'linear' },
    )
    await new Promise((r) => setTimeout(r, 70))
    const middle = { width: target.offsetWidth, height: target.offsetHeight }
    const completed = await a.finished
    const final = {
      width: target.offsetWidth,
      height: target.offsetHeight,
      auto: target.style.height,
    }
    const value = rt.inspect(target)
    return { middle, final, completed, sizes: value.sizes }
  })
  expect(result.middle.width).toBeGreaterThan(120)
  expect(result.middle.width).toBeLessThan(240)
  expect(result.middle.height).toBeGreaterThan(40)
  expect(result.final.width).toBe(120)
  expect(result.final.height).toBeGreaterThan(100)
  expect(result.final.auto).toBe('auto')
  expect(result.completed).toBe(true)
  expect(result.sizes).toBe(0)
})
test('size interruption keeps current pixels, pause is idle, auto remeasures new content', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    target.style.cssText =
      'width:200px;height:50px;display:block;flex:none;overflow:hidden'
    target.textContent = 'Short text'
    const first = rt.animateSize(
      target,
      { height: 240 },
      { duration: 500, ease: 'linear' },
    )
    await new Promise((r) => setTimeout(r, 100))
    first.pause()
    const held = target.offsetHeight
    const idle = rt.inspect(target).scheduler.pending
    const second = rt.animateSize(
      target,
      { height: 'auto' },
      () => {
        target.textContent = 'Changing content '.repeat(30)
      },
      { duration: 150 },
    )
    const start = target.offsetHeight
    await new Promise((r) => setTimeout(r, 60))
    target.textContent += ' more content'.repeat(20)
    const completed = await second.finished
    return {
      held,
      start,
      idle,
      first: await first.finished,
      completed,
      height: target.offsetHeight,
      auto: target.style.height,
    }
  })
  expect(Math.abs(result.start - result.held)).toBeLessThanOrEqual(1)
  expect(result.idle).toBe(false)
  expect(result.first).toBe(false)
  expect(result.completed).toBe(true)
  expect(result.height).toBeGreaterThan(200)
  expect(result.auto).toBe('auto')
})
test('size restores both axes on removal and respects external ownership', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    target.style.cssText = 'width:200px;height:50px;flex:none'
    const a = rt.animateSize(target, { width: 100, height: 220 }, { duration: 1000 })
    await new Promise((r) => setTimeout(r, 40))
    target.style.width = '177px'
    await a.finished
    const external = target.style.width,
      restored = target.style.height
    const b = rt.animateSize(target, { height: 300 }, { duration: 1000 })
    target.remove()
    const removed = await b.finished
    return {
      external,
      restored,
      removed,
      height: target.style.height,
      sizes: rt.inspect(target).sizes,
    }
  })
  expect(result).toEqual({
    external: '177px',
    restored: '50px',
    removed: false,
    height: '50px',
    sizes: 0,
  })
})
test('FLIP preserves visual position and size across reorder and resize', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const parent = document.querySelector('#stage')! as HTMLElement
    parent.style.position = 'relative'
    const other = lab.makeTarget()
    target.style.transformOrigin = '20% 70%'
    rt.set(target, { scale: 1.1 })
    rt.press(target)
    const before = target.getBoundingClientRect()
    const motion = rt.animateLayout(
      parent,
      () => {
        parent.append(target)
        target.style.width = '230px'
      },
      { duration: 300, ease: 'linear' },
    )
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const first = target.getBoundingClientRect()
    const completed = await motion.finished
    const after = target.getBoundingClientRect()
    const pose = rt.inspect(target).pose
    return {
      before: { x: before.x, width: before.width },
      first: { x: first.x, width: first.width },
      after: { x: after.x, width: after.width },
      pose,
      completed,
      layouts: rt.inspect(target).layouts,
    }
  })
  expect(result.first.width).toBeCloseTo(result.before.width, 0)
  expect(result.first.x).toBeCloseTo(result.before.x, 0)
  expect(result.after.width).toBeCloseTo(253, 0)
  expect(result.after.x).toBeGreaterThan(result.before.x + 100)
  expect(result.pose!.scaleX).toBeCloseTo(1.1, 3)
  expect(result.completed).toBe(true)
  expect(result.layouts).toBe(0)
})
test('FLIP interruption recaptures the live pose, insertion fades and stopping settles', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const parent = document.querySelector('#stage')! as HTMLElement
    parent.style.position = 'relative'
    lab.makeTarget()
    const first = rt.animateLayout(
      parent,
      () => {
        parent.append(target)
      },
      { duration: 600, ease: 'linear' },
    )
    await new Promise((r) => setTimeout(r, 100))
    const before = target.getBoundingClientRect().x
    const second = rt.animateLayout(
      parent,
      () => {
        parent.prepend(target)
        lab.makeTarget()
      },
      { duration: 500, ease: 'linear' },
    )
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const after = target.getBoundingClientRect().x
    const inserted = parent.lastElementChild as HTMLElement,
      opacity = Number(getComputedStyle(inserted).opacity)
    second.stop()
    const pose = rt.inspect(target).pose
    return {
      before,
      after,
      opacity,
      first: await first.finished,
      second: await second.finished,
      pose,
    }
  })
  expect(Math.abs(result.before - result.after)).toBeLessThan(5)
  expect(result.opacity).toBeLessThan(0.1)
  expect(result.first).toBe(false)
  expect(result.second).toBe(false)
  expect(result.pose!.x).toBe(0)
  expect(result.pose!.scaleX).toBe(1)
})
test('scene coordinates nested element, color, radius and numeric value tracks with seek', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const input = rt.motionValue(0),
      other = lab.makeTarget()
    rt.bind(other, { x: input })
    rt.press(target)
    const scene = rt.seekableTimeline(
      [
        {
          target,
          keyframes: {
            x: [0, 100],
            backgroundColor: ['red', 'blue'],
            borderRadius: [0, 30],
          },
          transition: { duration: 1000, ease: 'linear' },
        },
        {
          at: 200,
          steps: [
            {
              value: input,
              keyframes: [0, 200],
              transition: { duration: 800, ease: 'linear' },
            },
          ],
        },
      ],
      { paused: true },
    )
    scene.progress = 0.5
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const middle = {
      x: new DOMMatrix(getComputedStyle(target).transform).e,
      value: input.get(),
      radius: getComputedStyle(target).borderRadius,
    }
    scene.progress = 1
    const end = input.get()
    scene.progress = 0.25
    const rewound = input.get()
    scene.play()
    const completed = await scene.finished
    return {
      middle,
      end,
      rewound,
      completed,
      value: input.get(),
      tracks: rt.inspect(target).valueAnimations,
    }
  })
  expect(result.middle.x).toBeCloseTo(50, 1)
  expect(result.middle.value).toBeCloseTo(75, 1)
  expect(result.middle.radius).toBe('15px')
  expect(result.end).toBe(200)
  expect(result.rewound).toBeCloseTo(12.5, 2)
  expect(result.completed).toBe(true)
  expect(result.value).toBe(200)
  expect(result.tracks).toBe(0)
})
test('scene partial takeover keeps unrelated channels and stale completion cannot write a new value', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const input = rt.motionValue(0)
    const scene = rt.seekableTimeline(
      [
        {
          target,
          keyframes: { x: [0, 100], y: [0, 80] },
          transition: { duration: 180, ease: 'linear' },
        },
        {
          value: input,
          keyframes: [0, 10],
          transition: { duration: 180, ease: 'linear' },
        },
      ],
      { paused: true },
    )
    scene.progress = 0.4
    rt.set(target, { x: 333 })
    input.set(777)
    scene.play()
    const done = await scene.finished
    return {
      done,
      input: input.get(),
      pose: rt.inspect(target).pose,
      tracks: rt.inspect(target).valueAnimations,
    }
  })
  expect(result.done).toBe(false)
  expect(result.input).toBe(777)
  expect(result.pose!.x).toBe(333)
  expect(result.pose!.y).toBe(80)
  expect(result.tracks).toBe(0)
})
test('value-only scene finishes, cancels and disposes without retained frames', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const input = rt.motionValue(0)
    const a = rt.seekableTimeline([
      { value: input, keyframes: [0, 10], transition: { duration: 60 } },
    ])
    const completed = await a.finished
    const b = rt.seekableTimeline([
      { value: input, keyframes: [10, 20], transition: { duration: 2000 } },
    ])
    input.dispose()
    const cancelled = await b.finished
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const state = rt.inspect(target)
    return {
      completed,
      cancelled,
      values: state.values,
      tracks: state.valueAnimations,
      pending: state.scheduler.pending,
    }
  })
  expect(result).toEqual({
    completed: true,
    cancelled: false,
    values: 0,
    tracks: 0,
    pending: false,
  })
})

test('CSS colors resolve variables/currentColor and preserve authored image and border styles', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    target.style.cssText =
      '--accent:hsl(120 100% 50% / .5);color:rebeccapurple;background-image:linear-gradient(white,transparent);border-style:dashed solid dotted double;border-radius:10px 20px'
    const original = target.style.cssText
    rt.set(target, {
      backgroundColor: 'var(--accent)',
      borderTopColor: 'currentColor',
      borderRightWidth: '1em',
      borderBottomLeftRadius: 'calc(10% + 2px) 25%',
    })
    const css = getComputedStyle(target)
    const result = {
      background: css.backgroundColor,
      border: css.borderTopColor,
      width: parseFloat(css.borderRightWidth),
      radius: css.borderBottomLeftRadius,
      image: css.backgroundImage,
      style: css.borderTopStyle,
    }
    rt.release(target)
    return { ...result, original, restored: target.style.cssText }
  })
  expect(result.background).toBe('rgba(0, 255, 0, 0.5)')
  expect(result.border).toBe('rgb(102, 51, 153)')
  expect(result.width).toBe(16)
  expect(result.radius).toBe('18px 25px')
  expect(result.image).toContain('linear-gradient')
  expect(result.style).toBe('dashed')
  expect(result.restored).toBe(result.original)
})
test('invalid paint transactions retain old owners and current color on stop', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const a = rt.animate(
      target,
      { backgroundColor: ['red', 'blue'], x: [0, 100] },
      { duration: 1000, ease: 'linear' },
    )
    a.pause()
    a.progress = 0.4
    const before = getComputedStyle(target).backgroundColor
    let failed = false
    try {
      rt.animate(target, { backgroundColor: 'not-a-color', x: 300 })
    } catch {
      failed = true
    }
    const retained = rt.inspect(target).tracks?.length
    a.stop()
    const after = getComputedStyle(target).backgroundColor
    return { before, after, failed, retained, completed: await a.finished }
  })
  expect(result.failed).toBe(true)
  expect(result.retained).toBe(2)
  expect(result.completed).toBe(false)
  expect(result.after).toBe(result.before)
})
test('color source teardown holds latest paint, rejects foreign nodes and does not keep an idle frame loop', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const input = rt.motionValue(0),
      color = input.to([1, 0], ['blue', 'red'])
    rt.bind(target, { backgroundColor: color })
    input.set(0.8)
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const before = getComputedStyle(target).backgroundColor
    const other = lab.createWebRuntime(document)
    let rejected = false
    try {
      other.bind(lab.makeTarget(), { backgroundColor: color })
    } catch {
      rejected = true
    }
    other.dispose()
    input.dispose()
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const state = rt.inspect(target)
    return {
      before,
      after: getComputedStyle(target).backgroundColor,
      rejected,
      disposed: color.disposed,
      values: state.values,
      pending: state.scheduler.pending,
    }
  })
  expect(result.after).toBe(result.before)
  expect(result.rejected).toBe(true)
  expect(result.disposed).toBe(true)
  expect(result.values).toBe(0)
  expect(result.pending).toBe(false)
})
for (const display of ['block', 'grid', 'flex'] as const)
  test(`size participates in ${display} parent allocation with content-box and min/max`, async ({
    page,
  }) => {
    const result = await page.evaluate(async (display) => {
      const parent = document.querySelector('#stage')! as HTMLElement
      parent.style.cssText = `display:${display};width:380px;align-items:start;grid-template-columns:auto;`
      target.style.cssText =
        'box-sizing:content-box;display:block;width:120px;height:50px;padding:10px;border:4px solid;min-width:80px;max-width:210px;flex:0 0 auto'
      const sibling = lab.makeTarget()
      sibling.style.flex = '1 1 auto'
      const done = await rt.animateSize(
        target,
        { width: 300, height: 100 },
        { duration: 80 },
      ).finished
      return {
        done,
        width: target.offsetWidth,
        height: target.offsetHeight,
        css: target.style.width,
        sibling: sibling.getBoundingClientRect().width,
      }
    }, display)
    expect(result.done).toBe(true)
    expect(result.width).toBe(238)
    expect(result.height).toBe(128)
    expect(result.sibling).toBeGreaterThan(0)
  })
test('size completion preserves other finite motion across changing transform origin', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    target.style.flex = 'none'
    const move = rt.animate(target, { x: [0, 100] }, { duration: 250, ease: 'linear' })
    const size = rt.animateSize(target, { width: 250, height: 180 }, { duration: 60 })
    await size.finished
    const x = rt.inspect(target).pose!.x
    const moved = await move.finished
    return { x, moved, pose: rt.inspect(target).pose }
  })
  expect(result.x).toBeGreaterThan(0)
  expect(result.moved).toBe(true)
  expect(result.pose!.x).toBe(100)
})
test('live reduced motion settles a paused intrinsic operation and active spatial scene', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    target.style.flex = 'none'
    const size = rt.animateSize(target, { width: 240, height: 180 }, { duration: 1000 })
    size.pause()
    const scene = rt.seekableTimeline(
      [
        {
          target,
          keyframes: { x: [0, 100], opacity: [0.3, 1], backgroundColor: ['red', 'blue'] },
          transition: { duration: 1000, ease: 'linear' },
        },
      ],
      { paused: true },
    )
    scene.progress = 0.2
    rt.configure({ reducedMotion: 'always' })
    const css = getComputedStyle(target),
      pose = rt.inspect(target).pose
    const sized = await size.finished
    scene.stop()
    return {
      sized,
      width: target.offsetWidth,
      height: target.offsetHeight,
      pose,
      opacity: Number(css.opacity),
    }
  })
  expect(result.sized).toBe(true)
  expect(result.width).toBe(240)
  expect(result.height).toBe(180)
  expect(result.pose!.x).toBe(100)
  expect(result.pose!.opacity).toBeCloseTo(0.44, 2)
})
test('invalid size mutation and options do not cancel a running operation', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    target.style.flex = 'none'
    const op = rt.animateSize(target, { height: 200 }, { duration: 100 })
    let errors = 0
    for (const call of [
      () => rt.animateSize(target, { height: -1 }),
      () => rt.animateSize(target, { height: 10 }, async () => {}),
      () => rt.animateSize(target, { height: 100 }, { repeat: 2 } as never),
    ])
      try {
        call()
      } catch {
        errors++
      }
    return { errors, done: await op.finished, height: target.offsetHeight }
  })
  expect(result).toEqual({ errors: 3, done: true, height: 200 })
})
test('empty layout and runtime disposal release pending observers and operations', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    rt.release(target)
    target.remove()
    const parent = document.querySelector('#stage')! as HTMLElement
    const empty = await rt.animateLayout(parent).finished
    const clean = rt.inspect(parent)
    target = lab.makeTarget()
    const size = rt.animateSize(target, { width: 250, height: 300 }, { duration: 1000 })
    const layout = rt.animateLayout(
      parent,
      () => {
        parent.append(lab.makeTarget())
      },
      { duration: 1000 },
    )
    rt.dispose()
    return {
      empty,
      observers: clean.observers,
      size: await size.finished,
      layout: await layout.finished,
      state: rt.inspect(parent),
    }
  })
  expect(result.empty).toBe(true)
  expect(result.observers).toBe(0)
  expect(result.size).toBe(false)
  expect(result.layout).toBe(false)
  expect(result.state.scheduler.pending).toBe(false)
  expect(result.state.targets).toBe(0)
  expect(result.state.layouts).toBe(0)
})
test('FLIP handles nested 2D transforms, noncentral origins and actual hit geometry', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const parent = document.querySelector('#stage')! as HTMLElement
    parent.style.cssText =
      'display:flex;gap:30px;transform:rotate(12deg) scale(.8);transform-origin:10% 20%;position:relative'
    target.style.transform = 'rotate(8deg) scale(.9)'
    target.style.transformOrigin = '0% 100%'
    lab.makeTarget()
    rt.set(target, { scale: 1.1, rotate: 5 })
    const before = target.getBoundingClientRect()
    const op = rt.animateLayout(
      parent,
      () => {
        parent.append(target)
        target.style.width = '230px'
        target.style.height = '150px'
      },
      { duration: 180 },
    )
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const first = target.getBoundingClientRect()
    const hit =
      document.elementFromPoint(first.x + first.width / 2, first.y + first.height / 2) ===
      target
    await op.finished
    return {
      before: { x: before.x, y: before.y, width: before.width, height: before.height },
      first: { x: first.x, y: first.y, width: first.width, height: first.height },
      hit,
      pose: rt.inspect(target).pose,
    }
  })
  for (const field of ['x', 'y', 'width', 'height'] as const)
    expect(Math.abs(result.before[field] - result.first[field])).toBeLessThan(1)
  expect(result.hit).toBe(true)
  expect(result.pose!.scaleX).toBe(1.1)
  expect(result.pose!.rotate).toBe(5)
})
test('position-only FLIP and disabled insertion keep the requested contract', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const parent = document.querySelector('#stage')! as HTMLElement
    lab.makeTarget()
    const op = rt.animateLayout(
      parent,
      () => {
        parent.append(target)
        target.style.width = '240px'
        lab.makeTarget()
      },
      { duration: 120, size: false, enter: false },
    )
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const width = target.offsetWidth,
      scale = rt.inspect(target).pose!.scaleX,
      opacity = getComputedStyle(parent.lastElementChild!).opacity
    return { width, scale, opacity, done: await op.finished }
  })
  expect(result).toEqual({ width: 240, scale: 1, opacity: '1', done: true })
})
test('scene invalid setup is atomic and cross-runtime values stay isolated', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const a = rt.animate(target, { x: [0, 100] }, { duration: 200, ease: 'linear' })
    a.pause()
    a.progress = 0.3
    const other = lab.createWebRuntime(document),
      input = other.motionValue(0)
    let errors = 0
    for (const call of [
      () =>
        rt.seekableTimeline([
          { target, keyframes: { x: [0, 50] } },
          { value: input, keyframes: [0, 1] },
        ]),
      () =>
        rt.seekableTimeline([
          { target, keyframes: { x: [0, 2] } },
          { target, keyframes: { x: [3, 4] } },
        ]),
      () => rt.seekableTimeline([{ target, keyframes: { x: [null, 2] } }]),
    ])
      try {
        call()
      } catch {
        errors++
      }
    const x = rt.inspect(target).pose!.x
    other.dispose()
    a.stop()
    return { errors, x }
  })
  expect(result.errors).toBe(3)
  expect(result.x).toBeCloseTo(30, 2)
})
test('scene repeats and delayed layers share a clock while held press stays independent', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    rt.set(target, { scale: 1.2 })
    const press = rt.press(target)
    const scene = rt.seekableTimeline(
      [
        {
          target,
          keyframes: { x: [0, 100] },
          transition: { duration: 100, repeat: 1, repeatType: 'reverse', ease: 'linear' },
        },
        {
          target,
          keyframes: { scale: [1, 1.5] },
          layer: 'scene',
          at: 50,
          transition: { duration: 150, ease: 'linear' },
        },
      ],
      { paused: true },
    )
    scene.progress = 0.75
    const pose = rt.inspect(target).pose!
    scene.progress = 1
    const end = rt.inspect(target).pose!
    scene.progress = 0
    const start = rt.inspect(target).pose!
    scene.stop()
    press.dispose()
    return { pose, end, start, duration: scene.duration }
  })
  expect(result.duration).toBe(200)
  expect(result.pose.x).toBeCloseTo(50, 2)
  expect(result.pose.scaleX).toBeCloseTo(1.6, 2)
  expect(result.end.x).toBe(0)
  expect(result.end.scaleX).toBeCloseTo(1.8, 2)
  expect(result.start.scaleX).toBe(1.2)
})
for (const mode of ['grow', 'shrink'] as const)
  test(`size preserves the first frame under flex ${mode} and returns the requested CSS size`, async ({
    page,
  }) => {
    const result = await page.evaluate(async (mode) => {
      const parent = document.querySelector('#stage')! as HTMLElement
      parent.style.cssText = 'display:flex;width:500px;gap:0;'
      target.style.cssText = `width:${mode === 'grow' ? 100 : 400}px;height:100px;min-width:0;flex:${mode === 'grow' ? '1 1 auto' : '0 1 auto'};`
      const sibling = lab.makeTarget()
      sibling.style.cssText = target.style.cssText
      const start = target.getBoundingClientRect().width
      const op = rt.animateSize(target, { width: 300 }, { duration: 120, ease: 'linear' })
      const first = target.getBoundingClientRect().width
      const done = await op.finished,
        end = target.getBoundingClientRect().width,
        css = target.style.width
      rt.release(target)
      target.style.width = '300px'
      const natural = target.getBoundingClientRect().width
      return { start, first, done, end, natural, css, flex: target.style.flex }
    }, mode)
    expect(result.first).toBeCloseTo(result.start, 2)
    expect(result.end).toBeCloseTo(result.natural, 2)
    expect(result.done).toBe(true)
    expect(result.css).toBe('300px')
  })

test('content-box border width can change the pivot while color bindings and scene controls remain live', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    target.style.boxSizing = 'content-box'
    const value = rt.motionValue(0),
      color = value.to([0, 1], ['red', 'blue'])
    rt.bind(target, { backgroundColor: color })
    const scene = rt.seekableTimeline(
      [
        { value, keyframes: [0, 1], transition: { duration: 120, ease: 'linear' } },
        {
          target,
          keyframes: { borderRightWidth: [4, 20], x: [0, 50] },
          transition: { duration: 120, ease: 'linear' },
        },
      ],
      { paused: true },
    )
    scene.progress = 1
    scene.progress = 0.5
    scene.play()
    const done = await scene.finished
    const css = getComputedStyle(target)
    return {
      done,
      width: css.borderRightWidth,
      color: css.backgroundColor,
      x: rt.inspect(target).pose!.x,
    }
  })
  expect(result).toEqual({ done: true, width: '20px', color: 'rgb(0, 0, 255)', x: 50 })
})

test('running WAAPI presents intermediate paint instead of exposing inline endpoints', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const op = rt.animate(
      target,
      {
        backgroundColor: ['rgb(255,0,0)', 'rgb(0,0,255)'],
        borderRightWidth: [2, 22],
        borderTopLeftRadius: [0, 60],
        x: [0, 100],
      },
      { duration: 1000, ease: 'linear' },
    )
    op.progress = 0.4
    await new Promise<void>((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => r())),
    )
    const css = getComputedStyle(target),
      result = {
        color: css.backgroundColor,
        width: parseFloat(css.borderRightWidth),
        radius: parseFloat(css.borderTopLeftRadius),
        x: new DOMMatrix(css.transform).e,
        frames: target
          .getAnimations()
          .flatMap((a) => (a.effect as KeyframeEffect).getKeyframes())
          .map((f) => Object.keys(f)),
      }
    op.stop()
    return result
  })
  expect(result.color).not.toBe('rgb(0, 0, 255)')
  expect(result.color).not.toBe('rgb(255, 0, 0)')
  expect(result.width).toBeGreaterThan(8)
  expect(result.width).toBeLessThan(15)
  expect(result.radius).toBeGreaterThan(22)
  expect(result.radius).toBeLessThan(36)
  expect(result.x).toBeGreaterThan(38)
  expect(result.x).toBeLessThan(60)
  expect(
    result.frames.some(
      (f) =>
        f.includes('backgroundColor') &&
        f.includes('borderTopLeftRadius') &&
        f.includes('borderRightWidth'),
    ),
  ).toBe(true)
})

test('interrupting a size-changing FLIP preserves the displayed dimensions and position', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const parent = document.querySelector('#stage')! as HTMLElement
    lab.makeTarget()
    target.style.transformOrigin = '0% 100%'
    const first = rt.animateLayout(
      parent,
      () => {
        target.style.width = '300px'
        target.style.height = '200px'
      },
      { duration: 1000, ease: 'linear' },
    )
    await new Promise((r) => setTimeout(r, 180))
    const before = target.getBoundingClientRect()
    const second = rt.animateLayout(
      parent,
      () => {
        parent.append(target)
        target.style.width = '230px'
        target.style.height = '140px'
      },
      { duration: 150, ease: 'linear' },
    )
    await new Promise<void>((r) => requestAnimationFrame(() => r()))
    const after = target.getBoundingClientRect()
    return {
      before: { x: before.x, y: before.y, width: before.width, height: before.height },
      after: { x: after.x, y: after.y, width: after.width, height: after.height },
      first: await first.finished,
      second: await second.finished,
    }
  })
  for (const key of ['x', 'y', 'width', 'height'] as const)
    expect(Math.abs(result.before[key] - result.after[key])).toBeLessThan(1)
  expect(result.first).toBe(false)
  expect(result.second).toBe(true)
})

test('nested CSS math resolves elliptical percentages on both axes', async ({ page }) => {
  const result = await page.evaluate(() => {
    rt.set(target, {
      borderTopLeftRadius: 'calc(10% + max(2px, 3%)) calc(20% + min(2px, 3%))',
    })
    return getComputedStyle(target).borderTopLeftRadius.split(' ').map(parseFloat)
  })
  expect(result[0]).toBeCloseTo(20.8, 1)
  expect(result[1]).toBeCloseTo(22, 1)
})
test('unresolved mapping colors fail atomically instead of reusing a previous canvas color', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const input = rt.motionValue(0)
    const good = input.to([0, 1], ['red', 'blue'])
    rt.bind(target, { backgroundColor: good })
    let failed = false
    try {
      input.to([0, 1], ['red', 'var(--missing-color)'])
    } catch {
      failed = true
    }
    return {
      failed,
      color: getComputedStyle(target).backgroundColor,
      values: rt.inspect(target).values,
    }
  })
  expect(result).toEqual({ failed: true, color: 'rgb(255, 0, 0)', values: 2 })
})
