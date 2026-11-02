import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/?test')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
})
const frames = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  )
const move = async (page: Page, x = 0.85, y = 0.7) => {
  const box = (await page.locator('#region').boundingBox())!
  await page.mouse.move(box.x + box.width * x, box.y + box.height * y)
  await frames(page)
}
const scroll = async (page: Page, top: number) => {
  await page.evaluate((top) => {
    lifecycleLab.scroller.scrollTop = top
  }, top)
  await frames(page)
}
const pointer = (page: Page, spring = false) =>
  page.evaluate((spring) => {
    const l = lifecycleLab
    l.scope = l.rt.scope()
    l.pointer = l.scope.pointerFollow(l.region, {
      range: { x: [-80, 80], y: [-40, 40] },
      spring: spring ? { stiffness: 200, damping: 24 } : false,
    })
    l.scope.bind(l.target, { x: l.pointer.x, y: l.pointer.y })
  }, spring)

test('disposing one scope preserves borrowed values, a sibling binding and host press', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.value = l.rt.motionValue(15)
    l.scope = l.rt.scope()
    l.other = l.rt.scope()
    l.scope.borrow(l.value)
    l.scope.bind(l.target, { x: l.value })
    l.other.bind(l.sibling, { x: l.value })
    l.rt.set(l.target, { scale: 1.1 })
    l.rt.press(l.target, { scale: 0.96 })
    l.scope.dispose()
    l.value.set(60)
  })
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.sibling).x))
    .toBeCloseTo(60)
  expect(await page.evaluate(() => lifecycleLab.read().x)).toBeCloseTo(15)
  expect(await page.evaluate(() => lifecycleLab.value!.disposed)).toBe(false)
  await page.locator('#target').hover()
  await page.mouse.down()
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read().scale))
    .toBeCloseTo(1.056, 3)
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read().scale))
    .toBeCloseTo(1.1, 3)
})

test('stale scope cleanup cannot overwrite a newer binding or animation', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.scope = l.rt.scope()
    l.other = l.rt.scope()
    const old = l.scope.motionValue(20),
      current = l.other.motionValue(90)
    l.scope.bind(l.target, { x: old })
    l.scope.animate(l.target, { y: 100 }, { duration: 5000 })
    l.other.bind(l.target, { x: current })
    l.animation = l.other.animate(l.target, { y: 30 }, { duration: 150 })
    l.scope.dispose()
  })
  expect(await page.evaluate(() => lifecycleLab.animation!.finished)).toBe(true)
  expect(await page.evaluate(() => lifecycleLab.read())).toMatchObject({ x: 90, y: 30 })
})

test('scope setup rolls back acquired resources and runtime disposal reaches nested scopes', async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const l = lifecycleLab
      try {
        l.rt.scope((scope) => {
          scope.motionValue(1)
          scope.pointerFollow(l.region)
          throw new Error('rollback')
        })
      } catch {}
      const after = l.rt.inspect(l.target)
      l.scope = l.rt.scope()
      l.other = l.scope.scope()
      l.other.motionValue(10)
      l.rt.dispose()
      return {
        values: after.values,
        scopes: after.scopes,
        pointers: after.pointerFollowers,
        parent: l.scope.disposed,
        child: l.other.disposed,
      }
    }),
  ).toEqual({ values: 0, scopes: 0, pointers: 0, parent: true, child: true })
})

test('scope suspension preserves manual pause and rebuilds use resources once', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const l = lifecycleLab
    l.scope = l.rt.scope()
    const input = l.scope.motionValue(0),
      follower = l.scope.springValue(input)
    let setups = 0
    l.scope.use((s) => {
      setups++
      s.bind(l.target, { x: follower })
    })
    follower.pause()
    l.scope.suspend()
    input.set(50)
    l.scope.resume()
    return {
      setups,
      paused: follower.paused,
      input: input.get(),
      scopes: l.rt.inspect(l.target).scopes,
    }
  })
  expect(result).toEqual({ setups: 2, paused: true, input: 50, scopes: 2 })
})

