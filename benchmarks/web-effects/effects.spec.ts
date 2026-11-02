import { test, expect, type Page } from '@playwright/test'
import type { demo } from './fixture.js'
declare global {
  interface Window {
    demo: typeof demo
  }
}
const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', (e) => messages.push(e.message))
  await page.goto('/')
  await page.evaluate(() => window.demo.frame())
})
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([])
})

test('changing reduced motion with active loading effects settles without mutation feedback', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('loading')
    window.demo.runtime.configure({ reducedMotion: 'always' })
    await window.demo.frame()
    const hidden = document.querySelector<HTMLElement>(
      '[data-jolt-effect="shimmer"]',
    )!.hidden
    window.demo.runtime.configure({ reducedMotion: 'never' })
    await window.demo.frame()
    return {
      hidden,
      restored: !document.querySelector<HTMLElement>('[data-jolt-effect="shimmer"]')!
        .hidden,
    }
  })
  expect(result).toEqual({ hidden: true, restored: true })
})

test('color replacement retains independent gradient stops', async ({ page }) => {
  const background = await page.evaluate(() => {
    const gradient = window.demo.gradient
    gradient.set({ stops: [0.2, 0.7] })
    gradient.set({ colors: ['red', 'blue'] })
    return document.querySelector<HTMLElement>('#surface')!.style.backgroundImage
  })
  expect(background).toContain('20%')
  expect(background).toContain('70%')
})

test('repeated paused rolling replacements keep presentation depth and cleanup bounded', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    window.demo.setup('roll')
    const target = document.querySelector<HTMLElement>('#text')!
    for (let i = 0; i < 80; i++) {
      const animation = window.demo.runtime.rollTo(target, i + 100)
      animation.pause()
      animation.progress = 0.1
    }
    const depth = (element: Element): number =>
      1 + Math.max(0, ...[...element.children].map(depth))
    const before = {
      depth: depth(target),
      fragments: target.querySelectorAll('span').length,
    }
    window.demo.runtime.dispose()
    return {
      ...before,
      after: target.querySelectorAll('span').length,
      text: target.textContent,
    }
  })
  expect(result.depth).toBeLessThan(5)
  expect(result.fragments).toBeLessThan(2048)
  expect(result.after).toBe(0)
  expect(result.text).toBe('179')
})

test('Vue ref replacement and KeepAlive release visual resources through child scopes', async ({
  page,
}) => {
  const result = await page.evaluate(() => window.demo.vueLifecycle())
  expect(result.mounted).toBe(4)
  expect(result.replaced).toBe(4)
  expect(result.deactivated).toBe(0)
  expect(result.reactivated).toBe(4)
  expect(result.ended.interactions).toBe(0)
  expect(result.ended.scheduler.tasks).toBe(0)
  expect(result.events.filter((e) => e === 'setup')).toHaveLength(3)
  expect(result.events.filter((e) => e === 'cleanup')).toHaveLength(3)
})

test('gradients animate geometry and color, preserve transforms, and stop at a shown frame', async ({
  page,
}) => {
  await page.evaluate(() => {
    const { runtime, gradient } = window.demo
    runtime.set(document.querySelector<HTMLElement>('#surface')!, { scale: 0.92 })
    const animation = gradient.animate(
      { colors: ['red', 'blue'], angle: 300 },
      { type: 'tween', duration: 1200, ease: 'linear' },
    )
    animation.pause()
    animation.progress = 0.5
  })
  const image = await page
    .locator('#surface')
    .evaluate((el) => getComputedStyle(el).backgroundImage)
  expect(image).toContain('210deg')
  expect(
    await page.locator('#surface').evaluate((el) => getComputedStyle(el).transform),
  ).not.toBe('none')
  await page.evaluate(() => window.demo.gradient.stop())
  await page.waitForTimeout(90)
  expect(
    await page.locator('#surface').evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toBe(image)
})

test('gradient partial replacement keeps other channels playing and invalid writes leave the owner intact', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const g = window.demo.gradient
    const first = g.animate(
      { angle: 320, center: { x: 0.8 } },
      { duration: 150, type: 'tween' },
    )
    const second = g.animate({ angle: 90 }, { duration: 90, type: 'tween' })
    let rejected = false
    try {
      g.set({ stops: [0.8, 0.1] })
    } catch {
      rejected = true
    }
    return { first: await first, second: await second, rejected }
  })
  expect(result).toEqual({ first: true, second: true, rejected: true })
  expect(
    await page.locator('#surface').evaluate((el) => getComputedStyle(el).backgroundImage),
  ).toContain('90deg')
})

