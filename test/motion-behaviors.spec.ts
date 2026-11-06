import { describe, it, expect, vi } from 'vitest'
import { Application } from './shims/core.js'
import { motionBehaviors, type BehaviorContext } from '../src/index.js'
import { createView, driver, flush } from './helpers.js'

describe('motion behaviors', () => {
  it('holds external work through backgrounding and removes application listeners on teardown', async () => {
    const before = Application.listenerCount(Application.resumeEvent)
    let resolve!: () => void
    const next = vi.fn()
    const behaviors = motionBehaviors({
      task: {
        run: async ({ wait }) => {
          await wait(
            new Promise<void>((r) => {
              resolve = r
            }),
          )
          next()
        },
      },
    })
    const run = behaviors.request('task')
    Application.notify({ eventName: Application.suspendEvent })
    resolve()
    await flush()
    expect(next).not.toHaveBeenCalled()
    behaviors.pause()
    Application.notify({ eventName: Application.resumeEvent })
    await flush()
    expect(next).not.toHaveBeenCalled()
    behaviors.play()
    await flush()
    expect(await run.finished).toMatchObject({ status: 'completed' })
    expect(next).toHaveBeenCalledOnce()
    behaviors.dispose()
    expect(Application.listenerCount(Application.resumeEvent)).toBe(before)
  })
  it('disposes an existing run when a request guard tears down its owner', async () => {
    const cleanup = vi.fn()
    const behaviors = motionBehaviors({
      active: {
        run: ({ scope }) => {
          scope.retain(cleanup)
          return new Promise(() => {})
        },
      },
      next: {
        priority: 2,
        when: () => {
          behaviors.dispose()
          return true
        },
        run: vi.fn(),
      },
    })
    const run = behaviors.request('active')
    expect(await behaviors.request('next').finished).toMatchObject({ status: 'blocked' })
    expect(await run.finished).toMatchObject({ status: 'cancelled' })
    expect(cleanup).toHaveBeenCalledOnce()
    expect(behaviors.current).toBeUndefined()
  })
  it('defers rest until resumption when cancellation happens while paused', async () => {
    const rest = vi.fn()
    const behaviors = motionBehaviors(
      {
        rest: { run: rest },
        task: { run: () => new Promise(() => {}) },
      },
      { rest: 'rest' },
    )
    const run = behaviors.request('task')
    behaviors.pause()
    run.cancel()
    expect(await run.finished).toMatchObject({ status: 'cancelled' })
    expect(rest).not.toHaveBeenCalled()
    behaviors.play()
    expect(rest).toHaveBeenCalledOnce()
    await flush()
    behaviors.dispose()
  })
  it('interrupts from current presentation, blocks excluded input and restores rest', async () => {
    const view = createView(),
      continuation = vi.fn()
    const behaviors = motionBehaviors(
      {
        rest: {
          priority: -1,
          run: async ({ scope, wait }) => {
            await wait(scope.animate(view, { x: 0 }, { duration: 200 }))
          },
        },
        touch: {
          run: async ({ scope, wait }) => {
            await wait(
              scope.animate(view, { x: 100 }, { duration: 1000, ease: 'linear' }),
            )
            continuation()
          },
        },
        dress: {
          priority: 2,
          blocks: ['touch'],
          run: async ({ scope, wait }) => {
            await wait(scope.animate(view, { x: 200 }, { duration: 400, ease: 'linear' }))
          },
        },
      },
      { rest: 'rest' },
    )
    const touch = behaviors.request('touch')
    driver.advance(200)
    const dress = behaviors.request('dress')
    expect(await touch.finished).toMatchObject({ status: 'interrupted' })
    expect(driver.last('x').track.valueAt(0)).toBeCloseTo(20)
    expect(await behaviors.request('touch').finished).toMatchObject({ status: 'blocked' })
    driver.advance(400)
    await flush()
    expect(await dress.finished).toMatchObject({ status: 'completed' })
    expect(continuation).not.toHaveBeenCalled()
    expect(behaviors.current).toBe('rest')
    driver.advance(200)
    await flush()
    expect(view.translateX).toBe(0)
    expect(behaviors.current).toBeUndefined()
    behaviors.dispose()
  })
  it('checks guards on each request; equal priorities reject unless replacement is explicit', async () => {
    let enabled = false
    const behaviors = motionBehaviors({
      first: { when: () => enabled, run: () => new Promise(() => {}) },
      second: { equal: 'replace', run: () => new Promise(() => {}) },
    })
    expect(behaviors.can('first')).toBe(false)
    enabled = true
    const first = behaviors.request('first')
    expect(await behaviors.request('first').finished).toMatchObject({ status: 'blocked' })
    const second = behaviors.request('second')
    expect(await first.finished).toMatchObject({ status: 'interrupted' })
    first.cancel()
    expect(behaviors.current).toBe('second')
    second.cancel()
    expect(await second.finished).toMatchObject({ status: 'cancelled' })
    behaviors.dispose()
  })
  it('invalidates awaited work and guarded callbacks after cancellation and disposal', async () => {
    let resolve!: () => void, old!: BehaviorContext
    const next = vi.fn(),
      effect = vi.fn(),
      cleanup = vi.fn()
    const behaviors = motionBehaviors({
      task: {
        run: async (context) => {
          old = context
          context.scope.retain(cleanup)
          await context.wait(
            new Promise<void>((r) => {
              resolve = r
            }),
          )
          next()
        },
      },
    })
    const run = behaviors.request('task')
    const callback = old.guard(effect)
    behaviors.dispose()
    resolve()
    callback()
    await flush()
    expect(await run.finished).toMatchObject({ status: 'cancelled' })
    expect(next).not.toHaveBeenCalled()
    expect(effect).not.toHaveBeenCalled()
    expect(cleanup).toHaveBeenCalledOnce()
  })
  it('holds async continuations through manual suspension and never revives disposed work', async () => {
    let resolve!: () => void
    const next = vi.fn()
    const behaviors = motionBehaviors({
      task: {
        run: async ({ wait }) => {
          await wait(
            new Promise<void>((r) => {
              resolve = r
            }),
          )
          next()
        },
      },
    })
    const run = behaviors.request('task')
    behaviors.pause()
    resolve()
    await flush()
    expect(next).not.toHaveBeenCalled()
    behaviors.play()
    await flush()
    expect(next).toHaveBeenCalledOnce()
    expect(await run.finished).toMatchObject({ status: 'completed' })
    behaviors.dispose()
  })
  it('reports failures after cleanup and prevents reentrant disposal from launching rest', async () => {
    const onError = vi.fn(),
      rest = vi.fn()
    const behaviors = motionBehaviors(
      {
        rest: { run: rest },
        broken: {
          run: ({ scope }) => {
            scope.retain(() => behaviors.dispose())
            throw Error('effect failed')
          },
        },
      },
      { rest: 'rest', onError },
    )
    const result = await behaviors.request('broken').finished
    expect(result.status).toBe('failed')
    expect(onError).toHaveBeenCalledOnce()
    expect(rest).not.toHaveBeenCalled()
    expect(behaviors.disposed).toBe(true)
  })
  it('cancels restoration and preserves a paused animation across coordinator pause', async () => {
    const view = createView()
    let animation: ReturnType<BehaviorContext['scope']['animate']> | undefined
    const behaviors = motionBehaviors(
      {
        rest: {
          priority: -1,
          run: async ({ scope, wait }) => {
            await wait(scope.animate(view, { x: 0 }, { duration: 1000 }))
          },
        },
        task: {
          run: async ({ scope, wait }) => {
            animation = scope.animate(view, { x: 100 }, { duration: 1000 })
            animation.pause()
            await wait(animation)
          },
        },
      },
      { rest: 'rest' },
    )
    const task = behaviors.request('task')
    behaviors.pause()
    behaviors.play()
    expect(animation!.paused).toBe(true)
    task.cancel()
    expect(behaviors.current).toBe('rest')
    behaviors.dispose()
    driver.advance(2000)
    await flush()
    expect(behaviors.current).toBeUndefined()
    expect(driver.frames.size).toBe(0)
  })
})
