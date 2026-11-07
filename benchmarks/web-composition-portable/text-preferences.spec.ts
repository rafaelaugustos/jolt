import { expect, test } from '@playwright/test'
import type {} from './fixture.js'
test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => !!window.composition)
})

test('text remains selectable and accessible; sheen is seekable, stoppable and keeps the fill', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { text, textTarget } = window.composition
    const original = textTarget.textContent
    const fill = getComputedStyle(textTarget).backgroundImage
    const play = text.play({ duration: 2000, ease: 'linear' })
    play.pause()
    play.progress = 0.45
    const middle = getComputedStyle(textTarget).backgroundImage
    const range = document.createRange()
    range.selectNodeContents(textTarget)
    const selection = getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    const selected = selection.toString()
    text.stop()
    const stopped = await play.finished
    const restored = getComputedStyle(textTarget).backgroundImage
    textTarget.style.color = 'rgb(255, 0, 0)'
    text.dispose()
    return {
      original,
      fill,
      middle,
      selected,
      stopped,
      restored,
      color: textTarget.style.color,
      text: textTarget.textContent,
      background: textTarget.style.backgroundImage,
    }
  })
  expect(result.selected).toBe(result.original)
  expect(result.text).toBe(result.original)
  expect(result.middle).not.toBe(result.fill)
  expect(result.restored).toBe(result.fill)
  expect(result.stopped).toBe(false)
  expect(result.color).toBe('rgb(255, 0, 0)')
  expect(result.background).toBe('')
})

test('text repeats indefinitely until cancelled and preserves a manual pause across scope suspension', async ({
  page,
}) => {
  const result = await page.evaluate(async () => {
    const { runtime, text } = window.composition,
      scope = runtime.scope()
    scope.retain(text)
    const playback = text.play({ duration: 150, repeat: Infinity, ease: 'linear' })
    playback.pause()
    scope.suspend()
    scope.resume()
    const paused = playback.paused,
      duration = playback.duration
    scope.dispose()
    return {
      paused,
      infinite: duration === Infinity,
      completed: await playback.finished,
      disposed: text.disposed,
    }
  })
  expect(result).toEqual({
    paused: true,
    infinite: true,
    completed: false,
    disposed: true,
  })
})

test('forced colors keeps readable original text and cancels decorative sheen', async ({
  page,
  browserName,
}) => {
  test.skip(browserName === 'webkit', 'WebKit does not emulate OS forced-colors mode.')
  await page.getByRole('button', { name: 'Shine', exact: true }).click()
  await page.emulateMedia({ forcedColors: 'active' })
  await expect
    .poll(() => page.evaluate(() => window.composition.text.snapshot().backend))
    .toBe('plain-text')
  await expect
    .poll(() =>
      page.evaluate(() => ({
        image: window.composition.textTarget.style.backgroundImage,
        color: window.composition.textTarget.style.color,
        playing: window.composition.text.snapshot().playing,
      })),
    )
    .toEqual({ image: '', color: '', playing: false })
  await page.emulateMedia({ forcedColors: 'none' })
  await expect
    .poll(() => page.evaluate(() => window.composition.text.snapshot().backend))
    .toBe('css-text-clip')
})

test('effective preferences isolate runtime overrides and observe system changes without duplicate events', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.evaluate(() => {
    const { runtime, helpers } = window.composition
    runtime.configure({ reducedMotion: 'user' })
    const other = helpers.createWebRuntime(document, { reducedMotion: 'always' }),
      events: boolean[] = [],
      others: boolean[] = []
    const off = runtime.onReducedMotion((v) => events.push(v)),
      offOther = other.onReducedMotion((v) => others.push(v))
    Object.assign(window, { prefs: { other, events, others, off, offOther } })
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await expect(page.locator('#preference-status')).toHaveText(
    'Effective reduced motion: on',
  )
  const result = await page.evaluate(() => {
    const state = (
      window as unknown as {
        prefs: {
          other: typeof window.composition.runtime
          events: boolean[]
          others: boolean[]
          off(): void
          offOther(): void
        }
      }
    ).prefs
    window.composition.runtime.configure({ reducedMotion: 'never' })
    window.composition.runtime.configure({ reducedMotion: 'never' })
    state.off()
    window.composition.runtime.configure({ reducedMotion: 'always' })
    const result = {
      events: state.events,
      others: state.others,
      other: state.other.reducedMotion(),
    }
    state.offOther()
    state.other.dispose()
    window.composition.preferenceApp.unmount()
    return result
  })
  expect(result).toEqual({ events: [true, false], others: [], other: true })
})

test('portable helpers feed the existing playback compiler', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const { runtime, card, helpers } = window.composition
    const spring = helpers.origamiSpring({ tension: 40, friction: 7 })
    const first = runtime.animate(card, { x: 50 }, spring)
    first.pause()
    first.progress = 1
    first.play()
    await first.finished
    const second = runtime.animate(
      card,
      helpers.presets.fadeIn.keyframes,
      helpers.presets.fadeIn.transition,
    )
    second.pause()
    second.progress = 1
    second.play()
    return {
      spring,
      ease: helpers.cubicBezier(0.25, 0.1, 0.25, 1)(0.5),
      preset: await second.finished,
      names: Object.keys(helpers.springs),
    }
  })
  expect(result.spring).toMatchObject({
    type: 'spring',
    stiffness: 230.2,
    damping: 22,
    mass: 1,
  })
  expect(result.ease).toBeGreaterThan(0.5)
  expect(result.preset).toBe(true)
  expect(result.names).toEqual(['smooth', 'snappy', 'bouncy'])
})
