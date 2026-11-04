import { expect, test, type Page } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/?test')
  await page.emulateMedia({ reducedMotion: 'no-preference' })
})
async function overlay(
  page: Page,
  transform = 'scale(0.8) translate(30px, 25px)',
  modal = true,
) {
  return page.evaluate(
    ({ transform, modal }) => {
      const l = lifecycleLab
      l.region.style.transform = transform
      const dialog = document.createElement('dialog')
      dialog.setAttribute('aria-label', 'Choose a city')
      dialog.style.cssText =
        'width:400px;height:300px;padding:24px;border:0;background:#26364e;color:white;'
      const sheet = document.createElement('div')
      sheet.id = 'sheet'
      sheet.tabIndex = 0
      sheet.style.cssText =
        'width:300px;height:180px;background:#86c5b8;color:#17243a;display:grid;place-items:center;border-radius:14px;'
      sheet.textContent = 'Drag this panel'
      const choice = document.createElement('button')
      choice.id = 'choice'
      choice.textContent = 'Choose Porto'
      choice.onclick = () => {
        dialog.dataset.selection = 'Porto'
        dialog.close()
      }
      dialog.append(sheet, choice)
      l.region.append(dialog)
      if (modal) dialog.showModal()
      else dialog.show()
      l.dialog = dialog
      l.sheet = sheet
      try {
        l.drag = l.rt.drag(sheet, {
          axis: 'y',
          snap: { y: [0] },
          bounds: { top: 0, bottom: 120 },
        })
        return ''
      } catch (error) {
        return String(error)
      }
    },
    { transform, modal },
  )
}
async function drag(page: Page, distance = 90) {
  const box = (await page.locator('#sheet').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 45)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2, box.y + 45 + distance, { steps: 8 })
}

for (const transform of [
  'matrix(1, 0, 0, 1, 0, 0)',
  'translate(80px, 40px)',
  'scale(0.65) rotate(12deg)',
]) {
  test(`modal drag ignores outside ${transform} and preserves selection/dismissal`, async ({
    page,
  }) => {
    expect(await overlay(page, transform)).toBe('')
    await drag(page)
    await expect
      .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.sheet!).y))
      .toBeCloseTo(90, 0)
    await page.mouse.up()
    await expect
      .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.sheet!).y))
      .toBeCloseTo(0, 1)
    await page.click('#choice')
    expect(await page.evaluate(() => lifecycleLab.dialog!.dataset.selection)).toBe(
      'Porto',
    )
    expect(await page.evaluate(() => lifecycleLab.dialog!.open)).toBe(false)
    await page.evaluate(() => {
      const l = lifecycleLab
      l.dialog!.showModal()
      l.drag = l.rt.drag(l.sheet!, { axis: 'y', snap: { y: [0] } })
    })
    await drag(page, 45)
    await page.mouse.up()
    await page.keyboard.press('Escape')
    await expect(page.locator('dialog')).not.toBeVisible()
    await page.evaluate(() => {
      lifecycleLab.drag!.dispose()
      lifecycleLab.rt.release(lifecycleLab.sheet!)
      lifecycleLab.dialog!.remove()
    })
    expect(
      await page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.target)),
    ).toMatchObject({ values: 0, animations: 0 })
  })
}

test('moving parent, reduced motion and explicit inert outside a modal do not block drag/press', async ({
  page,
}) => {
  expect(await overlay(page)).toBe('')
  await page.evaluate(() => {
    const l = lifecycleLab
    l.region.style.transform = ''
    l.rt.animate(l.region, { x: [0, 100, 0], rotate: [0, 15, 0] }, { duration: 2000 })
    l.region.inert = true
    l.rt.press(l.sheet!)
  })
  await drag(page, 60)
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.sheet!).y))
    .toBeCloseTo(60, 0)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.mouse.up()
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.sheet!).y))
    .toBe(0)
  await page.locator('#choice').focus()
  await page.keyboard.press('Enter')
  expect(await page.evaluate(() => lifecycleLab.dialog!.dataset.selection)).toBe('Porto')
})

