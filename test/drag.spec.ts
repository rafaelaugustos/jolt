import { Application, type PanGestureEventData } from '@nativescript/core'
import { describe, expect, it, vi } from 'vitest'
import { animate, configure, drag, motionScope, type DragRelease } from '../src/index.js'
import { DragInput } from '../src/drag-input.js'
import { resistDrag, solveDragRelease, type DragCurve } from '../src/drag-physics.js'
import { createView, driver, flush } from './helpers.js'

function pan(
  view: ReturnType<typeof createView>,
  state: number,
  x = 0,
  y = 0,
  extra = {},
) {
  view.notify({ eventName: 'pan', object: view, state, deltaX: x, deltaY: y, ...extra })
}
function begin(view: ReturnType<typeof createView>) {
  view.touch('down')
  pan(view, 1)
}
const base: DragCurve = {
  type: 'drag',
  velocity: 900,
  friction: 0.998,
  bounds: [0, 200],
  rubberband: false,
}

describe('drag release physics', () => {
  it('coasts until the boundary with no hard-bound overshoot', () => {
    const motion = solveDragRelease(40, base)
    expect(motion.to).toBe(200)
    expect(motion.position(0)).toBe(40)
    expect(motion.velocity(0)).toBe(900)
    for (let t = 0; t < motion.duration + 100; t += 3)
      expect(motion.position(t)).toBeGreaterThanOrEqual(40)
    expect(motion.position(motion.duration)).toBe(200)
    expect(motion.position(motion.duration - 0.01)).toBeLessThan(200)
  })
  it('absorbs the collision velocity and returns to the edge', () => {
    const motion = solveDragRelease(40, { ...base, rubberband: true })
    const positions = Array.from({ length: 501 }, (_, i) =>
      motion.position((motion.duration * i) / 500),
    )
    expect(Math.max(...positions)).toBeGreaterThan(200)
    expect(positions.at(-1)).toBe(200)
    expect(
      Math.max(...positions.map((p, i) => (i ? Math.abs(p - positions[i - 1]!) : 0))),
    ).toBeLessThan(10)
  })
  it('springs from overscroll to the violated edge with zero release velocity', () => {
    const motion = solveDragRelease(-40, { ...base, velocity: 0, rubberband: true })
    expect(motion.position(0)).toBe(-40)
    expect(motion.to).toBe(0)
    expect(motion.position(motion.duration)).toBe(0)
  })
  it('selects snap by projected landing, carrying the original velocity', () => {
    const motion = solveDragRelease(20, { ...base, velocity: 300, snap: [0, 200] })
    expect(motion.to).toBe(200)
    expect(motion.velocity(0)).toBeCloseTo(300, 0)
    expect(motion.position(motion.duration)).toBe(200)
  })
  it('keeps high velocity snap keyframes inside hard bounds in both directions', () => {
    for (const velocity of [-3000, 3000]) {
      const motion = solveDragRelease(80, { ...base, velocity, snap: [0, 200] })
      for (let t = 0; t < motion.duration; t += 2) {
        expect(motion.position(t)).toBeGreaterThanOrEqual(0)
        expect(motion.position(t)).toBeLessThanOrEqual(200)
      }
    }
  })
  it('supports one-sided, unbounded, fixed and zero velocity motion', () => {
    for (const bounds of [
      [-Infinity, Infinity],
      [0, Infinity],
      [-Infinity, 200],
      [40, 40],
    ] as const) {
      const motion = solveDragRelease(40, { ...base, bounds, velocity: 0 })
      expect(motion.to).toBe(40)
      expect(Number.isFinite(motion.duration)).toBe(true)
    }
    expect(
      solveDragRelease(40, { ...base, bounds: [-Infinity, Infinity] }).to,
    ).toBeGreaterThan(400)
    const edge = solveDragRelease(200, { ...base, rubberband: true })
    expect(edge.position(0)).toBe(200)
    expect(edge.position(edge.duration)).toBe(200)
  })
  it('rubberband is continuous, monotonic and bounded on either side', () => {
    expect(resistDrag(90, [0, 100], 200)).toBe(90)
    expect(resistDrag(100, [0, 100], 200)).toBe(100)
    expect(resistDrag(101, [0, 100], 200)).toBeGreaterThan(100)
    expect(resistDrag(101, [0, 100], 200)).toBeLessThan(101)
    expect(resistDrag(1e9, [0, 100], 200)).toBeLessThan(210)
    expect(resistDrag(-1e9, [0, 100], 200)).toBeGreaterThan(-110)
  })
})

