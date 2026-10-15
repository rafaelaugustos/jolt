import { describe, expect, it } from 'vitest'
import { createTrack } from '../src/track.js'
import { resolveTransition } from '../src/transition.js'
import { animate, decay, sequence, stop } from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'

const linear = { duration: 1000, ease: 'linear' as const }

describe('animation playback', () => {
  it('holds a paused promise, seeks in both directions and continues from that position', async () => {
    const view = createView()
    const animation = animate(view, { x: [0, 100] }, linear)
    driver.advance(200)
    animation.pause()
    expect(animation.paused).toBe(true)
    expect(animation.progress).toBeCloseTo(0.2)
    const result = state(animation.finished)
    driver.advance(2000)
    expect(result()).toBeUndefined()
    expect(animation.progress).toBeCloseTo(0.2)
    animation.progress = 0.8
    animation.progress = 0.4
    expect(driver.last('x').offset).toBe(400)
    expect(animation.progress).toBe(0.4)
    animation.play()
    driver.advance(599)
    await flush()
    expect(result()).toBeUndefined()
    driver.advance(1)
    expect(await animation).toBe(true)
  })
  it('stops and interrupts at the scrubbed value, with zero velocity while paused', async () => {
    const view = createView()
    const first = animate(view, { x: [0, 100], opacity: [1, 0] }, linear)
    first.pause()
    first.progress = 0.4
    const next = animate(
      view,
      { x: 150 },
      { type: 'spring', stiffness: 200, damping: 20 },
    )
    expect(driver.last('x').track.values[0]).toBeCloseTo(40)
    expect(driver.last('x').track.values).toEqual(
      createTrack(
        'x',
        [40, 150],
        resolveTransition({ type: 'spring', stiffness: 200, damping: 20 }, 'x', 2),
        0,
      ).values,
    )
    stop(view, ['opacity'])
    expect(view.opacity).toBeCloseTo(0.6)
    expect(await first).toBe(false)
    next.stop()
  })
  it('includes delays and reverse repeats in finite progress', () => {
    const view = createView()
    const animation = animate(
      view,
      { x: [0, 100] },
      { ...linear, delay: 200, repeat: 1, repeatType: 'reverse' },
    )
    expect(animation.duration).toBe(2200)
    animation.pause()
    animation.progress = 0.5
    stop(view, ['x'])
    expect(view.translateX).toBeCloseTo(90)
  })
  it('allows a paused endpoint to be scrubbed backward before playing', async () => {
    const view = createView()
    const animation = animate(view, { x: [0, 100] }, linear)
    animation.pause()
    animation.progress = 1
    driver.advance(3000)
    expect(state(animation.finished)()).toBeUndefined()
    animation.progress = 0
    animation.play()
    driver.advance(1000)
    expect(await animation).toBe(true)
  })
  it('holds shorter properties until they can be rewound with a longer live track', async () => {
    const view = createView()
    const animation = animate(
      view,
      { x: [0, 100], opacity: [0, 1] },
      { ...linear, opacity: { duration: 200, ease: 'linear' } },
    )
    driver.advance(500)
    animation.pause()
    animation.progress = 0.1
    expect(driver.last('opacity').offset).toBe(100)
    stop(view, ['opacity'])
    expect(view.opacity).toBeCloseTo(0.5)
    animation.stop()
    expect(await animation).toBe(false)
  })
  it('does not reclaim a completed property taken over by another animation', () => {
    const view = createView()
    const first = animate(
      view,
      { x: [0, 100], opacity: [0, 1] },
      { ...linear, opacity: { duration: 200 } },
    )
    driver.advance(400)
    const second = animate(view, { opacity: 0.3 }, linear)
    const owner = driver.last('opacity')
    first.pause()
    first.progress = 0.1
    expect(driver.last('opacity')).toBe(owner)
    expect(owner.stopped).toBe(false)
    first.stop()
    second.stop()
  })
  it('supports pause and a deferred seek before the view loads', async () => {
    const view = createView().unload()
    const animation = animate(view, { x: [0, 100] }, linear)
    animation.pause()
    animation.progress = 0.6
    view.load()
    expect(driver.last('x').held).toBe(true)
    expect(driver.last('x').offset).toBe(600)
    animation.play()
    driver.advance(400)
    expect(await animation).toBe(true)
  })
  it('leaves another animation on the same view running', async () => {
    const view = createView()
    const x = animate(view, { x: [0, 100] }, linear)
    const y = animate(view, { y: [0, 100] }, linear)
    x.pause()
    driver.advance(1000)
    expect(await y).toBe(true)
    expect(x.progress).toBe(0)
    x.stop()
    expect(await x).toBe(false)
  })
  it('rejects invalid or unbounded progress without altering playback', () => {
    const animation = animate(
      createView(),
      { x: [0, 100] },
      { ...linear, repeat: Infinity },
    )
    expect(() => animation.progress).toThrow(/finite/)
    expect(() => {
      animation.progress = 0.4
    }).toThrow(/finite/)
    animation.pause()
    animation.play()
    animation.stop()
    const finite = animate(createView(), { x: 100 }, linear)
    for (const value of [NaN, Infinity, -0.1, 1.1])
      expect(() => {
        finite.progress = value
      }).toThrow(/between/)
    finite.stop()
  })
  it('pauses sequence arrival and resumes the next step at the adjusted time', async () => {
    const view = createView()
    const first = animate(view, { x: [0, 100] }, linear)
    first.pause()
    const timeline = sequence([() => first, [view, { y: [0, 100] }, linear]])
    driver.advance(2000)
    await flush()
    expect(driver.played.some((entry) => entry.track.property === 'y')).toBe(false)
    first.progress = 0.8
    first.play()
    driver.advance(200)
    await flush()
    expect(driver.last('y').track.values[0]).toBe(0)
    driver.advance(1000)
    expect(await timeline).toBe(true)
  })
  it('controls decay without resimulating a new release', async () => {
    const view = createView()
    const animation = decay(view, { x: 800 }, { friction: 0.995 })
    animation.pause()
    animation.progress = 0.4
    const expected = driver.last('x').track.valueAt(animation.duration * 0.4)
    animation.stop()
    expect(view.translateX).toBeCloseTo(expected)
    expect(await animation).toBe(false)
  })
  it('scrubs staggered views on one time range and rewinds shorter children', async () => {
    const views = [createView(), createView()]
    const animation = animate(views, { x: [0, 100] }, { ...linear, stagger: 200 })
    expect(animation.duration).toBe(1200)
    driver.advance(1050)
    animation.pause()
    animation.progress = 0.25
    stop(views)
    expect(views[0]!.translateX).toBeCloseTo(30)
    expect(views[1]!.translateX).toBeCloseTo(10)
    expect(await animation).toBe(false)
  })
  it('keeps stopped and completed animations terminal', async () => {
    const animation = animate(createView(), { x: [0, 100] }, linear)
    animation.pause()
    animation.progress = 0.4
    animation.stop()
    const count = driver.played.length
    animation.play()
    animation.progress = 0.9
    expect(driver.played.length).toBe(count)
    expect(animation.progress).toBe(0.4)
    expect(await animation).toBe(false)
    const done = animate(createView(), { x: [0, 100] }, linear)
    driver.advance(1000)
    expect(await done).toBe(true)
    done.pause()
    done.progress = 0
    expect(done.progress).toBe(1)
  })
  it('defers grouped progress until every target is loaded', async () => {
    const views = [createView().unload(), createView().unload()]
    const animation = animate(views, { x: [0, 100] }, { ...linear, stagger: 200 })
    animation.pause()
    animation.progress = 0.5
    views[0]!.load()
    views[1]!.load()
    expect(driver.last('x', views[0]!).offset).toBe(600)
    expect(driver.last('x', views[1]!).offset).toBe(600)
    animation.stop()
    expect(await animation).toBe(false)
  })
  it('keeps grouped progress on the shared time range if the longest child is interrupted', () => {
    const views = [createView(), createView()]
    const animation = animate(views, { x: [0, 100] }, { ...linear, stagger: 200 })
    driver.advance(400)
    stop(views[1]!)
    expect(animation.progress).toBeCloseTo(1 / 3)
    animation.pause()
    animation.stop()
    expect(animation.progress).toBeCloseTo(1 / 3)
  })
  it('cancels paused ownership and native clocks on unload', async () => {
    const view = createView()
    const animation = animate(view, { x: [0, 100] }, linear)
    animation.pause()
    animation.progress = 0.6
    view.notify({ eventName: 'unloaded', object: view })
    expect(await animation).toBe(false)
    expect(view.translateX).toBeCloseTo(60)
    expect(view.listenerCount('unloaded')).toBe(0)
  })
  it('does not reclaim a completed property overwritten by an instant animation', async () => {
    const view = createView()
    const first = animate(
      view,
      { x: [0, 100], opacity: [0, 1] },
      { ...linear, opacity: { duration: 200 } },
    )
    driver.advance(400)
    await animate(view, { opacity: 1 }, { duration: 0 })
    const count = driver.played.filter(
      (entry) => entry.track.property === 'opacity',
    ).length
    first.pause()
    first.progress = 0.1
    expect(
      driver.played.filter((entry) => entry.track.property === 'opacity'),
    ).toHaveLength(count)
    expect(view.opacity).toBe(1)
    first.stop()
  })
  it('respects a selective stop of a shorter completed property when scrubbing back', () => {
    const view = createView()
    const animation = animate(
      view,
      { x: [0, 100], opacity: [0, 1] },
      { ...linear, opacity: { duration: 200 } },
    )
    driver.advance(400)
    stop(view, ['opacity'])
    animation.pause()
    animation.progress = 0.1
    expect(
      driver.played.filter((entry) => entry.track.property === 'opacity'),
    ).toHaveLength(1)
    expect(view.opacity).toBe(1)
    animation.stop()
  })
})
