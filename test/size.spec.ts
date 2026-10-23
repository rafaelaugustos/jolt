import { describe, expect, it, vi } from 'vitest'
import { createView, driver, flush } from './helpers.js'
import { Application } from './shims/core.js'
import { animateSize, configure, motionScope } from '../src/index.js'
import type { SizeValues } from '../src/size-layout.js'

const models = vi.hoisted(
  () =>
    new WeakMap<
      object,
      {
        size: { width: number; height: number }
        declarations: SizeValues
        intrinsic: { width: number; height: number }
        owner?: () => void
        layouts: number
      }
    >(),
)
vi.mock('../src/size-layout.js', async (original) => {
  const actual = await original<typeof import('../src/size-layout.js')>()
  return {
    ...actual,
    sizeLayout(view: object, axes: ('width' | 'height')[]) {
      const state = models.get(view)!
      const original = { ...state.declarations }
      let held = { ...state.size }
      return {
        ready: () => true,
        read: () => ({ ...state.size }),
        write(values: SizeValues) {
          for (const axis of axes)
            if (typeof values[axis] === 'number') held[axis] = values[axis] as number
        },
        measure(values: SizeValues) {
          const result = { ...state.size }
          for (const axis of axes)
            result[axis] =
              values[axis] === 'auto' ? state.intrinsic[axis] : (values[axis] as number)
          return result
        },
        layout() {
          state.size = { ...held }
          state.layouts++
        },
        commit(values?: SizeValues) {
          for (const axis of axes) {
            state.declarations[axis] = values ? values[axis] : original[axis]
            held[axis] =
              state.declarations[axis] === 'auto'
                ? state.intrinsic[axis]
                : (state.declarations[axis] as number)
          }
        },
        watch(takeover: () => void) {
          state.owner = takeover
        },
        dispose() {
          state.owner = undefined
        },
      }
    },
  }
})

