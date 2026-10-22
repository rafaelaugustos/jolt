import { describe, expect, it } from 'vitest'
import {
  animate,
  motionScope,
  motionStates,
  type MotionStatesOptions,
} from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'

describe('motion states', () => {
  it('coordinates multiple targets and settles only when all finish', async () => {
    const icon = createView(),
      label = createView()
    const control = motionStates(
      { icon, label },
      {
        idle: { icon: { scale: 1 }, label: { opacity: 1 } },
        sending: { icon: { scale: 0.8 }, label: { opacity: 0 } },
      },
    )
    const handle = control.to('sending'),
      result = state(handle.finished)
    expect(control.current).toBe('sending')
    expect(control.settled).toBeUndefined()
    driver.advance(50)
    await flush()
    expect(result()).toBeUndefined()
    driver.advance(10000)
    expect(await handle).toBe(true)
    expect(control.settled).toBe('sending')
    control.dispose()
  })
  it('transfers position and velocity before cancelling the superseded transition', async () => {
    const view = createView()
    const control = motionStates(
      { view },
      { right: { view: { x: 200 } }, left: { view: { x: -80 } } },
    )
    const first = control.to('right')
    const old = driver.last('x')
    driver.advance(100)
    const value = old.track.valueAt(100),
      velocity = old.track.velocityAt(100)
    const second = control.to('left')
    const next = driver.last('x')
    expect(next.track.valueAt(0)).toBeCloseTo(value)
    expect(next.track.velocityAt(0.01)).toBeCloseTo(velocity, -1)
    expect(await first).toBe(false)
    driver.advance(10000)
    expect(await second).toBe(true)
    expect(control.settled).toBe('left')
  })
  it('freezes omitted old properties and leaves external animation owners alone', async () => {
    const view = createView()
    const control = motionStates(
      { view },
      { a: { view: { x: 100, y: 200 } }, b: { view: { x: 0 } } },
    )
    const a = control.to('a')
    driver.advance(100)
    const expectedY = driver.last('y').track.valueAt(100)
    const outside = animate(view, { opacity: 0 })
    const b = control.to('b')
    expect(await a).toBe(false)
    expect(view.translateY).toBeCloseTo(expectedY)
    expect(driver.last('opacity').stopped).toBe(false)
    control.dispose()
    expect(await b).toBe(false)
    driver.advance(10000)
    expect(await outside).toBe(true)
  })
  it('invalid definitions or transitions never cancel existing ownership', () => {
    const view = createView()
    const active = animate(view, { x: 100 })
    expect(() =>
      motionStates({ view }, { bad: { view: { x: [0, 1] } } } as never),
    ).toThrow(/endpoint/)
    expect(() => motionStates({ view }, { bad: { other: { x: 2 } } } as never)).toThrow(
      /target/,
    )
    expect(() => motionStates({ view, duplicate: view }, { a: {} })).toThrow(/distinct/)
    const control = motionStates({ view }, { a: { view: { x: 20 } } })
    expect(() => control.to('unknown' as never)).toThrow(/Unknown/)
    expect(() => control.to('a', { repeat: Infinity } as never)).toThrow(/repeat/)
    expect(driver.last('x').stopped).toBe(false)
    active.stop()
    control.dispose()
  })
  it('cancels stale immediate reduced-motion completions during rapid requests', async () => {
    driver.reduced = true
    const view = createView()
    const control = motionStates(
      { view },
      { a: { view: { x: 100 } }, b: { view: { x: 0 } } },
    )
    const first = control.to('a'),
      second = control.to('b')
    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(control.current).toBe('b')
    expect(control.settled).toBe('b')
    expect(view.translateX).toBe(0)
  })
  it('disposes pending unloaded work and prevents future transitions', async () => {
    const view = createView()
    view.unload()
    const scope = motionScope()
    const control = scope.states({ view }, { a: { view: { x: 100 } } })
    const result = control.to('a')
    scope.dispose()
    expect(await result).toBe(false)
    expect(view.listenerCount('loaded')).toBe(0)
    view.load()
    expect(driver.played).toHaveLength(0)
    expect(() => control.to('a')).toThrow(/disposed/)
  })
  it('pauses through its owning scope and preserves paused state through retargeting', async () => {
    const view = createView(),
      scope = motionScope()
    const control = motionStates(
      { view },
      { a: { view: { x: 100 } }, b: { view: { x: 200 } } },
      { scope, transition: { duration: 1000 } },
    )
    const a = control.to('a')
    driver.advance(200)
    scope.suspend()
    expect(control.paused).toBe(true)
    const b = control.to('b')
    expect(await a).toBe(false)
    expect(driver.last('x').held).toBe(true)
    driver.advance(10000)
    scope.resume()
    driver.advance(1000)
    expect(await b).toBe(true)
    scope.dispose()
  })
  it('copies numeric definitions and safely disposes after outside replacement', async () => {
    const view = createView(),
      definitions = { a: { view: { x: 100 } } }
    const control = motionStates({ view }, definitions)
    definitions.a.view.x = 999
    const a = control.to('a')
    expect(driver.last('x').track.to).toBe(100)
    const outside = animate(view, { x: 200 })
    control.dispose()
    control.dispose()
    expect(await a).toBe(false)
    expect(driver.last('x').stopped).toBe(false)
    driver.advance(10000)
    expect(await outside).toBe(true)
  })
  it('supports an empty state that cancels the previous pose without new tracks', async () => {
    const view = createView()
    const control = motionStates({ view }, { a: { view: { x: 100 } }, hold: {} })
    const a = control.to('a')
    driver.advance(80)
    const expected = driver.last('x').track.valueAt(80)
    expect(await control.to('hold')).toBe(true)
    expect(await a).toBe(false)
    expect(view.translateX).toBeCloseTo(expected)
  })
})

