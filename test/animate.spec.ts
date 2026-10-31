import { maximumSampleError } from './sampling-helpers.js'
import { describe, expect, it } from 'vitest'
import { animate, stop } from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'

describe('animate', () => {
  it('animates from the current value to the target', async () => {
    const view = createView()

    const animation = animate(view, { opacity: 0.5 }, { duration: 200 })
    const played = driver.last('opacity')

    expect(played.track.values[0]).toBe(1)
    expect(played.track.values.at(-1)).toBe(0.5)
    expect(played.track.duration).toBe(200)

    driver.advance(200)
    expect(await animation).toBe(true)
  })

  it('sets the final values on the view before the platform plays them', () => {
    const view = createView()

    animate(view, { x: [0, 100], opacity: 0 })

    expect(driver.last('x').snapshot).toMatchObject({ translateX: 100, opacity: 0 })
    expect(view.translateX).toBe(100)
  })

  it('starts every track on the same clock', () => {
    const view = createView()

    animate(view, { x: 10, y: 10, opacity: 0, scale: 2, rotate: 90 })

    expect(new Set(driver.played.map((p) => p.startedAt))).toEqual(new Set([driver.time]))
    expect(driver.played.map((p) => p.track.property).sort()).toEqual([
      'opacity',
      'rotate',
      'scaleX',
      'scaleY',
      'x',
      'y',
    ])
  })

  it('replaces null with the value at the start', () => {
    const view = createView()
    view.translateY = 40

    animate(view, { y: [null, 0, null] }, { duration: 300 })

    expect(driver.last('y').track.values[0]).toBe(40)
    expect(driver.last('y').track.values.at(-1)).toBe(40)
  })

  it('springs transforms and fades opacity unless told otherwise', () => {
    const view = createView()

    animate(view, { y: 100, opacity: 0 })

    expect(maximumSampleError(driver.last('y').track)).toBeLessThanOrEqual(0.25)
    expect(driver.last('opacity').track.duration).toBe(300)
  })

  it('takes a named spring', () => {
    const view = createView()

    animate(view, { scale: 1.2 }, 'bouncy')

    expect(Math.max(...driver.last('scaleX').track.values)).toBeGreaterThan(1.2)
  })

  it('takes a transition per property', () => {
    const view = createView()

    animate(view, { x: 100, opacity: 0 }, { duration: 500, opacity: { duration: 100 } })

    expect(driver.last('x').track.duration).toBe(500)
    expect(driver.last('opacity').track.duration).toBe(100)
  })

  it('lets scaleX and scaleY win over scale', () => {
    const view = createView()

    animate(view, { scale: 2, scaleY: 0.5 }, { duration: 100 })

    expect(driver.last('scaleX').track.to).toBe(2)
    expect(driver.last('scaleY').track.to).toBe(0.5)
  })

  it('finishes right away when there is nothing to play', async () => {
    const view = createView()

    const animation = animate(view, { opacity: 0 }, { duration: 0 })

    expect(driver.played).toHaveLength(0)
    expect(view.opacity).toBe(0)
    expect(await animation).toBe(true)
  })

  it('takes elements that hold a view', () => {
    const view = createView()

    animate({ nativeView: view }, { opacity: 0 })
    animate({ nativeElement: view }, { x: 10 })

    expect(driver.played.map((p) => p.view)).toEqual([view, view])
  })

  it('accepts a component instance through its root element', () => {
    const view = createView()
    const instance = componentInstance({ nativeView: view })

    animate(instance as never, 'fadeIn')

    expect(driver.played.map((p) => p.view)).toEqual([view])
  })

  it('explains bad input', () => {
    const view = createView()

    expect(() => animate(undefined as never, 'fadeIn')).toThrow(
      'Expected a NativeScript view, got undefined',
    )
    expect(() => animate({} as never, 'fadeIn')).toThrow(
      'Expected a NativeScript view, got an object without a view',
    )
    expect(() => animate(new Date() as never, 'fadeIn')).toThrow(
      'Expected a NativeScript view, got a Date',
    )
    const fragment = componentInstance({ nativeView: undefined })
    expect(() => String(fragment)).toThrow(TypeError)
    expect(() => animate(fragment as never, 'fadeIn')).toThrow(
      'Expected a NativeScript view, got a component instance without a root view',
    )
    expect(() => animate(view, 'fadeInSideways' as never)).toThrow('Unknown preset')
    expect(() => animate(view, { width: 100 } as never)).toThrow('Can\'t animate "width"')
    expect(() => animate(view, { x: [] })).toThrow('Invalid keyframes for "x"')
    expect(() => animate(view, { x: NaN })).toThrow('Invalid keyframes for "x"')
    expect(() => animate(view, { x: 1 }, 'wobbly' as never)).toThrow('Unknown spring')
  })
})