test('nonmodal transforms still reject atomically, while identity ancestors are accepted', async ({
  page,
}) => {
  expect(await overlay(page, 'scale(0.8)', false)).toContain('rendered coordinate root')
  expect(await page.evaluate(() => lifecycleLab.sheet!.style.touchAction)).toBe('')
  expect(
    await page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.sheet!)),
  ).toMatchObject({ targets: 0, values: 0 })
  await page.evaluate(() => {
    lifecycleLab.dialog!.remove()
  })
  expect(await overlay(page, 'matrix(1, 0, 0, 1, 0, 0)', false)).toBe('')
})

test('transforms within a modal still affect geometry and are not silently ignored', async ({
  page,
}) => {
  expect(await overlay(page)).toBe('')
  expect(
    await page.evaluate(() => {
      const l = lifecycleLab
      l.drag!.dispose()
      l.rt.release(l.sheet!)
      l.dialog!.style.transform = 'scale(0.8)'
      try {
        l.rt.drag(l.sheet!)
        return ''
      } catch (error) {
        return String(error)
      }
    }),
  ).toContain('rendered coordinate root')
  expect(await page.evaluate(() => lifecycleLab.sheet!.style.touchAction)).toBe('')
  await page.locator('#choice').click()
  expect(await page.evaluate(() => lifecycleLab.dialog!.open)).toBe(false)
})

test('popover establishes the same geometry boundary, including through Shadow DOM', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const l = lifecycleLab
    l.region.style.transform = 'scale(0.6)'
    const shadow = l.region.attachShadow({ mode: 'open' })
    const popover = document.createElement('div')
    popover.setAttribute('popover', 'manual')
    const sheet = document.createElement('div')
    sheet.id = 'sheet'
    sheet.style.cssText = 'width:180px;height:100px;background:#86c5b8'
    popover.append(sheet)
    shadow.append(popover)
    popover.showPopover()
    l.sheet = sheet
    l.drag = l.rt.drag(sheet, { axis: 'y' })
    return sheet.getBoundingClientRect().width
  })
  expect(result).toBe(180)
  await drag(page, 50)
  await expect
    .poll(() => page.evaluate(() => lifecycleLab.read(lifecycleLab.sheet!).y))
    .toBeCloseTo(50, 0)
  await page.mouse.up()
})

async function shared(page: Page, duration = 500) {
  await page.evaluate((duration) => {
    const l = lifecycleLab
    l.region.style.height = '360px'
    l.region.style.width = '600px'
    l.target.style.position = 'absolute'
    l.target.style.left = '20px'
    l.target.style.top = '20px'
    l.target.textContent = 'Card'
    const detail = document.createElement('div')
    detail.id = 'detail'
    detail.textContent = 'Details · shared identity'
    detail.style.cssText =
      'position:absolute;left:270px;top:100px;width:280px;height:180px;border-radius:20px;background:#86c5b8;color:#17243a;padding:20px;'
    l.detail = detail
    l.shared = l.rt.sharedLayout(l.region, {
      transition: { duration, ease: 'linear' },
      layoutTimeout: 80,
    })
    l.shared.attach(l.target, 'card')
  }, duration)
}
async function expand(page: Page) {
  await page.evaluate(() => {
    const l = lifecycleLab
    l.flight = l.shared!.transition(() => {
      l.target.remove()
      l.region.append(l.detail!)
      l.shared!.attach(l.detail!, 'card')
    })
  })
}

test('shared card to detail uses inert copies, then restores the live destination', async ({
  page,
}) => {
  await shared(page, 700)
  await expand(page)
  await expect
    .poll(() =>
      page.evaluate(() => document.querySelectorAll('[data-jolt-shared-copy]').length),
    )
    .toBe(2)
  expect(
    await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('[data-jolt-shared-copy]')].every(
        (node) =>
          node.inert &&
          node.getAttribute('aria-hidden') === 'true' &&
          !node.querySelector('[id]'),
      ),
    ),
  ).toBe(true)
  expect(await page.evaluate(() => lifecycleLab.read(lifecycleLab.detail!).opacity)).toBe(
    0,
  )
  expect(await page.evaluate(() => lifecycleLab.flight!.finished)).toEqual({
    status: 'completed',
  })
  expect(await page.evaluate(() => lifecycleLab.read(lifecycleLab.detail!).opacity)).toBe(
    1,
  )
  await expect(page.locator('[data-jolt-shared-stage]')).toHaveCount(0)
})

