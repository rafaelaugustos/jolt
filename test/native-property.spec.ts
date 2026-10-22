import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animate, motionValue, playbackProgress, timeline } from '../src/index.js'
import { registerNativeProperty } from '../src/native-property.js'
import { interpolatePose, shortestAngle } from '../src/native-properties.js'
import {
  setNativePropertyDriver,
  type NativePropertyDriver,
} from '../src/native-property-driver.js'
import type { Track } from '../src/track.js'
import { createView, driver } from './helpers.js'

type Sink = { values: number[]; alive: boolean }
const plays: {
  track: Track
  samples: readonly (readonly number[])[]
  time: number
  paused: boolean
  cancelled: boolean
}[] = []
const native: NativePropertyDriver = {
  validate(sink, n) {
    if ((sink as Sink).values.length !== n) throw new Error('dimensions')
  },
  alive: (sink) => (sink as Sink).alive,
  read: (sink) => [...(sink as Sink).values],
  write(sink, values) {
    ;(sink as Sink).values = [...values]
  },
  dispose(sink) {
    ;(sink as Sink).alive = false
  },
  play(sink, track, samples) {
    const state = { track, samples, time: 0, paused: false, cancelled: false }
    plays.push(state)
    return {
      control(time, paused) {
        state.time = time
        state.paused = paused
      },
      cancel() {
        state.cancelled = true
      },
    }
  },
}
let serial = 0
const scalar = () =>
  registerNativeProperty<number>({
    name: `test${serial++}/scalar`,
    units: ['units'],
    platforms: ['ios', 'android'],
    encode: (n) => [n],
    decode: (n) => n[0]!,
    create: (target) => target,
  })
beforeEach(() => {
  plays.length = 0
  setNativePropertyDriver(native)
})
afterEach(() => {
  setNativePropertyDriver(undefined)
  vi.restoreAllMocks()
})