describe('drag controller', () => {
  it('keeps only the latest owner when replacement cancels into another drag', () => {
    const view = createView()
    let latest: ReturnType<typeof drag> | undefined
    const first = drag(view, { onCancel: () => (latest = drag(view, { axis: 'y' })) })
    begin(view)
    pan(view, 2, 20)
    const replacement = drag(view, { axis: 'x' })
    expect(first.disposed).toBe(true)
    expect(replacement.disposed).toBe(true)
    expect(latest?.disposed).toBe(false)
    expect(view.listenerCount('pan')).toBe(1)
    latest!.dispose()
  })
  it('tracks two axes with independent snap/decay and preserves manually paused scope members', async () => {
    const view = createView()
    const scope = motionScope()
    const controller = scope.drag(view, {
      bounds: { left: -100, right: 100, top: -200, bottom: 200 },
      snap: { x: [-100, 0, 100] },
    })
    begin(view)
    driver.advance(50)
    pan(view, 2, 10, -10)
    pan(view, 3, 10, -10)
    expect(driver.last('x').track.to).toBe(100)
    expect(driver.last('y').track.to).toBeLessThan(-100)
    controller.pause()
    scope.suspend()
    scope.resume()
    expect(controller.paused).toBe(true)
    expect(view.listenerCount('pan')).toBe(0)
    scope.dispose()
    await flush()
  })
  it('follows absolute translation from its starting point on enabled axes only', () => {
    const view = createView()
    view.translateX = 25
    view.translateY = 12
    const start = vi.fn(),
      move = vi.fn()
    const controller = drag(view, {
      axis: 'x',
      bounds: { left: -20, right: 100 },
      onStart: start,
      onMove: move,
    })
    begin(view)
    pan(view, 2, 30, 60)
    expect(view.translateX).toBe(55)
    expect(view.translateY).toBe(12)
    pan(view, 2, 200, 100)
    expect(view.translateX).toBe(100)
    expect(start).toHaveBeenCalledTimes(1)
    expect(move.mock.lastCall![0].velocityY).toBe(0)
    expect(controller.dragging).toBe(true)
    controller.dispose()
  })
  it('springs to the velocity-projected stop, with an awaitable release', async () => {
    const view = createView()
    let released: DragRelease | undefined
    const settle = vi.fn()
    const controller = drag(view, {
      axis: 'x',
      bounds: { left: 0, right: 200 },
      snap: [0, 200],
      onRelease: (event) => (released = event),
      onSettle: settle,
    })
    begin(view)
    driver.advance(50)
    pan(view, 2, 30)
    pan(view, 3, 30)
    expect(released?.target).toEqual({ x: 200, y: 0 })
    expect(released?.velocityX).toBe(600)
    expect(controller.settling).toBe(true)
    expect(driver.last('x').track.values[0]).toBe(30)
    driver.advance(10000)
    await flush()
    expect(await released!.animation).toBe(true)
    expect(settle).toHaveBeenCalledWith({ x: 200, y: 0 })
    expect(controller.settling).toBe(false)
    controller.dispose()
  })
  it('grabs an in-flight animation at presentation and preserves other properties', () => {
    const view = createView()
    animate(view, { x: 200, opacity: 0.2 }, { duration: 1000, ease: 'linear' })
    const controller = drag(view, { axis: 'x' })
    driver.advance(250)
    expect(controller.position.x).toBe(50)
    begin(view)
    pan(view, 2, 10)
    expect(view.translateX).toBe(60)
    expect(driver.last('opacity').stopped).toBe(false)
    controller.dispose()
  })
  it('touch-down freezes a release and a fresh pan starts there without stale settle', async () => {
    const view = createView()
    const settle = vi.fn()
    const controller = drag(view, { axis: 'x', snap: [0, 200], onSettle: settle })
    begin(view)
    driver.advance(40)
    pan(view, 2, 60)
    pan(view, 3, 60)
    driver.advance(50)
    const before = controller.position.x
    view.touch('down')
    expect(view.translateX).toBeCloseTo(before)
    pan(view, 1)
    pan(view, 2, -10)
    expect(view.translateX).toBeCloseTo(before - 10)
    await flush()
    expect(settle).not.toHaveBeenCalled()
    controller.dispose()
  })
  it('resists overscroll and cancels without launching a fling or later callbacks', async () => {
    const view = createView()
    const release = vi.fn(),
      cancel = vi.fn()
    const controller = drag(view, {
      axis: 'y',
      bounds: { top: 0, bottom: 100 },
      rubberband: true,
      onRelease: release,
      onCancel: cancel,
    })
    begin(view)
    pan(view, 2, 0, 200)
    expect(view.translateY).toBeGreaterThan(100)
    expect(view.translateY).toBeLessThan(200)
    pan(view, 0, 0, 200)
    pan(view, 3, 0, 200)
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(release).not.toHaveBeenCalled()
    expect(driver.played).toHaveLength(0)
    controller.dispose()
    await flush()
  })
  it('disposal cannot stop a newer animation on the same property', async () => {
    const view = createView()
    const controller = drag(view, { axis: 'x', snap: [0, 200] })
    begin(view)
    driver.advance(50)
    pan(view, 2, 40)
    pan(view, 3, 40)
    const outside = animate(view, { x: 50 })
    controller.dispose()
    driver.advance(10000)
    expect(await outside).toBe(true)
  })
  it('scope suspension cancels input and release; resume accepts a fresh gesture', async () => {
    const view = createView()
    const scope = motionScope()
    const controller = scope.drag(view, { axis: 'x' })
    begin(view)
    pan(view, 2, 30)
    scope.suspend()
    expect(view.listenerCount('pan')).toBe(0)
    pan(view, 2, 50)
    expect(view.translateX).toBe(30)
    scope.resume()
    begin(view)
    pan(view, 2, 10)
    expect(view.translateX).toBe(40)
    scope.dispose()
    expect(controller.disposed).toBe(true)
    expect(view.listenerCount('touch')).toBe(0)
    expect(view.listenerCount('loaded')).toBe(0)
  })
  it('attaches after load, detaches on unload and reuses the controller after reload', () => {
    const view = createView().unload()
    const controller = drag(view)
    expect(view.listenerCount('pan')).toBe(0)
    view.load()
    expect(view.listenerCount('pan')).toBe(1)
    begin(view)
    pan(view, 2, 20, 30)
    view.notify({ eventName: 'unloaded', object: view })
    view.unload()
    expect(controller.dragging).toBe(false)
    expect(view.listenerCount('pan')).toBe(0)
    view.load()
    begin(view)
    pan(view, 2, 10, 10)
    expect(view.translateX).toBe(30)
    expect(view.translateY).toBe(40)
    controller.dispose()
  })
  it('application suspend cancels and respects manual pause on resume', () => {
    const view = createView()
    const controller = drag(view)
    begin(view)
    pan(view, 2, 20)
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    expect(controller.dragging).toBe(false)
    controller.pause()
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    expect(view.listenerCount('pan')).toBe(0)
    controller.play()
    expect(view.listenerCount('pan')).toBe(1)
    controller.dispose()
  })
  it('replaces only valid previous controllers and snapshots options', () => {
    const view = createView()
    const snap = [0, 200]
    const first = drag(view, { axis: 'x', snap })
    expect(() => drag(view, { bounds: { left: 10, right: 0 } })).toThrow()
    expect(first.disposed).toBe(false)
    const second = drag(view, { axis: 'x', snap })
    snap[1] = 999
    expect(first.disposed).toBe(true)
    expect(view.listenerCount('pan')).toBe(1)
    begin(view)
    driver.advance(50)
    pan(view, 2, 40)
    pan(view, 3, 40)
    expect(driver.last('x').track.to).toBe(200)
    second.dispose()
  })
  it('rejects invalid options before subscribing or taking ownership', () => {
    const view = createView()
    for (const options of [
      { axis: 'z' },
      { friction: 1 },
      { friction: NaN },
      { snap: [] },
      { snap: [NaN] },
      { bounds: { left: Infinity } },
      { bounds: { right: 20 }, snap: [30] },
      { onMove: true },
      { rubberband: 0 },
    ]) {
      expect(() => drag(view, options as never)).toThrow()
    }
    expect(view.listenerCount('pan')).toBe(0)
  })
  it('reduced motion keeps direct tracking, then settles immediately once', async () => {
    configure({ reducedMotion: 'always' })
    const view = createView()
    const settle = vi.fn()
    const controller = drag(view, { axis: 'x', snap: [0, 100], onSettle: settle })
    begin(view)
    pan(view, 2, 80)
    expect(view.translateX).toBe(80)
    pan(view, 3, 80)
    await flush()
    expect(view.translateX).toBe(100)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(driver.played).toHaveLength(0)
    controller.dispose()
  })
  it('onStart can dispose, and throwing onMove removes all input', () => {
    const view = createView()
    const first = drag(view, { onStart: () => first.dispose() })
    begin(view)
    pan(view, 2, 50)
    expect(view.translateX).toBe(0)
    const second = drag(view, {
      onMove: () => {
        throw new Error('consumer')
      },
    })
    expect(() => begin(view)).toThrow('consumer')
    expect(second.disposed).toBe(true)
    expect(view.listenerCount('pan')).toBe(0)
  })
  it('release callbacks may dispose without a later settle notification', async () => {
    const view = createView()
    const settle = vi.fn()
    const controller = drag(view, {
      onRelease: () => controller.dispose(),
      onSettle: settle,
    })
    begin(view)
    driver.advance(50)
    pan(view, 2, 50)
    pan(view, 3, 50)
    driver.advance(10000)
    await flush()
    expect(settle).not.toHaveBeenCalled()
    expect(controller.disposed).toBe(true)
  })
})

