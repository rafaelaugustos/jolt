import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, definePreset, sequence, stop, type Haptic } from '../src/index.js'
import { createView, driver, flush } from './helpers.js'

const platform = vi.hoisted(() => ({ isIOS: true }))
vi.mock('@nativescript/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  get isIOS() {
    return platform.isIOS
  },
}))

const impacts: { at: number; style: number }[] = []
const preparations: number[] = []
let allocations = 0
let app: { applicationState: number }

function target() {
  const view = createView()
  view.nativeViewProtected = { window: {} }
  return view
}

beforeEach(() => {
  platform.isIOS = true
  impacts.length = preparations.length = allocations = 0
  app = { applicationState: 0 }
  vi.stubGlobal('UIApplication', { sharedApplication: app })
  vi.stubGlobal('UIApplicationState', { Active: 0 })
  vi.stubGlobal('UIImpactFeedbackStyle', { Light: 0, Medium: 1, Heavy: 2 })
  vi.stubGlobal('UIImpactFeedbackGenerator', {
    alloc() {
      allocations++
      return {
        initWithStyle(style: number) {
          return {
            prepare: () => preparations.push(driver.now()),
            impactOccurred: () => impacts.push({ at: driver.now(), style }),
          }
        },
      }
    },
  })
})

afterEach(() => vi.unstubAllGlobals())