test('owned finite handles stop selected channels without stopping another owner', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.animation = l.rt.animate(
      l.target,
      { x: 100, y: 80 },
      { duration: 700, ease: 'linear' },
    )
    l.rt.animate(l.target, { scale: 1.2 }, { duration: 400 })
  })
  await page.waitForTimeout(150)
  await page.evaluate(() => lifecycleLab.animation!.stop(['x']))
  const held = await page.evaluate(() => lifecycleLab.read().x)
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().y)).toBeCloseTo(80)
  expect(await page.evaluate(() => lifecycleLab.read().x)).toBeCloseTo(held)
  expect(await page.evaluate(() => lifecycleLab.read().scale)).toBeCloseTo(1.2)
  expect(await page.evaluate(() => lifecycleLab.animation!.finished)).toBe(false)
})

test('pointer input uses the separate region, bounded normalized values and returns to rest', async ({
  page,
}) => {
  await pointer(page)
  await move(page)
  expect(await page.evaluate(() => lifecycleLab.read().x)).toBeCloseTo(56, 0)
  expect(await page.evaluate(() => lifecycleLab.read().y)).toBeCloseTo(16, 0)
  await move(page)
  expect(await page.evaluate(() => lifecycleLab.read().x)).toBeCloseTo(56, 0)
  await page.mouse.move(5, 5)
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBe(0)
  expect(await page.evaluate(() => lifecycleLab.pointer!.active)).toBe(false)
})

test('pointer pixels, axis and nonzero rest have explicit semantics', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.pointer = l.rt.pointerFollow(l.region, {
      coordinates: 'pixels',
      axis: 'x',
      range: { x: [-35, 35] },
      rest: { x: 5, y: 12 },
      spring: false,
    })
    l.rt.bind(l.target, { x: l.pointer.x, y: l.pointer.y })
  })
  await move(page)
  expect(await page.evaluate(() => lifecycleLab.read())).toMatchObject({ x: 35, y: 12 })
  await page.mouse.move(2, 2)
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBe(5)
})

test('pointer spring settles, stays idle and live reduced motion stops following', async ({
  page,
}) => {
  await pointer(page, true)
  await move(page)
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBeCloseTo(56, 0)
  await expect
    .poll(() =>
      page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.target).scheduler.pending),
    )
    .toBe(false)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBe(0)
  await move(page, 0.2, 0.2)
  expect(await page.evaluate(() => lifecycleLab.read().x)).toBe(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await frames(page)
  expect(await page.evaluate(() => lifecycleLab.read().x)).toBe(0)
  await move(page)
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBeCloseTo(56, 0)
})

test('pointer keeps press and finite pulse independent, without capturing activation', async ({
  page,
}) => {
  await pointer(page)
  await page.evaluate(() => {
    const l = lifecycleLab
    l.rt.set(l.target, { scale: 1.1 })
    l.rt.press(l.target)
    l.target.onclick = () => {
      l.target.dataset.clicked = 'yes'
      l.rt.animate(l.target, 'pulse')
    }
  })
  // Center keeps the surface under the real pointer while pressing.
  await move(page, 0.5, 0.5)
  await page.locator('#target').hover()
  await page.mouse.down()
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read().scale))
    .toBeCloseTo(1.056, 3)
  await page.mouse.up()
  await expect(page.locator('#target')).toHaveAttribute('data-clicked', 'yes')
  await move(page, 0.8, 0.6)
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBeCloseTo(48, 0)
  expect(await page.evaluate(() => lifecycleLab.region.style.touchAction)).toBe('')
})