test('all gradient geometries render and resize without taking application backgrounds', async ({
  page,
}) => {
  for (const type of ['radial', 'conic'] as const) {
    await page.evaluate((type) => {
      window.demo.setup()
      const el = document.querySelector<HTMLElement>('#surface')!
      window.demo.gradient.dispose()
      el.style.backgroundImage = 'linear-gradient(black,white)'
      const g = window.demo.scope.gradient(el, {
        type,
        colors: ['#ff0080', '#7928ca00'],
        radius: 0.5,
        center: { x: 0.2, y: 0.7 },
      })
      g.set({ angle: 40 })
      el.style.width = '300px'
    }, type)
    await page.evaluate(() => window.demo.frame())
    const value = await page
      .locator('#surface')
      .evaluate((el) => getComputedStyle(el).backgroundImage)
    expect(value).toContain(`${type}-gradient`)
    expect(value).toContain('linear-gradient')
    await page.evaluate(() => window.demo.scope.dispose())
    expect(
      await page
        .locator('#surface')
        .evaluate((el) => (el as HTMLElement).style.backgroundImage),
    ).toContain('linear-gradient')
    expect(
      await page
        .locator('#surface')
        .evaluate((el) => (el as HTMLElement).style.backgroundImage),
    ).not.toContain(type)
  }
})

test('gradient bindings suspend demand, borrow values, resume and preserve newer bindings', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { runtime, gradient, scope } = window.demo
    const angle = runtime.motionValue(30)
    const off = gradient.bind({ angle })
    angle.set(90)
    await window.demo.frame()
    const before = getComputedStyle(document.querySelector('#surface')!).backgroundImage
    scope.suspend()
    angle.set(120)
    await window.demo.frame()
    const held = getComputedStyle(document.querySelector('#surface')!).backgroundImage
    scope.resume()
    await window.demo.frame()
    const resumed = getComputedStyle(document.querySelector('#surface')!).backgroundImage
    const newer = runtime.motionValue(180)
    gradient.bind({ angle: newer })
    off()
    newer.set(200)
    await window.demo.frame()
    const final = getComputedStyle(document.querySelector('#surface')!).backgroundImage
    gradient.dispose()
    return { before, held, resumed, final, borrowed: !angle.disposed && !newer.disposed }
  })
  expect(result.held).toBe(result.before)
  expect(result.resumed).toContain('120deg')
  expect(result.final).toContain('200deg')
  expect(result.borrowed).toBe(true)
})

test('gradient binding rejects foreign values and leaves no demand after disposal', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { runtime, gradient } = window.demo
    let rejected = false
    try {
      gradient.bind({ angle: { get: () => 12 } as never })
    } catch {
      rejected = true
    }
    const v = runtime.motionValue(0)
    const color = v.to([0, 1], ['red', 'blue'])
    gradient.bind({ colors: [color, 'white'] })
    runtime.animate(v, 1, { duration: 100 })
    await window.demo.frame()
    gradient.dispose()
    color.dispose()
    v.dispose()
    await window.demo.frame()
    return { rejected, snapshot: runtime.inspect(document.body) }
  })
  expect(result.rejected).toBe(true)
  expect(result.snapshot.interactions).toBe(0)
})

test('shimmer and loader use real WAAPI, suspend, resume and release all temporary layers', async ({
  page,
}) => {
  await page.evaluate(() => window.demo.setup('loading'))
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === 'running').length,
      ),
    )
    .toBeGreaterThan(0)
  await page.locator('#pause').click()
  expect(
    await page.evaluate(() =>
      document.getAnimations().every((a) => a.playState === 'paused'),
    ),
  ).toBe(true)
  await page.locator('#play').click()
  await expect
    .poll(() =>
      page.evaluate(
        () => document.getAnimations().filter((a) => a.playState === 'running').length,
      ),
    )
    .toBeGreaterThan(0)
  await page.locator('#dispose').click()
  expect(await page.locator('[data-jolt-effect]').count()).toBe(0)
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
})

test('all loader styles preserve authored content and mask and honor reduced motion', async ({
  page,
}) => {
  for (const style of ['dots', 'bars', 'ring'] as const) {
    const result = await page.evaluate((style) => {
      window.demo.setup('reveal')
      const { runtime } = window.demo,
        target = document.querySelector<HTMLElement>('#surface')!
      target.style.clipPath = 'inset(4px round 14px)'
      const before = target.querySelector('#text')
      const effect = runtime.loader(target, { style })
      runtime.configure({ reducedMotion: 'always' })
      const staticFrame = document.getAnimations().every((a) => a.playState === 'paused')
      effect()
      effect()
      return {
        staticFrame,
        same: before === target.querySelector('#text'),
        clip: target.style.clipPath,
        children: target.childElementCount,
      }
    }, style)
    expect(result.staticFrame && result.same).toBe(true)
    expect(result.clip).toContain('inset')
    expect(result.children).toBe(1)
  }
})