describe('platforms that end animations right away', () => {
  it('still wait for every property', async () => {
    const view = createView()
    const play = driver.play.bind(driver)
    driver.play = (v, track, startedAt, onEnd) => {
      const played = play(v, track, startedAt, onEnd)
      if (track.property === 'opacity') driver.stop(v, played)
      return played
    }

    const animation = animate(view, { opacity: 0, x: 100 }, { duration: 100 })
    const done = state(animation.finished)
    await flush()

    expect(done()).toBeUndefined()
    driver.advance(100)
    expect(await animation).toBe(true)
  })
})

describe('interrupting', () => {
  it('picks up where the previous animation is, with its velocity', async () => {
    const view = createView()
    const first = animate(view, { x: [0, 100] }, { type: 'spring' })
    const previous = driver.last('x').track

    driver.advance(80)
    const second = animate(view, { x: 0 }, { type: 'spring' })
    const next = driver.last('x').track

    expect(next.values[0]).toBeCloseTo(previous.valueAt(80))
    expect(next.velocityAt(0.01)).toBeCloseTo(previous.velocityAt(80), -1)
    expect(next.velocityAt(0.01)).toBeGreaterThan(0)
    expect(await first).toBe(false)

    driver.advance(next.end)
    expect(await second).toBe(true)
  })

  it('only takes over the properties it animates', async () => {
    const view = createView()
    const first = animate(view, { x: 100, opacity: 0 }, { duration: 300 })
    const done = state(first.finished)

    driver.advance(100)
    animate(view, { x: 0 }, { duration: 300 })
    await flush()

    expect(driver.played.find((p) => p.track.property === 'opacity')!.stopped).toBe(false)
    expect(done()).toBeUndefined()

    driver.advance(200)
    expect(await first).toBe(false)
  })
})

describe('stopping', () => {
  it('leaves the view where it is', async () => {
    const view = createView()
    const animation = animate(view, { x: [0, 100] }, { duration: 100, ease: 'linear' })

    driver.advance(25)
    animation.stop()

    expect(view.translateX).toBe(25)
    expect(driver.last('x').stopped).toBe(true)
    expect(await animation).toBe(false)
  })

  it('stops everything on a view', async () => {
    const view = createView()
    const a = animate(view, { x: 100 }, { duration: 100, ease: 'linear' })
    const b = animate(view, { opacity: 0 }, { duration: 100, ease: 'linear' })

    driver.advance(50)
    stop(view)

    expect(view.translateX).toBe(50)
    expect(view.opacity).toBe(0.5)
    expect(await Promise.all([a, b])).toEqual([false, false])
  })

  it('stops selected properties and waits for the others to finish', async () => {
    const view = createView()
    const animation = animate(
      view,
      { x: 100, scale: 2, opacity: 0 },
      { duration: 100, ease: 'linear' },
    )
    const done = state(animation.finished)

    driver.advance(25)
    stop(view, ['x', 'scale'] as const)
    await flush()

    expect(view.translateX).toBe(25)
    expect(view.scaleX).toBe(1.25)
    expect(view.scaleY).toBe(1.25)
    expect(driver.last('x').stopped).toBe(true)
    expect(driver.last('scaleX').stopped).toBe(true)
    expect(driver.last('scaleY').stopped).toBe(true)
    expect(driver.last('opacity').stopped).toBe(false)
    expect(done()).toBeUndefined()

    driver.advance(75)
    expect(await animation).toBe(false)
    expect(view.opacity).toBe(0)
  })

  it('can stop one scale axis without stopping the other', async () => {
    const view = createView()
    const animation = animate(view, { scale: 2 }, { duration: 100, ease: 'linear' })

    driver.advance(25)
    stop(view, ['scaleX'])

    expect(view.scaleX).toBe(1.25)
    expect(driver.last('scaleX').stopped).toBe(true)
    expect(driver.last('scaleY').stopped).toBe(false)

    driver.advance(75)
    expect(await animation).toBe(false)
    expect(view.scaleY).toBe(2)
  })

  it('stops selected properties on several targets, including template refs', async () => {
    const first = createView()
    const second = createView()
    const targets = [{ nativeView: first }, { nativeElement: second }] as const
    const movement = animate(targets, { x: 100 }, { duration: 100, ease: 'linear' })
    const fade = animate(targets, { opacity: 0 }, { duration: 100, ease: 'linear' })

    driver.advance(25)
    stop(targets, ['x'])

    for (const view of [first, second]) {
      expect(view.translateX).toBe(25)
      expect(driver.last('x', view).stopped).toBe(true)
      expect(driver.last('opacity', view).stopped).toBe(false)
    }
    expect(await movement).toBe(false)

    driver.advance(75)
    expect(await fade).toBe(true)
  })

  it.each([{ properties: [] }, { properties: ['rotate'] }] as const)(
    'leaves animations running when no active property is selected: $properties',
    async ({ properties }) => {
      const view = createView()
      const animation = animate(view, { x: 100 }, { duration: 100, ease: 'linear' })

      driver.advance(25)
      stop(view, properties)

      expect(driver.last('x').stopped).toBe(false)

      driver.advance(75)
      expect(await animation).toBe(true)
    },
  )

  it('does nothing once finished', async () => {
    const view = createView()
    const animation = animate(view, { x: 100 }, { duration: 100 })

    driver.advance(100)
    animation.stop()

    expect(view.translateX).toBe(100)
    expect(await animation).toBe(true)
  })
})

