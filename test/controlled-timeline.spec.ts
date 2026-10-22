import { describe, expect, it } from 'vitest'
import {
  animate,
  motionScope,
  motionValue,
  playbackProgress,
  timeline,
  type TimelineStep,
  type PlaybackAnimation,
} from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'

const linear = { duration: 1000, ease: 'linear' as const }

describe('controllable timelines', () => {
  it('pauses a path/view, scalar layers and pending absolute launches together', async () => {
    const car = createView(),
      effect = createView(),
      value = motionValue(0)
    const scene = timeline([
      [car, { x: 100 }, linear],
      [value, 100, { ...linear, at: '<' }],
      [value, 20, { ...linear, at: '<', layer: 'pulse' }],
      [effect, { opacity: [0, 1] }, { ...linear, at: 500 }],
    ])
    expect(scene.duration).toBeUndefined()
    driver.advance(200)
    scene.pause()
    scene.pause()
    driver.advance(1000)
    expect(value.get()).toBeCloseTo(24)
    expect(driver.played.filter((p) => p.view === effect)).toHaveLength(0)
    scene.play()
    scene.play()
    driver.advance(299)
    expect(driver.played.filter((p) => p.view === effect)).toHaveLength(0)
    driver.advance(1)
    expect(driver.played.filter((p) => p.view === effect)).toHaveLength(1)
    expect(scene.duration).toBe(1500)
    const progress = playbackProgress(scene)
    expect(progress.get()).toBeCloseTo(1 / 3)
    driver.advance(1000)
    await expect(scene.finished).resolves.toBe(true)
    expect(progress.get()).toBe(1)
  })

  it('holds positive gaps and negative-overlap followers', async () => {
    const a = createView(),
      b = createView(),
      c = createView()
    const scene = timeline([
      [a, { x: 100 }, linear],
      [b, { x: 100 }, { ...linear, at: '-200' }],
      [c, { x: 100 }, { ...linear, at: '+300' }],
    ])
    driver.advance(500)
    scene.pause()
    await flush()
    driver.advance(1000)
    expect(driver.played.filter((p) => p.view === b)).toHaveLength(0)
    scene.play()
    await flush()
    driver.advance(300)
    expect(driver.played.filter((p) => p.view === b)).toHaveLength(1)
    driver.advance(1000)
    await flush()
    scene.pause()
    driver.advance(1000)
    expect(driver.played.filter((p) => p.view === c)).toHaveLength(0)
    scene.play()
    driver.advance(300)
    expect(driver.played.filter((p) => p.view === c)).toHaveLength(1)
    scene.stop()
    await expect(scene.finished).resolves.toBe(false)
  })

  it('can pause before any step starts and stop while paused', async () => {
    const view = createView()
    const scene = timeline([[view, { x: 100 }, { ...linear, at: 100 }]])
    scene.pause()
    driver.advance(1000)
    expect(driver.played).toHaveLength(0)
    scene.stop()
    scene.play()
    driver.advance(1000)
    await expect(scene.finished).resolves.toBe(false)
    expect(driver.played).toHaveLength(0)
  })

  it('rejects non-playable callback effects and cleans active and future work', async () => {
    const view = createView()
    let cancelled = false
    const bad = () => ({
      finished: Promise.resolve(true),
      stop() {
        cancelled = true
      },
      then: Promise.resolve(true).then.bind(Promise.resolve(true)),
    })
    const scene = timeline([
      [view, { x: 100 }, linear],
      { at: 100, run: bad },
      [createView(), { x: 100 }, { ...linear, at: 600 }],
    ] as unknown as TimelineStep[])
    const rejection = expect(scene.finished).rejects.toThrow(/pause/)
    driver.advance(100)
    await rejection
    expect(cancelled).toBe(true)
    expect(driver.played.every((p) => p.stopped)).toBe(true)
    driver.advance(1000)
    expect(driver.played).toHaveLength(1)
  })

  it('preserves independently paused children and owns nested timelines', async () => {
    let child!: PlaybackAnimation
    const scene = timeline([
      () => {
        child = animate(createView(), { x: 100 }, linear)
        child.pause()
        return child
      },
      { at: 0, run: () => timeline([[createView(), { x: 100 }, linear]]) },
    ])
    scene.pause()
    driver.advance(100)
    scene.play()
    expect(child.paused).toBe(true)
    scene.stop()
    await expect(scene.finished).resolves.toBe(false)
  })

  it('is owned by a scope and does not complete during a pause', async () => {
    const scope = motionScope()
    const scene = scope.timeline([[createView(), { x: 100 }, linear]])
    const done = state(scene.finished)
    driver.advance(900)
    scope.suspend()
    driver.advance(1000)
    await flush()
    expect(done()).toBeUndefined()
    scope.resume()
    driver.advance(100)
    await expect(scene.finished).resolves.toBe(true)
    scope.dispose()
  })
})
