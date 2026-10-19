import { describe, expect, it, vi, afterEach } from 'vitest'
import { animate, animateLayout, motionScope } from '../src/index.js'
import { createView, driver, flush, state } from './helpers.js'
import { Application, type View } from './shims/core.js'

function place(view: View, x: number, y: number, width = 100, height = 50) {
  view.layoutBounds = { left: x, top: y, right: x + width, bottom: y + height }
}

function unload(host: ReturnType<typeof createView>) {
  host.notify({ eventName: 'unloaded', object: host })
  host.unload()
}
const hosts: ReturnType<typeof createView>[] = []
afterEach(async () => {
  hosts.splice(0).forEach((host) => unload(host))
  await flush()
})

function scene() {
  const host = createView()
  hosts.push(host)
  const a = createView()
  const b = createView()
  place(a, 0, 0)
  place(b, 0, 60)
  host.children.push(a, b)
  return { host, a, b }
}

const playedOn = (view: View) => driver.played.filter((played) => played.view === view)

describe('animateLayout', () => {
  it('slides the children that moved from where they were', async () => {
    const { host, a, b } = scene()
    const c = createView()
    const animation = animateLayout(host, () => {
      host.children.unshift(c)
      place(c, 0, 0)
      place(a, 0, 60)
      place(b, 0, 120)
    })
    expect(driver.played).toHaveLength(0)
    driver.layout()
    expect(driver.last('y', a).track.values[0]).toBe(-60)
    expect(driver.last('y', a).track.to).toBe(0)
    expect(driver.last('y', b).track.values[0]).toBe(-60)
    expect(driver.played.some((played) => played.track.property === 'x')).toBe(false)
    expect(driver.last('opacity', c).track.values[0]).toBe(0)
    driver.advance(3000)
    await flush()
    expect(await animation.finished).toBe(true)
  })

  it('leaves a child that stayed in place alone', () => {
    const { host, a, b } = scene()
    const c = createView()
    animateLayout(host, () => {
      host.children.push(c)
      place(c, 0, 120)
    })
    driver.layout()
    expect(playedOn(a)).toHaveLength(0)
    expect(playedOn(b)).toHaveLength(0)
    expect(playedOn(c)).not.toHaveLength(0)
  })

  it('scales a child that changed size about its center', () => {
    const { host, a } = scene()
    animateLayout(host, () => place(a, 0, 0, 200, 50))
    driver.layout()
    expect(driver.last('scaleX', a).track.values[0]).toBeCloseTo(0.5)
    expect(driver.last('scaleX', a).track.to).toBe(1)
    expect(driver.last('x', a).track.values[0]).toBeCloseTo(-50)
    expect(playedOn(a).some((played) => played.track.property === 'scaleY')).toBe(false)
    expect(playedOn(a).some((played) => played.track.property === 'y')).toBe(false)
  })

  it('only moves, from the corner, when size is false', () => {
    const { host, a } = scene()
    animateLayout(host, () => place(a, 40, 0, 200, 50), { size: false })
    driver.layout()
    expect(driver.last('x', a).track.values[0]).toBe(-40)
    expect(playedOn(a).some((played) => played.track.property.startsWith('scale'))).toBe(
      false,
    )
  })

  it('picks up a move that is still playing', () => {
    const { host, a } = scene()
    animateLayout(host, () => place(a, 0, 100))
    driver.layout()
    const first = driver.last('y', a)
    driver.advance(100)
    const inFlight = first.track.valueAt(100)
    expect(inFlight).not.toBe(0)
    animateLayout(host, () => place(a, 0, 220))
    driver.layout()
    const second = driver.last('y', a)
    expect(second).not.toBe(first)
    expect(first.stopped).toBe(true)
    expect(second.track.values[0]).toBeCloseTo(100 + inFlight - 220)
    expect(second.track.velocityAt(0.00001)).toBeCloseTo(first.track.velocityAt(100), 1)
  })

  it('ends at the translation the app had set', () => {
    const { host, a } = scene()
    a.translateX = 10
    animateLayout(host, () => place(a, 50, 0))
    driver.layout()
    expect(driver.last('x', a).track.values[0]).toBe(-40)
    expect(driver.last('x', a).track.to).toBe(10)
  })

  it('shows new children in place when enter is false', () => {
    const { host } = scene()
    const c = createView()
    animateLayout(
      host,
      () => {
        host.children.push(c)
        place(c, 0, 120)
      },
      { enter: false },
    )
    driver.layout()
    expect(driver.played).toHaveLength(0)
  })

  it('treats collapsed children as absent', () => {
    const { host, a, b } = scene()
    b.visibility = 'collapse'
    animateLayout(host, () => {
      b.visibility = 'visible'
      place(a, 0, 60)
      place(b, 0, 0)
    })
    driver.layout()
    expect(driver.last('y', a).track.values[0]).toBe(-60)
    expect(driver.last('opacity', b).track.values[0]).toBe(0)
    expect(playedOn(b).some((played) => played.track.property === 'y')).toBe(false)
  })

  it('animates the next layout pass when called without a change', () => {
    const { host, a } = scene()
    animateLayout(host, 'snappy')
    place(a, 0, 100)
    driver.layout()
    expect(driver.last('y', a).track.values[0]).toBe(-100)
  })

  it('requests a layout and finishes a no-op without an arbitrary timer', async () => {
    const { host } = scene()
    const done = state(animateLayout(host).finished)
    expect(host.layoutRequests).toBe(1)
    driver.layout()
    await flush()
    expect(done()?.value).toBe(true)
    expect(driver.played).toHaveLength(0)
    driver.layout()
    expect(driver.played).toHaveLength(0)
  })

  it('cancels the wait when stopped before the layout', async () => {
    const { host, a } = scene()
    const animation = animateLayout(host, () => place(a, 0, 100))
    animation.stop()
    expect(await animation.finished).toBe(false)
    driver.layout()
    expect(driver.played).toHaveLength(0)
  })

  it('settles temporary inverse transforms when stopped during playback', async () => {
    const { host, a } = scene()
    const animation = animateLayout(host, () => place(a, 0, 100))
    driver.layout()
    animation.stop()
    expect(driver.last('y', a).stopped).toBe(true)
    expect(a.translateY).toBe(0)
    expect(await animation.finished).toBe(false)
  })

  it('skips the moves under reduced motion', () => {
    const { host, a } = scene()
    driver.reduced = true
    const c = createView()
    animateLayout(host, () => {
      host.children.unshift(c)
      place(c, 0, 0)
      place(a, 0, 60)
    })
    driver.layout()
    expect(a.translateY).toBe(0)
  })

  it('rethrows a failing change and stops waiting', () => {
    const { host } = scene()
    expect(() =>
      animateLayout(host, () => {
        throw new Error('boom')
      }),
    ).toThrow('boom')
    driver.layout()
    expect(driver.played).toHaveLength(0)
  })

  it('rejects a target that is not a view', () => {
    expect(() => animateLayout({} as never)).toThrow(TypeError)
  })
})