test('loading replacement is transactional and target removal cleans runtime resources', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('loading')
    const el = document.querySelector<HTMLElement>('#text')!
    let rejected = false
    try {
      window.demo.runtime.shimmer(el, { duration: -1 })
    } catch {
      rejected = true
    }
    const survived = el.querySelector('[data-jolt-effect]') !== null
    el.remove()
    document.querySelector('#indicator')!.remove()
    await window.demo.frame()
    return {
      rejected,
      survived,
      interactions: window.demo.inspect().interactions,
      animations: document.getAnimations().length,
    }
  })
  expect(result).toEqual({
    rejected: true,
    survived: true,
    interactions: 0,
    animations: 0,
  })
})

test('circular conceal/reveal preserve layout, masks and semantic content', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('reveal')
    const target = document.querySelector<HTMLElement>('#surface')!,
      before = target.getBoundingClientRect().height
    const first = window.demo.scope.conceal(target, { duration: 50 })
    await first
    const hidden = getComputedStyle(target).visibility
    const second = window.demo.scope.reveal(target, { duration: 50 })
    await second
    return {
      hidden,
      visible: getComputedStyle(target).visibility,
      height: target.getBoundingClientRect().height,
      before,
      clip: target.style.clipPath,
      text: target.textContent,
    }
  })
  expect(result.hidden).toBe('hidden')
  expect(result.visible).toBe('visible')
  expect(result.height).toBe(result.before)
  expect(result.clip).toBe('')
  expect(result.text).toContain('Make every detail')
})

test('circular reversal begins at the displayed circle and reports cancellation', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('reveal')
    const target = document.querySelector<HTMLElement>('#surface')!
    const first = window.demo.runtime.conceal(target, { duration: 1000 })
    first.pause()
    first.progress = 0.45
    const before = getComputedStyle(target).clipPath
    const second = window.demo.runtime.reveal(target, { duration: 1000 })
    second.pause()
    second.progress = 0
    const after = getComputedStyle(target).clipPath
    second.progress = 1
    return { before, after, first: await first, second: await second }
  })
  // CSS serialization and compositor precision vary below a hundredth of a pixel.
  const numbers = (value: string) => value.match(/-?\d+(?:\.\d+)?/g)!.map(Number)
  numbers(result.after).forEach((value, i) =>
    expect(Math.abs(value - numbers(result.before)[i]!)).toBeLessThan(0.01),
  )
  expect(result.first).toBe(false)
  expect(result.second).toBe(true)
})

test('reveal intersects authored clip paths and restores app changes on cancellation', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('reveal')
    const el = document.querySelector<HTMLElement>('#surface')!
    el.style.clipPath = 'inset(12px round 8px)'
    const run = window.demo.runtime.conceal(el, { duration: 1000 })
    run.pause()
    run.progress = 0.5
    const mask = el.style.maskImage,
      clip = el.style.clipPath
    el.style.maskImage = 'linear-gradient(red,blue)'
    run.stop()
    return { mask, clip, restored: el.style.maskImage, finished: await run }
  })
  expect(result.mask).toContain('radial-gradient')
  expect(result.clip).toContain('inset')
  expect(result.restored).toContain('linear-gradient')
  expect(result.finished).toBe(false)
})

test('text entrance preserves the original node, shapes Unicode and clears accessible copies', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('text')
    const el = document.querySelector<HTMLElement>('#text')!
    el.textContent = 'Á 👨‍👩‍👧‍👦 مرحبا world'
    el.dir = 'rtl'
    const original = el.firstChild,
      width = el.getBoundingClientRect().width
    const animation = window.demo.scope.animateText(el, { duration: 80, stagger: 1 })
    animation.pause()
    animation.progress = 0.4
    const hidden = [...el.querySelectorAll('[data-jolt-effect]')].every(
      (n) => n.getAttribute('aria-hidden') === 'true',
    )
    const motion = el.getAnimations({ subtree: true }).length
    animation.progress = 1
    return {
      same: el.firstChild === original,
      hidden,
      motion,
      width,
      afterWidth: el.getBoundingClientRect().width,
      text: el.textContent,
      finished: await animation,
      layers: el.querySelectorAll('[data-jolt-effect]').length,
    }
  })
  expect(result.same && result.hidden && result.finished).toBe(true)
  expect(result.motion).toBeGreaterThan(1)
  expect(result.afterWidth).toBe(result.width)
  expect(result.layers).toBe(0)
  expect(result.text).toBe('Á 👨‍👩‍👧‍👦 مرحبا world')
})

