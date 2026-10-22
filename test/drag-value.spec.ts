import { describe, expect, it, vi } from 'vitest'
import {
  animate,
  bind,
  configure,
  drag,
  motionScope,
  motionValue,
  type DragRelease,
} from '../src/index.js'
import type { Animation } from '../src/engine.js'
import { createView, driver, flush } from './helpers.js'

type View = ReturnType<typeof createView>

function pan(view: View, state: number, y = 0, x = 0) {
  view.notify({ eventName: 'pan', object: view, state, deltaX: x, deltaY: y })
}
function begin(view: View) {
  view.touch('down')
  pan(view, 1)
}
function sheet(options: { rubberband?: boolean } = {}) {
  const value = motionValue(600)
  const handle = createView()
  const panel = createView()
  const backdrop = createView()
  bind(panel, { y: value })
  bind(backdrop, { opacity: value.to([0, 600], [0.5, 0]) })
  const settle = vi.fn()
  let released: DragRelease<Animation> | undefined
  const controller = drag(handle, {
    axis: 'y',
    value,
    bounds: { top: 0, bottom: 600 },
    snap: [0, 600],
    onRelease: (event) => (released = event),
    onSettle: settle,
    ...options,
  })
  return { value, handle, panel, backdrop, controller, settle, release: () => released }
}

describe('drag into a motion value', () => {
  it('writes the finger position into the value, and bound views follow', () => {
    const { value, handle, panel, backdrop, controller } = sheet()
    begin(handle)
    pan(handle, 2, -150)
    expect(value.get()).toBe(450)
    expect(panel.translateY).toBe(450)
    expect(backdrop.opacity).toBeCloseTo(0.125)
    expect(handle.translateY).toBe(0)
    expect(controller.position).toEqual({ x: 0, y: 450 })
    pan(handle, 2, -900)
    expect(value.get()).toBe(0)
    expect(driver.played).toHaveLength(0)
    controller.dispose()
  })

  it('plays the release natively on every bound view and settles on the snap point', async () => {
    const { value, handle, panel, backdrop, controller, settle, release } = sheet()
    begin(handle)
    driver.advance(50)
    pan(handle, 2, -100)
    pan(handle, 3, -100)
    expect(release()?.target).toEqual({ x: 0, y: 0 })
    expect(release()?.velocityY).toBe(-2000)
    expect(controller.settling).toBe(true)
    const move = driver.last('y', panel)
    const fade = driver.last('opacity', backdrop)
    expect(move.track.values[0]).toBe(500)
    expect(move.track.to).toBe(0)
    expect(fade.track.to).toBe(0.5)
    driver.advance(100)
    expect(value.get()).toBeLessThan(500)
    expect(value.get()).toBeGreaterThan(0)
    driver.advance(10000)
    await flush()
    expect(await release()!.animation).toBe(true)
    expect(value.get()).toBe(0)
    expect(settle).toHaveBeenCalledWith({ x: 0, y: 0 })
    expect(controller.settling).toBe(false)
    controller.dispose()
  })

  it('grabs a release or an animation of the value where it is', async () => {
    const { value, handle, panel, controller, settle, release } = sheet()
    begin(handle)
    driver.advance(50)
    pan(handle, 2, -100)
    pan(handle, 3, -100)
    driver.advance(80)
    const caught = value.get()
    begin(handle)
    expect(await release()!.animation).toBe(false)
    expect(value.get()).toBe(caught)
    expect(panel.translateY).toBe(caught)
    pan(handle, 2, 40)
    expect(value.get()).toBe(caught + 40)

    pan(handle, 3, 40)
    const open = animate(value, 0, { duration: 400, ease: 'linear' })
    driver.advance(200)
    begin(handle)
    expect(await open).toBe(false)
    const held = value.get()
    expect(held).toBeCloseTo((caught + 40) / 2)
    pan(handle, 2, 10)
    expect(value.get()).toBeCloseTo(held + 10)
    expect(panel.translateY).toBe(value.get())
    await flush()
    expect(settle).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('resists past the bounds and springs back to the edge', async () => {
    const { value, handle, controller } = sheet({ rubberband: true })
    begin(handle)
    pan(handle, 2, 200)
    expect(value.get()).toBeGreaterThan(600)
    expect(value.get()).toBeLessThan(700)
    pan(handle, 3, 200)
    driver.advance(10000)
    await flush()
    expect(value.get()).toBe(600)
    controller.dispose()
  })

  it('cancel stops the value at its visible position', async () => {
    const { value, handle, panel, controller, settle } = sheet()
    begin(handle)
    driver.advance(50)
    pan(handle, 2, -100)
    pan(handle, 3, -100)
    driver.advance(60)
    controller.cancel()
    const stopped = value.get()
    expect(panel.translateY).toBe(stopped)
    driver.advance(10000)
    await flush()
    expect(value.get()).toBe(stopped)
    expect(settle).not.toHaveBeenCalled()
    controller.dispose()
  })

  it('settles at once with reduced motion', async () => {
    configure({ reducedMotion: 'always' })
    const { value, handle, panel, controller, settle } = sheet()
    begin(handle)
    pan(handle, 2, -400)
    pan(handle, 3, -400)
    await flush()
    expect(value.get()).toBe(0)
    expect(panel.translateY).toBe(0)
    expect(settle).toHaveBeenCalledTimes(1)
    expect(driver.played).toHaveLength(0)
    controller.dispose()
  })

  it('works from a motion scope and needs one axis and a real motion value', () => {
    const view = createView()
    const value = motionValue()
    const scope = motionScope()
    const controller = scope.drag(view, { axis: 'x', value })
    begin(view)
    pan(view, 2, 0, 30)
    expect(value.get()).toBe(30)
    scope.dispose()
    expect(controller.disposed).toBe(true)

    expect(() =>
      drag(view, { axis: 'both', value } as unknown as Parameters<typeof drag>[1]),
    ).toThrow('axis "x" or "y"')
    expect(() =>
      drag(view, { axis: 'y', value: value.to([0, 1], [0, 2]) } as never),
    ).toThrow('motion value')
    expect(view.listenerCount('pan')).toBe(0)
  })
})