test('pointer ignores touch/contact pen and cancels disabled, blur and suspended input', async ({
  page,
}) => {
  await pointer(page)
  await move(page)
  await page.evaluate(() =>
    lifecycleLab.region.dispatchEvent(
      new PointerEvent('pointermove', {
        pointerType: 'touch',
        clientX: 200,
        clientY: 200,
      }),
    ),
  )
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBe(0)
  await move(page, 0.8)
  await page.evaluate(() => lifecycleLab.region.setAttribute('inert', ''))
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBe(0)
  await page.evaluate(() => {
    lifecycleLab.region.removeAttribute('inert')
    lifecycleLab.pointer!.suspend()
  })
  await move(page, 0.2)
  expect(await page.evaluate(() => lifecycleLab.read().x)).toBe(0)
  await page.evaluate(() => lifecycleLab.pointer!.resume())
  await move(page)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().x)).toBe(0)
})

test('pointer refreshes resized regions and rejects rotated input spaces atomically', async ({
  page,
}) => {
  await pointer(page)
  await move(page)
  await page.evaluate(() => {
    lifecycleLab.region.style.width = '500px'
    lifecycleLab.pointer!.refresh()
  })
  await frames(page)
  await move(page)
  expect(await page.evaluate(() => lifecycleLab.read().x)).toBeCloseTo(56, 0)
  expect(
    await page.evaluate(() => {
      const l = lifecycleLab
      l.scope!.dispose()
      l.region.style.rotate = '12deg'
      try {
        l.rt.pointerFollow(l.region)
        return ''
      } catch (error) {
        return String(error)
      }
    }),
  ).toContain('axis-aligned')
  expect(
    await page.evaluate(
      () => lifecycleLab.rt.inspect(lifecycleLab.target).pointerFollowers,
    ),
  ).toBe(0)
})

test('pointer removal and repeated teardown release values, listeners and frame demand', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    for (let i = 0; i < 30; i++) {
      const scope = l.rt.scope()
      const p = scope.pointerFollow(l.region)
      scope.bind(l.target, { x: p.x })
      scope.dispose()
    }
    l.pointer = l.rt.pointerFollow(l.region)
    l.region.remove()
  })
  await expect
    .poll(() =>
      page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.target).pointerFollowers),
    )
    .toBe(0)
  await expect
    .poll(() =>
      page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.target).scheduler.tasks),
    )
    .toBe(0)
  expect(
    await page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.target)),
  ).toMatchObject({ values: 0, scopes: 0, preferenceListeners: 0, targets: 0 })
})

test('viewport starts on actual visibility, respects stable stagger and disconnects once completed', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.entrance = l.rt.viewportEnter(l.cards, {
      root: l.scroller,
      threshold: 0.2,
      keyframes: { y: [40, 0], opacity: [0, 1] },
      transition: { duration: 300, ease: 'linear', stagger: 200 },
    })
  })
  await frames(page)
  expect(await page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(0)
  expect(
    await page.evaluate(() =>
      lifecycleLab.cards.every((card) => getComputedStyle(card).opacity === '1'),
    ),
  ).toBe(true)
  await scroll(page, 350)
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.entrance!.pending))
    .toBeGreaterThan(0)
  expect(
    await page.evaluate(() => {
      const l = lifecycleLab
      return l.read(l.cards[0]!).y < l.read(l.cards[1]!).y
    }),
  ).toBe(true)
  await expect.poll(() => page.evaluate(() => lifecycleLab.entrance!.completed)).toBe(3)
  await scroll(page, 0)
  await scroll(page, 350)
  expect(await page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(0)
})

test('viewport repeat supports reentry and cancellation leaves readable content', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.entrance = l.rt.viewportEnter(l.cards, {
      root: l.scroller,
      once: false,
      keyframes: { y: [50, 0], opacity: [0, 1] },
      transition: { duration: 1000 },
    })
  })
  await scroll(page, 350)
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.entrance!.pending))
    .toBeGreaterThan(0)
  await scroll(page, 0)
  await expect.poll(() => page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(0)
  expect(
    await page.evaluate(() => lifecycleLab.read(lifecycleLab.cards[0]!).opacity),
  ).toBe(1)
  await scroll(page, 350)
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.entrance!.pending))
    .toBeGreaterThan(0)
})

