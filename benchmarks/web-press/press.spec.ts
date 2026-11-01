import { expect, test, type Page } from '@playwright/test'
import type { WebRuntime } from '../../src/web/runtime.js'
import type { WebPress } from '../../src/web/press.js'
import type {} from './fixture.js'

declare global {
  var specimen: {
    motion: WebRuntime
    button: HTMLButtonElement
    press: WebPress
    clicks: number
    submits: number
    pointerId: number
  }
}
const scale = (page: Page) =>
  page.evaluate(() => new DOMMatrix(getComputedStyle(specimen.button).transform).a)
const near = (page: Page, value: number) =>
  expect.poll(() => scale(page)).toBeCloseTo(value, 3)
const down = async (page: Page) => {
  const box = (await page.locator('#subject').boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
}
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const form = document.createElement('form')
    const button = document.createElement('button')
    button.id = 'subject'
    button.textContent = 'Subject'
    button.style.cssText =
      'position:fixed;left:300px;top:180px;width:240px;height:100px;z-index:100'
    form.append(button)
    document.body.append(form)
    const motion = pressLab.createWebRuntime(document)
    motion.set(button, { scale: 1.1 })
    const press = motion.press(button)
    specimen = { motion, button, press, clicks: 0, submits: 0, pointerId: -1 }
    button.addEventListener('click', () => specimen.clicks++)
    button.addEventListener('pointerdown', (e) => {
      specimen.pointerId = e.pointerId
    })
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      specimen.submits++
    })
  })
})

test('composes application retargeting while held and during release', async ({
  page,
}) => {
  await down(page)
  await near(page, 1.056)
  await page.evaluate(() => {
    specimen.motion.animate(specimen.button, { scale: 1.2 }, 'snappy')
  })
  await near(page, 1.152)
  await page.mouse.up()
  await page.evaluate(() => {
    specimen.motion.animate(specimen.button, { scale: 1.3 }, 'snappy')
  })
  await near(page, 1.3)
  expect(
    await page.evaluate(() => ({
      pressed: specimen.press.pressed,
      clicks: specimen.clicks,
      submits: specimen.submits,
    })),
  ).toEqual({ pressed: false, clicks: 1, submits: 1 })
})

test('release outside keeps native hit-testing and ignores secondary buttons', async ({
  page,
}) => {
  await down(page)
  await near(page, 1.056)
  await page.mouse.move(40, 40)
  await page.mouse.up()
  await near(page, 1.1)
  expect(await page.evaluate(() => specimen.clicks)).toBe(0)
  await page.locator('#subject').click({ button: 'right' })
  expect(await page.evaluate(() => specimen.press.pressed)).toBe(false)
  await near(page, 1.1)
})

test('Space, Enter, repeat, focus and form activation match an unbound native button', async ({
  page,
}) => {
  const exercise = async () => {
    await page.locator('#subject').focus()
    await page.keyboard.down('Space')
    await page.keyboard.down('Space')
    await page.keyboard.up('Space')
    await page.keyboard.down('Enter')
    await page.keyboard.down('Enter')
    await page.keyboard.up('Enter')
    return page.evaluate(() => ({
      clicks: specimen.clicks,
      submits: specimen.submits,
      focused: document.activeElement === specimen.button,
    }))
  }
  const enhanced = await exercise()
  await page.evaluate(() => {
    specimen.press.dispose()
    specimen.clicks = 0
    specimen.submits = 0
  })
  expect(await exercise()).toEqual(enhanced)
  expect(enhanced.clicks).toBeGreaterThanOrEqual(2)
  expect(enhanced.submits).toBe(enhanced.clicks)
  expect(enhanced.focused).toBe(true)
})

test('keyboard hold animates; losing focus cancels without extra activation', async ({
  page,
}) => {
  await page.locator('#subject').focus()
  await page.keyboard.down('Space')
  await near(page, 1.056)
  await page.locator('#reset').focus()
  await page.keyboard.up('Space')
  await near(page, 1.1)
  expect(await page.evaluate(() => specimen.clicks)).toBe(0)
})

