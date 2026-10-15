import { describe, expect, it } from 'vitest'
import {
  animate,
  decay,
  sequence,
  stop,
  type Animation,
  type PlaybackAnimation,
  type SequencePosition,
} from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'

const linear = { duration: 1000, ease: 'linear' as const }

describe('sequence positions', () => {
  it('overlaps a step before the previous arrival and starts < in the same turn', async () => {
    const a = createView(),
      b = createView(),
      c = createView()
    const animation = sequence([
      [a, { x: [0, 100] }, linear],
      [b, { y: [0, 100] }, { ...linear, at: '-150' }],
      [c, { opacity: [0, 1] }, { ...linear, at: '<' }],
    ])
    await flush()
    driver.advance(849)
    expect(driver.played).toHaveLength(1)
    driver.advance(1)
    expect(driver.played.map((p) => p.view)).toEqual([a, b, c])
    expect(driver.last('y').startedAt).toBe(driver.last('opacity').startedAt)
    driver.advance(150)
    await flush()
    expect(state(animation.finished)()).toBeUndefined()
    driver.advance(850)
    expect(await animation).toBe(true)
  })

  it('uses spring arrival rather than the full settling duration', async () => {
    const a = createView(),
      b = createView()
    const animation = sequence([
      [a, { x: 100 }, 'bouncy'],
      [b, 'fadeIn', { duration: 100, at: '-150' }],
    ])
    const track = driver.last('x').track
    expect(track.arrival).toBeLessThan(track.end)
    await flush()
    driver.advance(track.arrival - 151)
    expect(driver.played).toHaveLength(1)
    driver.advance(1)
    expect(driver.last('opacity').view).toBe(b)
    animation.stop()
    expect(await animation).toBe(false)
  })

  it('includes per-property delay and the last staggered arrival', async () => {
    const rows = [createView(), createView(), createView()]
    const title = createView()
    const animation = sequence([
      [
        rows,
        { x: [0, 100], opacity: [0, 1] },
        { ...linear, delay: 200, stagger: 100, opacity: { duration: 200 } },
      ],
      [title, 'fadeIn', { duration: 100, at: '-150' }],
    ])
    await flush()
    const arrival = Math.max(...driver.played.map((p) => p.track.arrival))
    expect(arrival).toBe(1400)
    driver.advance(arrival - 151)
    expect(driver.played).toHaveLength(6)
    driver.advance(1)
    expect(driver.last('opacity').view).toBe(title)
    animation.stop()
    expect(await animation).toBe(false)
  })

  it('starts absolute positions independently, including out of list order', async () => {
    const a = createView(),
      b = createView(),
      c = createView()
    const animation = sequence([
      [a, { x: [0, 100] }, { ...linear, at: 500 }],
      [b, { x: [0, 100] }, { duration: 100, at: 100 }],
      [c, { x: [0, 100] }, { duration: 100 }],
    ])
    expect(driver.played).toHaveLength(0)
    driver.advance(100)
    expect(driver.last('x').view).toBe(b)
    driver.advance(100)
    await flush()
    expect(driver.last('x').view).toBe(c)
    driver.advance(300)
    expect(driver.last('x').view).toBe(a)
    driver.advance(1000)
    expect(await animation).toBe(true)
  })

  it('anchors < to step activation, with its own delay added afterward', async () => {
    const a = createView(),
      b = createView(),
      c = createView()
    const animation = sequence([
      [a, 'fadeIn', { duration: 100, delay: 200, at: 300 }],
      [b, 'fadeIn', { duration: 100, delay: 50, at: '<' }],
      [c, 'fadeIn', { duration: 100, at: '<' }],
    ])
    driver.advance(300)
    await flush()
    expect(driver.played.map((p) => p.startedAt)).toEqual([1300, 1300, 1300])
    expect(driver.played.map((p) => p.track.delay)).toEqual([200, 50, 0])
    animation.stop()
    expect(await animation).toBe(false)
  })

  it('waits for every overlapping arrival when used as a nested step', async () => {
    const a = createView(),
      b = createView(),
      c = createView()
    const animation = sequence([
      () =>
        sequence([
          [a, { x: [0, 100] }, linear],
          [b, 'fadeIn', { duration: 100, at: 0 }],
        ]),
      [c, 'fadeIn', { duration: 100 }],
    ])
    driver.advance(100)
    await flush()
    expect(driver.played.some((p) => p.view === c)).toBe(false)
    driver.advance(900)
    await flush()
    expect(driver.played.some((p) => p.view === c)).toBe(true)
    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('uses actual interrupted arrival for a positive offset', async () => {
    const a = createView(),
      b = createView()
    const animation = sequence([
      [a, { x: 100 }, linear],
      [b, 'fadeIn', { duration: 100, at: '+150' }],
    ])
    driver.advance(200)
    stop(a)
    await flush()
    driver.advance(149)
    expect(driver.played).toHaveLength(1)
    driver.advance(1)
    expect(driver.last('opacity').view).toBe(b)
    driver.advance(100)
    expect(await animation).toBe(false)
  })

  it('advances a negative follower after interruption without reentrant ownership changes', async () => {
    const a = createView(),
      b = createView()
    const animation = sequence([
      [a, { x: 100 }, linear],
      [b, 'fadeIn', { duration: 100, at: '-150' }],
    ])
    await flush()
    driver.advance(200)
    const replacement = animate(a, { x: 200 }, linear)
    expect(driver.last('x').track.values[0]).toBeCloseTo(20)
    expect(driver.played).toHaveLength(2)
    await flush()
    expect(driver.last('opacity').view).toBe(b)
    driver.advance(1200)
    expect(await animation).toBe(false)
    expect(await replacement).toBe(true)
    expect(driver.played).toHaveLength(3)
  })

  it('waits for loaded tracks before predicting their arrival', async () => {
    const a = createView(),
      b = createView()
    a.isLoaded = false
    const animation = sequence([
      [a, 'fadeIn', linear],
      [b, 'fadeIn', { duration: 100, at: '-100' }],
    ])
    driver.advance(400)
    await flush()
    expect(driver.played).toHaveLength(0)
    a.load()
    await flush()
    driver.advance(899)
    expect(driver.played).toHaveLength(1)
    driver.advance(1)
    expect(driver.last('opacity').view).toBe(b)
    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('keeps later views hidden and reads null values at the overlapping start', async () => {
    const a = createView(),
      b = createView()
    const animation = sequence([
      [a, { x: [0, 100] }, linear],
      [a, { x: [null, 200] }, { ...linear, at: '-600' }],
      [b, 'fadeIn', { duration: 100, at: 1500 }],
    ])
    expect(b.opacity).toBe(0)
    await flush()
    driver.advance(400)
    expect(driver.last('x').track.values[0]).toBeCloseTo(40)
    driver.advance(1100)
    driver.advance(100)
    expect(await animation).toBe(false)
  })

  it('cancels all overlapping and future steps on stop', async () => {
    const a = createView(),
      b = createView(),
      c = createView()
    const animation = sequence([
      [a, 'fadeIn', linear],
      [b, 'fadeIn', { ...linear, at: '<' }],
      [c, 'fadeIn', { ...linear, at: 5000 }],
    ])
    animation.stop()
    animation.stop()
    expect(await animation).toBe(false)
    expect(driver.played).toHaveLength(2)
    expect(driver.played.every((p) => p.stopped)).toBe(true)
    driver.advance(10000)
    await flush()
    expect(driver.played).toHaveLength(2)
  })

  it('can stop before the first absolute step starts', async () => {
    const a = createView()
    const animation = sequence([[a, 'fadeIn', { duration: 100, at: 500 }]])
    animation.stop()
    expect(await animation).toBe(false)
    driver.advance(1000)
    expect(driver.played).toHaveLength(0)
  })

  it.each(['<', '-500', '+0', 0] as const)(
    'anchors first position %s to the sequence origin',
    async (at) => {
      const animation = sequence([[createView(), 'fadeIn', { duration: 100, at }]])
      expect(driver.played).toHaveLength(1)
      driver.advance(100)
      expect(await animation).toBe(true)
    },
  )

  it('supports positive and fractional offsets on the first step', async () => {
    const animation = sequence([[createView(), 'fadeIn', { duration: 100, at: '+12.5' }]])
    driver.advance(12)
    expect(driver.played).toHaveLength(0)
    driver.advance(0.5)
    expect(driver.played).toHaveLength(1)
    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('clamps an overlap that precedes the previous activation to that activation', async () => {
    const animation = sequence([
      [createView(), 'fadeIn', { duration: 100, at: 500 }],
      [createView(), 'fadeIn', { duration: 100, at: '-300' }],
    ])
    driver.advance(499)
    expect(driver.played).toHaveLength(0)
    driver.advance(1)
    await flush()
    expect(driver.played).toHaveLength(2)
    expect(driver.played.map((p) => p.startedAt)).toEqual([1500, 1500])
    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('reschedules a forecastable callback across pause, seek and play', async () => {
    let child!: PlaybackAnimation
    const animation = sequence([
      () => (child = animate(createView(), { x: [0, 100] }, linear)),
      [createView(), 'fadeIn', { duration: 100, at: '-100' }],
    ])
    await flush()
    driver.advance(200)
    child.pause()
    await flush()
    driver.advance(2000)
    expect(driver.played).toHaveLength(1)
    child.progress = 0.5
    child.play()
    await flush()
    driver.advance(399)
    expect(driver.played).toHaveLength(1)
    driver.advance(1)
    expect(driver.played).toHaveLength(2)
    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('reschedules the last staggered arrival after a paused group seek', async () => {
    let child!: PlaybackAnimation
    const animation = sequence([
      () =>
        (child = animate(
          [createView(), createView()],
          { x: [0, 100] },
          { ...linear, stagger: 200 },
        )),
      [createView(), 'fadeIn', { duration: 100, at: '-100' }],
    ])
    driver.advance(200)
    child.pause()
    child.progress = 0.5
    await flush()
    driver.advance(2000)
    expect(driver.played).toHaveLength(2)
    child.play()
    await flush()
    driver.advance(499)
    expect(driver.played).toHaveLength(2)
    driver.advance(1)
    expect(driver.played).toHaveLength(3)
    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('waits for every staggered target to load before forecasting the group', async () => {
    const a = createView(),
      b = createView()
    a.isLoaded = b.isLoaded = false
    const animation = sequence([
      [[a, b], 'fadeIn', { ...linear, stagger: 100 }],
      [createView(), 'fadeIn', { duration: 100, at: '-100' }],
    ])
    a.load()
    driver.advance(300)
    await flush()
    expect(driver.played).toHaveLength(1)
    b.load()
    await flush()
    driver.advance(999)
    expect(driver.played).toHaveLength(2)
    driver.advance(1)
    expect(driver.played).toHaveLength(3)
    driver.advance(100)
    expect(await animation).toBe(true)
  })

  it('captures relative values at activation during an overlapping property takeover', async () => {
    const view = createView()
    const animation = sequence([
      [view, { x: [0, 100] }, linear],
      [view, { x: 10 }, { ...linear, relative: true, at: '-700' }],
    ])
    driver.advance(300)
    expect(driver.last('x').track.values[0]).toBeCloseTo(30)
    expect(driver.last('x').track.to).toBeCloseTo(40)
    driver.advance(1000)
    expect(await animation).toBe(false)
  })

  it('does not revive a queued forecast update after stop', async () => {
    let child!: PlaybackAnimation
    const animation = sequence([
      () => (child = animate(createView(), { x: 100 }, linear)),
      [createView(), 'fadeIn', { at: '-100' }],
    ])
    child.pause()
    animation.stop()
    await flush()
    driver.advance(5000)
    expect(await animation).toBe(false)
    expect(driver.played).toHaveLength(1)
  })

  it('waits for an endless predecessor to be interrupted, while absolute steps stay independent', async () => {
    const a = createView(),
      b = createView(),
      c = createView()
    const animation = sequence([
      [a, { x: [0, 100] }, { ...linear, repeat: Infinity }],
      [b, 'fadeIn', { duration: 100, at: '-100' }],
      [c, 'fadeIn', { duration: 100, at: 200 }],
    ])
    await flush()
    driver.advance(200)
    expect(driver.last('opacity').view).toBe(c)
    stop(a)
    await flush()
    expect(driver.last('opacity').view).toBe(b)
    driver.advance(100)
    expect(await animation).toBe(false)
  })

  it('can anticipate a decay returned by a callback', async () => {
    const a = createView(),
      b = createView()
    const animation = sequence([
      () => decay(a, { x: 1000 }),
      [b, 'fadeIn', { duration: 100, at: '-100' }],
    ])
    await flush()
    const arrival = driver.last('x').track.arrival
    driver.advance(arrival - 101)
    expect(driver.played).toHaveLength(1)
    driver.advance(1)
    expect(driver.played).toHaveLength(2)
    animation.stop()
    expect(await animation).toBe(false)
  })

  it('reports missing forecasts on callback effects and cancels future work', async () => {
    let resolve!: (value: boolean) => void
    const finished = new Promise<boolean>((r) => (resolve = r))
    const effect: Animation = {
      finished,
      stop: () => resolve(false),
      then: (a, b) => finished.then(a, b),
    }
    const animation = sequence([
      () => effect,
      [createView(), 'fadeIn', { at: '-100' }],
      [createView(), 'fadeIn', { at: 500 }],
    ])
    await expect(animation.finished).rejects.toThrow(/arrival forecast/)
    expect(await effect).toBe(false)
    driver.advance(1000)
    expect(driver.played).toHaveLength(0)
  })

  it('propagates nested setup errors without leaving relative followers pending', async () => {
    const animation = sequence([
      () =>
        sequence([
          () => {
            throw new Error('Failed to create a step')
          },
        ]),
      [createView(), 'fadeIn', { at: '+100' }],
      [createView(), 'fadeIn', { at: 500 }],
    ])
    await expect(animation.finished).rejects.toThrow('Failed to create a step')
    driver.advance(1000)
    expect(driver.played).toHaveLength(0)
  })

  it('stops overlapping steps when a nested callback fails', async () => {
    const animation = sequence([
      () =>
        sequence([
          () => {
            throw new Error('Nested setup failure')
          },
        ]),
      [createView(), 'fadeIn', { ...linear, at: '<' }],
    ])
    await expect(animation.finished).rejects.toThrow('Nested setup failure')
    expect(driver.played).toHaveLength(1)
    expect(driver.played[0]!.stopped).toBe(true)
  })

  it.each([-1, NaN, Infinity, '150', '+', '-Infinity', '+=150', 'label', ' +10', '0x20'])(
    'validates position %s before applying any first keyframe',
    (at) => {
      const a = createView()
      a.opacity = 0.7
      expect(() => sequence([[a, 'fadeIn', { at: at as SequencePosition }]])).toThrow(
        /Sequence at/,
      )
      expect(a.opacity).toBe(0.7)
      expect(driver.played).toHaveLength(0)
    },
  )

  it('does not mutate caller options and accepts empty steps', async () => {
    const options = Object.freeze({ duration: 100, at: '<', ease: 'linear' } as const)
    const animation = sequence([
      [createView(), 'fadeIn', options],
      [[], 'fadeIn', { at: '-50' }],
    ])
    await flush()
    driver.advance(100)
    expect(await animation).toBe(true)
    expect(options.at).toBe('<')
    expect(await sequence([])).toBe(true)
  })
})
