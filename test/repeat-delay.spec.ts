import { describe, expect, it } from 'vitest'
import { animate, configure } from '../src/index.js'
import { createTrack } from '../src/track.js'
import { resolveTransition, type Transition } from '../src/transition.js'
import { createView, driver } from './helpers.js'

const linear = { duration: 100, ease: 'linear' } as const

function track(transition: Transition, keyframes = [0, 100]) {
  return createTrack(
    'x',
    keyframes,
    resolveTransition(transition, 'x', keyframes.length),
    0,
  )
}

function nativeTimesAreValid({ times }: { times: readonly number[] }) {
  expect(times[0]).toBe(0)
  expect(times.at(-1)).toBe(1)
  for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]!)
}

describe('repeatDelay', () => {
  it('holds the end value between finite repeats, with no wait before the first or after the last', () => {
    const result = track({ ...linear, repeat: 2, repeatDelay: 50 })

    expect(result.end).toBe(400)
    expect(result.repeat).toBe(0)
    expect(result.to).toBe(100)
    expect(result.valueAt(50)).toBe(50)
    expect(result.valueAt(100)).toBe(100)
    expect(result.valueAt(140)).toBe(100)
    expect(result.velocityAt(140)).toBe(0)
    expect(result.valueAt(200)).toBe(50)
    expect(result.valueAt(400)).toBe(100)
    nativeTimesAreValid(result)
  })

  it('waits at both ends when reversing', () => {
    const result = track({ ...linear, repeat: 2, repeatType: 'reverse', repeatDelay: 50 })

    expect(result.end).toBe(400)
    expect(result.valueAt(125)).toBe(100)
    expect(result.valueAt(200)).toBe(50)
    expect(result.velocityAt(200)).toBeLessThan(0)
    expect(result.valueAt(275)).toBe(0)
    expect(result.valueAt(350)).toBe(50)
    expect(result.to).toBe(100)
    nativeTimesAreValid(result)
  })

  it('ends at the start after an odd number of reversed repeats', () => {
    const result = track({ ...linear, repeat: 1, repeatType: 'reverse', repeatDelay: 50 })
    expect(result.end).toBe(250)
    expect(result.to).toBe(0)
  })

  it('loops a cycle that waits after each play when repeating forever', () => {
    const result = track({ ...linear, repeat: Infinity, repeatDelay: 50 })

    expect(result.repeat).toBe(Infinity)
    expect(result.duration).toBe(150)
    expect(result.valueAt(50)).toBe(50)
    expect(result.valueAt(120)).toBe(100)
    expect(result.valueAt(175)).toBe(25)
    nativeTimesAreValid(result)
    expect(result.values.at(-1)).toBe(100)
  })

  it('loops there and back with a wait at each end when reversing forever', () => {
    const result = track({
      ...linear,
      repeat: Infinity,
      repeatType: 'reverse',
      repeatDelay: 50,
    })

    expect(result.duration).toBe(300)
    expect(result.reverse).toBe(false)
    expect(result.valueAt(125)).toBe(100)
    expect(result.valueAt(200)).toBe(50)
    expect(result.valueAt(275)).toBe(0)
    expect(result.valueAt(350)).toBe(50)
    expect(result.to).toBe(0)
    nativeTimesAreValid(result)
    expect(result.values.at(-1)).toBe(0)
  })

  it('keeps the shape of springs and multi-keyframe tweens inside each play', () => {
    const tween = track({ duration: 300, repeat: 1, repeatDelay: 100 }, [0, 50, 20])
    const plain = track({ duration: 300 }, [0, 50, 20])
    for (const time of [0, 75, 150, 225, 300])
      expect(tween.valueAt(time + 400)).toBeCloseTo(plain.valueAt(time))

    const spring = track({ type: 'spring', repeat: 1, repeatDelay: 100 })
    const single = track({ type: 'spring' })
    expect(spring.end).toBe(single.end * 2 + 100)
    expect(spring.arrival).toBe(spring.end)
  })

  it('stretches the wait with the time scale', () => {
    configure({ timeScale: 0.5 })
    expect(track({ ...linear, repeat: 1, repeatDelay: 50 }).end).toBe(500)
  })

  it('changes nothing without repeats', () => {
    const waiting = track({ ...linear, repeatDelay: 50 })
    const plain = track(linear)
    expect(waiting.end).toBe(plain.end)
    expect(waiting.values).toEqual(plain.values)
  })

  it('rejects a negative or endless wait', () => {
    for (const repeatDelay of [-1, NaN, Infinity])
      expect(() => track({ ...linear, repeat: 1, repeatDelay })).toThrow(RangeError)
  })

  it('stops during the wait at the held value', async () => {
    const view = createView()
    const animation = animate(
      view,
      { x: [0, 100] },
      { ...linear, repeat: Infinity, repeatDelay: 1000 },
    )

    driver.advance(400)
    animation.stop()

    expect(view.translateX).toBe(100)
    expect(await animation).toBe(false)
  })

  it('applies per property and to colors', () => {
    const view = createView()
    animate(
      view,
      { x: 100, backgroundColor: '#ff0000' },
      { ...linear, repeat: 1, backgroundColor: { repeatDelay: 200 } },
    )

    expect(driver.last('x').track.end).toBe(200)
    const color = driver.last('backgroundColor').track
    expect(color.end).toBe(400)
    expect(color.valueAt(150)).toBe(color.valueAt(100))
  })
})