for (const event of ['pointercancel', 'lostpointercapture', 'blur']) {
  test(`${event} releases only the feedback contribution`, async ({ page }) => {
    await down(page)
    await near(page, 1.056)
    await page.evaluate((name) => {
      if (name === 'blur') window.dispatchEvent(new Event('blur'))
      else
        specimen.button.dispatchEvent(
          new PointerEvent(name, { pointerId: specimen.pointerId, bubbles: true }),
        )
    }, event)
    await near(page, 1.1)
    expect(await page.evaluate(() => specimen.press.pressed)).toBe(false)
    await page.mouse.up()
  })
}

for (const cause of [
  'disabled state',
  'loading state',
  'disabled attribute',
  'fieldset',
  'aria-disabled',
  'aria-busy',
  'inert',
]) {
  test(`${cause} cancels a held press and blocks new feedback`, async ({ page }) => {
    await down(page)
    await near(page, 1.056)
    await page.evaluate((kind) => {
      const { button, press } = specimen
      if (kind === 'disabled state') press.update({ disabled: true })
      else if (kind === 'loading state') press.update({ loading: true })
      else if (kind === 'disabled attribute') button.disabled = true
      else if (kind === 'fieldset') {
        const fieldset = document.createElement('fieldset')
        button.parentElement!.append(fieldset)
        fieldset.append(button)
        fieldset.disabled = true
      } else button.setAttribute(kind, kind === 'inert' ? '' : 'true')
    }, cause)
    await near(page, 1.1)
    await page.mouse.up()
    await down(page)
    expect(await page.evaluate(() => specimen.press.pressed)).toBe(false)
    await page.mouse.up()
  })
}

test('state reenabling permits the next press and does not rearm a held input', async ({
  page,
}) => {
  await down(page)
  await page.evaluate(() => {
    specimen.press.update({ loading: true })
    specimen.press.update({ loading: false })
  })
  expect(await page.evaluate(() => specimen.press.pressed)).toBe(false)
  await page.mouse.up()
  await down(page)
  await near(page, 1.056)
  await page.mouse.up()
})

test('interruption inherits spring state and terminal results settle once', async ({
  page,
}) => {
  await down(page)
  await page.waitForTimeout(70)
  const result = await page.evaluate(async () => {
    const { motion, button, press } = specimen
    const first = press.animation!
    const before = motion
      .inspect(button)
      .tracks!.find((t) => t.layer && t.property === 'scaleX')!
    const counts = [0, 0]
    void first.finished.then(() => counts[0]!++)
    button.dispatchEvent(
      new PointerEvent('pointercancel', { pointerId: specimen.pointerId, bubbles: true }),
    )
    const second = press.animation!
    void second.finished.then(() => counts[1]!++)
    const after = motion
      .inspect(button)
      .tracks!.find((t) => t.layer && t.property === 'scaleX')!
    first.stop()
    first.progress = 0
    first.play()
    const results = await Promise.all([first.finished, second.finished])
    return { before, after, results, counts }
  })
  expect(result.after.from).toBeCloseTo(result.before.position, 2)
  expect(result.after.initialVelocity).toBeCloseTo(result.before.velocity, 1)
  expect(result.results).toEqual([false, true])
  expect(result.counts).toEqual([1, 1])
  await near(page, 1.1)
  await page.mouse.up()
})

test('rapid input and disposal cancel feedback while other motion completes', async ({
  page,
}) => {
  for (let i = 0; i < 4; i++) {
    await down(page)
    await page.mouse.up()
  }
  await down(page)
  const result = await page.evaluate(async () => {
    const { motion, button, press } = specimen
    const feedback = press.animation!
    const base = motion.animate(button, { scale: 1.2, x: 40 }, { duration: 180 })
    press.dispose()
    press.dispose()
    feedback.stop()
    feedback.progress = 0
    press.update({ disabled: false })
    const values = await Promise.all([feedback.finished, base.finished])
    return { values, pressed: press.pressed, inspection: motion.inspect(button) }
  })
  expect(result.values).toEqual([false, true])
  expect(result.pressed).toBe(false)
  expect(result.inspection.pose).toMatchObject({ scaleX: 1.2, scaleY: 1.2, x: 40 })
  await page.mouse.up()
  await down(page)
  await near(page, 1.2)
  await page.mouse.up()
})

