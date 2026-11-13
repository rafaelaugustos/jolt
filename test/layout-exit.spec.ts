import { afterEach, describe, expect, it, vi } from 'vitest'
import { animateLayout, configure } from '../src/index.js'
import { setExitCaptureDriver } from '../src/layout-exit.js'
import { createView, driver, flush } from './helpers.js'
import { Application } from './shims/core.js'

const cleanup: (() => void)[] = []
afterEach(() => {
  cleanup.splice(0).forEach((fn) => fn())
  setExitCaptureDriver()
  configure({ reducedMotion: 'user' })
})
function scene(budget = 5000) {
  const host = createView(),
    a = createView(),
    b = createView()
  for (const [i, view] of [a, b].entries()) {
    view.layoutBounds = { left: 0, top: i * 50, right: 100, bottom: (i + 1) * 50 }
    view.parent = host
  }
  host.children.push(a, b)
  const remove = function (view: typeof a) {
    host.children.splice(host.children.indexOf(view), 1)
    view.parent = undefined as never
    view.notify({ eventName: 'unloaded', object: view })
    view.unload()
  }
  Object.assign(host, { _removeView: remove })
  const snapshots: {
    view: typeof a
    dispose: ReturnType<typeof vi.fn>
    play: ReturnType<typeof vi.fn>
    complete?: (done: boolean) => void
  }[] = []
  setExitCaptureDriver((view, remaining) => {
    expect(view.nativeViewProtected).toBeDefined()
    if (remaining < budget) return
    const snapshot = {
      view: view as typeof a,
      dispose: vi.fn(),
      play: vi.fn((json, complete) => {
        snapshot.complete = complete
      }),
      complete: undefined as ((done: boolean) => void) | undefined,
    }
    snapshots.push(snapshot)
    return {
      ...snapshot,
      pixels: () => budget,
      state: () => JSON.stringify({ pose: [0, 0, 100, 50, 0, 0] }),
      prepare: () => null,
      freeze: () => false,
    }
  })
  const removeChild = (view: typeof a) =>
    (host as unknown as { _removeView(view: typeof a): void })._removeView(view)
  return { host, a, b, remove, removeChild, snapshots }
}
describe('layout exits', () => {
  it('captures only removed children before teardown and waits for exits and moves', async () => {
    const { host, a, b, removeChild, snapshots, remove } = scene()
    const animation = animateLayout(
      host,
      () => {
        removeChild(a)
        b.layoutBounds = { left: 0, top: 0, right: 100, bottom: 50 }
      },
      { exit: 'fadeOut' },
    )
    cleanup.push(animation.stop)
    expect(snapshots.map((s) => s.view)).toEqual([a])
    driver.layout()
    expect((host as any)._removeView).toBe(remove)
    const tracks = JSON.parse(snapshots[0]!.play.mock.calls[0]![0]).tracks
    expect(tracks[5].values.at(-1)).toBe(1)
    let settled = false
    void animation.finished.then(() => (settled = true))
    driver.advance(3000)
    await flush()
    expect(settled).toBe(false)
    snapshots[0]!.complete!(true)
    expect(await animation).toBe(true)
    expect(snapshots[0]!.dispose).toHaveBeenCalledOnce()
    expect(a.listenerCount('loaded')).toBe(0)
  })
  it('bounds concurrent snapshot pixels and cancels a reinserted copy', async () => {
    const { host, a, b, removeChild, snapshots } = scene()
    const animation = animateLayout(
      host,
      () => {
        removeChild(a)
        removeChild(b)
      },
      { exit: { y: 8, scale: 0.9 }, maxSnapshotPixels: 5000 },
    )
    cleanup.push(animation.stop)
    driver.layout()
    expect(snapshots).toHaveLength(1)
    host.children.push(a)
    a.parent = host
    a.load()
    expect(await animation).toBe(false)
    expect(snapshots[0]!.dispose).toHaveBeenCalledOnce()
  })
  it('never captures a reorder or removal under reduced motion', async () => {
    const { host, a, removeChild, snapshots } = scene()
    configure({ reducedMotion: 'always' })
    const animation = animateLayout(host, () => removeChild(a), { exit: 'fadeOut' })
    cleanup.push(animation.stop)
    driver.layout()
    expect(await animation).toBe(true)
    expect(snapshots).toHaveLength(0)
  })
  it.each(['stop', 'background', 'unload', 'reduced'] as const)(
    'cleans an interrupted exit on %s',
    async (reason) => {
      const { host, a, removeChild, snapshots, remove } = scene()
      const animation = animateLayout(host, () => removeChild(a), { exit: 'fadeOut' })
      if (reason === 'stop') animation.stop()
      if (reason === 'background')
        Application.notify({ eventName: Application.suspendEvent })
      if (reason === 'unload') host.notify({ eventName: 'unloaded', object: host })
      if (reason === 'reduced') configure({ reducedMotion: 'always' })
      expect(await animation).toBe(false)
      expect((host as any)._removeView).toBe(remove)
      expect(snapshots[0]!.dispose).toHaveBeenCalledOnce()
      expect(a.listenerCount('loaded')).toBe(0)
    },
  )
  it('validates before mutation and releases captures if the mutation throws', () => {
    const { host, a, removeChild, snapshots } = scene(),
      change = vi.fn()
    expect(() => animateLayout(host, change, { exit: { opacity: 2 } })).toThrow()
    expect(change).not.toHaveBeenCalled()
    expect(() =>
      animateLayout(
        host,
        () => {
          removeChild(a)
          throw Error('abort')
        },
        { exit: 'fadeOut' },
      ),
    ).toThrow('abort')
    expect(snapshots[0]!.dispose).toHaveBeenCalledOnce()
  })
})
