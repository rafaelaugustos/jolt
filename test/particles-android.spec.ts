import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { confetti, configure, motionScope, particles } from '../src/index.js'
import { currentAndroidParticles } from '../src/driver/android-particles.js'
import { Application } from './shims/core.js'
import { createView, driver, flush } from './helpers.js'

vi.mock('@nativescript/core', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  isAndroid: true,
  isIOS: false,
}))

const made: Native[] = []
const cleanups: (() => void)[] = []
class Native {
  started = false
  stopped = false
  corner = 0
  invalid = false
  args: any[]
  constructor(...args: any[]) {
    this.args = args
    made.push(this)
  }
  start() {
    this.started = true
  }
  refresh(corner: number) {
    this.corner = corner
    if (this.invalid) this.stop()
  }
  stop() {
    if (this.stopped) return
    this.stopped = true
    this.args.at(-1).onEnd()
  }
}
function target() {
  const view = createView()
  const state = { attached: true, width: 220, height: 100 }
  view.nativeViewProtected = {
    getWindowToken: () => (state.attached ? {} : null),
    getWidth: () => state.width,
    getHeight: () => state.height,
  }
  return { view, state }
}
function start(
  view: ReturnType<typeof createView>,
  options?: Parameters<typeof particles>[1],
) {
  const stop = particles(view, options)
  cleanups.push(stop)
  return stop
}
function burst(view: ReturnType<typeof createView>) {
  const stop = confetti(view)
  cleanups.push(stop)
  return stop
}
beforeEach(() => {
  made.length = 0
  vi.stubGlobal('org', {
    rafaelaugusto: {
      jolt: {
        ParticleEmitter: Object.assign(Native, {
          Listener: class {
            constructor(value: object) {
              Object.assign(this, value)
            }
          },
        }),
      },
    },
  })
  Object.defineProperty(Array, 'create', {
    configurable: true,
    value: (_type: string, count: number) => new Array(count),
  })
})
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup()
  expect(driver.watchers.size).toBe(0)
  expect(driver.frames.size).toBe(0)
  expect(Application.listenerCount(Application.suspendEvent)).toBe(0)
  delete (Array as unknown as { create?: unknown }).create
  vi.unstubAllGlobals()
})

describe('Android native particle bridge', () => {
  it('passes all public options in DIP/ms/degrees without requesting JS observer frames', async () => {
    const { view } = target()
    start(view, {
      colors: ['red', 'blue'],
      shape: 'ring',
      source: 'bottom',
      rate: 25,
      lifetime: 4500,
      size: 18,
      velocity: 40,
      velocityRange: 12,
      angle: -80,
      spread: 35,
      gravity: -20,
      spin: 120,
      spinRange: 60,
      fadeOut: false,
      duration: 300,
    })
    await flush()
    expect(made[0]!.args.slice(1, -1)).toEqual([
      false,
      [0xffff0000 | 0, 0xff0000ff | 0],
      2,
      2,
      25,
      4500,
      18,
      40,
      12,
      -80,
      35,
      -20,
      120,
      60,
      false,
      300,
    ])
    expect(made[0]!.started).toBe(true)
    expect(driver.frames.size).toBe(0)
  })

  it('waits for load/window/size without starting native timing', async () => {
    const { view, state } = target()
    view.isLoaded = false
    state.attached = false
    state.width = 0
    start(view)
    await flush()
    expect(made).toHaveLength(0)
    view.isLoaded = true
    view.notify({ eventName: 'loaded' })
    await flush()
    state.attached = true
    view.notify({ eventName: 'layoutChanged' })
    await flush()
    expect(made).toHaveLength(0)
    state.width = 220
    view.notify({ eventName: 'layoutChanged' })
    await flush()
    expect(made).toHaveLength(1)
  })

  it('keeps independent emitter/burst ownership and ignores stale cleanup', async () => {
    const { view } = target()
    const old = start(view)
    burst(view)
    await flush()
    expect(made[1]!.args[1]).toBe(true)
    expect(made[1]!.args.slice(3, 7)).toEqual([1, 0, 400, 2200])
    start(view)
    await flush()
    old()
    expect(made.map((native) => native.stopped)).toEqual([true, false, false])
    expect(currentAndroidParticles(view)).toBe(made[2])
    expect(currentAndroidParticles(view, true)).toBe(made[1])
  })

  it('releases all JS listeners after native completion and idempotent cleanup', async () => {
    const { view } = target()
    const off = start(view, { duration: 100 })
    await flush()
    made[0]!.stop()
    off()
    off()
    expect(currentAndroidParticles(view)).toBeUndefined()
    expect(view.listenerCount('loaded')).toBe(0)
    expect(view.listenerCount('layoutChanged')).toBe(0)
    expect(view.listenerCount('unloaded')).toBe(0)
    expect(view.style.listenerCount('borderTopLeftRadiusChange')).toBe(0)
  })

  it('cancels on unload and background without replaying on reload/resume', async () => {
    for (const background of [false, true]) {
      const { view } = target()
      start(view)
      burst(view)
      await flush()
      if (background) Application.notify({ eventName: Application.suspendEvent })
      else view.notify({ eventName: 'unloaded' })
      const count = made.length
      expect(made.slice(-2).every((native) => native.stopped)).toBe(true)
      Application.notify({ eventName: Application.resumeEvent })
      view.notify({ eventName: 'loaded' })
      await flush()
      expect(made.length).toBe(count)
    }
  })

  it('cancels replaced native targets and propagates native detach/zero-size cleanup', async () => {
    const { view } = target()
    start(view)
    await flush()
    view.nativeViewProtected = { ...view.nativeViewProtected }
    view.notify({ eventName: 'layoutChanged' })
    await flush()
    expect(made[0]!.stopped).toBe(true)
    start(view)
    await flush()
    made[1]!.invalid = true
    view.notify({ eventName: 'layoutChanged' })
    await flush()
    expect(made[1]!.stopped).toBe(true)
    expect(currentAndroidParticles(view)).toBeUndefined()
  })

  it('validates before replacement and treats zero rate/count as cleanup', async () => {
    const { view } = target()
    start(view)
    burst(view)
    await flush()
    expect(() => particles(view, { colors: [] })).toThrow()
    expect(() => confetti(view, { count: 0.5 })).toThrow()
    expect(made.every((native) => !native.stopped)).toBe(true)
    particles(view, { rate: 0 })
    confetti(view, { count: 0 })
    await flush()
    expect(made.every((native) => native.stopped)).toBe(true)
    expect(made).toHaveLength(2)
  })

  it('cancels live and pending emitters when Jolt reduced motion changes', async () => {
    const { view } = target()
    start(view)
    await flush()
    const pending = target().view
    pending.isLoaded = false
    start(pending)
    configure({ reducedMotion: 'always' })
    expect(made[0]!.stopped).toBe(true)
    expect(pending.listenerCount('loaded')).toBe(0)
    configure({ reducedMotion: 'never' })
    pending.isLoaded = true
    pending.notify({ eventName: 'loaded' })
    await flush()
    expect(made).toHaveLength(1)
  })

  it('cleans up scope-owned factories and queued starts over repeated disposal', async () => {
    const { view } = target()
    for (let i = 0; i < 20; i++) {
      const scope = motionScope()
      scope.use(() => start(view))
      await flush()
      scope.dispose()
      scope.dispose()
      expect(currentAndroidParticles(view)).toBeUndefined()
    }
    const off = start(view)
    off()
    await flush()
    expect(made).toHaveLength(20)
    expect(made.every((native) => native.stopped)).toBe(true)
  })
})