test('settled feedback disposal preserves the application base', async ({ page }) => {
  await down(page)
  await near(page, 1.056)
  await page.evaluate(async () => {
    await specimen.press.animation!.finished
    specimen.press.dispose()
  })
  await near(page, 1.1)
  await page.mouse.up()
})

test('unmount, replacement, explicit release and context disposal detach input', async ({
  page,
}) => {
  await down(page)
  const result = await page.evaluate(async () => {
    const { motion, button, press } = specimen
    const animation = press.animation!
    button.remove()
    await Promise.resolve()
    press.dispose()
    document.body.append(button)
    button.dispatchEvent(
      new PointerEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 99 }),
    )
    const oldPressed = press.pressed
    const replacement = motion.press(button)
    motion.release(button)
    const third = motion.press(button)
    motion.dispose()
    motion.dispose()
    button.dispatchEvent(
      new PointerEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 100 }),
    )
    return {
      finished: await animation,
      oldPressed,
      replacement: replacement.pressed,
      third: third.pressed,
      inspection: motion.inspect(button),
    }
  })
  expect(result).toMatchObject({
    finished: false,
    oldPressed: false,
    replacement: false,
    third: false,
    inspection: { targets: 0, animations: 0, observers: 0, pendingFrame: false },
  })
  await page.mouse.up()
})

test('live reduced motion finishes held and released transforms without replay', async ({
  page,
}) => {
  await down(page)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await near(page, 1.056)
  expect(
    await page.evaluate(() => specimen.motion.inspect(specimen.button).animations),
  ).toBe(0)
  await page.mouse.up()
  await near(page, 1.1)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  expect(
    await page.evaluate(() => specimen.motion.inspect(specimen.button).animations),
  ).toBe(0)
  await down(page)
  expect(
    await page.evaluate(() => specimen.motion.inspect(specimen.button).animations),
  ).toBe(1)
  await page.mouse.up()
})

test('non-buttons get pointer feedback only and nested controls keep ownership', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const card = document.createElement('div')
    card.style.display = 'block'
    card.tabIndex = 0
    const child = document.createElement('button')
    card.append(child)
    document.body.append(card)
    const before = { role: card.getAttribute('role'), tabIndex: card.tabIndex }
    const press = specimen.motion.press(
      card,
      { opacity: 0.5 },
      { transition: { duration: 0 } },
    )
    child.dispatchEvent(
      new PointerEvent('pointerdown', {
        bubbles: true,
        isPrimary: true,
        button: 0,
        pointerId: 1,
      }),
    )
    const nested = press.pressed
    card.focus()
    card.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    const keyboard = press.pressed
    card.dispatchEvent(
      new PointerEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 2 }),
    )
    const own = press.pressed
    press.dispose()
    return {
      before,
      after: { role: card.getAttribute('role'), tabIndex: card.tabIndex },
      nested,
      keyboard,
      own,
      opacity: getComputedStyle(card).opacity,
    }
  })
  expect(result).toEqual({
    before: { role: null, tabIndex: 0 },
    after: { role: null, tabIndex: 0 },
    nested: false,
    keyboard: false,
    own: true,
    opacity: '1',
  })
})

test('invalid setup and duplicate binding preserve existing ownership', async ({
  page,
}) => {
  const result = await page.evaluate(() => {
    const { motion, button, press } = specimen
    let duplicate = false,
      reserved = false,
      invalid = false
    try {
      motion.press(button)
    } catch {
      duplicate = true
    }
    try {
      motion.animate(button, { scale: 0.1 }, { layer: 'jolt:press:1' })
    } catch {
      reserved = true
    }
    press.dispose()
    try {
      motion.press(button, { scale: NaN })
    } catch {
      invalid = true
    }
    const valid = motion.press(button)
    valid.dispose()
    return { duplicate, reserved, invalid, pose: motion.inspect(button).pose }
  })
  expect(result).toMatchObject({
    duplicate: true,
    reserved: true,
    invalid: true,
    pose: { scaleX: 1.1, scaleY: 1.1 },
  })
})

