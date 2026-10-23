import type { NSVElement } from 'nativescript-vue'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { motionScope, motionValue, set } from '../src/index.js'
import { setGradientPainter, type GradientFrame } from '../src/gradient.js'
import { install, vGradient, type GradientValue } from '../src/vue/index.js'
import { createView } from './helpers.js'

interface Played {
  frames: readonly GradientFrame[]
  duration: number
  cancelled: boolean
}

let painted: GradientFrame[]
let played: Played[]
let removed: number

beforeEach(() => {
  painted = []
  played = []
  removed = 0
  setGradientPainter(() => ({
    paint: (frame) => painted.push(frame),
    play(frames, _times, timing) {
      const entry: Played = { frames, duration: timing.duration, cancelled: false }
      played.push(entry)
      return { cancel: () => (entry.cancelled = true) }
    },
    remove: () => removed++,
  }))
})

afterEach(() => setGradientPainter(undefined))

const red = 0xffff0000
const blue = 0xff0000ff
const element = () => ({ nativeView: createView() }) as unknown as NSVElement
const binding = (value: GradientValue, oldValue: GradientValue | null = null) =>
  ({ value, oldValue, instance: null, modifiers: {}, dir: {} }) as never
const vnode = null as never

describe('v-gradient', () => {
  it('paints on mount and animates to new values with the given transition', () => {
    const el = element()
    const cold: GradientValue = { type: 'linear', colors: ['red', 'blue'] }
    vGradient.mounted!(el, binding(cold), vnode, vnode)
    expect(painted.at(-1)!.colors).toEqual([red, blue])
    expect(played).toHaveLength(0)

    const hot: GradientValue = [
      { type: 'linear', colors: ['blue', 'red'], angle: 90 },
      { duration: 500 },
    ]
    vGradient.updated!(el, binding(hot, cold), vnode, vnode)
    expect(played).toHaveLength(1)
    expect(played[0]!.duration).toBe(500)
    expect(played[0]!.frames.at(-1)!.colors).toEqual([blue, red])
    expect(played[0]!.frames.at(-1)!.angle).toBe(90)

    vGradient.updated!(el, binding(hot, hot), vnode, vnode)
    expect(played).toHaveLength(1)
  })

  it('applies a new color count at once and replaces a new type', () => {
    const el = element()
    const two: GradientValue = { type: 'linear', colors: ['red', 'blue'] }
    vGradient.mounted!(el, binding(two), vnode, vnode)
    const three: GradientValue = { type: 'linear', colors: ['red', 'blue', 'red'] }
    vGradient.updated!(el, binding(three, two), vnode, vnode)
    expect(played).toHaveLength(0)
    expect(painted.at(-1)!.stops).toEqual([0, 0.5, 1])
    expect(removed).toBe(0)

    const radial: GradientValue = { type: 'radial', colors: ['red', 'blue'] }
    vGradient.updated!(el, binding(radial, three), vnode, vnode)
    expect(removed).toBe(1)
    expect(painted.at(-1)!.colors).toEqual([red, blue])

    vGradient.unmounted!(el, binding(radial), vnode, vnode)
    expect(removed).toBe(2)
  })

  it('keeps values opaque, replaces only new directive bindings and removes omitted ones', () => {
    const el = element(),
      value = motionValue(0.2),
      replacement = motionValue(0.5)
    const first: GradientValue = {
      type: 'radial',
      colors: ['red', 'blue'],
      angle: value,
      center: { x: value },
    }
    vGradient.mounted!(el, binding(first), vnode, vnode)
    vGradient.updated!(el, binding({ ...first }, first), vnode, vnode)
    const next: GradientValue = {
      type: 'radial',
      colors: ['red', 'blue'],
      angle: replacement,
    }
    vGradient.updated!(el, binding(next, first), vnode, vnode)
    set(value, 1)
    set(replacement, 0.8)
    expect(painted.at(-1)).toMatchObject({ angle: 0.8, x: 0.2 })
    vGradient.unmounted!(el, binding(next), vnode, vnode)
    const count = painted.length
    set(replacement, 1)
    expect(painted.length).toBe(count)
  })

  it('validates a new type before removing the working bound gradient', () => {
    const el = element(),
      value = motionValue(0.2)
    const first: GradientValue = { type: 'radial', colors: ['red', 'blue'], angle: value }
    vGradient.mounted!(el, binding(first), vnode, vnode)
    expect(() =>
      vGradient.updated!(
        el,
        binding({ type: 'conic', colors: ['red'] }, first),
        vnode,
        vnode,
      ),
    ).toThrow()
    expect(removed).toBe(0)
    set(value, 0.6)
    expect(painted.at(-1)!.angle).toBe(0.6)
    vGradient.unmounted!(el, binding(first), vnode, vnode)
  })

  it('is registered by the plugin', () => {
    const directives: Record<string, unknown> = {}
    install({
      directive: (name: string, directive: unknown) => (directives[name] = directive),
      component: () => {},
    } as never)
    expect(directives.gradient).toBe(vGradient)
  })
})

describe('motionScope().gradient', () => {
  it('removes the gradient with the scope and stops its animation on suspend', () => {
    const scope = motionScope()
    const glow = scope.gradient(createView(), { type: 'linear', colors: ['red', 'blue'] })
    glow.animate({ colors: ['blue', 'red'] }, { duration: 400 })
    scope.suspend()
    expect(played[0]!.cancelled).toBe(true)
    expect(removed).toBe(0)
    scope.resume()
    glow.animate({ angle: 90 })
    scope.dispose()
    expect(removed).toBe(1)
    expect(() => glow.animate({ angle: 0 })).toThrow()
  })

  it('does not resume a gradient that was already suspended manually', () => {
    const scope = motionScope()
    const value = motionValue(0)
    const glow = scope.gradient(createView(), {
      type: 'linear',
      colors: ['red', 'blue'],
      angle: value,
    })
    glow.suspend()
    scope.suspend()
    scope.resume()
    expect(glow.suspended).toBe(true)
    glow.resume()
    expect(glow.suspended).toBe(false)
    scope.dispose()
  })

  it('refuses to start in a disposed scope', () => {
    const scope = motionScope()
    scope.dispose()
    expect(() =>
      scope.gradient(createView(), { type: 'linear', colors: ['red', 'blue'] }),
    ).toThrow()
    expect(painted).toHaveLength(0)
  })
})