describe('haptics', () => {
  it('fires once when a spring arrives, before its settling tail finishes', async () => {
    const view = target()
    const animation = animate(
      view,
      { x: 100, scale: 1.2 },
      { type: 'spring', haptic: 'light' },
    )
    const arrival = Math.max(...driver.played.map(({ track }) => track.arrival))
    const end = Math.max(...driver.played.map(({ track }) => track.end))
    expect(arrival).toBeLessThan(end)
    expect(allocations).toBe(1)
    expect(preparations).toEqual([1000])
    driver.advance(arrival - 1)
    expect(impacts).toHaveLength(0)
    driver.advance(1)
    expect(impacts).toEqual([{ at: 1000 + arrival, style: 0 }])
    // The animation still owns its settling tail and unload cleanup.
    expect(view.listenerCount('unloaded')).toBe(1)
    driver.advance(end)
    expect(await animation).toBe(true)
    expect(impacts).toHaveLength(1)
  })

  it('follows property timing overrides and prepares again near a delayed impact', () => {
    animate(
      target(),
      { x: 100, opacity: 0.5 },
      {
        duration: 200,
        delay: 1000,
        opacity: { duration: 500 },
        haptic: 'heavy',
      },
    )
    driver.advance(1399)
    expect(preparations).toEqual([1000])
    driver.advance(1)
    expect(preparations).toEqual([1000, 2400])
    driver.advance(99)
    expect(impacts).toHaveLength(0)
    driver.advance(1)
    expect(impacts).toEqual([{ at: 2500, style: 2 }])
  })

  it('fires at both bounce landings and scales the points with duration and delay', () => {
    animate(target(), 'bounce', {
      // Timing overrides keep the preset curve and keyframe offsets.
      delay: 200,
      haptic: { style: 'medium', times: [0.6, 1] },
    })
    driver.advance(589)
    expect(impacts).toHaveLength(0)
    driver.advance(1)
    expect(impacts).toEqual([{ at: 1590, style: 1 }])
    driver.advance(260)
    expect(impacts.map(({ at }) => at)).toEqual([1590, 1850])

    animate(
      target(),
      { y: [0, -20, 0] },
      {
        duration: 1000,
        haptic: { style: 'light', times: [0.5, 1] },
      },
    )
    driver.advance(500)
    driver.advance(500)
    expect(impacts.slice(2).map(({ at }) => at)).toEqual([2350, 2850])
  })

  it('includes stagger separately for each view', () => {
    animate(
      [target(), target()],
      { x: 100 },
      { duration: 200, stagger: 80, haptic: 'light' },
    )
    driver.advance(200)
    expect(impacts).toHaveLength(1)
    driver.advance(80)
    expect(impacts.map(({ at }) => at)).toEqual([1200, 1280])
  })

  it('maps explicit points over the full span of delayed, repeated properties', () => {
    animate(
      target(),
      { x: 100, y: 100 },
      {
        duration: 200,
        delay: 100,
        repeat: 1,
        y: { duration: 300, delay: 200 },
        haptic: { style: 'light', times: [0.5, 1] },
      },
    )
    // x: 100..500, y: 200..800. The full span is 100..800.
    driver.advance(449)
    expect(impacts).toHaveLength(0)
    driver.advance(1)
    driver.advance(350)
    expect(impacts.map(({ at }) => at)).toEqual([1450, 1800])
  })

  it('waits for loading before preparing or starting the feedback clock', () => {
    const view = target().unload()
    animate(view, { x: 100 }, { duration: 200, haptic: 'light' })
    driver.advance(500)
    expect(allocations).toBe(0)
    view.isLoaded = true
    view.nativeViewProtected = { window: {} }
    view.notify({ eventName: 'loaded', object: view })
    expect(preparations).toEqual([1500])
    driver.advance(200)
    expect(impacts).toEqual([{ at: 1700, style: 0 }])
  })

  it('does not prepare when cancelled before loading', () => {
    const view = target().unload()
    animate(view, { x: 100 }, { haptic: 'light' }).stop()
    view.load()
    driver.advance(1000)
    expect(allocations).toBe(0)
  })

  it('cancels pending taps when stopped through the handle or stop(view)', () => {
    const first = target()
    const second = target()
    const animation = animate(first, 'bounce', {
      haptic: { style: 'light', times: [0.6, 1] },
    })
    animate(second, { x: 100 }, { duration: 900, haptic: 'heavy' })
    driver.advance(390)
    expect(impacts).toHaveLength(1)
    animation.stop()
    stop(second)
    const preparedBeforeStop = preparations.length
    driver.advance(1000)
    expect(impacts).toHaveLength(1)
    expect(preparations).toHaveLength(preparedBeforeStop)
    expect(first.listenerCount('unloaded')).toBe(0)
    expect(second.listenerCount('unloaded')).toBe(0)
  })

  it('cancels the old feedback on partial interruption without stopping other properties', () => {
    const view = target()
    animate(view, { x: 100, opacity: 0.2 }, { duration: 500, haptic: 'heavy' })
    driver.advance(100)
    animate(view, { x: 0 }, { duration: 400, haptic: 'light' })
    expect(driver.last('opacity').stopped).toBe(false)
    driver.advance(400)
    expect(impacts).toEqual([{ at: 1500, style: 0 }])
  })

  it('cancels on selective stop but keeps feedback on unrelated animations', () => {
    const view = target()
    animate(view, { x: 100, scale: 2 }, { duration: 500, haptic: 'heavy' })
    animate(view, { opacity: 0.2 }, { duration: 500, haptic: 'light' })
    stop(view, ['scale'])
    driver.advance(500)
    expect(impacts).toEqual([{ at: 1500, style: 0 }])
  })

  it('drops feedback after unloading, even if the view reloads before arrival', () => {
    const view = target()
    animate(view, { x: 100 }, { duration: 500, haptic: 'light' })
    view.notify({ eventName: 'unloaded', object: view })
    view.notify({ eventName: 'loaded', object: view })
    driver.advance(500)
    expect(impacts).toHaveLength(0)
    expect(view.listenerCount('unloaded')).toBe(0)
  })

  it('does not fire on detached or replaced native views, or an inactive app', () => {
    for (const situation of ['detached', 'replaced', 'inactive']) {
      const view = target()
      app.applicationState = 0
      animate(view, { x: 100 }, { duration: 200, haptic: 'light' })
      if (situation === 'detached')
        Object.assign(view.nativeViewProtected!, { window: null })
      if (situation === 'replaced') view.nativeViewProtected = { window: {} }
      if (situation === 'inactive') app.applicationState = 1
      driver.advance(200)
      expect(impacts).toHaveLength(0)
    }
  })

  it('does not replay stale taps after a long UI-thread block', () => {
    const view = target()
    animate(view, 'bounce', { haptic: { style: 'light', times: [0.6, 1] } })
    driver.advance(1000)
    expect(impacts).toHaveLength(0)
    expect(view.listenerCount('unloaded')).toBe(0)
  })

  it('handles native completion before the final timer without a duplicate tap', () => {
    animate(target(), { x: 100 }, { duration: 200, haptic: 'light' })
    driver.time += 200
    driver.last('x').onEnd()
    expect(impacts).toHaveLength(1)
    driver.advance(0)
    expect(impacts).toHaveLength(1)
  })

  it('does not fire early when the platform skips playback', async () => {
    const play = driver.play.bind(driver)
    driver.play = (view, track, startedAt, onEnd) => {
      const handle = play(view, track, startedAt, onEnd)
      onEnd()
      return handle
    }
    await animate(target(), { x: 100 }, { duration: 500, haptic: 'light' })
    driver.advance(500)
    expect(impacts).toHaveLength(0)
  })

  it('waits for the end of finite repeats and skips animations without a finite arrival', () => {
    animate(target(), { x: [0, 100] }, { duration: 200, repeat: 1, haptic: 'light' })
    animate(target(), 'bounce', { repeat: Infinity, haptic: 'heavy' })
    driver.advance(200)
    expect(impacts).toHaveLength(0)
    driver.advance(200)
    expect(impacts).toEqual([{ at: 1400, style: 0 }])
    expect(allocations).toBe(1)
  })

  it('does not allocate for empty, zero-duration, stationary or disabled animations', () => {
    animate(target(), {}, { haptic: 'light' })
    animate(target(), { x: 100 }, { duration: 0, haptic: 'light' })
    animate(target(), { x: 0 }, { duration: 200, haptic: 'light' })
    animate(target(), { x: 100 }, { haptic: false })
    animate(target(), { x: 100 })
    expect(allocations).toBe(0)
  })

  it('lets custom presets provide feedback and callers disable it', () => {
    definePreset('hapticSnap' as never, {
      keyframes: { x: 100 },
      transition: { duration: 200, haptic: 'medium' },
    })
    animate(target(), 'hapticSnap' as never)
    animate(target(), 'hapticSnap' as never, { haptic: false })
    driver.advance(200)
    expect(impacts).toEqual([{ at: 1200, style: 1 }])
  })

  it('cancels feedback with a sequence and does not start later steps', async () => {
    const view = target()
    const animation = sequence([
      [view, { x: 100 }, { duration: 200, haptic: 'light' }],
      [view, { x: 0 }, { duration: 200, haptic: 'heavy' }],
    ])
    driver.advance(100)
    animation.stop()
    await flush()
    driver.advance(500)
    expect(await animation).toBe(false)
    expect(impacts).toHaveLength(0)
    expect(allocations).toBe(1)
  })

  it('validates options before interrupting a running animation', () => {
    const view = target()
    animate(view, { x: 100 }, { duration: 200, haptic: 'light' })
    const original = driver.last('x')
    const invalid: unknown[] = [
      true,
      null,
      'strong',
      { style: 'light', times: [] },
      ...[0, -1, 1.1, NaN, Infinity].map((time) => ({ style: 'light', times: [time] })),
      { style: 'light', times: [0.8, 0.4] },
      { style: 'light', times: [0.5, 0.5] },
      { style: 'light', times: Array(2) },
    ]
    for (const haptic of invalid)
      expect(() => animate(view, { x: 0 }, { haptic: haptic as Haptic })).toThrow()
    expect(original.stopped).toBe(false)
    driver.advance(200)
    expect(impacts).toHaveLength(1)
  })

  it('does not touch iOS APIs or add timers for Android', () => {
    platform.isIOS = false
    vi.unstubAllGlobals()
    const view = target()
    animate(view, { x: 100 }, { duration: 200, haptic: 'light' })
    driver.advance(200)
    expect(view.listenerCount('unloaded')).toBe(0)
    expect(allocations).toBe(0)
  })
})

describe('haptics with playback controls', () => {
  it('holds feedback through pause and schedules the remaining points after play', async () => {
    const animation = animate(
      target(),
      { x: [0, 100] },
      { duration: 1000, ease: 'linear', haptic: { style: 'light', times: [0.3, 0.8] } },
    )
    driver.advance(200)
    animation.pause()
    driver.advance(500)
    expect(impacts).toHaveLength(0)
    animation.play()
    driver.advance(100)
    expect(impacts).toHaveLength(1)
    driver.advance(500)
    expect(impacts).toHaveLength(2)
    driver.advance(200)
    expect(await animation).toBe(true)
  })
  it('skips points crossed by a seek and never replays consumed feedback', async () => {
    const animation = animate(
      target(),
      { x: [0, 100] },
      { duration: 1000, ease: 'linear', haptic: { style: 'light', times: [0.3, 0.8] } },
    )
    animation.pause()
    animation.progress = 0.5
    expect(impacts).toHaveLength(0)
    animation.play()
    driver.advance(300)
    expect(impacts).toHaveLength(1)
    animation.pause()
    animation.progress = 0.1
    animation.play()
    driver.advance(900)
    expect(impacts).toHaveLength(1)
    expect(await animation).toBe(true)
  })
})