test('settled input has no pending effects or frame loop', async ({ page }) => {
  await down(page)
  await near(page, 1.056)
  await page.evaluate(() => specimen.press.animation!.finished)
  expect(
    await page.evaluate(() => specimen.motion.inspect(specimen.button)),
  ).toMatchObject({ animations: 0, effects: 0, pendingFrame: false })
  await page.mouse.up()
  await page.evaluate(() => specimen.press.animation!.finished)
  expect(
    await page.evaluate(() => specimen.motion.inspect(specimen.button)),
  ).toMatchObject({ animations: 0, effects: 0, pendingFrame: false })
})

test('synchronous unmount disposal and shadow-root cancellation leave no input listeners', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { motion, button, press } = specimen
    button.remove()
    press.dispose() // before MutationObserver delivery
    const host = document.createElement('div')
    document.body.append(host)
    const shadow = host.attachShadow({ mode: 'open' })
    const scroller = document.createElement('div')
    shadow.append(scroller)
    scroller.append(button)
    const prototype = EventTarget.prototype
    const original = prototype.addEventListener
    let installed = 0,
      aborted = 0
    prototype.addEventListener = function (type, listener, options) {
      if (options && typeof options === 'object' && options.signal) {
        installed++
        original.call(options.signal, 'abort', () => aborted++, { once: true })
      }
      return original.call(this, type, listener, options)
    }
    let next: WebPress
    try {
      next = motion.press(button, { scale: 0.96 }, { transition: { duration: 0 } })
    } finally {
      prototype.addEventListener = original
    }
    button.dispatchEvent(
      new PointerEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 1 }),
    )
    const held = next.pressed
    scroller.dispatchEvent(new Event('scroll'))
    const cancelled = next.pressed
    button.dispatchEvent(
      new PointerEvent('pointerdown', { isPrimary: true, button: 0, pointerId: 2 }),
    )
    host.setAttribute('aria-disabled', 'true')
    await Promise.resolve()
    const disabled = next.pressed
    motion.dispose()
    return {
      held,
      cancelled,
      disabled,
      installed,
      aborted,
      inspection: motion.inspect(button),
    }
  })
  expect(result.held).toBe(true)
  expect(result.cancelled).toBe(false)
  expect(result.disabled).toBe(false)
  expect(result.installed).toBeGreaterThan(10)
  expect(result.aborted).toBe(result.installed)
  expect(result.inspection).toMatchObject({ targets: 0, observers: 0, animations: 0 })
})

test('real touch scrolling cancels press and preserves browser scroll takeover', async ({
  page,
  browserName,
}) => {
  test.skip(
    browserName !== 'chromium',
    'CDP touch drag is Chromium-only; all engines cover pointercancel handling above.',
  )
  await page.evaluate(() => {
    specimen.motion.release(specimen.button)
    specimen.button.style.cssText =
      'display:block;width:240px;height:100px;margin:100px 30px'
    const scroll = document.createElement('div')
    scroll.id = 'scroller'
    scroll.style.cssText =
      'position:fixed;inset:100px 150px;height:400px;overflow:auto;background:white;z-index:1000'
    const content = document.createElement('div')
    content.style.height = '1600px'
    content.append(specimen.button)
    scroll.append(content)
    document.body.append(scroll)
    specimen.motion.set(specimen.button, { scale: 1.1 })
    specimen.press = specimen.motion.press(specimen.button)
  })
  const session = await page.context().newCDPSession(page)
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true })
  const box = (await page.locator('#subject').boundingBox())!
  const x = box.x + box.width / 2,
    y = box.y + box.height / 2
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  })
  await near(page, 1.056)
  for (const dy of [30, 70, 120]) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - dy }],
    })
    await page.waitForTimeout(35)
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await expect
    .poll(() => page.locator('#scroller').evaluate((el) => el.scrollTop))
    .toBeGreaterThan(0)
  expect(await page.evaluate(() => specimen.press.pressed)).toBe(false)
  await near(page, 1.1)
  expect(await page.evaluate(() => specimen.clicks)).toBe(0)
})
