import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Application, type View as NativeView } from '@nativescript/core'
import { configure } from '../src/config.js'
import { sharedLayout, type SharedLayout } from '../src/shared-layout/index.js'
import { capture } from '../src/shared-layout/native.js'
import { View } from './shims/core.js'
import { driver, flush } from './helpers.js'
vi.mock('../src/shared-layout/native.js', () => ({ capture: vi.fn() }))
class Flight {
  done: (value: boolean) => void = () => {}
  pose = [12, 24, 60, 80, 8, 0]
  velocity = [100, 0, 0, 0, 0]
  pixels = vi.fn(() => 4800)
  state = () => JSON.stringify({ pose: this.pose, velocity: this.velocity })
  prepare = vi.fn((): string | null => JSON.stringify([180, 90, 180, 220, 24]))
  freeze = vi.fn(() => true)
  play = vi.fn((_json: string, complete: (value: boolean) => void) => {
    this.done = complete
  })
  dispose = vi.fn()
}
const controls: SharedLayout[] = []
const flights: Flight[] = []
beforeEach(() => {
  vi.mocked(capture).mockImplementation(() => {
    const flight = new Flight()
    flights.push(flight)
    return flight
  })
})
afterEach(() => {
  controls.splice(0).forEach((control) => control.dispose())
  flights.length = 0
  vi.mocked(capture).mockReset()
  vi.useRealTimers()
})
function fixture() {
  const host = new View(),
    source = new View(),
    target = new View()
  source.parent = host
  target.parent = host
  const control = sharedLayout(host as unknown as NativeView)
  controls.push(control)
  const off = control.attach(source as unknown as NativeView, 'cover', {
    content: 'image',
  })
  return { host, source, target, control, off }
}
async function layout() {
  await flush()
  driver.layout()
  await flush()
}
describe('shared layout identity and lifecycle', () => {
  it('captures before mutation, resolves its replacement after layout and restores once', async () => {
    const { control, target } = fixture()
    const handle = control.transition(() => {
      expect(capture).toHaveBeenCalledTimes(1)
      control.attach(target as unknown as NativeView, 'cover')
    })
    expect(flights[0]!.play).not.toHaveBeenCalled()
    await layout()
    expect(flights[0]!.prepare).toHaveBeenCalledWith(target, false, 0, 8_000_000)
    flights[0]!.done(true)
    expect(await handle.finished).toEqual({ status: 'completed' })
    handle.cancel()
    expect(flights[0]!.dispose).toHaveBeenCalledTimes(1)
    expect(control.active).toBe(false)
  })
  it('rejects duplicate identities outside a transition and overlapping descendants', () => {
    const { control, target, source } = fixture()
    expect(() => control.attach(target as unknown as NativeView, 'cover')).toThrow(
      /Duplicate/,
    )
    target.parent = source
    expect(() => control.attach(target as unknown as NativeView, 'child')).toThrow(
      /overlap/,
    )
  })
  it('ignores a stale disposer after the replacement attaches', async () => {
    const { control, target, off } = fixture()
    const handle = control.transition(() => {
      control.attach(target as unknown as NativeView, 'cover')
      off()
    })
    await layout()
    flights[0]!.done(true)
    expect((await handle.finished).status).toBe('completed')
  })
  it('keeps the captured source after its original view unloads', async () => {
    const { control, target, source } = fixture()
    const handle = control.transition(() => {
      source.notify({ eventName: 'unloaded', object: source })
      source.unload()
      control.attach(target as unknown as NativeView, 'cover')
    })
    await layout()
    flights[0]!.done(true)
    expect((await handle.finished).status).toBe('completed')
  })
  it('returns an explicit fallback when the destination disappears', async () => {
    const { control, off } = fixture()
    const handle = control.transition(off)
    await layout()
    expect(await handle.finished).toEqual({
      status: 'unavailable',
      reason: 'missing-target',
    })
    expect(flights[0]!.dispose).toHaveBeenCalledOnce()
  })
  it('preserves the current native image and velocity when reversed', async () => {
    const { control, target, source } = fixture()
    const first = control.transition(() => {
      control.attach(target as unknown as NativeView, 'cover')
    })
    await layout()
    const second = control.transition(() => {
      control.attach(source as unknown as NativeView, 'cover')
    })
    expect(await first.finished).toEqual({ status: 'cancelled', reason: 'interrupted' })
    expect(flights[0]!.freeze).toHaveBeenCalledOnce()
    expect(flights[0]!.dispose).not.toHaveBeenCalled()
    await layout()
    expect(capture).toHaveBeenCalledTimes(1)
    const played = JSON.parse(flights[0]!.play.mock.calls[1]![0])
    expect(played.tracks[0].values[0]).toBe(12)
    expect(played.tracks).toHaveLength(6)
    flights[0]!.done(true)
    expect((await second.finished).status).toBe('completed')
    expect(flights[0]!.dispose).toHaveBeenCalledOnce()
  })
  it('waits for all identities and cancels them together on geometry change', async () => {
    const { control, host } = fixture()
    const other = new View()
    other.parent = host
    control.attach(other as unknown as NativeView, 'tab')
    const handle = control.transition(() => {})
    await layout()
    flights[0]!.done(true)
    expect(control.active).toBe(true)
    flights[1]!.done(false)
    expect(await handle.finished).toEqual({
      status: 'cancelled',
      reason: 'geometry-changed',
    })
    expect(flights.every((f) => f.dispose.mock.calls.length === 1)).toBe(true)
  })
  it('does not start a pending layout after explicit cancellation', async () => {
    const { control } = fixture()
    const handle = control.transition(() => {})
    handle.cancel()
    await layout()
    expect(flights[0]!.play).not.toHaveBeenCalled()
    expect((await handle.finished).status).toBe('cancelled')
  })
  it('bounds missing layout rather than retaining hidden sources indefinitely', async () => {
    vi.useFakeTimers()
    const { control } = fixture()
    const handle = control.transition(() => {})
    await Promise.resolve()
    await vi.advanceTimersByTimeAsync(501)
    expect(await handle.finished).toEqual({
      status: 'unavailable',
      reason: 'layout-timeout',
    })
    expect(flights[0]!.dispose).toHaveBeenCalledOnce()
  })
  it('applies the mutation without capturing when motion is reduced', async () => {
    const { control } = fixture()
    configure({ reducedMotion: 'always' })
    const change = vi.fn()
    const handle = control.transition(change)
    expect(change).toHaveBeenCalledOnce()
    expect(capture).not.toHaveBeenCalled()
    expect(await handle.finished).toEqual({
      status: 'unavailable',
      reason: 'reduced-motion',
    })
  })
  it('reports unsupported snapshots and still applies the app change', async () => {
    const { control } = fixture()
    vi.mocked(capture).mockReturnValue(undefined)
    const change = vi.fn()
    const handle = control.transition(change)
    expect(change).toHaveBeenCalledOnce()
    expect((await handle.finished).reason).toBe('unsupported-target')
  })
  it('cleans earlier captures when a later source exceeds its remaining budget', async () => {
    const { control, host } = fixture()
    const other = new View()
    other.parent = host
    control.attach(other as unknown as NativeView, 'tab')
    vi.mocked(capture)
      .mockImplementationOnce(() => {
        const f = new Flight()
        flights.push(f)
        return f
      })
      .mockReturnValueOnce(undefined)
    const handle = control.transition(() => {})
    expect((await handle.finished).status).toBe('unavailable')
    expect(flights[0]!.dispose).toHaveBeenCalledOnce()
    expect(vi.mocked(capture).mock.calls[1]![3]).toBe(8_000_000 - 4800)
  })
  it('cleans up when the application mutation throws', () => {
    const { control } = fixture()
    expect(() =>
      control.transition(() => {
        throw Error('mutation failed')
      }),
    ).toThrow('mutation failed')
    expect(control.active).toBe(false)
    expect(flights[0]!.dispose).toHaveBeenCalledOnce()
  })
  it('rejects async mutations and infinite/repeating timing', () => {
    const { control } = fixture()
    expect(() => control.transition(async () => {})).toThrow(/synchronous/)
    expect(() => control.transition(() => {}, { repeat: 1 } as never)).toThrow(/repeat/)
    expect(() => control.transition(() => {}, { duration: Infinity })).toThrow(/finite/)
  })
  it('rejects invalid spring physics before changing the view tree', () => {
    const { control } = fixture()
    const change = vi.fn()
    for (const options of [
      { mass: 0 },
      { stiffness: -1 },
      { damping: -2 },
      { type: 'spring', duration: 0 },
      { duration: 30_001 },
    ])
      expect(() => control.transition(change, options as never)).toThrow()
    expect(change).not.toHaveBeenCalled()
    expect(capture).not.toHaveBeenCalled()
  })
  it('cleans snapshots if layout scheduling itself throws', async () => {
    const { control } = fixture()
    const schedule = vi.spyOn(driver, 'afterLayout').mockImplementationOnce(() => {
      throw Error('layout unavailable')
    })
    const handle = control.transition(() => {})
    await flush()
    expect((await handle.finished).status).toBe('unavailable')
    expect(flights[0]!.dispose).toHaveBeenCalledOnce()
    schedule.mockRestore()
  })
  it('cancels on background, permits resume and disposes idempotently', async () => {
    const { control } = fixture()
    const handle = control.transition(() => {})
    Application.notify({ eventName: Application.suspendEvent })
    expect((await handle.finished).reason).toBe('suspended')
    expect(() => control.transition(() => {})).toThrow(/paused/)
    Application.notify({ eventName: Application.resumeEvent })
    control.transition(() => {})
    control.dispose()
    control.dispose()
    expect(flights.every((f) => f.dispose.mock.calls.length === 1)).toBe(true)
  })
  it('preserves explicit pause across background/resume', () => {
    const { control } = fixture()
    control.pause()
    Application.notify({ eventName: Application.suspendEvent })
    Application.notify({ eventName: Application.resumeEvent })
    expect(control.paused).toBe(true)
    expect(() => control.transition(() => {})).toThrow(/paused/)
    control.play()
    expect(control.paused).toBe(false)
  })
  it('cancels on host unload and releases identity ownership on disposal', async () => {
    const { control, host } = fixture()
    const handle = control.transition(() => {})
    host.notify({ eventName: 'unloaded', object: host })
    expect((await handle.finished).reason).toBe('unloaded')
    control.dispose()
    const next = sharedLayout(host as unknown as NativeView)
    controls.push(next)
  })
})
