import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, configure, motionScope, stop, timeline } from '../src/index.js'
import { createClock } from '../src/playback.js'
import { createView, driver, flush } from './helpers.js'

vi.mock('@nativescript/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAndroid: true,
  isIOS: false,
}))

let sdk: number
const requests: { at: number; effect: number; accepted: boolean }[] = []

function target() {
  const view = createView()
  const state = {
    attached: true,
    visible: true,
    shown: true,
    focused: true,
    enabled: true,
    hardware: true,
  }
  const native = {
    getWindowToken: () => (state.attached ? {} : null),
    getWindowVisibility: () => (state.visible ? 0 : 8),
    isShown: () => state.shown,
    hasWindowFocus: () => state.focused,
    performHapticFeedback: vi.fn((effect: number) => {
      const accepted = state.enabled && state.hardware
      requests.push({ at: driver.now(), effect, accepted })
      return accepted
    }),
  }
  view.nativeViewProtected = native
  return { view, native, state }
}

beforeEach(() => {
  sdk = 36
  requests.length = 0
  vi.stubGlobal('android', {
    os: {
      Build: {
        VERSION: {
          get SDK_INT() {
            return sdk
          },
        },
      },
    },
    view: {
      HapticFeedbackConstants: {
        LONG_PRESS: 0,
        KEYBOARD_TAP: 3,
        get CLOCK_TICK() {
          if (sdk < 21) throw new Error('Unavailable CLOCK_TICK')
          return 4
        },
        get CONTEXT_CLICK() {
          if (sdk < 23) throw new Error('Unavailable CONTEXT_CLICK')
          return 6
        },
      },
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('Android haptics', () => {
  it.each([
    [36, 'light', 4],
    [36, 'medium', 6],
    [36, 'heavy', 0],
    [21, 'light', 4],
    [21, 'medium', 3],
    [19, 'light', 3],
    [19, 'heavy', 0],
  ] as const)(
    'maps API %s %s to platform feedback %s without ignore-setting flags',
    (api, style, effect) => {
      sdk = api
      const { view, native } = target()
      animate(view, { x: 100 }, { duration: 200, haptic: style })
      driver.advance(200)
      expect(requests).toEqual([{ at: 1200, effect, accepted: true }])
      expect(native.performHapticFeedback).toHaveBeenCalledExactlyOnceWith(effect)
    },
  )

  it.each(['enabled', 'hardware'] as const)(
    'does not retry or force feedback when %s is false',
    (setting) => {
      const { view, native, state } = target()
      state[setting] = false
      animate(view, { x: 100 }, { duration: 200, haptic: 'light' })
      driver.advance(200)
      expect(requests).toEqual([{ at: 1200, effect: 4, accepted: false }])
      expect(native.performHapticFeedback).toHaveBeenCalledTimes(1)
    },
  )

  it('fires at the latest spring arrival, before its settling tail', () => {
    const { view } = target()
    animate(view, { x: 100, scale: 1.2 }, { type: 'spring', haptic: 'heavy' })
    const arrival = Math.max(...driver.played.map(({ track }) => track.arrival))
    expect(arrival).toBeLessThan(Math.max(...driver.played.map(({ track }) => track.end)))
    driver.advance(arrival - 1)
    expect(requests).toHaveLength(0)
    driver.advance(1)
    expect(requests).toEqual([{ at: 1000 + arrival, effect: 0, accepted: true }])
  })

  it('keeps stagger and explicit repeated/delayed property points on the playback clock', () => {
    animate(
      [target().view, target().view],
      { x: 100 },
      { duration: 200, stagger: 80, haptic: 'light' },
    )
    driver.advance(200)
    driver.advance(80)
    expect(requests.map(({ at }) => at)).toEqual([1200, 1280])
    requests.length = 0
    animate(
      target().view,
      { x: 100, y: 100 },
      {
        duration: 200,
        delay: 100,
        repeat: 1,
        y: { duration: 300, delay: 200 },
        haptic: { style: 'medium', times: [0.5, 1] },
      },
    )
    driver.advance(450)
    driver.advance(350)
    expect(requests.map(({ at }) => at)).toEqual([1730, 2080])
  })

  it.each([0.5, 2])('schedules against animation time with system scale %s', (scale) => {
    const after = driver.after.bind(driver)
    driver.after = (ms, callback) => after(ms * scale, callback)
    Object.assign(driver, { clock: () => createClock(() => driver.now() / scale) })
    const animation = animate(
      target().view,
      { x: 100 },
      {
        duration: 1000,
        ease: 'linear',
        haptic: { style: 'light', times: [0.3] },
      },
    )
    driver.advance(300 * scale - 1)
    expect(requests).toHaveLength(0)
    driver.advance(1)
    expect(requests[0]?.at).toBe(1000 + 300 * scale)
    expect(animation.progress).toBeCloseTo(0.3)
    animation.stop()
  })

  it('includes Jolt slow motion in feedback timing', () => {
    configure({ timeScale: 0.5 })
    animate(target().view, { x: 100 }, { duration: 400, haptic: 'light' })
    driver.advance(799)
    expect(requests).toHaveLength(0)
    driver.advance(1)
    expect(requests[0]?.at).toBe(1800)
  })

  it('keeps subsequent points aligned when native animators wait for their first frame', () => {
    const after = driver.after.bind(driver)
    driver.after = (ms, callback) => after(ms + 120, callback)
    Object.assign(driver, {
      clock: () => createClock(() => Math.max(0, driver.now() - 1120)),
    })
    animate(
      target().view,
      { x: 100 },
      { duration: 1000, haptic: { style: 'light', times: [0.2, 0.6] } },
    )
    driver.advance(320)
    expect(requests).toHaveLength(1)
    driver.advance(400)
    expect(requests).toHaveLength(2)
  })

  it('handles fractional points without a synchronous zero-duration native marker', () => {
    const after = driver.after.bind(driver)
    driver.after = (ms, callback) => {
      if (Math.floor(ms) === 0) throw new Error('Synchronous native marker')
      return after(Math.floor(ms), callback)
    }
    animate(
      target().view,
      { x: 100 },
      { duration: 1000, haptic: { style: 'light', times: [0.0005] } },
    )
    driver.advance(1)
    expect(requests).toHaveLength(1)
  })

  it('does not request feedback for disabled animators even when reduced motion is overridden', () => {
    driver.reduced = true
    configure({ reducedMotion: 'never' })
    animate(target().view, { opacity: 0.5 }, { duration: 1000, haptic: 'heavy' })
    driver.advance(1000)
    expect(requests).toHaveLength(0)
  })

  it('drops pending feedback when animator scale becomes zero', () => {
    const animation = animate(
      target().view,
      { opacity: 0.5 },
      { duration: 1000, haptic: 'heavy' },
    )
    driver.reduced = true
    animation.pause()
    animation.play()
    driver.advance(1000)
    expect(requests).toHaveLength(0)
  })

  it('does not rearm native markers when disabled animators reset their clock', () => {
    Object.assign(driver, { clock: () => createClock(() => 0) })
    const after = vi.spyOn(driver, 'after')
    animate(
      target().view,
      { x: 100 },
      { duration: 1000, haptic: { style: 'light', times: [0.3, 0.8] } },
    )
    const scheduled = after.mock.calls.length
    driver.reduced = true
    driver.advance(300)
    expect(after).toHaveBeenCalledTimes(scheduled)
    expect(requests).toHaveLength(0)
  })

  it('does not leave pending feedback when native playback ends synchronously', async () => {
    const play = driver.play.bind(driver)
    driver.play = (view, track, startedAt, onEnd) => {
      const handle = play(view, track, startedAt, onEnd)
      onEnd()
      return handle
    }
    const animation = animate(
      target().view,
      { x: 100 },
      { duration: 400, haptic: 'light' },
    )
    expect(await animation).toBe(true)
    driver.advance(1000)
    expect(requests).toHaveLength(0)
  })

  it('keeps reduced transforms silent while opt-in feedback on a remaining fade can play', () => {
    configure({ reducedMotion: 'always' })
    animate(target().view, { x: 100 }, { duration: 200, haptic: 'heavy' })
    animate(target().view, { opacity: 0.5 }, { duration: 200, haptic: 'light' })
    driver.advance(200)
    expect(requests.map(({ effect }) => effect)).toEqual([4])
  })

  it.each(['attached', 'visible', 'shown', 'focused'] as const)(
    'suppresses requests when the target is not %s',
    (setting) => {
      const { view, state } = target()
      animate(view, { x: 100 }, { duration: 200, haptic: 'medium' })
      state[setting] = false
      driver.advance(200)
      expect(requests).toHaveLength(0)
    },
  )

  it('does not revive feedback after native-view replacement or unload/reload', () => {
    const one = target(),
      two = target()
    animate(one.view, { x: 100 }, { duration: 200, haptic: 'medium' })
    animate(two.view, { x: 100 }, { duration: 200, haptic: 'medium' })
    one.view.nativeViewProtected = target().native
    two.view.notify({ eventName: 'unloaded', object: two.view })
    two.view.notify({ eventName: 'loaded', object: two.view })
    driver.advance(200)
    expect(requests).toHaveLength(0)
  })

  it('pauses, seeks without replaying consumed points, and resumes once', async () => {
    const animation = animate(
      target().view,
      { x: 100 },
      {
        duration: 1000,
        haptic: { style: 'light', times: [0.3, 0.8] },
      },
    )
    driver.advance(200)
    animation.pause()
    driver.advance(500)
    expect(requests).toHaveLength(0)
    animation.progress = 0.5
    animation.play()
    driver.advance(300)
    expect(requests).toHaveLength(1)
    animation.pause()
    animation.progress = 0.1
    animation.play()
    driver.advance(900)
    expect(requests).toHaveLength(1)
    expect(await animation).toBe(true)
  })

  it('pauses timeline feedback and pending steps together', async () => {
    const scene = timeline([
      {
        at: 0,
        run: () => animate(target().view, { x: 100 }, { duration: 400, haptic: 'light' }),
      },
      {
        at: 500,
        run: () => animate(target().view, { x: 100 }, { duration: 200, haptic: 'heavy' }),
      },
    ])
    driver.advance(200)
    scene.pause()
    driver.advance(600)
    expect(requests).toHaveLength(0)
    scene.play()
    driver.advance(200)
    await flush()
    driver.advance(100)
    await flush()
    driver.advance(200)
    await flush()
    expect(requests.map(({ effect }) => effect)).toEqual([4, 0])
    expect(await scene).toBe(true)
  })

  it('cancels scoped/overridden feedback without touching unrelated owners', () => {
    const scope = motionScope(),
      { view } = target()
    scope.add(animate(view, { x: 100 }, { duration: 200, haptic: 'light' }))
    animate(view, { opacity: 0.5 }, { duration: 200, haptic: 'medium' })
    scope.dispose()
    driver.advance(200)
    expect(requests.map(({ effect }) => effect)).toEqual([6])
    requests.length = 0
    animate(view, { x: 200, scale: 2 }, { duration: 200, haptic: 'heavy' })
    stop(view, ['scale'])
    driver.advance(200)
    expect(requests).toHaveLength(0)
  })

  it('drops late events and does not duplicate an event at native completion', () => {
    animate(
      target().view,
      { x: 100 },
      { duration: 500, haptic: { style: 'light', times: [0.2, 0.5] } },
    )
    driver.advance(700)
    expect(requests).toHaveLength(0)
    animate(target().view, { x: 100 }, { duration: 200, haptic: 'light' })
    driver.time += 200
    driver.last('x').onEnd()
    driver.advance(0)
    expect(requests).toHaveLength(1)
  })

  it('uses native completion for the final point without replaying stale earlier points', () => {
    animate(
      target().view,
      { x: 100 },
      { duration: 1000, haptic: { style: 'light', times: [0.3, 0.8, 1] } },
    )
    // Native playback reaches its final frame before the sampled clock catches up.
    driver.time += 960
    driver.last('x').onEnd()
    expect(requests).toHaveLength(1)
    driver.advance(40)
    expect(requests).toHaveLength(1)
  })

  it('skips empty, immediate, stationary, infinite and explicitly disabled feedback', () => {
    animate(target().view, {}, { haptic: 'light' })
    animate(target().view, { x: 100 }, { duration: 0, haptic: 'light' })
    animate(target().view, { x: 0 }, { duration: 200, haptic: 'light' })
    animate(
      target().view,
      { x: 100 },
      { duration: 200, repeat: Infinity, haptic: 'light' },
    ).stop()
    animate(target().view, { x: 100 }, { duration: 200, haptic: false })
    driver.advance(200)
    expect(requests).toHaveLength(0)
  })
})
