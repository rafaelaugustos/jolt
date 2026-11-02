import { describe, expect, it, vi } from 'vitest'
import { Application } from '@nativescript/core'
import {
  animate,
  bind,
  configure,
  motionValue,
  seekableTimeline,
  set,
} from '../src/index.js'
import type { SeekableStep } from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'

const linear = { duration: 1000, ease: 'linear' as const }
describe('finite declarative scenes', () => {
  it('compiles delayed, overlapping and nested tracks before playback', async () => {
    const card = createView(),
      bar = createView(),
      value = motionValue(0)
    const off = bind(bar, { scaleX: value })
    const scene = seekableTimeline(
      [
        { target: card, keyframes: { x: [0, 100] }, transition: linear },
        {
          at: 500,
          steps: [
            {
              target: card,
              keyframes: { scale: [1, 2], opacity: [0, 1] },
              transition: linear,
            },
          ],
        },
        { value, keyframes: [0, 1], transition: { ...linear, duration: 1500 } },
      ],
      { paused: true },
    )
    expect(scene.duration).toBe(1500)
    const x = driver.played.find((p) => p.view === card && p.track.property === 'x')!
    const scale = driver.played.find(
      (p) => p.view === card && p.track.property === 'scaleX',
    )!
    for (const { track } of driver.played) {
      expect(
        track.times
          .slice(1)
          .every((time, i) => Math.fround(time) > Math.fround(track.times[i]!)),
      ).toBe(true)
      expect(track.values.every(Number.isFinite)).toBe(true)
    }
    expect(x.track.valueAt(750)).toBe(75)
    expect(x.track.valueAt(1400)).toBe(100)
    expect(scale.track.valueAt(250)).toBe(1)
    expect(scale.track.valueAt(750)).toBe(1.25)
    scene.progress = 0.5
    expect(value.get()).toBeCloseTo(0.5)
    expect(x.offset).toBe(750)
    scene.progress = 1
    driver.advance(10000)
    await flush()
    expect(state(scene.finished)()).toBeUndefined()
    scene.progress = 0.2
    expect(value.get()).toBeCloseTo(0.2)
    scene.play()
    driver.advance(1200)
    expect(await scene).toBe(true)
    expect(driver.frames.size).toBe(0)
    off()
  })
  it('preserves playing state and keeps completed/stopped handles terminal', async () => {
    const view = createView()
    const scene = seekableTimeline([
      { target: view, keyframes: { y: [0, 100] }, transition: linear },
    ])
    scene.progress = 0.7
    expect(scene.paused).toBe(false)
    driver.advance(300)
    expect(await scene).toBe(true)
    const count = driver.played.length
    scene.progress = 0
    scene.play()
    expect(driver.played.length).toBe(count)
    const stopped = seekableTimeline([
      { target: view, keyframes: { y: [0, 100] }, transition: linear },
    ])
    stopped.stop()
    expect(await stopped).toBe(false)
    stopped.progress = 0.5
    expect(driver.played.at(-1)!.stopped).toBe(true)
  })
  it('seeking never reclaims a superseded property or numeric value', async () => {
    const view = createView(),
      value = motionValue(0)
    const scene = seekableTimeline(
      [
        { target: view, keyframes: { x: [0, 100], y: [0, 200] }, transition: linear },
        { value, keyframes: [0, 1], transition: linear },
      ],
      { paused: true },
    )
    scene.progress = 0.4
    const next = animate(view, { x: 300 }, linear)
    set(value, 9)
    const x = driver.last('x')
    scene.progress = 0.1
    expect(driver.last('x')).toBe(x)
    expect(value.get()).toBe(9)
    expect(driver.last('y').offset).toBe(100)
    scene.play()
    driver.advance(1000)
    expect(await scene).toBe(false)
    expect(await next).toBe(true)
  })
  it('uses timeScale, delay and reverse repeats consistently', () => {
    configure({ timeScale: 0.5 })
    const scene = seekableTimeline(
      [
        {
          target: createView(),
          at: 100,
          keyframes: { x: [0, 100] },
          transition: { ...linear, delay: 100, repeat: 1, repeatType: 'reverse' },
        },
      ],
      { paused: true },
    )
    expect(scene.duration).toBe(4400)
    const track = driver.last('x').track
    expect(track.valueAt(200)).toBe(0)
    expect(track.valueAt(1400)).toBe(50)
    expect(track.valueAt(3400)).toBe(50)
    expect(track.valueAt(4400)).toBe(0)
    scene.stop()
  })
  it('preserves layered channels independently', async () => {
    const view = createView()
    const scene = seekableTimeline(
      [
        { target: view, keyframes: { x: [0, 100] }, transition: linear },
        { target: view, layer: 'nudge', keyframes: { x: [0, 10] }, transition: linear },
      ],
      { paused: true },
    )
    scene.progress = 0.5
    expect(view.translateX).toBeCloseTo(55)
    const newer = animate(view, { x: 20 }, { ...linear, layer: 'nudge' })
    scene.progress = 0.25
    scene.stop()
    newer.stop()
    expect(await scene).toBe(false)
  })
  it('freezes in the background, preserves an explicit pause, and stops on unload', async () => {
    const view = createView()
    const scene = seekableTimeline([
      { target: view, keyframes: { x: [0, 100] }, transition: linear },
    ])
    driver.advance(200)
    Application.notify({ eventName: Application.suspendEvent })
    driver.advance(4000)
    expect(scene.progress).toBeCloseTo(0.2)
    Application.notify({ eventName: Application.resumeEvent })
    expect(scene.paused).toBe(false)
    Application.notify({ eventName: Application.suspendEvent })
    scene.pause()
    Application.notify({ eventName: Application.resumeEvent })
    expect(scene.paused).toBe(true)
    Application.notify({ eventName: Application.suspendEvent })
    Application.notify({ eventName: Application.resumeEvent })
    expect(scene.paused).toBe(true)
    view.notify({ eventName: 'unloaded' })
    expect(await scene).toBe(false)
    view.notify({ eventName: 'loaded' })
    expect(view.listenerCount('unloaded')).toBe(0)
  })
  it('reduces transforms but retains opacity timing', () => {
    configure({ reducedMotion: 'always' })
    const scene = seekableTimeline(
      [
        {
          target: createView(),
          keyframes: { x: [0, 100], opacity: [0, 1] },
          transition: linear,
        },
      ],
      { paused: true },
    )
    scene.progress = 0.4
    expect(driver.last('x').track.valueAt(400)).toBe(100)
    expect(driver.last('opacity').track.valueAt(400)).toBe(0.4)
    scene.stop()
  })
  it.each([
    () => {},
    { run: () => {} },
    { target: null, keyframes: { x: [0, 1] } },
    { keyframes: { x: [0, 1] } },
  ])('rejects unsupported participants before taking ownership: %o', (bad) => {
    const view = createView()
    const old = animate(view, { x: 100 }, linear)
    const first = driver.last('x')
    expect(() =>
      seekableTimeline([
        { target: view, keyframes: { x: [0, 1] } },
        bad as unknown as SeekableStep,
      ]),
    ).toThrow()
    expect(first.stopped).toBe(false)
    old.stop()
  })
  it.each([
    { repeat: Infinity },
    { repeatDelay: [10, 20] },
    { haptic: true },
    { ease: () => 1 },
    { duration: Infinity },
  ])('rejects non-finite or effectful transitions: %o', (transition) => {
    expect(() =>
      seekableTimeline([
        { target: createView(), keyframes: { x: [0, 1] }, transition } as SeekableStep,
      ]),
    ).toThrow()
    expect(driver.played).toHaveLength(0)
  })
  it('rejects duplicate channels, implicit frames and unloaded targets before mutation', () => {
    const view = createView(),
      step = { target: view, keyframes: { x: [0, 1] } }
    expect(() => seekableTimeline([step, { ...step, at: 1000 }])).toThrow(/one track/)
    expect(() =>
      seekableTimeline([
        { target: view, keyframes: { x: [null, 1] } } as unknown as SeekableStep,
      ]),
    ).toThrow(/explicit/)
    view.isLoaded = false
    expect(() => seekableTimeline([step])).toThrow(/loaded/)
    expect(driver.played).toHaveLength(0)
  })
  it('cleans earlier tracks and the failing native owner on setup failure', () => {
    const a = createView(),
      b = createView()
    const original = driver.play.bind(driver)
    const spy = vi.spyOn(driver, 'play').mockImplementation((view, ...rest) => {
      if (view === b) throw new Error('native setup')
      return original(view, ...rest)
    })
    expect(() =>
      seekableTimeline([
        { target: a, keyframes: { x: [0, 1] } },
        { target: b, keyframes: { y: [0, 1] } },
      ]),
    ).toThrow(/native setup/)
    expect(driver.played.every((p) => p.stopped)).toBe(true)
    expect(a.listenerCount('unloaded')).toBe(0)
    expect(b.listenerCount('unloaded')).toBe(0)
    spy.mockRestore()
  })
})