describe('views that are not loaded yet', () => {
  it('apply the first keyframe and play once loaded', async () => {
    const view = createView().unload()

    const animation = animate(view, 'fadeInUp')

    expect(view.opacity).toBe(0)
    expect(view.translateY).toBe(24)
    expect(driver.played).toHaveLength(0)

    view.load()
    expect(driver.played).toHaveLength(2)

    driver.advance(5000)
    expect(await animation).toBe(true)
  })

  it('stop waiting when stopped', async () => {
    const view = createView().unload()
    const animation = animate(view, 'fadeIn')

    animation.stop()
    view.load()

    expect(driver.played).toHaveLength(0)
    expect(view.listenerCount('loaded')).toBe(0)
    expect(await animation).toBe(false)
  })
})

describe('presets', () => {
  it('play their keyframes with their own transitions', () => {
    const view = createView()

    animate(view, 'fadeInUp')

    expect(driver.last('opacity').track.values[0]).toBe(0)
    expect(driver.last('opacity').track.duration).toBe(300)
    expect(driver.last('y').track.values[0]).toBe(24)
    expect(driver.last('y').track.to).toBe(0)
    expect(maximumSampleError(driver.last('y').track)).toBeLessThanOrEqual(0.25)
  })

  it('keep their curves when only timing is given', () => {
    const view = createView()

    animate(view, 'popIn', { delay: 120 })

    expect(driver.last('opacity').track.duration).toBe(150)
    expect(driver.last('opacity').track.delay).toBe(120)
    expect(driver.last('scaleX').track.delay).toBe(120)
    expect(Math.max(...driver.last('scaleX').track.values)).toBeGreaterThan(1)
  })

  it('use the curve they are given instead of theirs', () => {
    const view = createView()

    animate(view, 'fadeInUp', { duration: 600 })

    expect(driver.last('opacity').track.duration).toBe(600)
    expect(driver.last('y').track.duration).toBe(600)
  })

  it('loop', () => {
    const view = createView()

    animate(view, 'spin', { repeat: Infinity })

    expect(driver.last('rotate').track.end).toBe(Infinity)
    expect(view.rotate).toBe(0)
  })
})

describe('several targets', () => {
  it('stagger', () => {
    const views = [createView(), createView(), createView(), createView()]

    animate(views, 'fadeIn', { stagger: 40, delay: 100 })

    expect(views.map((view) => driver.last('opacity', view).track.delay)).toEqual([
      100, 140, 180, 220,
    ])
  })

  it('stagger from the center or the end', () => {
    const views = [createView(), createView(), createView()]

    animate(views, 'fadeIn', { stagger: { each: 50, from: 'center' } })
    const center = views.map((view) => driver.last('opacity', view).track.delay)
    animate(views, 'fadeIn', { stagger: { each: 50, from: 'last' } })
    const last = views.map((view) => driver.last('opacity', view).track.delay)

    expect(center).toEqual([50, 0, 50])
    expect(last).toEqual([100, 50, 0])
  })

  it('finish together and stop together', async () => {
    const views = [createView(), createView()]
    const animation = animate(views, { x: 100 }, { duration: 100, stagger: 100 })

    driver.advance(100)
    animation.stop()

    expect(views.map((view) => view.translateX)).toEqual([100, 0])
    expect(await animation).toBe(false)
  })
})

/** The public instance NativeScript-Vue hands out for a ref on a component: `$el` is its root element, and it cannot be stringified. */
function componentInstance(root: object) {
  return new Proxy(
    {},
    {
      get: (_, key) => (key === '$el' ? root : undefined),
      has: (_, key) => key === '$el',
    },
  )
}