describe('repeatDelay ranges', () => {
  /** The pauses a track holds for, in order, from its sampled keyframes. */
  function pauses(result: ReturnType<typeof track>) {
    const total = result.end === Infinity ? result.duration : result.end
    const held: number[] = []
    for (let i = 1; i < result.times.length; i++) {
      const span = (result.times[i]! - result.times[i - 1]!) * total
      if (result.values[i] === result.values[i - 1] && span > 1) held.push(span)
    }
    return held
  }

  it('draws a new pause within the range before each finite repeat', () => {
    const result = track({ ...linear, repeat: 5, repeatDelay: [200, 600] })
    const drawn = pauses(result)
    expect(drawn).toHaveLength(5)
    for (const pause of drawn) {
      expect(pause).toBeGreaterThanOrEqual(199)
      expect(pause).toBeLessThanOrEqual(601)
    }
    expect(new Set(drawn.map(Math.round)).size).toBeGreaterThan(1)
    // Each hold hands over to the next play 1 ms before it ends.
    const held = drawn.reduce((a, b) => a + b, 0)
    expect(result.end - (600 + held)).toBeCloseTo(drawn.length, 5)
    expect(result.to).toBe(100)
    nativeTimesAreValid(result)
  })

  it('loops sixteen drawn cycles natively when repeating forever', () => {
    const result = track({ ...linear, repeat: Infinity, repeatDelay: [200, 600] })
    expect(result.repeat).toBe(Infinity)
    const drawn = pauses(result)
    expect(drawn.length).toBeGreaterThanOrEqual(15)
    expect(new Set(drawn.map(Math.round)).size).toBeGreaterThan(8)
    expect(result.duration).toBeGreaterThan(16 * (100 + 200))
    expect(result.duration).toBeLessThan(16 * (100 + 600))
    nativeTimesAreValid(result)

    const reversed = track({
      ...linear,
      repeat: Infinity,
      repeatType: 'reverse',
      repeatDelay: [200, 600],
    })
    expect(reversed.values[0]).toBe(0)
    expect(reversed.values.at(-1)).toBe(0)
    expect(reversed.values).toContain(100)
  })

  it('shares the drawn pauses between the properties of one animation', () => {
    const view = createView()
    animate(
      view,
      { scale: [1, 0.2, 1], opacity: [1, 0.4, 1] },
      { ...linear, repeat: Infinity, repeatDelay: [500, 3000] },
    )
    const scaleX = driver.last('scaleX').track
    const scaleY = driver.last('scaleY').track
    const opacity = driver.last('opacity').track
    expect(scaleY.times).toEqual(scaleX.times)
    expect(opacity.duration).toBe(scaleX.duration)

    const other = createView()
    animate(
      other,
      { scale: [1, 0.2, 1] },
      { ...linear, repeat: Infinity, repeatDelay: [500, 3000] },
    )
    expect(driver.last('scaleX', other).track.duration).not.toBe(scaleX.duration)

    const [left, right] = [createView(), createView()]
    animate(
      [left, right],
      { scaleY: [1, 0.1, 1] },
      { ...linear, repeat: Infinity, repeatDelay: [500, 3000] },
    )
    expect(driver.last('scaleY', right).track.times).toEqual(
      driver.last('scaleY', left).track.times,
    )
  })

  it('treats an even range like a fixed wait and rejects bad ranges', () => {
    const even = track({ ...linear, repeat: 2, repeatDelay: [50, 50] })
    expect(even.end).toBe(400)
    for (const repeatDelay of [[600, 200], [-1, 5], [1], [0, Infinity]])
      expect(() =>
        track({ ...linear, repeat: 2, repeatDelay: repeatDelay as never }),
      ).toThrow('Invalid repeat delay')
  })
})