test('text replacement and resize reveal current content without leaving observers or styles', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('text')
    const el = document.querySelector<HTMLElement>('#text')!
    const node = el.firstChild as Text
    const run = window.demo.runtime.animateText(el, { duration: 1200 })
    node.data = 'New application text'
    await window.demo.frame()
    return {
      completed: await run,
      same: node === el.firstChild,
      text: el.textContent,
      color: el.style.color,
      layers: el.querySelectorAll('[data-jolt-effect]').length,
      interactions: window.demo.inspect().interactions,
    }
  })
  expect(result).toEqual({
    completed: false,
    same: true,
    text: 'New application text',
    color: '',
    layers: 0,
    interactions: 0,
  })
})

test('rolling numbers format negative decimals and digit changes while retaining the framework Text node', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('roll')
    const el = document.querySelector<HTMLElement>('#text')!,
      node = el.firstChild
    const first = window.demo.scope.rollTo(el, -12.34, {
      format: (n) => `€${n.toFixed(2)}`,
      duration: 80,
    })
    await first
    const second = window.demo.scope.rollTo(el, 98765.43, {
      format: (n) => `€${n.toFixed(2)}`,
      duration: 80,
    })
    await second
    return {
      text: el.textContent,
      same: el.firstChild === node,
      children: el.childNodes.length,
      styles: el.getAttribute('style') ?? '',
    }
  })
  expect(result.text).toBe('€98765.43')
  expect(result.same).toBe(true)
  expect(result.children).toBe(1)
  expect(result.styles).not.toContain('transparent')
})

test('rolling interruption retains an actual presentation snapshot and settles the latest text', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('roll')
    const el = document.querySelector<HTMLElement>('#text')!
    const first = window.demo.runtime.rollTo(el, 99999, { duration: 1000 })
    first.pause()
    first.progress = 0.35
    const second = window.demo.runtime.rollTo(el, 12, { duration: 1000 })
    second.pause()
    const snapshots = el.querySelectorAll('[data-jolt-effect="text-snapshot"]').length
    second.progress = 1
    return {
      snapshots,
      first: await first,
      second: await second,
      text: el.textContent,
      interactions: window.demo.inspect().interactions,
    }
  })
  expect(result).toEqual({
    snapshots: 1,
    first: false,
    second: true,
    text: '12',
    interactions: 0,
  })
})

test('invalid text options preserve current text and reduced motion reaches the final state', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('roll')
    const el = document.querySelector<HTMLElement>('#text')!,
      before = el.textContent
    let invalid = false
    try {
      window.demo.runtime.rollTo(el, 22, { bounce: 8 })
    } catch {
      invalid = true
    }
    const preserved = el.textContent === before
    window.demo.runtime.configure({ reducedMotion: 'always' })
    const run = window.demo.scope.rollTo(el, 300)
    await run
    await window.demo.frame()
    return {
      invalid,
      preserved,
      text: el.textContent,
      animations: document.getAnimations().length,
      layers: el.querySelectorAll('[data-jolt-effect]').length,
    }
  })
  expect(result).toEqual({
    invalid: true,
    preserved: true,
    text: '300',
    animations: 0,
    layers: 0,
  })
})

test('all visual resources are released by runtime disposal including paused animations', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    window.demo.setup('text')
    const { runtime, scope } = window.demo
    const surface = document.querySelector<HTMLElement>('#surface')!,
      text = document.querySelector<HTMLElement>('#text')!
    scope.gradient(surface, { type: 'conic', colors: ['red', 'blue'] })
    scope.loader(surface)
    scope.shimmer(surface)
    const textRun = scope.animateText(text, { duration: 1000 })
    scope.suspend()
    runtime.dispose()
    await window.demo.frame()
    return {
      finished: await textRun,
      layers: document.querySelectorAll('[data-jolt-effect]').length,
      animations: document.getAnimations().length,
      text: text.textContent,
      background: surface.style.backgroundImage,
    }
  })
  expect(result.finished).toBe(false)
  expect(result.layers).toBe(0)
  expect(result.animations).toBe(0)
  expect(result.background).toBe('')
  expect(result.text).toBe('Make every detail count.')
})
