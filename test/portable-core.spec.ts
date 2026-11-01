import { afterEach, describe, expect, it } from 'vitest'
import { configure } from '../src/config.js'
import { createTrack as nativeTrack } from '../src/track.js'
import {
  createTrack,
  createClock,
  createOwnership,
  resolveTransition,
} from '../src/core/index.js'
import { isBuiltinEasing, linear } from '../src/core/easing.js'
import { linear as nativeLinear } from '../src/easing.js'
import baseline from './fixtures/portable-motion-baseline.json'
import { motionCases } from './fixtures/portable-motion-cases.js'
import { describeTrack } from './fixtures/describe-track.mjs'

afterEach(() => configure({ timeScale: 1, reducedMotion: 'user' }))

describe('portable compilation preserves the pre-extraction native tracks', () => {
  for (const item of motionCases) {
    it(item.name, () => {
      const expected = baseline.cases[item.name as keyof typeof baseline.cases]
      expect(expected).toBeDefined()
      const portable = createTrack(
        item.property,
        item.frames,
        item.transition,
        item.velocity,
        item,
      )
      configure({
        timeScale: item.timeScale,
        reducedMotion: item.reducedMotion ? 'always' : 'never',
      })
      const native = nativeTrack(
        item.property,
        item.frames,
        item.transition,
        item.velocity,
      )
      expect(describeTrack(portable)).toEqual(expected)
      expect(describeTrack(native)).toEqual(expected)
    })
  }

  it('keeps builtin easing identity across the native and portable imports', () => {
    expect(nativeLinear).toBe(linear)
    expect(isBuiltinEasing(nativeLinear)).toBe(true)
  })

  it('does not share settings between compilations or consult native configuration', () => {
    const transition = resolveTransition({ type: 'spring' }, 'x', 2)
    const options = { timeScale: 1, reducedMotion: false }
    const regular = createTrack('x', [0, 300], transition, 700, options)
    const initial = describeTrack(regular)
    options.timeScale = 4
    options.reducedMotion = true
    configure({ timeScale: 0.1, reducedMotion: 'always' })
    const slow = createTrack('x', [0, 300], transition, 700, {
      timeScale: 0.5,
      reducedMotion: false,
    })
    const reduced = createTrack('x', [0, 300], transition, 700, options)
    expect(slow.duration).toBeGreaterThan(regular.duration)
    // The existing solver estimates velocity with a finite difference.
    expect(slow.velocityAt(0)).toBeCloseTo(700, 1)
    expect(reduced.end).toBe(0)
    expect(reduced.to).toBe(300)
    expect(describeTrack(regular)).toEqual(initial)
  })

  it.each([0, -1, NaN, Infinity])(
    'rejects an invalid explicit timeScale: %s',
    (timeScale) => {
      expect(() =>
        createTrack('x', [0, 1], resolveTransition({}, 'x', 2), 0, {
          timeScale,
          reducedMotion: false,
        }),
      ).toThrow(RangeError)
    },
  )
})

describe('portable playback clock', () => {
  it('preserves local time through repeated pause/play and seek, independently per clock', () => {
    let now = 1000
    const first = createClock(() => now)
    const second = createClock(() => now, 50)
    now += 120
    first.pause()
    first.pause()
    now += 80
    expect(first.time()).toBe(120)
    expect(second.time()).toBe(250)
    first.seek(500)
    now += 30
    expect(first.time()).toBe(500)
    first.play()
    first.play()
    now += 70
    expect(first.time()).toBe(570)
    first.seek(40)
    now += 20
    expect(first.time()).toBe(60)
    first.cancel()
    now += 500
    expect(first.time()).toBe(60)
    expect(second.time()).toBe(870)
  })
})

describe('portable property ownership', () => {
  it('invalidates stale cleanup only for the replaced channel', () => {
    const registry = createOwnership<object, 'x' | 'scaleX'>()
    const target = {}
    const x = registry.claim(target, 'x')
    const scale = registry.claim(target, 'scaleX')
    const newer = registry.claim(target, 'x')
    expect(registry.get(target, 'x')).not.toBe(x)
    expect(registry.get(target, 'x')).toBe(newer)
    expect(registry.get(target, 'scaleX')).toBe(scale)
    registry.invalidate(target, ['x'])
    expect(registry.get(target, 'x')).not.toBe(newer)
    expect(registry.get(target, 'scaleX')).toBe(scale)
    registry.invalidate(target)
    expect(registry.get(target, 'scaleX')).not.toBe(scale)
  })

  it('isolates targets and registries, including a shared target in two contexts', () => {
    const first = createOwnership<object, 'x'>()
    const second = createOwnership<object, 'x'>()
    const target = {},
      other = {}
    expect(first.get(target, 'x')).toBeUndefined()
    const token = first.claim(target, 'x')
    const otherToken = first.claim(other, 'x')
    const secondToken = second.claim(target, 'x')
    second.invalidate(target)
    expect(second.get(target, 'x')).not.toBe(secondToken)
    expect(first.get(target, 'x')).toBe(token)
    first.invalidate(target)
    expect(first.get(other, 'x')).toBe(otherToken)
  })
})
