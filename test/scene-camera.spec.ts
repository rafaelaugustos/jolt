import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest'
import {
  animate,
  configure,
  motionScope,
  motionValue,
  playbackProgress,
  timeline,
} from '../src/index.js'
import { sceneKitFieldOfView } from '../src/native/index.js'
import {
  setNativePropertyDriver,
  type NativePropertyDriver,
} from '../src/native-property-driver.js'
import { driver } from './helpers.js'

type Camera = { fov: number; valid: boolean }
type Sink = { camera: Camera; disposed: boolean }
const camera = (): Camera => ({ fov: 60, valid: true })
const plays: {
  samples: readonly (readonly number[])[]
  cancelled: boolean
  paused: boolean
  end: (done: boolean) => void
}[] = []
const native: NativePropertyDriver = {
  validate() {},
  alive: (raw) => !(raw as Sink).disposed && (raw as Sink).camera.valid,
  read: (raw) => [(raw as Sink).camera.fov],
  write: (raw, values) => {
    ;(raw as Sink).camera.fov = values[0]!
  },
  dispose: (raw) => {
    ;(raw as Sink).disposed = true
  },
  play(_sink, _track, samples, _final, end) {
    const state = { samples, cancelled: false, paused: false, end }
    plays.push(state)
    return {
      cancel: () => {
        state.cancelled = true
      },
      control: (_time, paused) => {
        state.paused = paused
      },
    }
  },
}
const resources: { dispose(): void }[] = []
const own = <T extends { dispose(): void }>(resource: T): T => {
  resources.push(resource)
  return resource
}
const wrap = (target = camera()) =>
  own(sceneKitFieldOfView(target as unknown as SCNCamera))
beforeEach(() => {
  plays.length = 0
  setNativePropertyDriver(native)
  vi.stubGlobal('JoltReferenceProperties', {
    sceneFieldOfView: (camera: Camera): Sink => ({ camera, disposed: false }),
  })
})
afterEach(() => {
  for (const resource of resources.splice(0)) resource.dispose()
  expect(driver.frames.size).toBe(0)
  setNativePropertyDriver(undefined)
  vi.unstubAllGlobals()
})

describe('SceneKit field of view', () => {
  it('validates degrees and all mapped samples before replacing the current animation', () => {
    const fov = wrap()
    fov.animate(32, { duration: 1000 })
    for (const bad of [0, 0.9, 179.1, 180, -20, NaN, Infinity]) {
      expect(() => fov.set(bad)).toThrow(/1..179 degrees/)
      expect(() => fov.animate(bad)).toThrow(/1..179 degrees/)
    }
    const value = motionValue(0)
    const run = animate(value, 1, { duration: 1000, ease: 'linear' })
    expect(() => fov.bind(value, (n) => (n === 0 ? 60 : 180))).toThrow(/degrees/)
    expect(plays[0]!.cancelled).toBe(false)
    run.stop()
    fov.set(1)
    expect(fov.get()).toBe(1)
    fov.set(179)
    expect(fov.get()).toBe(179)
  })
  it('preserves a degree-linear tween and clamps overshoot in both directions', () => {
    const fov = wrap()
    fov.animate(30, { duration: 1000, ease: 'linear' })
    expect(plays[0]!.samples[30]).toEqual([45])
    for (const end of [1, 179]) {
      fov.set(end === 1 ? 179 : 1)
      fov.animate(end, 'bouncy')
      const values = plays.at(-1)!.samples.map(([v]) => v!)
      expect(Math.min(...values)).toBeGreaterThanOrEqual(1)
      expect(Math.max(...values)).toBeLessThanOrEqual(179)
      expect(values.at(-1)).toBe(end)
    }
  })
  it('reads the latest native value for interruption and shares ownership across wrappers', async () => {
    const target = camera(),
      first = wrap(target),
      next = wrap(target)
    const old = first.animate(30, { duration: 1000 })
    target.fov = 47.5
    const run = next.animate(80, { duration: 1000, ease: 'linear' })
    await expect(old.finished).resolves.toBe(false)
    expect(plays[1]!.samples[0]).toEqual([47.5])
    first.dispose()
    expect(plays[1]!.cancelled).toBe(false)
    run.pause()
    expect(plays[1]!.paused).toBe(true)
    run.progress = 0.5
    run.play()
    expect(plays[1]!.paused).toBe(false)
    run.stop()
  })
  it('binds derived/playback values with scope suspension and no JS frame subscription', () => {
    const fov = wrap(),
      value = motionValue(0),
      scope = own(motionScope())
    const run = scope.add(animate(value, 1, { duration: 1000, ease: 'linear' }))
    scope.use(() => fov.bind(value.to([0, 1], [72, 30]), (n) => n))
    expect(plays.at(-1)!.samples[30]).toEqual([51])
    scope.suspend()
    expect(plays.at(-1)!.cancelled).toBe(true)
    scope.resume()
    const previous = plays.at(-1)!
    const off = fov.bind(playbackProgress(run), (n) => 60 - n * 20)
    expect(previous.cancelled).toBe(true)
    run.pause()
    run.progress = 0.5
    expect(fov.get()).toBe(50)
    off()
  })
  it('follows spatial reduced-motion policy at creation and source rebuild', () => {
    const fov = wrap()
    configure({ reducedMotion: 'always' })
    const instant = fov.animate(32, { duration: 900 })
    expect(instant.duration).toBe(0)
    expect(fov.get()).toBe(32)
    configure({ reducedMotion: 'never', timeScale: 2 })
    const value = motionValue(0),
      run = animate(value, 1, { duration: 1000 })
    const off = fov.bind(value, (n) => 60 - n * 30)
    const active = plays.at(-1)!
    expect(run.duration).toBe(500)
    configure({ reducedMotion: 'always' })
    const replacement = animate(value, 1, { duration: 1000 })
    expect(active.cancelled).toBe(true)
    expect(fov.get()).toBe(30)
    off()
    run.stop()
    replacement.stop()
  })
  it('coordinates timeline controls and stops cleanly when native projection becomes invalid', async () => {
    const target = camera(),
      fov = wrap(target)
    const group = timeline([{ at: 0, run: () => fov.animate(32, { duration: 1000 }) }])
    group.pause()
    expect(plays[0]!.paused).toBe(true)
    group.play()
    target.valid = false
    plays[0]!.end(false)
    await expect(group.finished).resolves.toBe(false)
    expect(() => fov.get()).toThrow(/target/)
    fov.dispose()
    fov.dispose()
    expect(plays[0]!.cancelled).toBe(true)
  })
  it('explains that an older native binary needs an update and rebuild', () => {
    vi.stubGlobal('JoltReferenceProperties', {})
    expect(() => wrap()).toThrow(/Update both packages and rebuild/)
  })
})