describe('layout ownership and lifecycle', () => {
  it('supersedes a pending request without running duplicate tracks', async () => {
    const { host, a } = scene()
    const first = animateLayout(host)
    const next = animateLayout(host, () => place(a, 0, 80))
    expect(await first).toBe(false)
    expect(driver.pendingLayouts).toBe(1)
    driver.layout()
    expect(playedOn(a)).toHaveLength(1)
    next.stop()
  })
  it('restores the resting transform when keyed reorder unloads/reinserts an animated child', async () => {
    const { host, a } = scene()
    const first = animateLayout(host, () => place(a, 0, 100), {
      duration: 1000,
      ease: 'linear',
    })
    driver.layout()
    driver.advance(100)
    const next = animateLayout(host, () => {
      unload(a)
      a.load()
      place(a, 0, 200)
    })
    expect(a.translateY).toBe(0)
    driver.layout()
    expect(driver.last('y', a).track.values[0]).toBeCloseTo(-190)
    expect(driver.last('y', a).track.to).toBe(0)
    next.stop()
    expect(await first).toBe(false)
    expect(a.listenerCount('unloaded')).toBe(0)
  })
  it('rejects asynchronous mutations and cleans their pending request', async () => {
    const { host } = scene()
    expect(() =>
      animateLayout(host, async () => {
        throw new Error('async')
      }),
    ).toThrow('synchronous')
    await flush()
    expect(driver.pendingLayouts).toBe(0)
    expect(host.listenerCount('unloaded')).toBe(0)
  })
  it('skips 3D geometry and origin changes rather than applying an invalid inverse', () => {
    const { host, a, b } = scene()
    a.rotateX = 30
    animateLayout(host, () => {
      a.rotateX = 0
      place(a, 0, 100)
      b.originX = 0
      place(b, 0, 160)
    })
    driver.layout()
    expect(driver.played).toHaveLength(0)
  })
  it('samples a running animation at the layout pass, not at the mutation call', () => {
    const { host, a } = scene()
    animateLayout(host, () => place(a, 0, 100), { duration: 1000, ease: 'linear' })
    driver.layout()
    driver.advance(100)
    animateLayout(host, () => place(a, 0, 200))
    driver.advance(100)
    driver.layout()
    expect(driver.last('y', a).track.values[0]).toBeCloseTo(-180)
  })
  it('uses the endpoint if an old track completes before the next layout', () => {
    const { host, a } = scene()
    animateLayout(host, () => place(a, 0, 100), { duration: 100, ease: 'linear' })
    driver.layout()
    driver.advance(90)
    animateLayout(host, () => place(a, 0, 200))
    driver.advance(20)
    driver.layout()
    expect(driver.last('y', a).track.values[0]).toBeCloseTo(-100)
  })
  it('honors a noncentral origin and existing scale/translation during resize', () => {
    const { host, a } = scene()
    a.originX = 0.2
    a.translateX = 12
    a.scaleX = 1.4
    animateLayout(host, () => place(a, 40, 0, 200))
    driver.layout()
    expect(driver.last('x', a).track.values[0]).toBeCloseTo(-48)
    expect(driver.last('x', a).track.to).toBe(12)
    expect(driver.last('scaleX', a).track.values[0]).toBeCloseTo(0.7)
    expect(driver.last('scaleX', a).track.to).toBe(1.4)
  })
  it('preserves a new explicit owner acquired between capture and layout', () => {
    const { host, a } = scene()
    animateLayout(host, () => {
      place(a, 20, 50)
      animate(a, { x: 80 }, { duration: 1000 })
    })
    const explicit = driver.last('x', a)
    driver.layout()
    expect(driver.last('x', a)).toBe(explicit)
    expect(explicit.stopped).toBe(false)
    expect(driver.last('y', a).track.values[0]).toBe(-50)
  })
  it('settles only its own transforms on stop, preserving a later owner', async () => {
    const { host, a } = scene()
    const layout = animateLayout(host, () => place(a, 80, 60))
    driver.layout()
    driver.advance(100)
    const explicit = animate(a, { x: 200 }, { duration: 500 })
    layout.stop()
    expect(await layout).toBe(false)
    expect(driver.last('x', a).stopped).toBe(false)
    expect(a.translateY).toBe(0)
    expect(a.translateX).toBe(200)
    explicit.stop()
  })
  it('does not cancel disjoint properties such as opacity', () => {
    const { host, a } = scene()
    const opacity = animate(a, { opacity: 0.5 }, { duration: 1000 })
    const layout = animateLayout(host, () => place(a, 0, 50))
    driver.layout()
    layout.stop()
    expect(driver.last('opacity', a).stopped).toBe(false)
    opacity.stop()
  })
  it('cleans up on unload and supports a later loaded operation', async () => {
    const { host, a } = scene()
    const first = animateLayout(host, () => place(a, 0, 40))
    unload(host)
    expect(await first).toBe(false)
    expect(driver.pendingLayouts).toBe(0)
    expect(host.listenerCount('unloaded')).toBe(0)
    host.load()
    const next = animateLayout(host, () => place(a, 0, 90))
    driver.layout()
    expect(driver.last('y', a).track.values[0]).toBe(-50)
    next.stop()
  })
  it('cancels on application suspension without leaving a layout hook', async () => {
    const { host } = scene()
    const before = Application.listenerCount(Application.suspendEvent)
    const layout = animateLayout(host)
    Application.notify({ eventName: Application.suspendEvent })
    expect(await layout).toBe(false)
    expect(driver.pendingLayouts).toBe(0)
    expect(Application.listenerCount(Application.suspendEvent)).toBe(before)
  })
  it('runs an unloaded mutation without retaining a late animation', async () => {
    const { host, a } = scene()
    unload(host)
    const change = vi.fn(() => place(a, 0, 90))
    const layout = animateLayout(host, change)
    expect(change).toHaveBeenCalledOnce()
    expect(await layout).toBe(true)
    expect(driver.pendingLayouts).toBe(0)
    host.load()
    driver.layout()
    expect(driver.played).toHaveLength(0)
  })
  it('fades a new child to its configured opacity, not always one', () => {
    const { host } = scene(),
      c = createView()
    c.opacity = 0.4
    animateLayout(host, () => {
      host.children.push(c)
      place(c, 0, 150)
    })
    driver.layout()
    expect(driver.last('opacity', c).track.to).toBe(0.4)
  })
  it('validates options before mutating or replacing a pending request', () => {
    const { host } = scene(),
      change = vi.fn()
    const first = animateLayout(host)
    for (const options of [
      { duration: -1 },
      { duration: Infinity },
      { duration: 0, type: 'spring' },
      { type: 'invalid' },
      { stiffness: -1 },
      { damping: NaN },
      { mass: 0 },
      { velocity: Infinity },
      { bounce: 2 },
      { delay: Infinity },
      { repeat: 1 },
      { size: true },
      { enter: 'fadeIn' },
    ])
      expect(() => animateLayout(host, change, options as never)).toThrow()
    expect(change).not.toHaveBeenCalled()
    expect(driver.pendingLayouts).toBe(1)
    first.stop()
  })
  it('allows a newer reentrant request to win', async () => {
    const { host, a } = scene()
    let next: ReturnType<typeof animateLayout> | undefined
    const first = animateLayout(host, () => {
      next = animateLayout(host, () => place(a, 0, 80))
    })
    expect(await first).toBe(false)
    driver.layout()
    expect(playedOn(a)).toHaveLength(1)
    next!.stop()
  })
  it('is owned and cleaned up by motionScope', async () => {
    const { host, a } = scene(),
      scope = motionScope()
    const layout = scope.animateLayout(host, () => place(a, 0, 80))
    driver.layout()
    scope.dispose()
    expect(await layout).toBe(false)
    expect(a.translateY).toBe(0)
    expect(host.listenerCount('unloaded')).toBe(0)
    expect(() => scope.animateLayout(host)).toThrow('disposed')
  })
})
