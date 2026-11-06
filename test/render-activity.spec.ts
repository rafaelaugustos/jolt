import { afterEach, expect, it, vi } from 'vitest'
import { Application } from './shims/core.js'
import { animate, motionScope, renderActivity } from '../src/index.js'
import type { RenderActivity } from '../src/render-activity.js'
import { createView, driver } from './helpers.js'

const resources: RenderActivity[] = []
afterEach(() => {
  resources.splice(0).forEach((item) => item.dispose())
  Application.suspended = false
})
function make() {
  const adapter = { change: vi.fn(), redraw: vi.fn() }
  const activity = renderActivity(adapter)
  resources.push(activity)
  return { adapter, activity }
}
it('aggregates independent owners and stops only after their last real completion', async () => {
  const { adapter, activity } = make(),
    first = activity.scope(),
    second = activity.scope()
  const a = animate(createView(), { x: 10 }, { duration: 100 }),
    b = animate(createView(), { x: 20 }, { duration: 200, delay: 50 })
  first.track(a)
  second.track(b)
  expect(activity.active).toBe(true)
  expect(adapter.change.mock.calls).toEqual([[true]])
  driver.advance(100)
  await a.finished
  expect(first.size).toBe(0)
  expect(adapter.change.mock.calls).toEqual([[true]])
  driver.advance(150)
  await b.finished
  expect(activity.active).toBe(false)
  expect(adapter.change.mock.calls).toEqual([[true], [false]])
  expect(driver.frames.size).toBe(0)
  expect(adapter.redraw).toHaveBeenCalled()
})
it('pause, seek and resume change demand without a periodic JavaScript observer', () => {
  const { adapter, activity } = make()
  const animation = animate(createView(), { x: 40 }, { duration: 1000 })
  activity.track(animation)
  driver.advance(100)
  animation.pause()
  expect(activity.active).toBe(false)
  const frames = adapter.redraw.mock.calls.length
  animation.progress = 0.7
  expect(adapter.redraw.mock.calls.length).toBeGreaterThan(frames)
  animation.play()
  expect(activity.active).toBe(true)
  animation.stop()
  expect(activity.size).toBe(0)
  expect(driver.frames.size).toBe(0)
})
it('suspending one owner preserves another and application-owned rendering tokens', () => {
  const { activity } = make(),
    one = activity.scope(),
    two = activity.scope()
  const releaseOne = one.hold(),
    releaseTwo = two.hold()
  one.suspend()
  expect(activity.active).toBe(true)
  releaseTwo()
  expect(activity.active).toBe(false)
  one.resume()
  expect(activity.active).toBe(true)
  releaseOne()
  releaseOne()
  expect(activity.active).toBe(false)
  expect(one.size).toBe(0)
})
it('manual suspension survives app visibility changes and disposal releases subscriptions', () => {
  const before = Application.listenerCount(Application.suspendEvent)
  const { activity, adapter } = make()
  activity.hold()
  activity.suspend()
  Application.suspended = true
  Application.notify({ eventName: Application.suspendEvent })
  Application.suspended = false
  Application.notify({ eventName: Application.resumeEvent })
  expect(activity.active).toBe(false)
  activity.resume()
  expect(activity.active).toBe(true)
  activity.dispose()
  expect(activity.active).toBe(false)
  expect(adapter.change.mock.calls.at(-1)).toEqual([false])
  expect(Application.listenerCount(Application.suspendEvent)).toBe(before)
})
it('retains an idle renderer owner in a motion scope, without treating retention as activity', () => {
  const scope = motionScope(),
    adapter = { change: vi.fn(), redraw: vi.fn() }
  const activity = scope.renderActivity(adapter)
  expect(scope.size).toBe(1)
  expect(adapter.change).not.toHaveBeenCalled()
  const off = activity.hold()
  scope.suspend()
  expect(activity.active).toBe(false)
  scope.resume()
  expect(activity.active).toBe(true)
  off()
  scope.dispose()
  expect(activity.disposed).toBe(true)
})
it('removes an observation without cancelling borrowed motion or accepting stale completion', async () => {
  const { activity, adapter } = make(),
    view = createView()
  const animation = animate(view, { x: 40 }, { duration: 100 })
  const off = activity.track(animation)
  expect(activity.track(animation)).toBe(off)
  off()
  expect(activity.size).toBe(0)
  const calls = adapter.redraw.mock.calls.length
  driver.advance(100)
  await expect(animation.finished).resolves.toBe(true)
  expect(adapter.redraw.mock.calls.length).toBe(calls)
})
it('handles disposal from a renderer callback and rejects unsupported clocks before mutation', () => {
  let activity: RenderActivity
  activity = renderActivity({
    change: (active) => {
      if (active) activity.dispose()
    },
    redraw() {},
  })
  resources.push(activity)
  activity.hold()
  expect(activity.disposed).toBe(true)
  expect(activity.active).toBe(false)
  const other = make()
  expect(() =>
    other.activity.track({
      finished: new Promise(() => {}),
      stop() {},
      then: () => new Promise(() => {}),
    }),
  ).toThrow(/clock/)
  expect(other.adapter.change).not.toHaveBeenCalled()
})