describe('native pan input', () => {
  it('does not reuse stale iOS velocity after holding still before release', () => {
    const view = createView(),
      input = new DragInput()
    let x = 0
    const event = {
      state: 2,
      ios: {
        translationInView: () => ({ x, y: 0 }),
        velocityInView: () => ({ x: 600, y: 0 }),
        numberOfTouches: 1,
      },
    } as unknown as PanGestureEventData
    input.read(event, view)
    driver.advance(30)
    x = 40
    expect(input.read(event, view).velocityX).toBe(600)
    driver.advance(300)
    expect(input.read({ ...event, state: 3 }, view).velocityX).toBe(0)
  })
  it('reads iOS translation and velocity in the parent coordinate system', () => {
    const view = createView()
    view.parent = createView()
    const translationInView = vi.fn(() => ({ x: 25, y: -10 }))
    const velocityInView = vi.fn(() => ({ x: 700, y: -200 }))
    const input = new DragInput().read(
      {
        state: 3,
        ios: { translationInView, velocityInView, numberOfTouches: 0 },
      } as unknown as PanGestureEventData,
      view,
    )
    expect(input).toMatchObject({
      x: 25,
      y: -10,
      velocityX: 700,
      velocityY: -200,
      cancelled: false,
    })
    expect(velocityInView).toHaveBeenCalledWith(view.parent.nativeViewProtected)
  })
  it('samples Android raw positions, including release timestamps and cancellation', () => {
    const input = new DragInput(),
      view = createView()
    const event = (x: number, time: number, action = 2) =>
      ({
        state: 2,
        deltaX: x,
        deltaY: 0,
        android: {
          current: {
            getRawX: () => x,
            getRawY: () => 0,
            getEventTime: () => time,
            getActionMasked: () => action,
            getPointerCount: () => 1,
          },
        },
      }) as unknown as PanGestureEventData
    input.read(event(20, 1000), view)
    expect(input.read(event(60, 1050), view).velocityX).toBe(800)
    expect(input.read(event(60, 1400, 1), view).velocityX).toBe(0)
    expect(input.read(event(60, 1410, 3), view).cancelled).toBe(true)
    expect(input.read(event(60, 1420, 5), view).cancelled).toBe(true)
  })
  it('Android ACTION_CANCEL reported as pan ended never flings', () => {
    const view = createView()
    const release = vi.fn(),
      cancel = vi.fn()
    const controller = drag(view, { onRelease: release, onCancel: cancel })
    begin(view)
    pan(view, 2, 30)
    pan(view, 3, 30, 0, {
      android: {
        current: {
          getRawX: () => 30,
          getRawY: () => 0,
          getEventTime: () => 100,
          getActionMasked: () => 3,
          getPointerCount: () => 1,
        },
      },
    })
    expect(cancel).toHaveBeenCalledTimes(1)
    expect(release).not.toHaveBeenCalled()
    controller.dispose()
  })
})