describe('native property contract', () => {
  it('releases a native player that reports a synchronous setup failure', async () => {
    const cancel = vi.fn()
    vi.spyOn(native, 'play').mockImplementation(
      (_sink, _track, _samples, _final, end) => {
        end(false)
        return { control: vi.fn(), cancel }
      },
    )
    const property = scalar()({ values: [0], alive: true })
    const animation = property.animate(10, { duration: 1000 })
    await expect(animation.finished).resolves.toBe(false)
    expect(cancel).toHaveBeenCalledOnce()
    property.dispose()
  })

  it('does not retain a binding player after synchronous target loss', () => {
    const cancel = vi.fn()
    vi.spyOn(native, 'play').mockImplementation(
      (_sink, _track, _samples, _final, end) => {
        end(false)
        return { control: vi.fn(), cancel }
      },
    )
    const value = motionValue(0),
      animation = animate(value, 1, { duration: 1000 })
    const property = scalar()({ values: [0], alive: true })
    const off = property.bind(value, (n) => n)
    expect(cancel).toHaveBeenCalledOnce()
    animation.pause()
    animation.play()
    expect(native.play).toHaveBeenCalledOnce()
    off()
    property.dispose()
    animation.stop()
  })
  it('samples and controls a native sink with no JS frame callback', async () => {
    const sink: Sink = { values: [0], alive: true },
      property = scalar()(sink)
    const animation = property.animate(10, { duration: 1000, ease: 'linear' })
    expect(plays[0]!.samples).toHaveLength(61)
    expect(driver.frames.size).toBe(0)
    driver.advance(250)
    animation.pause()
    expect(plays[0]!.time).toBe(250)
    expect(plays[0]!.paused).toBe(true)
    driver.advance(1000)
    animation.progress = 0.5
    expect(plays[0]!.time).toBe(500)
    animation.play()
    driver.advance(500)
    await expect(animation.finished).resolves.toBe(true)
    expect(property.get()).toBe(10)
    expect(plays[0]!.cancelled).toBe(true)
    property.dispose()
  })

  it('shares ownership across wrappers, leaving other properties independent', async () => {
    const sink: Sink = { values: [0], alive: true },
      adapter = scalar(),
      first = adapter(sink),
      second = adapter(sink)
    const a = first.animate(10, { duration: 1000 }),
      b = second.animate(20, { duration: 1000 })
    await expect(a.finished).resolves.toBe(false)
    first.stop()
    expect(plays[1]!.cancelled).toBe(false)
    second.stop()
    await expect(b.finished).resolves.toBe(false)
  })

  it('validates every mapped compound sample before interrupting the current owner', () => {
    const sink: Sink = { values: [0], alive: true },
      property = scalar()(sink)
    const animation = property.animate(10, { duration: 1000 })
    expect(() => property.animate(NaN)).toThrow(/finite/)
    const value = motionValue(0)
    const run = animate(value, 1, { duration: 1000, ease: 'linear' })
    expect(() => property.bind(value, (n) => (n > 0.4 && n < 0.6 ? NaN : n))).toThrow(
      /finite/,
    )
    expect(plays[0]!.cancelled).toBe(false)
    animation.stop()
    run.stop()
  })

  it('binds nonlinear mappings to scalar and observable playback values natively', () => {
    const value = motionValue(0),
      run = animate(value, 1, { duration: 1000, ease: 'linear' })
    const property = scalar()({ values: [0], alive: true })
    const off = property.bind(value, (n) => n * n)
    expect(plays.at(-1)!.samples[30]![0]).toBeCloseTo(0.25)
    driver.advance(300)
    run.pause()
    expect(property.get()).toBeCloseTo(0.09)
    expect(plays[0]!.cancelled).toBe(true)
    run.play()
    expect(plays.at(-1)!.time).toBeCloseTo(300)
    off()
    const animation = animate(createView(), { x: 100 }, { duration: 1000 })
    const release = property.bind(playbackProgress(animation), (n) => n * 100)
    expect(driver.frames.size).toBe(0)
    animation.pause()
    expect(plays.at(-1)!.cancelled).toBe(true)
    release()
    property.dispose()
    animation.stop()
    run.stop()
  })

  it('joins timelines and rejects use after disposal', async () => {
    const property = scalar()({ values: [0], alive: true })
    const scene = timeline([
      { run: () => property.animate(10, { duration: 1000 }), at: 0 },
    ])
    scene.pause()
    expect(plays[0]!.paused).toBe(true)
    scene.play()
    property.dispose()
    property.dispose()
    await expect(scene.finished).resolves.toBe(false)
    expect(() => property.animate(2)).toThrow(/disposed/)
  })

  it('rejects duplicate namespaces and unsupported platforms', () => {
    const name = `test${serial++}/unique`
    const definition = {
      name,
      units: ['x'],
      platforms: ['ios' as const],
      encode: (n: number) => [n],
      decode: (n: readonly number[]) => n[0]!,
      create: (target: object) => target,
    }
    registerNativeProperty(definition)
    expect(() => registerNativeProperty(definition)).toThrow(/already/)
    const android = registerNativeProperty({
      ...definition,
      name: `test${serial++}/android`,
      platforms: ['android'],
    })
    expect(() => android({ values: [0], alive: true })).toThrow(/unavailable/)
  })

  it('handles longitude wrap and quaternion shortest paths without component-wise rotation', () => {
    expect(shortestAngle(179, -179, 0.5)).toBe(180)
    expect(shortestAngle(350, 10, 0.5)).toBe(360)
    const identity = { position: [0, 0, 0] as const, orientation: [0, 0, 0, 1] as const }
    const opposite = { position: [2, 4, 6] as const, orientation: [0, 0, 0, -1] as const }
    const pose = interpolatePose(identity, opposite, 0.5)
    expect(pose.position).toEqual([1, 2, 3])
    expect(pose.orientation).toEqual([0, 0, 0, 1])
    const half = interpolatePose(
      identity,
      { ...identity, orientation: [0, 1, 0, 0] },
      0.5,
    )
    expect(half.orientation[1]).toBeCloseTo(Math.SQRT1_2)
    expect(half.orientation[3]).toBeCloseTo(Math.SQRT1_2)
  })
})