describe('motion states with recreated views', () => {
  const definitions = {
    hidden: { logo: { opacity: 0, scale: 0.8 } },
    shown: { logo: { opacity: 1, scale: 1 } },
  }

  it('starts without a view and gives the current state to the one that arrives', async () => {
    const control = motionStates({ logo: null }, definitions)
    expect(await control.to('shown')).toBe(true)
    expect(control.settled).toBe('shown')

    const logo = createView()
    logo.opacity = 0
    control.attach('logo', logo)

    expect(logo.opacity).toBe(1)
    expect(logo.scaleX).toBe(1)
    expect(driver.played).toHaveLength(0)
    control.dispose()
  })

  it('applies the settled state to a recreated view without animating', async () => {
    const first = createView()
    const control = motionStates({ logo: first }, definitions)
    const shown = control.to('shown', { duration: 300 })
    driver.advance(300)
    expect(await shown).toBe(true)
    const played = driver.played.length

    const second = createView()
    second.opacity = 0
    second.scaleX = second.scaleY = 0.8
    control.attach('logo', second)

    expect(second.opacity).toBe(1)
    expect(second.scaleY).toBe(1)
    expect(driver.played).toHaveLength(played)
    control.dispose()
  })

  it('joins a transition in progress from where the new view is', () => {
    const control = motionStates({ logo: createView() }, definitions)
    control.to('shown', { duration: 400, ease: 'linear' })
    control.pause()

    const next = createView()
    next.opacity = 0.2
    control.attach('logo', next)

    const track = driver.last('opacity', next).track
    expect(track.values[0]).toBe(0.2)
    expect(track.to).toBe(1)
    expect(track.duration).toBe(400)
    expect(driver.last('opacity', next).held).toBe(true)
    control.dispose()
  })

  it('leaves an empty slot out of transitions and remembers it for later', async () => {
    const control = motionStates(
      { logo: createView(), badge: null },
      {
        hidden: { logo: { opacity: 0 }, badge: { opacity: 0 } },
      },
    )
    const hidden = control.to('hidden', { duration: 100 })
    expect(driver.played.map((p) => p.track.property)).toEqual(['opacity'])
    driver.advance(100)
    expect(await hidden).toBe(true)

    const badge = createView()
    control.attach('badge', badge)
    expect(badge.opacity).toBe(0)
    control.dispose()
  })

  it('detaches with null, ignores the same view and rejects a view another target owns', () => {
    const logo = createView()
    const badge = createView()
    const control = motionStates(
      { logo, badge: null },
      {
        shown: { logo: { opacity: 1 }, badge: { opacity: 1 } },
      },
    )
    control.attach('logo', logo)
    expect(driver.played).toHaveLength(0)
    expect(() => control.attach('badge', logo)).toThrow(/distinct views/)
    expect(() => control.attach('missing' as never, badge)).toThrow(
      /Unknown motion target/,
    )

    control.attach('logo', null)
    control.to('shown')
    expect(driver.played.map((p) => p.view)).toEqual([])
    control.dispose()
    expect(() => control.attach('logo', logo)).toThrow(/disposed/)
  })

  it('hands out one stable ref callback per target', () => {
    const control = motionStates({ logo: null }, definitions)
    const ref = control.ref('logo')
    expect(control.ref('logo')).toBe(ref)

    control.to('shown')
    const logo = createView()
    logo.opacity = 0
    ref({ nativeView: logo })
    expect(logo.opacity).toBe(1)
    ref(null)
    control.dispose()
    expect(() => ref(createView())).not.toThrow()
  })

  it('still validates definitions for targets that start empty', () => {
    expect(() =>
      motionStates({ logo: null }, {
        broken: { logo: { opacity: Number.NaN } },
      } as never),
    ).toThrow(/finite endpoint/)
  })

  it('works through a scope', async () => {
    const scope = motionScope()
    const control = scope.states({ logo: null }, definitions)
    await control.to('shown')
    const logo = createView()
    logo.opacity = 0
    control.attach('logo', logo)
    expect(logo.opacity).toBe(1)
    scope.dispose()
    expect(control.disposed).toBe(true)
  })
})

