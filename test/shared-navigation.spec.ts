import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Frame } from '@nativescript/core'
import { Application } from '@nativescript/core'
import {
  sharedNavigation,
  type SharedNavigation,
  type SharedNavigationOptions,
} from '../src/shared-navigation/index.js'
import { configure } from '../src/config.js'
import { capture, captureNavigationImage } from '../src/shared-layout/native.js'
import { Image, ImageSource, View } from './shims/core.js'
import { driver, flush } from './helpers.js'
vi.mock('../src/shared-layout/native.js', () => ({
  capture: vi.fn(),
  captureNavigationImage: vi.fn(),
}))
class Flight {
  state = () =>
    JSON.stringify({
      pose: [10, 20, 80, 110, 10, 0, 0, -10, 80, 120],
      velocity: Array(10).fill(0),
    })
  pixels = () => 20_000
  prepare = vi.fn((): string | null => JSON.stringify([30, 40, 220, 300, 24]))
  holdPage = vi.fn(() => true)
  fade = vi.fn((_duration: number, done: (finished: boolean) => void) => done(true))
  freeze = () => false
  done: (completed: boolean) => void = () => {}
  play = vi.fn((_json: string, done: (completed: boolean) => void) => {
    this.done = done
  })
  dispose = vi.fn()
}
const controls: SharedNavigation[] = []
let flight: Flight
beforeEach(() => {
  flight = new Flight()
  vi.mocked(capture).mockReturnValue(flight)
  vi.mocked(captureNavigationImage).mockReturnValue(flight)
})
afterEach(() => {
  controls.splice(0).forEach((c) => c.dispose())
  vi.clearAllMocks()
  vi.useRealTimers()
})
function tagged(view = new View()) {
  return Object.assign(view, { sharedTransitionTag: 'photo' })
}
function fixture(
  options: SharedNavigationOptions = {},
  source = tagged(),
  target = tagged(),
) {
  const from = new View(),
    to = new View()
  from.children = [source]
  to.children = [target]
  const frame = Object.assign(new View(), { currentPage: from })
  const control = sharedNavigation(frame as unknown as Frame, options)
  controls.push(control)
  function commit() {
    frame.notify({ eventName: 'navigatingTo' })
    frame.currentPage = to
    frame.notify({ eventName: 'navigatedTo' })
  }
  async function layout() {
    await flush()
    driver.layout()
    await flush()
  }
  return { from, to, frame, control, commit, layout, source, target }
}
describe('shared navigation route and overlay ownership', () => {
  it('captures the clipped held pose and carries translation velocity into the spring', async () => {
    const source = Object.assign(new Image(), {
      sharedTransitionTag: 'photo',
      src: 'photo.png',
      stretch: 'aspectFit',
      imageSource: new ImageSource({ name: 'photo', symbolImage: false }),
    })
    const target = Object.assign(new Image(), {
      sharedTransitionTag: 'photo',
      src: source.src,
      imageSource: source.imageSource,
      stretch: 'aspectFill',
    })
    const f = fixture({}, source, target)
    const op = f.control.navigate({
      tag: 'photo',
      allowClippedSource: true,
      velocity: { x: 0, y: 900 },
      navigate: f.commit,
    })
    expect(captureNavigationImage).toHaveBeenCalledWith(source, 0, 8_000_000, true)
    await f.layout()
    const configured = JSON.parse(flight.play.mock.calls[0]![0])
    const y = configured.tracks[1]
    expect(
      ((y.values[1] - y.values[0]) * 1000) / (y.times[1] - y.times[0]),
    ).toBeGreaterThan(500)
    flight.done(true)
    expect((await op.finished).navigated).toBe(true)
  })
  it('captures first, invokes one route, prepares after layout and cleans once', async () => {
    const f = fixture()
    const navigate = vi.fn((options) => {
      expect(options).toEqual({ animated: false })
      expect(capture).toHaveBeenCalledTimes(1)
      f.commit()
    })
    const op = f.control.navigate({ tag: 'photo', navigate })
    expect(flight.play).not.toHaveBeenCalled()
    await f.layout()
    expect(f.control.state).toBe('running')
    flight.done(true)
    expect(await op.finished).toEqual({ status: 'completed', navigated: true })
    op.cancel()
    flight.done(false)
    expect(flight.dispose).toHaveBeenCalledTimes(1)
    expect(f.control.state).toBe('idle')
    expect(f.frame.listenerCount('navigatedTo')).toBe(0)
    expect(navigate).toHaveBeenCalledTimes(1)
  })
  it('holds the source while resolving the current return cell and releases all listeners', async () => {
    const f = fixture()
    let release!: (view: any) => void
    const operation = f.control.navigate({
      tag: 'photo',
      holdSource: true,
      returnTarget: { key: '42', resolve: () => new Promise((r) => (release = r)) },
      navigate: f.commit,
    })
    expect(flight.holdPage).toHaveBeenCalledWith(f.from, 8_000_000)
    await f.layout()
    expect(flight.prepare).not.toHaveBeenCalled()
    release(f.target)
    await f.layout()
    await f.layout()
    await f.layout()
    expect(flight.prepare).toHaveBeenCalled()
    flight.done(true)
    expect(await operation.finished).toMatchObject({
      status: 'completed',
      navigated: true,
    })
    expect(f.target.listenerCount('bindingContextChange')).toBe(0)
  })
  it('fades the retained source on missing return without another route operation', async () => {
    const f = fixture(),
      navigate = vi.fn(f.commit)
    const operation = f.control.navigate({
      tag: 'photo',
      holdSource: true,
      returnTarget: { key: '42', resolve: () => undefined },
      navigate,
    })
    await f.layout()
    await f.layout()
    expect(await operation.finished).toMatchObject({
      status: 'unavailable',
      reason: 'missing-target',
      navigated: true,
    })
    expect(flight.fade).toHaveBeenCalledOnce()
    expect(navigate).toHaveBeenCalledOnce()
    expect(flight.dispose).toHaveBeenCalledOnce()
  })
  it('ends a flight if its destination cell is rebound during playback', async () => {
    const f = fixture()
    const operation = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await f.layout()
    f.target.notify({ eventName: 'bindingContextChange' })
    expect(await operation.finished).toMatchObject({
      status: 'cancelled',
      reason: 'target-identity-changed',
    })
    expect(flight.dispose).toHaveBeenCalledOnce()
  })
  it('refuses concurrent taps without invoking another route', async () => {
    const f = fixture(),
      next = vi.fn()
    const first = f.control.navigate({ tag: 'photo', navigate: f.commit })
    const second = f.control.navigate({ tag: 'photo', navigate: next })
    expect(await second.finished).toEqual({
      status: 'unavailable',
      reason: 'busy',
      navigated: false,
    })
    expect(next).not.toHaveBeenCalled()
    first.cancel()
  })
  it('captures the current source again on programmatic back', async () => {
    const f = fixture()
    const first = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await f.layout()
    flight.done(true)
    await first.finished
    f.from.children = [tagged()]
    const back = f.control.navigate({
      tag: 'photo',
      navigate: () => {
        f.frame.notify({ eventName: 'navigatingTo' })
        f.frame.currentPage = f.from
        f.frame.notify({ eventName: 'navigatedTo' })
      },
    })
    await f.layout()
    expect(flight.prepare).toHaveBeenLastCalledWith(
      f.from.children[0],
      false,
      0,
      8_000_000,
    )
    flight.done(true)
    expect((await back.finished).navigated).toBe(true)
  })
  it.each(['missing-source', 'duplicate-source', 'missing-target', 'duplicate-target'])(
    'falls back for %s while committing the route',
    async (reason) => {
      const f = fixture()
      if (reason === 'missing-source') f.from.children = []
      if (reason === 'duplicate-source') f.from.children.push(tagged())
      if (reason === 'missing-target') f.to.children = []
      if (reason === 'duplicate-target') f.to.children.push(tagged())
      const op = f.control.navigate({ tag: 'photo', navigate: f.commit })
      await f.layout()
      expect(await op.finished).toEqual({
        status: 'unavailable',
        reason,
        navigated: true,
      })
      expect(flight.play).not.toHaveBeenCalled()
    },
  )
  it('restores on rejected guards and ignores late completion', async () => {
    const f = fixture()
    const error = new Error('guard failed')
    const op = f.control.navigate({ tag: 'photo', navigate: () => Promise.reject(error) })
    expect(await op.finished).toEqual({
      status: 'failed',
      reason: 'navigation-failed',
      error,
      navigated: false,
    })
    f.commit()
    await f.layout()
    expect(flight.play).not.toHaveBeenCalled()
    expect(flight.dispose).toHaveBeenCalledTimes(1)
  })
  it('settles an aborted router promise with no route change', async () => {
    const f = fixture(),
      op = f.control.navigate({ tag: 'photo', navigate: () => Promise.resolve(false) })
    expect(await op.finished).toEqual({
      status: 'unavailable',
      reason: 'route-unchanged',
      navigated: false,
    })
  })
  it('bounds both a never-settling guard and a missing layout', async () => {
    vi.useFakeTimers()
    const f = fixture({ navigationTimeout: 100, layoutTimeout: 50 })
    const first = f.control.navigate({
      tag: 'photo',
      navigate: () => new Promise(() => {}),
    })
    await vi.advanceTimersByTimeAsync(100)
    expect((await first.finished).reason).toBe('navigation-timeout')
    const second = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await flush()
    await vi.advanceTimersByTimeAsync(50)
    expect((await second.finished).reason).toBe('layout-timeout')
    await f.layout()
    expect(flight.play).not.toHaveBeenCalled()
  })
  it('preserves navigation when the optional native runtime is unavailable', async () => {
    const f = fixture()
    vi.mocked(capture).mockImplementationOnce(() => {
      throw new Error('Rebuild required')
    })
    const op = f.control.navigate({ tag: 'photo', navigate: f.commit })
    expect(await op.finished).toEqual({
      status: 'unavailable',
      reason: 'native-unavailable',
      navigated: true,
    })
  })
  it('does not borrow a duplicate identity from a nested Frame', async () => {
    const f = fixture()
    const nested = Object.assign(new View(), {
      typeName: 'Frame',
      sharedTransitionTag: 'photo',
    })
    nested.children = [tagged()]
    f.to.children.push(nested)
    const op = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await f.layout()
    flight.done(true)
    expect((await op.finished).status).toBe('completed')
  })
  it('cancels during route preparation and ignores a late route callback', async () => {
    const f = fixture()
    let resolve!: () => void
    const op = f.control.navigate({
      tag: 'photo',
      navigate: () =>
        new Promise<void>((r) => {
          resolve = r
        }),
    })
    op.cancel()
    expect(await op.finished).toEqual({
      status: 'cancelled',
      reason: 'cancelled',
      navigated: false,
    })
    f.commit()
    resolve()
    await f.layout()
    expect(flight.play).not.toHaveBeenCalled()
    expect(flight.dispose).toHaveBeenCalledTimes(1)
  })
  it('does not leave a running native overlay without a completion callback', async () => {
    vi.useFakeTimers()
    const f = fixture({ transition: { duration: 100 } })
    const op = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await f.layout()
    await vi.advanceTimersByTimeAsync(1000)
    expect((await op.finished).reason).toBe('playback-timeout')
    expect(flight.dispose).toHaveBeenCalledTimes(1)
  })
  it('cleans the overlay when another route interrupts playback', async () => {
    const f = fixture(),
      op = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await f.layout()
    f.frame.notify({ eventName: 'navigatingTo' })
    expect(await op.finished).toEqual({
      status: 'cancelled',
      reason: 'navigation-interrupted',
      navigated: true,
    })
    expect(flight.dispose).toHaveBeenCalledTimes(1)
  })
  it('safely finishes on resize/native geometry invalidation', async () => {
    const f = fixture(),
      op = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await f.layout()
    flight.done(false)
    expect((await op.finished).reason).toBe('geometry-changed')
    expect(flight.dispose).toHaveBeenCalledTimes(1)
  })
  it('keeps the route when reduced motion disables the overlay', async () => {
    configure({ reducedMotion: 'always' })
    const f = fixture(),
      op = f.control.navigate({ tag: 'photo', navigate: f.commit })
    expect(await op.finished).toEqual({
      status: 'unavailable',
      reason: 'reduced-motion',
      navigated: true,
    })
    expect(capture).not.toHaveBeenCalled()
  })
  it('cleans on suspension and on Frame disposal without disposing a new owner', async () => {
    const f = fixture(),
      op = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await f.layout()
    Application.notify({ eventName: Application.suspendEvent })
    expect((await op.finished).reason).toBe('suspended')
    f.frame.notify({ eventName: 'unloaded' })
    expect(f.control.state).toBe('disposed')
    const next = sharedNavigation(f.frame as unknown as Frame)
    controls.push(next)
    f.control.dispose()
    expect(() => sharedNavigation(f.frame as unknown as Frame)).toThrow(/already/)
  })
  it('animates nine image geometry channels plus blend using decoded content', async () => {
    const source = Object.assign(new Image(), {
      src: 'local.png',
      stretch: 'aspectFill',
      imageSource: new ImageSource({ name: 'local', symbolImage: false }),
    })
    const target = Object.assign(new Image(), {
      src: 'local.png',
      stretch: 'aspectFit',
      imageSource: new ImageSource({ name: 'local', symbolImage: false }),
    })
    const f = fixture({}, tagged(source), tagged(target))
    flight.prepare.mockReturnValue(
      JSON.stringify([30, 40, 220, 300, 10, 10, 0, 200, 300]),
    )
    const op = f.control.navigate({ tag: 'photo', navigate: f.commit })
    await f.layout()
    const tracks = JSON.parse(flight.play.mock.calls[0]![0]).tracks as {
      values: number[]
    }[]
    expect(tracks).toHaveLength(10)
    expect(tracks.map((t) => t.values.at(-1))).toEqual([
      30, 40, 220, 300, 10, 1, 10, 0, 200, 300,
    ])
    expect(captureNavigationImage).toHaveBeenCalledTimes(1)
    expect(capture).not.toHaveBeenCalled()
    flight.done(true)
    expect((await op.finished).status).toBe('completed')
  })
})