for (const advanceBeforeCapture of [0, 40]) {
  test(`shared reversal captures current copies after ${advanceBeforeCapture}ms advancement and keeps old cleanup obsolete`, async ({
    page,
  }) => {
    await shared(page, 1000)
    await expand(page)
    await expect(page.locator('[data-jolt-shared-copy]')).toHaveCount(2)
    await page.waitForTimeout(150)
    const { captured, after, earlier, reads, advanced } = await page.evaluate(
      (advance) => {
        const source = document.querySelector<HTMLElement>('[data-jolt-shared-copy]')!
        const geometry = (rect: DOMRect) => ({ x: rect.x, y: rect.y, width: rect.width })
        const earlier = geometry(source.getBoundingClientRect())
        let advanced = 0
        // Reproduce the stale-sample case with the browser's real WAAPI timeline.
        // Both copies keep running; only their playback position advances.
        if (advance) {
          for (const animation of document.getAnimations()) {
            const target = (animation.effect as KeyframeEffect | null)?.target
            if (
              target instanceof HTMLElement &&
              target.hasAttribute('data-jolt-shared-copy') &&
              typeof animation.currentTime === 'number'
            ) {
              animation.currentTime += advance
              advanced++
            }
          }
        }
        // Observe the actual browser rectangle consumed by snapshot(), without
        // replacing its value. A separate pre-transition read can be older on
        // WebKit even inside rAF. Missing this read must also fail the test.
        const measure = source.getBoundingClientRect
        const descriptor = Object.getOwnPropertyDescriptor(
          source,
          'getBoundingClientRect',
        )
        let captured: ReturnType<typeof geometry> | undefined
        let reads = 0
        source.getBoundingClientRect = () => {
          const rect = measure.call(source)
          captured = geometry(rect)
          reads++
          return rect
        }
        const l = lifecycleLab
        l.previousFlight = l.flight
        try {
          l.flight = l.shared!.transition(() => {
            l.detail!.remove()
            l.region.append(l.target)
            l.shared!.attach(l.target, 'card')
          })
        } finally {
          if (descriptor)
            Object.defineProperty(source, 'getBoundingClientRect', descriptor)
          else Reflect.deleteProperty(source, 'getBoundingClientRect')
        }
        if (!captured)
          throw new Error('Reversal did not measure the presented source copy')
        const after = geometry(
          document.querySelector('[data-jolt-shared-copy]')!.getBoundingClientRect(),
        )
        return { captured, after, earlier, reads, advanced }
      },
      advanceBeforeCapture,
    )
    expect(reads).toBe(1)
    if (advanceBeforeCapture) {
      expect(advanced).toBeGreaterThan(0)
      expect(captured.x - earlier.x).toBeGreaterThan(5)
    }
    expect(after.x).toBeCloseTo(captured.x, 0)
    expect(after.y).toBeCloseTo(captured.y, 0)
    expect(after.width).toBeCloseTo(captured.width, 0)
    expect(await page.evaluate(() => lifecycleLab.previousFlight!.finished)).toEqual({
      status: 'cancelled',
      reason: 'interrupted',
    })
    expect(await page.evaluate(() => lifecycleLab.flight!.finished)).toEqual({
      status: 'completed',
    })
    expect(await page.evaluate(() => lifecycleLab.read().opacity)).toBe(1)
    await expect(page.locator('[data-jolt-shared-stage]')).toHaveCount(0)
  })
}

test('shared cancellation and reduced motion preserve application mutation and styles', async ({
  page,
}) => {
  await shared(page, 3000)
  await expand(page)
  await expect(page.locator('[data-jolt-shared-copy]')).toHaveCount(2)
  await page.evaluate(() => {
    lifecycleLab.rt.set(lifecycleLab.detail!, { opacity: 0.6 })
    lifecycleLab.flight!.cancel()
  })
  expect(await page.evaluate(() => lifecycleLab.flight!.finished)).toEqual({
    status: 'cancelled',
    reason: 'cancelled',
  })
  expect(
    await page.evaluate(() => lifecycleLab.read(lifecycleLab.detail!).opacity),
  ).toBeCloseTo(0.6)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  expect(
    await page.evaluate(async () => {
      const l = lifecycleLab
      return l.shared!.transition(() => {
        l.detail!.remove()
        l.region.append(l.target)
        l.shared!.attach(l.target, 'card')
      }).finished
    }),
  ).toEqual({ status: 'cancelled', reason: 'reduced-motion' })
  await expect(page.locator('#target')).toHaveCount(1)
  await expect(page.locator('[data-jolt-shared-stage]')).toHaveCount(0)
})