describe('per-target state transitions', () => {
  const create = (options?: MotionStatesOptions<'logo' | 'stroke'>) => {
    const logo = createView(),
      stroke = createView()
    stroke.opacity = 0
    const control = motionStates(
      { logo, stroke },
      {
        hidden: { logo: { x: 0 }, stroke: { opacity: 0 } },
        shown: { logo: { x: 100 }, stroke: { opacity: 1 } },
      },
      options,
    )
    return { logo, stroke, control }
  }

  it('give a named target its own transition, merged over the main one', async () => {
    const { logo, stroke, control } = create()
    const shown = control.to('shown', {
      type: 'spring',
      bounce: 0.2,
      stroke: { duration: 600, ease: 'linear', delay: 250 },
    })
    expect(driver.last('x', logo).track.duration).not.toBe(600)
    const fade = driver.last('opacity', stroke).track
    expect(fade.delay).toBe(250)
    expect(fade.duration).toBe(600)
    expect(fade.valueAt(550)).toBeCloseTo(0.5)
    driver.advance(10000)
    expect(await shown).toBe(true)
    expect(control.settled).toBe('shown')
  })

  it('merge a tween target over a tween key by key, and take a spring name', () => {
    const { logo, stroke, control } = create()
    control.to('shown', {
      duration: 800,
      ease: 'linear',
      stroke: { delay: 200 },
      logo: 'bouncy',
    })
    const fade = driver.last('opacity', stroke).track
    expect(fade.delay).toBe(200)
    expect(fade.valueAt(600)).toBeCloseTo(0.5)
    expect(driver.last('x', logo).track.duration).not.toBe(800)
  })

  it("keep the controller's transition when a call only names targets", () => {
    const { logo, stroke, control } = create({
      transition: { duration: 400, ease: 'linear', stroke: { delay: 100 } },
    })
    control.to('shown')
    expect(driver.last('opacity', stroke).track.delay).toBe(100)
    control.to('hidden', { logo: { delay: 50 } })
    expect(driver.last('x', logo).track.delay).toBe(50)
    expect(driver.last('x', logo).track.duration).toBe(400)
    const fade = driver.last('opacity', stroke).track
    expect(fade.delay).toBe(100)
    expect(fade.duration).toBe(400)
  })

  it('use the target transition for a view that joins a transition in progress', () => {
    const logo = createView()
    const control = motionStates(
      { logo, stroke: null },
      { shown: { logo: { x: 100 }, stroke: { opacity: 1 } } },
    )
    control.to('shown', { duration: 300, stroke: { duration: 900, ease: 'linear' } })
    const stroke = createView()
    stroke.opacity = 0
    control.attach('stroke', stroke)
    expect(driver.last('opacity', stroke).track.duration).toBe(900)
  })

  it('reject targets named like options and unknown keys in a target transition', () => {
    expect(() => motionStates({ delay: createView() }, { a: {} })).toThrow(
      'named "delay"',
    )
    const { control } = create()
    expect(() => control.to('shown', { stroke: { logo: 'snappy' } as never })).toThrow(
      'do not support "logo"',
    )
    expect(() => control.to('shown', { stroke: 'wobbly' as never })).toThrow(
      'Unknown state spring',
    )
    expect(control.current).toBeUndefined()
  })
})