test('viewport disposal never completes over a newer owner and removes queued entrances', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.entrance = l.rt.viewportEnter(l.cards, {
      root: l.scroller,
      keyframes: { y: [40, 0], opacity: [0, 1] },
      transition: { duration: 2000, stagger: 200 },
    })
  })
  await scroll(page, 350)
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.entrance!.pending))
    .toBeGreaterThan(0)
  await page.evaluate(() => {
    const l = lifecycleLab
    l.rt.set(l.cards[0]!, { y: 70 })
    l.entrance!.dispose()
  })
  expect(await page.evaluate(() => lifecycleLab.read(lifecycleLab.cards[0]!).y)).toBe(70)
  await scroll(page, 0)
  await scroll(page, 350)
  expect(await page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(0)
  expect(
    await page.evaluate(
      () => lifecycleLab.rt.inspect(lifecycleLab.target).viewportEntrances,
    ),
  ).toBe(0)
})

test('viewport handles initially visible targets, reduced motion, removal and no observer support', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.evaluate(() => {
    const l = lifecycleLab
    l.entrance = l.rt.viewportEnter(l.target)
    l.rt.viewportEnter(l.cards, { root: l.scroller })
    l.cards[2]!.remove()
  })
  await frames(page)
  expect(await page.evaluate(() => lifecycleLab.read().opacity)).toBe(1)
  expect(await page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(0)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await expect.poll(() => page.evaluate(() => lifecycleLab.entrance!.completed)).toBe(1)
  expect(
    await page.evaluate(() => {
      const l = lifecycleLab,
        original = window.IntersectionObserver
      Object.defineProperty(window, 'IntersectionObserver', {
        value: undefined,
        configurable: true,
        writable: true,
      })
      const controller = l.rt.viewportEnter(l.sibling)
      window.IntersectionObserver = original
      const result = { pending: controller.pending, visible: l.read(l.sibling).opacity }
      controller.dispose()
      return result
    }),
  ).toEqual({ pending: 0, visible: 1 })
})

test('viewport live reduced motion finishes only its remaining channels', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.entrance = l.rt.viewportEnter(l.target, {
      keyframes: { y: [60, 0], opacity: [0, 1] },
      transition: { duration: 3000 },
    })
  })
  await expect.poll(() => page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(1)
  await page.evaluate(() => lifecycleLab.rt.set(lifecycleLab.target, { y: 90 }))
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect.poll(() => page.evaluate(() => lifecycleLab.read().opacity)).toBe(1)
  expect(await page.evaluate(() => lifecycleLab.read().y)).toBe(90)
  expect(await page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(0)
})

test('viewport rejects invalid recipes and observer configuration without resource leaks', async ({
  page,
}) => {
  const errors = await page.evaluate(() => {
    const l = lifecycleLab,
      errors: string[] = []
    for (const options of [
      { threshold: 2 },
      { rootMargin: 'wrong' },
      { transition: { repeat: Infinity } },
      { keyframes: 'missing-preset' },
    ])
      try {
        l.rt.viewportEnter(l.cards, options)
      } catch (error) {
        errors.push(String(error))
      }
    return { count: errors.length, info: l.rt.inspect(l.target) }
  })
  expect(errors.count).toBe(4)
  expect(errors.info).toMatchObject({
    viewportEntrances: 0,
    preferenceListeners: 0,
    animations: 0,
  })
})

test('removing a viewport target during entry cancels without seeking a detached surface', async ({
  page,
}) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(String(error)))
  await page.evaluate(() => {
    const l = lifecycleLab
    l.entrance = l.rt.viewportEnter(l.target, { transition: { duration: 3000 } })
  })
  await expect.poll(() => page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(1)
  await page.evaluate(() => lifecycleLab.target.remove())
  await expect.poll(() => page.evaluate(() => lifecycleLab.entrance!.pending)).toBe(0)
  expect(errors).toEqual([])
})

