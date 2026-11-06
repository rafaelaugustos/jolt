import { describe, it, expect, vi } from 'vitest'
import { animate, configure, timeline, withTimelineCues } from '../src/index.js'
import { createView, driver, flush } from './helpers.js'

describe('timeline cues', () => {
  it('pauses an effect tail after the visual timeline has completed', async () => {
    const effect = createView()
    const scene = withTimelineCues(animate(createView(), { x: 1 }, { duration: 200 }), [
      {
        name: 'tail',
        at: 100,
        effect: () => animate(effect, { x: 100 }, { duration: 500, ease: 'linear' }),
      },
    ])
    driver.advance(100)
    driver.advance(100)
    await flush()
    scene.pause()
    expect(scene.paused).toBe(true)
    let finished = false
    void scene.finished.then(() => {
      finished = true
    })
    driver.advance(2000)
    await flush()
    expect(finished).toBe(false)
    scene.play()
    driver.advance(400)
    expect(await scene.finished).toBe(true)
  })
  it('suppresses cues for initial and live reduced motion', async () => {
    const effect = vi.fn()
    configure({ reducedMotion: 'always' })
    const initial = withTimelineCues(
      animate(createView(), { x: 1 }, { duration: 1000 }),
      [{ name: 'impact', at: 100, effect }],
    )
    await initial.finished
    expect(effect).not.toHaveBeenCalled()
    configure({ reducedMotion: 'never' })
    const live = withTimelineCues(animate(createView(), { x: 1 }, { duration: 1000 }), [
      { name: 'impact', at: 100, effect },
    ])
    configure({ reducedMotion: 'always' })
    driver.advance(1000)
    await live.finished
    expect(effect).not.toHaveBeenCalled()
  })
  it('fires ordered named cues from the timeline clock even while later steps are pending', async () => {
    const events: string[] = [],
      view = createView()
    const scene = withTimelineCues(
      timeline([
        [view, { x: 100 }, { duration: 100 }],
        [view, { y: 100 }, { at: 300, duration: 100 }],
      ]),
      [
        {
          name: 'bite',
          at: 50,
          effect: () => {
            events.push('bite')
          },
        },
        {
          name: 'crumbs',
          at: 50,
          effect: () => {
            events.push('crumbs')
          },
        },
      ],
    )
    driver.advance(50)
    expect(events).toEqual(['bite', 'crumbs'])
    scene.pause()
    driver.advance(1000)
    scene.play()
    driver.advance(250)
    driver.advance(100)
    await flush()
    expect(await scene.finished).toBe(true)
    expect(events).toEqual(['bite', 'crumbs'])
  })
  it('pauses pending markers, cancels active effects and never fires cancelled cues', async () => {
    const view = createView(),
      cleanup = vi.fn(),
      future = vi.fn()
    const scene = withTimelineCues(animate(view, { x: 100 }, { duration: 1000 }), [
      { name: 'sound', at: 100, effect: () => cleanup },
      { name: 'future', at: 800, effect: future },
    ])
    scene.pause()
    driver.advance(2000)
    expect(cleanup).not.toHaveBeenCalled()
    scene.play()
    driver.advance(100)
    scene.stop()
    driver.advance(1000)
    expect(await scene.finished).toBe(false)
    expect(cleanup).toHaveBeenCalledOnce()
    expect(future).not.toHaveBeenCalled()
  })
  it('scrubs without bursts, re-arms future markers on a backward seek and supports explicit reverse passes', async () => {
    const passes: number[] = []
    const scene = withTimelineCues(
      animate(createView(), { x: [0, 1] }, { duration: 1000, ease: 'linear' }),
      [
        {
          name: 'impact',
          at: 100,
          repeat: { every: 400, count: 2, reverse: true },
          effect: ({ pass }) => {
            passes.push(pass)
          },
        },
      ],
    )
    scene.progress = 0.5
    expect(passes).toEqual([])
    driver.advance(200)
    expect(passes).toEqual([1])
    scene.progress = 0
    driver.advance(100)
    expect(passes).toEqual([1, 0])
    scene.stop()
    expect(await scene.finished).toBe(false)
  })
  it('drops late effects by default and isolates effect failures from visual completion', async () => {
    const stale = vi.fn(),
      onError = vi.fn()
    const scene = withTimelineCues(
      animate(createView(), { x: 1 }, { duration: 1000 }),
      [
        { name: 'stale', at: 100, effect: stale },
        {
          name: 'broken',
          at: 600,
          effect: () => {
            throw Error('missing adapter')
          },
        },
      ],
      { onError },
    )
    driver.time += 400 // A blocked runtime: clock advances without delivery.
    driver.advance(0)
    expect(stale).not.toHaveBeenCalled()
    driver.advance(200)
    expect(onError).toHaveBeenCalledOnce()
    driver.advance(400)
    expect(await scene.finished).toBe(true)
  })
  it('supports an explicit catch-up policy and scales markers with the visual clock', async () => {
    configure({ timeScale: 0.5 })
    const effect = vi.fn()
    const scene = withTimelineCues(
      animate(createView(), { x: 1 }, { duration: 1000 }),
      [{ name: 'impact', at: 100, effect }],
      { late: 'catch-up' },
    )
    driver.advance(100)
    expect(effect).not.toHaveBeenCalled()
    driver.time += 200
    driver.advance(0)
    expect(effect).toHaveBeenCalledOnce()
    expect(effect.mock.calls[0]![0]).toMatchObject({ lateBy: 50 })
    scene.stop()
    await scene.finished
  })
  it('waits for finite cue effects and handles stop reentrantly inside an adapter', async () => {
    const effectView = createView(),
      cleanup = vi.fn()
    const scene = withTimelineCues(animate(createView(), { x: 1 }, { duration: 300 }), [
      {
        name: 'particles',
        at: 100,
        effect: () => animate(effectView, { y: 10 }, { duration: 800 }),
      },
    ])
    let settled = false
    void scene.finished.then(() => {
      settled = true
    })
    driver.advance(100)
    driver.advance(200)
    await flush()
    expect(settled).toBe(false)
    scene.stop()
    expect(await scene.finished).toBe(false)
    const second = withTimelineCues(animate(createView(), { x: 1 }, { duration: 300 }), [
      {
        name: 'close',
        at: 100,
        effect: () => {
          second.dispose()
          return cleanup
        },
      },
    ])
    driver.advance(100)
    expect(await second.finished).toBe(false)
    expect(cleanup).toHaveBeenCalledOnce()
  })
})