function scene() {
  const view = createView()
  const state = {
    size: { width: 200, height: 50 },
    intrinsic: { width: 250, height: 240 },
    declarations: { width: 'auto', height: 50 } as SizeValues,
    layouts: 0,
    owner: undefined as (() => void) | undefined,
  }
  models.set(view, state)
  view.getActualSize = () => ({ ...state.size })
  return { view, state }
}
const step = async (time = 16) => {
  driver.advance(time)
  await flush()
}
describe('animateSize actual-size lifecycle', () => {
  it('interpolates both dimensions and restores semantic auto at completion', async () => {
    const { view, state } = scene()
    const a = animateSize(
      view,
      { width: 100, height: 'auto' },
      { duration: 1000, ease: 'linear' },
    )
    await step()
    await step(500)
    expect(state.size).toEqual({ width: 150, height: 145 })
    expect(view.scaleX).toBe(1)
    await step(500)
    expect(await a).toBe(true)
    expect(state.declarations).toEqual({ width: 100, height: 'auto' })
    expect(driver.frames.size).toBe(0)
    expect(state.owner).toBeUndefined()
  })
  it('captures before a content mutation, measures after queued Vue work', async () => {
    const { view, state } = scene()
    const a = animateSize(
      view,
      { height: 'auto' },
      () => {
        void Promise.resolve().then(() => {
          state.intrinsic.height = 400
        })
      },
      { duration: 1000, ease: 'linear' },
    )
    await flush()
    await step()
    await step(500)
    expect(state.size.height).toBe(225)
    await step(500)
    expect(await a).toBe(true)
  })
  it('retargets late intrinsic changes from current bounds', async () => {
    const { view, state } = scene()
    const a = animateSize(view, { height: 'auto' }, { duration: 1000, ease: 'linear' })
    await step()
    await step(300)
    const before = state.size.height
    state.intrinsic.height = 360
    await step()
    expect(state.size.height).toBe(before)
    await step(1000)
    expect(await a).toBe(true)
    expect(state.size.height).toBe(360)
  })
  it('reverses from current bounds and resolves the replaced handle false', async () => {
    const { view, state } = scene()
    const first = animateSize(view, { height: 300 }, { duration: 1000, ease: 'linear' })
    await step()
    await step(400)
    const before = state.size.height
    const next = animateSize(view, { height: 20 }, { duration: 500, ease: 'linear' })
    expect(await first).toBe(false)
    await step()
    expect(state.size.height).toBe(before)
    await step(500)
    expect(await next).toBe(true)
  })
  it('rejects invalid requests before disturbing the current owner or running mutations', async () => {
    const { view, state } = scene()
    const a = animateSize(view, { height: 200 }, { duration: 800 })
    const change = vi.fn()
    for (const value of [-1, Infinity, NaN, '50%', { unit: 'px', value: 50 }, undefined])
      expect(() => animateSize(view, { height: value as never }, change)).toThrow()
    for (const option of [
      { repeat: 2 },
      { duration: Infinity },
      { duration: -1 },
      { stiffness: 0 },
      { mass: -1 },
      { type: 'foo' },
      { type: 'spring', duration: 0 },
      { times: [0, 1] },
      { progress: 0.4 },
    ])
      expect(() => animateSize(view, { height: 200 }, change, option as never)).toThrow()
    expect(change).not.toHaveBeenCalled()
    expect(state.owner).toBeDefined()
    await step()
    await step(1000)
    expect(await a).toBe(true)
  })
  it('pauses without pending frames and resumes to the destination', async () => {
    const { view, state } = scene()
    const a = animateSize(view, { height: 300 }, { duration: 1000, ease: 'linear' })
    await step()
    await step(250)
    a.pause()
    const before = state.size.height
    expect(driver.frames.size).toBe(0)
    await step(2000)
    expect(state.size.height).toBe(before)
    a.play()
    await step(750)
    expect(await a).toBe(true)
  })
  it('holds when stopped and can release the original declaration instead', async () => {
    const { view, state } = scene()
    const a = animateSize(view, { height: 300 }, { duration: 1000, ease: 'linear' })
    await step()
    await step(250)
    const held = state.size.height
    a.stop()
    expect(await a).toBe(false)
    expect(state.declarations.height).toBe(held)
    const b = animateSize(view, { height: 400 }, { duration: 500 })
    await step()
    await step(100)
    b.stop({ restore: true })
    expect(state.declarations.height).toBe(held)
    expect(driver.frames.size).toBe(0)
  })
  it('external declaration writes take ownership and clear the old operation', async () => {
    const { view, state } = scene()
    const a = animateSize(view, { height: 'auto' })
    state.owner!()
    state.declarations.height = 90
    expect(await a).toBe(false)
    expect(driver.frames.size).toBe(0)
    expect(state.declarations.height).toBe(90)
  })
  it('scope suspension pauses and disposal cancels with no retained work', async () => {
    const { view } = scene()
    const scope = motionScope()
    const a = scope.animateSize(view, { height: 'auto' })
    scope.suspend()
    expect(a.paused).toBe(true)
    expect(driver.frames.size).toBe(0)
    scope.resume()
    expect(a.paused).toBe(false)
    scope.dispose()
    expect(await a).toBe(false)
    expect(scope.size).toBe(0)
    expect(driver.watchers.size).toBe(0)
  })
  it('cleans up on unload and app suspension', async () => {
    for (const lifecycle of ['unloaded', 'suspend']) {
      const { view, state } = scene()
      const a = animateSize(view, { height: 'auto' })
      if (lifecycle === 'unloaded') view.notify({ eventName: lifecycle, object: view })
      else Application.notify({ eventName: Application.suspendEvent })
      expect(await a).toBe(false)
      expect(state.declarations.height).toBe(50)
      expect(driver.frames.size).toBe(0)
      expect(view.listenerCount('unloaded')).toBe(0)
    }
  })
  it('settles to the target when reduced motion changes, including while paused', async () => {
    const { view, state } = scene()
    const a = animateSize(view, { height: 'auto' }, { duration: 2000 })
    a.pause()
    configure({ reducedMotion: 'always' })
    expect(await a).toBe(true)
    expect(state.declarations.height).toBe('auto')
    expect(state.size.height).toBe(240)
    expect(driver.frames.size).toBe(0)
  })
  it('handles zero duration, zero dimensions and timeScale', async () => {
    const { view, state } = scene()
    const a = animateSize(view, { width: 0, height: 0 }, { duration: 0 })
    await step()
    expect(await a).toBe(true)
    expect(state.size.height).toBe(0)
    configure({ timeScale: 0.5 })
    const b = animateSize(view, { height: 100 }, { duration: 1000, ease: 'linear' })
    await step()
    await step(1000)
    expect(state.size.height).toBe(50)
    await step(1000)
    expect(await b).toBe(true)
  })
  it('cleans up synchronous mutation errors and rejects async mutations', () => {
    const { view, state } = scene()
    expect(() =>
      animateSize(view, { height: 'auto' }, () => {
        throw new Error('mutation')
      }),
    ).toThrow('mutation')
    expect(state.owner).toBeUndefined()
    expect(driver.frames.size).toBe(0)
    expect(() => animateSize(view, { height: 'auto' }, async () => {})).toThrow(
      'synchronous',
    )
  })
})