test('Vue mounts continuous resources without per-frame component renders', async ({
  page,
}) => {
  await page.evaluate(() => {
    lifecycleLab.vue = lifecycleLab.mountVue()
  })
  const renders = await page.evaluate(() => lifecycleLab.vue!.renders())
  await page.click('#vue-retarget')
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.vue!.target()).x))
    .toBeCloseTo(130, 1)
  expect(await page.evaluate(() => lifecycleLab.vue!.renders())).toBe(renders)
  await page.locator('#vue-card').click()
  expect(await page.evaluate(() => lifecycleLab.vue!.pulse.value)).toBe(1)
  expect(await page.evaluate(() => lifecycleLab.vue!.errors)).toEqual([])
})

test('Vue ref replacement cleans old resources and initializes exactly one replacement', async ({
  page,
}) => {
  await page.evaluate(() => {
    lifecycleLab.vue = lifecycleLab.mountVue()
  })
  await page.click('#vue-retarget')
  await page.click('#vue-replace')
  await expect
    .poll(() =>
      page.evaluate(() => lifecycleLab.vue!.events.filter((e) => e === 'setup').length),
    )
    .toBe(2)
  expect(
    await page.evaluate(
      () => lifecycleLab.vue!.events.filter((e) => e === 'cleanup').length,
    ),
  ).toBe(1)
  await page.click('#vue-retarget')
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.vue!.target()).x))
    .toBeCloseTo(130, 1)
  expect(await page.evaluate(() => lifecycleLab.vue!.errors)).toEqual([])
})

test('Vue KeepAlive tears down continuous resources and rebinds once on activation', async ({
  page,
}) => {
  await page.evaluate(() => {
    lifecycleLab.vue = lifecycleLab.mountVue()
  })
  await page.click('#vue-retarget')
  await page.click('#vue-toggle')
  expect(await page.evaluate(() => lifecycleLab.vue!.input().disposed)).toBe(true)
  await expect(page.locator('#vue-card')).toHaveCount(0)
  await page.click('#vue-toggle')
  await expect(page.locator('#vue-card')).toHaveCount(1)
  expect(
    await page.evaluate(
      () => lifecycleLab.vue!.events.filter((e) => e === 'setup').length,
    ),
  ).toBe(2)
  await page.click('#vue-retarget')
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.vue!.target()).x))
    .toBeCloseTo(130, 1)
  expect(await page.evaluate(() => lifecycleLab.vue!.errors)).toEqual([])
})

test('Vue borrowing a host runtime preserves host press and sibling resources', async ({
  page,
}) => {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.value = l.rt.motionValue(0)
    l.rt.bind(l.sibling, { x: l.value })
    l.vue = l.mountVue(true)
    l.rt.set(l.vue.target(), { scale: 1.1 })
  })
  await page.locator('#vue-card').hover()
  await page.mouse.down()
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.vue!.target()).scale))
    .toBeCloseTo(1.056, 3)
  await page.mouse.up()
  await page.evaluate(() => {
    lifecycleLab.vue!.unmount()
    lifecycleLab.value!.set(70)
  })
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.sibling).x))
    .toBe(70)
  expect(await page.evaluate(() => lifecycleLab.value!.disposed)).toBe(false)
  expect(
    await page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.sibling).scopes),
  ).toBe(0)
})

test('Vue partial setup errors release resources and repeated navigation returns to baseline', async ({
  page,
}) => {
  expect(
    await page.evaluate(async () => {
      const l = lifecycleLab
      for (let i = 0; i < 12; i++) {
        const vue = l.mountVue(true, i === 0)
        await vue.nextTick()
        if (i === 0 && !vue.errors.some((e) => e.includes('intentional')))
          throw new Error('Missing setup error')
        vue.unmount()
        await vue.nextTick()
      }
      return l.rt.inspect(l.target)
    }),
  ).toMatchObject({ scopes: 0, values: 0, geometryObservers: 0, animations: 0 })
})
