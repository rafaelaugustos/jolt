import { test, expect } from '@playwright/test'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!(window as any).lab)
})
test('combined inputs update and cancel with borrowed-source cleanup', async ({
  page,
}) => {
  await page.click('#combine')
  await page.waitForTimeout(350)
  const state = await page.evaluate(() => {
    const l = (window as any).lab
    return {
      sum: l.sum.get(),
      position: l.position.get(),
      angle: l.angle.get(),
      matrix: getComputedStyle(document.getElementById('orb')!).transform,
    }
  })
  expect(state.sum).toBeGreaterThan(0)
  expect(state.position).toBeCloseTo(state.sum * 1.4, 0)
  expect(state.matrix).not.toBe('none')
  await page.click('#interrupt-values')
  await page.waitForTimeout(1500)
  expect(await page.evaluate(() => (window as any).lab.sum.get())).toBeCloseTo(0, 0)
  await page.evaluate(() => (window as any).lab.dispose())
  expect(
    await page.evaluate(
      () => document.getAnimations().filter((a) => a.playState === 'running').length,
    ),
  ).toBe(0)
})
test('scroll-derived transform follows real scrolling without duplicate controllers', async ({
  page,
}) => {
  await page.click('[data-scene="scroll"]')
  await page.locator('#scroll').hover()
  await page.mouse.wheel(0, 310)
  await page.waitForTimeout(400)
  const value = await page.evaluate(() => {
    const scroll = document.getElementById('scroll')!,
      meter = document.getElementById('meter')!
    return {
      offset: scroll.scrollTop,
      scale: new DOMMatrix(getComputedStyle(meter).transform).a,
    }
  })
  expect(value.offset).toBeGreaterThan(200)
  expect(value.scale).toBeCloseTo(Math.min(1, value.offset / 500), 1)
})
test('mixed mutation creates one inaccessible exit and restores intercepted methods', async ({
  page,
}) => {
  await page.click('[data-scene="layout"]')
  await page.click('#mutate')
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(1)
  expect(
    await page.locator('[data-jolt-layout-exit]').evaluate((node) => ({
      inert: (node as HTMLElement).inert,
      hidden: node.getAttribute('aria-hidden'),
      events: getComputedStyle(node).pointerEvents,
    })),
  ).toEqual({ inert: true, hidden: 'true', events: 'none' })
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(0)
  expect(
    await page.locator('#cards').evaluate((node) => Object.hasOwn(node, 'removeChild')),
  ).toBe(false)
  await page.click('#remove')
  await page.waitForTimeout(100)
  await page.click('#cancel')
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(0)
})
test('reinsert, preference change and runtime disposal remove leaving copies', async ({
  page,
}) => {
  await page.click('[data-scene="layout"]')
  await page.evaluate(() => {
    const host = document.getElementById('cards')!,
      child = host.children[1]!
    ;(window as any).lab.layoutChange(() => child.remove())
    setTimeout(() => host.append(child), 120)
  })
  await page.waitForTimeout(180)
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(0)
  await page.click('#remove')
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.click('#reset-layout')
  await page.click('#remove')
  await page.evaluate(() => (window as any).lab.dispose())
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(0)
})
test('200 keyed rows preserve the viewport anchor and focused identity through updates', async ({
  page,
}) => {
  await page.click('[data-scene="list"]')
  await page.locator('#list').evaluate((node) => (node.scrollTop = 1500))
  await page.waitForTimeout(80)
  const before = await page.evaluate(() => {
    const item = (window as any).lab.visible()[0]
    return {
      key: item.id,
      top: document.querySelector(`[data-key="${item.id}"].row`)!.getBoundingClientRect()
        .top,
    }
  })
  await page.click('#prepend')
  await page.waitForTimeout(850)
  expect(
    await page
      .locator(`#list [data-key="${before.key}"]`)
      .evaluate((node) => node.getBoundingClientRect().top),
  ).toBeCloseTo(before.top, 0)
  await page.locator(`#list [data-key="${before.key}"] button`).focus()
  await page.evaluate(() => document.getElementById('sort')!.click())
  await page.waitForTimeout(850)
  expect(
    await page.evaluate(() => document.activeElement?.getAttribute('aria-label')),
  ).toBe(`Focus row ${before.key}`)
  await page.click('#delete-row')
  await page.waitForTimeout(100)
  await page.click('#filter')
  await page.waitForTimeout(850)
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.click('#reset-list')
  await page.waitForTimeout(120)
  await expect(page.locator('#list .row')).toHaveCount(200)
})
test('Vue group uses the same exit and move operation', async ({ page }) => {
  await page.click('[data-scene="group"]')
  await page.click('#group-change')
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(1)
  await page.waitForTimeout(1000)
  await expect(page.locator('[data-jolt-layout-exit]')).toHaveCount(0)
  await expect(page.locator('#vue .card')).toHaveCount(3)
})
test('eligible mapped scroll uses ScrollTimeline and singular scale uses the scheduler', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const l = (window as any).lab
    l.scene('scroll')
    const meter = document.getElementById('meter')!,
      viewport = document.getElementById('scroll')!
    l.runtime.bind(meter, {
      x: l.scroll.to([0, 500], [0, 100]),
      scaleX: l.scroll.to([0, 500], [1, 1]),
    })
    viewport.scrollTop = 310
    await new Promise((resolve) => setTimeout(resolve, 200))
    const eligible = {
      x: new DOMMatrix(getComputedStyle(meter).transform).e,
      path: l.runtime.inspect(meter).execution,
    }
    l.runtime.bind(meter, { scaleX: l.scroll.to([0, 500], [0, 1]) })
    await new Promise((resolve) => setTimeout(resolve, 100))
    return {
      eligible,
      supported: typeof (window as any).ScrollTimeline === 'function',
      fallback: l.runtime.inspect(meter).execution,
      scale: new DOMMatrix(getComputedStyle(meter).transform).a,
    }
  })
  expect(result.eligible.x).toBeCloseTo(62, 0)
  expect(result.eligible.path).toBe(result.supported ? 'scroll-timeline' : 'scheduler')
  expect(result.fallback).toBe('scheduler')
  expect(result.scale).toBeCloseTo(0.62, 1)
})
test('virtualizer notifies before recycling an animated element and removes its observer on disposal', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const runtime = (window as any).lab.runtime,
      container = document.createElement('div')
    container.style.cssText =
      'position:fixed;top:100px;left:20px;width:200px;height:200px;overflow:auto'
    document.body.append(container)
    let items = [{ id: 1 }, { id: 2 }, { id: 3 }],
      keys = [1, 2, 3],
      notify: (target: HTMLElement) => void = () => {},
      released = 0
    const pool = keys.map((key) => {
      const target = document.createElement('div')
      target.textContent = String(key)
      target.style.cssText = 'height:50px;background:blue'
      container.append(target)
      return target
    })
    const adapter = {
      virtualized: true,
      items: () => items,
      anchor: () => () => {},
      observeRecycling(callback: (target: HTMLElement) => void) {
        notify = callback
        return () => {
          released++
        }
      },
      rows: () => keys.map((key, i) => ({ key, target: pool[i]! })),
      render(next: typeof items) {
        items = [...next]
        keys = items.map((item) => item.id)
        keys.forEach((key, i) => {
          const target = pool.find((node) => node.textContent === String(key))!
          container.append(target)
        })
        pool.sort(
          (a, b) =>
            keys.indexOf(Number(a.textContent)) - keys.indexOf(Number(b.textContent)),
        )
      },
    }
    const controller = runtime.listChanges(container, {
      key: (item: { id: number }) => item.id,
      adapter,
      move: { duration: 700 },
    })
    const animation = controller.update([...items].reverse())
    await new Promise((resolve) => setTimeout(resolve, 120))
    const target = pool[0]!,
      before = runtime.inspect(target).tracks.length
    notify(target)
    keys[0] = 99
    target.textContent = '99'
    await new Promise((resolve) => setTimeout(resolve, 40))
    const after = runtime.inspect(target).tracks.length
    const done = await animation.finished
    controller.dispose()
    container.remove()
    return { before, after, done, released }
  })
  expect(result.before).toBeGreaterThan(0)
  expect(result.after).toBe(0)
  expect(result.done).toBe(false)
  expect(result.released).toBe(1)
})

test('a protected removal method keeps normal layout and restores the remaining local hooks', async ({
  page,
}) => {
  await page.click('[data-scene="layout"]')
  const result = await page.evaluate(async () => {
    const host = document.getElementById('cards')!
    Object.defineProperty(host, 'removeChild', {
      value: host.removeChild,
      writable: true,
      configurable: false,
    })
    const done = await (window as any).lab.layoutChange(() =>
      host.removeChild(host.children[1]!),
    )
    return {
      done,
      count: host.children.length,
      replacePatched: Object.hasOwn(host, 'replaceChildren'),
      copies: document.querySelectorAll('[data-jolt-layout-exit]').length,
    }
  })
  expect(result).toEqual({ done: true, count: 3, replacePatched: false, copies: 0 })
})
