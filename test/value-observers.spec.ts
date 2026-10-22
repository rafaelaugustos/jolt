import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  animate,
  bind,
  configure,
  motionScope,
  motionValue,
  scrollValue,
  set,
  stop,
} from '../src/index.js'
import { Application, ScrollView, Trace } from './shims/core.js'
import { createClock } from '../src/playback.js'
import { createView, driver } from './helpers.js'

const owned: (() => void)[] = []
const keep = (cleanup: () => void) => {
  owned.push(cleanup)
  return cleanup
}
afterEach(() => {
  Application.notify({ eventName: Application.resumeEvent, object: Application })
  for (const cleanup of owned.splice(0)) cleanup()
  vi.restoreAllMocks()
})
const linear = { duration: 400, ease: 'linear' } as const

describe('motion value subscribers', () => {
  it('reads native playback time when the system animator scale differs from wall time', async () => {
    const clocks: ReturnType<typeof createClock>[] = []
    const after = driver.after.bind(driver)
    Object.assign(driver, {
      clock: () => {
        const clock = createClock(() => driver.now() / 2)
        vi.spyOn(clock, 'cancel')
        clocks.push(clock)
        return clock
      },
      after: (ms: number, callback: () => void) => after(ms * 2, callback),
    })
    const value = motionValue(0)
    const listener = vi.fn()
    keep(value.subscribe(listener))
    const base = animate(value, 100, linear)
    driver.advance(200)
    expect(value.get()).toBeCloseTo(25)
    expect(listener.mock.lastCall![0]).toBeCloseTo(25)
    const layer = animate(value, 20, { ...linear, layer: 'pulse' })
    driver.advance(200)
    expect(value.get()).toBeCloseTo(55)
    expect(listener.mock.lastCall![0]).toBeCloseTo(55)
    stop(value, { layer: 'pulse' })
    expect(await layer).toBe(false)
    driver.advance(400)
    expect(await base).toBe(true)
    expect(listener.mock.lastCall![0]).toBe(100)
    expect(clocks.every((clock) => vi.mocked(clock.cancel).mock.calls.length === 1)).toBe(
      true,
    )
    expect(driver.frames.size).toBe(0)
  })

  it('deliver the current value immediately, with an opt-out and no idle frame work', () => {
    const value = motionValue(7)
    const listener = vi.fn()
    const quiet = vi.fn()
    keep(value.subscribe(listener))
    keep(value.subscribe(quiet, { immediate: false }))
    expect(listener.mock.calls).toEqual([[7, driver.now()]])
    expect(quiet).not.toHaveBeenCalled()
    expect(driver.frames.size).toBe(0)
    expect(() => value.subscribe(null as never)).toThrow(/listener function/)
  })

  it('shares one frame across roots and derived numeric/color consumers without views', () => {
    const first = motionValue(0)
    const second = motionValue(10)
    const a = vi.fn(),
      b = vi.fn(),
      c = vi.fn(),
      color = vi.fn()
    keep(first.subscribe(a))
    keep(second.subscribe(b))
    keep(first.to([1, 0], [100, 0]).subscribe(c))
    keep(first.to([0, 1], ['black', 'white']).subscribe(color))
    keep(() => stop(first))
    keep(() => stop(second))
    animate(first, 1, linear)
    animate(second, 20, linear)
    expect(driver.frames.size).toBe(1)
    driver.advance(100)
    expect(a).toHaveBeenLastCalledWith(0.25, 1100)
    expect(b).toHaveBeenLastCalledWith(12.5, 1100)
    expect(c).toHaveBeenLastCalledWith(25, 1100)
    expect(color.mock.lastCall![0].argb).toBe(
      first.to([0, 1], ['black', 'white']).get().argb,
    )
    expect(color.mock.lastCall![1]).toBe(1100)
    expect(driver.played).toHaveLength(0)
  })

  it('leaves native-only bindings without a JS frame loop', () => {
    const value = motionValue()
    bind(createView(), { x: value })
    const animation = animate(value, 100, linear)
    expect(driver.frames.size).toBe(0)
    animation.stop()
  })

  it('coalesces direct writes, suppresses unchanged outputs, and delivers completion once', async () => {
    const value = motionValue()
    const listener = vi.fn()
    keep(value.subscribe(listener))
    set(value, 1)
    set(value, 2)
    set(value, 2)
    expect(listener).toHaveBeenCalledTimes(1)
    driver.advance(16)
    expect(listener).toHaveBeenLastCalledWith(2, driver.now())
    expect(driver.frames.size).toBe(0)
    const animation = animate(value, 3, linear)
    driver.advance(400)
    expect(await animation).toBe(true)
    expect(listener).toHaveBeenLastCalledWith(3, driver.now())
    expect(listener).toHaveBeenCalledTimes(3)
    expect(driver.frames.size).toBe(0)
  })

  it('samples every source before callbacks and queues reentrant changes for the next frame', () => {
    const first = motionValue(),
      second = motionValue()
    const listener = vi.fn()
    keep(
      first.subscribe(
        (value) => {
          if (value === 1) set(second, 9)
        },
        { immediate: false },
      ),
    )
    keep(second.subscribe(listener, { immediate: false }))
    set(first, 1)
    set(second, 2)
    driver.advance(16)
    expect(listener).toHaveBeenLastCalledWith(2, driver.now())
    driver.advance(16)
    expect(listener).toHaveBeenLastCalledWith(9, driver.now())
    expect(driver.frames.size).toBe(0)
  })

  it('can unsubscribe another listener during delivery and unsubscribe twice', () => {
    const value = motionValue()
    let off = () => {}
    keep(value.subscribe(() => off(), { immediate: false }))
    const listener = vi.fn()
    off = keep(value.subscribe(listener, { immediate: false }))
    set(value, 1)
    driver.advance(16)
    off()
    off()
    expect(listener).not.toHaveBeenCalled()
  })

  it('keeps other subscribers and future frames alive after a callback throws', () => {
    const error = vi.spyOn(Trace, 'write').mockImplementation(() => {})
    const value = motionValue()
    keep(
      value.subscribe(() => {
        throw new Error('consumer')
      }),
    )
    const listener = vi.fn()
    keep(value.subscribe(listener))
    set(value, 1)
    driver.advance(16)
    set(value, 2)
    driver.advance(16)
    expect(listener).toHaveBeenLastCalledWith(2, driver.now())
    expect(error).toHaveBeenCalledTimes(3)
  })

  it('reports interruption and stop without a stale endpoint', async () => {
    const value = motionValue()
    const listener = vi.fn()
    keep(value.subscribe(listener))
    const first = animate(value, 1, linear)
    driver.advance(100)
    const second = animate(value, 0, linear)
    expect(await first).toBe(false)
    driver.advance(100)
    expect(listener.mock.lastCall![0]).toBeCloseTo(0.1875)
    driver.advance(25)
    stop(value)
    const held = value.get()
    driver.advance(1000)
    expect(await second).toBe(false)
    expect(listener.mock.lastCall![0]).toBeCloseTo(held)
    expect(driver.frames.size).toBe(0)
  })

  it('supports late observers, repeated springs, and detaches the last observer without stopping playback', () => {
    const value = motionValue()
    const animation = animate(value, 1, {
      ...linear,
      repeat: Infinity,
      repeatType: 'reverse',
    })
    keep(() => animation.stop())
    driver.advance(100)
    const listener = vi.fn()
    const off = keep(value.subscribe(listener))
    expect(listener.mock.lastCall![0]).toBeCloseTo(0.25)
    driver.advance(400)
    expect(listener.mock.lastCall![0]).toBeCloseTo(0.75)
    off()
    expect(driver.frames.size).toBe(0)
    driver.advance(100)
    expect(value.get()).toBeCloseTo(0.5)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('owns subscriptions through a scope, including suspension and resubscription', () => {
    const value = motionValue()
    const scope = motionScope()
    keep(() => scope.dispose())
    const listener = vi.fn()
    scope.use(() => value.subscribe(listener))
    scope.suspend()
    set(value, 2)
    driver.advance(16)
    expect(listener).toHaveBeenCalledTimes(1)
    scope.resume()
    expect(listener.mock.lastCall![0]).toBe(2)
    scope.dispose()
    set(value, 3)
    driver.advance(16)
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('pauses callbacks in background and samples current state once after resume', () => {
    const value = motionValue()
    const listener = vi.fn()
    keep(value.subscribe(listener))
    keep(() => stop(value))
    animate(value, 1, linear)
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    expect(driver.frames.size).toBe(0)
    driver.advance(200)
    expect(listener).toHaveBeenCalledTimes(1)
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    driver.advance(16)
    expect(listener.mock.lastCall![0]).toBeCloseTo(0.54)
    driver.advance(200)
    expect(listener.mock.lastCall![0]).toBe(1)
    expect(driver.frames.size).toBe(0)
  })

  it('recovers when the last observer leaves while suspended', () => {
    const value = motionValue()
    const off = keep(value.subscribe(() => {}))
    set(value, 1)
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    off()
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    const listener = vi.fn()
    keep(value.subscribe(listener))
    set(value, 2)
    driver.advance(16)
    expect(listener.mock.lastCall![0]).toBe(2)
  })

  it('retains scalar timing under reduced motion while bound transforms jump', () => {
    configure({ reducedMotion: 'always' })
    const value = motionValue()
    const listener = vi.fn()
    keep(value.subscribe(listener))
    const view = createView()
    bind(view, { x: value })
    keep(() => stop(value))
    animate(value, 100, linear)
    expect(view.translateX).toBe(100)
    driver.advance(100)
    expect(listener.mock.lastCall![0]).toBe(25)
  })

  it('follows scroll values without polling at rest', () => {
    const scroll = new ScrollView()
    const value = scrollValue(scroll as never)
    keep(() => value.dispose())
    const listener = vi.fn()
    keep(value.subscribe(listener))
    scroll.notify({
      eventName: 'scroll',
      object: scroll,
      scrollX: 0,
      scrollY: 30,
    } as never)
    driver.advance(16)
    expect(listener.mock.lastCall![0]).toBe(30)
    expect(driver.frames.size).toBe(0)
  })
})