test('missing destination, unsupported snapshots and thrown mutation release every copy', async ({
  page,
}) => {
  await shared(page)
  expect(
    await page.evaluate(async () => {
      const l = lifecycleLab
      return l.shared!.transition(() => l.target.remove()).finished
    }),
  ).toEqual({ status: 'unavailable', reason: 'missing-target' })
  await expect(page.locator('[data-jolt-shared-stage]')).toHaveCount(0)
  expect(
    await page.evaluate(async () => {
      const l = lifecycleLab
      l.region.append(l.target)
      l.target.append(document.createElement('canvas'))
      return l.shared!.transition(() => {
        l.target.dataset.changed = 'true'
      }).finished
    }),
  ).toEqual({ status: 'unavailable', reason: 'unsupported-target' })
  expect(await page.evaluate(() => lifecycleLab.target.dataset.changed)).toBe('true')
  expect(
    await page.evaluate(() => {
      const l = lifecycleLab
      l.target.textContent = 'Card'
      try {
        l.shared!.transition(() => {
          throw new Error('application failed')
        })
        return ''
      } catch (error) {
        return String(error)
      }
    }),
  ).toContain('application failed')
  await expect(page.locator('[data-jolt-shared-stage]')).toHaveCount(0)
  expect(await page.evaluate(() => lifecycleLab.read().opacity)).toBe(1)
})

test('shared lifecycle handles target removal, resize, source moves and controller disposal', async ({
  page,
}) => {
  await shared(page, 3000)
  await expand(page)
  await expect(page.locator('[data-jolt-shared-copy]')).toHaveCount(2)
  await page.evaluate(() => lifecycleLab.detail!.remove())
  expect(await page.evaluate(() => lifecycleLab.flight!.finished)).toEqual({
    status: 'cancelled',
    reason: 'unloaded',
  })
  await page.evaluate(() => {
    const l = lifecycleLab
    l.region.append(l.detail!)
    l.flight = l.shared!.transition(() => {
      l.detail!.style.left = '80px'
    })
  })
  await expect(page.locator('[data-jolt-shared-copy]')).toHaveCount(2)
  await page.evaluate(() => {
    lifecycleLab.detail!.style.width = '320px'
  })
  expect(await page.evaluate(() => lifecycleLab.flight!.finished)).toEqual({
    status: 'cancelled',
    reason: 'geometry-changed',
  })
  await page.evaluate(() => lifecycleLab.shared!.dispose())
  expect(
    await page.evaluate(() => lifecycleLab.rt.inspect(lifecycleLab.target).sharedLayouts),
  ).toBe(0)
})

test('shared geometry invalidates host style changes without ResizeObserver delivery', async ({
  page,
}) => {
  await shared(page, 3000)
  await page.evaluate(() => {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  })
  await expand(page)
  await expect(page.locator('[data-jolt-shared-copy]')).toHaveCount(2)
  await page.evaluate(() => {
    lifecycleLab.detail!.style.width = '320px'
  })
  expect(await page.evaluate(() => lifecycleLab.flight!.finished)).toEqual({
    status: 'cancelled',
    reason: 'geometry-changed',
  })
  await page.evaluate(() => {
    lifecycleLab.flight = lifecycleLab.shared!.transition(() => {})
  })
  await expect(page.locator('[data-jolt-shared-copy]')).toHaveCount(2)
  await page.evaluate(() => {
    lifecycleLab.detail!.style.left = '180px'
  })
  expect(await page.evaluate(() => lifecycleLab.flight!.finished)).toEqual({
    status: 'cancelled',
    reason: 'geometry-changed',
  })
})

test('shared image copies keep the actual image source and do not steal focus', async ({
  page,
}) => {
  await shared(page, 1500)
  await page.evaluate(async () => {
    const l = lifecycleLab
    const image = document.createElement('img')
    image.src =
      'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="40" height="40"%3E%3Crect width="40" height="40" fill="orange"/%3E%3C/svg%3E'
    image.style.cssText = 'width:40px;height:40px'
    l.target.append(image)
    await image.decode()
    l.sibling.focus()
  })
  await expand(page)
  await expect(page.locator('[data-jolt-shared-copy] img')).toHaveCount(1)
  expect(await page.locator('[data-jolt-shared-copy] img').getAttribute('src')).toContain(
    'data:image',
  )
  expect(await page.evaluate(() => document.activeElement === lifecycleLab.sibling)).toBe(
    true,
  )
  expect(await page.evaluate(() => lifecycleLab.flight!.finished)).toEqual({
    status: 'completed',
  })
})

test('diagnostics report actual channel owners, takeover/stop reasons and bounded history', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const l = lifecycleLab
    l.diagnostic = l.rt.diagnostics({ development: true, maxEvents: 40 })
    const old = l.rt.animate(l.target, { x: 100, y: 100 }, { duration: 2000 })
    const before = l.diagnostic
      .snapshot()
      .targets[0]!.channels.filter((c) => c.kind === 'animation')
    l.rt.animate(l.target, { x: 50 }, { duration: 2000 })
    const after = l.diagnostic
      .snapshot()
      .targets[0]!.channels.filter((c) => c.kind === 'animation')
    old.stop()
    const events = l.diagnostic.snapshot().events
    for (let i = 0; i < 50; i++) l.rt.set(l.target, { opacity: i % 2 })
    return { before, after, events, bounded: l.diagnostic.snapshot().events.length }
  })
  expect(result.before.find((c) => c.property === 'x')!.owner).not.toBe(
    result.after.find((c) => c.property === 'x')!.owner,
  )
  expect(result.before.find((c) => c.property === 'y')!.owner).toBe(
    result.after.find((c) => c.property === 'y')!.owner,
  )
  expect(
    result.events.some((e) => e.reason === 'interrupted' && e.property === 'x'),
  ).toBe(true)
  expect(result.events.some((e) => e.reason === 'stopped' && e.property === 'y')).toBe(
    true,
  )
  expect(result.bounded).toBeLessThanOrEqual(40)
})

test('diagnostics are opt-in, pull-only, isolated and retain a final resource snapshot', async ({
  page,
}) => {
  expect(
    await page.evaluate(() => {
      const l = lifecycleLab
      let rejected = false
      try {
        l.rt.diagnostics({ development: false } as never)
      } catch {
        rejected = true
      }
      l.rt.animate(l.target, { x: 10 }, { duration: 0 })
      const before = l.rt.inspect(l.target).scheduler.frames
      l.diagnostic = l.rt.diagnostics({ development: true })
      const initial = l.diagnostic.snapshot()
      const second = l.createWebRuntime(document),
        other = second.diagnostics({ development: true })
      const scope = l.rt.scope()
      scope.motionValue(10)
      scope.pointerFollow(l.region)
      scope.dispose()
      l.rt.dispose()
      const final = l.diagnostic.snapshot()
      const isolated = other.snapshot().events.length
      second.dispose()
      return { rejected, initial: initial.events.length, frames: before, final, isolated }
    }),
  ).toMatchObject({
    rejected: true,
    initial: 0,
    isolated: 0,
    final: {
      disposed: true,
      resources: {
        surfaces: 0,
        scopes: 0,
        values: 0,
        frameTasks: 0,
        framePending: false,
      },
    },
  })
})

test('runtime disposal during viewport/shared playback does not throw or leave effects', async ({
  page,
}) => {
  await shared(page, 3000)
  await expand(page)
  await expect(page.locator('[data-jolt-shared-copy]')).toHaveCount(2)
  await page.evaluate(() => {
    const l = lifecycleLab
    l.rt.viewportEnter(l.sibling, { transition: { duration: 3000 } })
  })
  await page.waitForTimeout(60)
  await page.evaluate(() => lifecycleLab.rt.dispose())
  await expect(page.locator('[data-jolt-shared-stage]')).toHaveCount(0)
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0)
})
