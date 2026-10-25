import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitForPresentation } from '../benchmarks/native-presentation.js'

/** Models NativeScript's initial macrotask followed by native display callbacks. */
function scheduler() {
  const tasks = new Map<number, () => void>()
  let id = 0
  const frame = (callback: () => void) => {
    const current = ++id
    tasks.set(current, callback)
    return () => tasks.delete(current)
  }
  const tick = () => {
    const ready = [...tasks.values()]
    tasks.clear()
    ready.forEach((callback) => callback())
  }
  return { frame, tick, tasks }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('held native presentation barrier', () => {
  it('does not sample at the initial macrotask or first native display callback', async () => {
    const s = scheduler()
    let position = 87.7
    const read = vi.fn(() => position)
    const result = waitForPresentation(s.frame).then(read)
    s.tick() // NativeScript's ASAP macrotask; no display update.
    await Promise.resolve()
    expect(read).not.toHaveBeenCalled()
    s.tick() // First display callback can precede the pending transaction commit.
    await Promise.resolve()
    expect(read).not.toHaveBeenCalled()
    position = 0
    s.tick() // Next display callback observes the held presentation.
    expect(await result).toBe(0)
    expect(read).toHaveBeenCalledTimes(1)
    expect(s.tasks.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('returns a wrong native value unchanged instead of polling until it matches', async () => {
    const s = scheduler(),
      read = vi.fn(() => 80)
    const result = waitForPresentation(s.frame).then(read)
    s.tick()
    s.tick()
    s.tick()
    expect(await result).toBe(80)
    expect(read).toHaveBeenCalledTimes(1)
    expect(s.tasks.size).toBe(0)
  })

  it('bounds a stalled display and cancels its queued callback', async () => {
    const s = scheduler(),
      read = vi.fn()
    const result = waitForPresentation(s.frame).then(read)
    const rejected = expect(result).rejects.toThrow('1500 ms')
    await vi.advanceTimersByTimeAsync(1500)
    await rejected
    expect(s.tasks.size).toBe(0)
    s.tick()
    expect(read).not.toHaveBeenCalled()
  })

  it('cancels between callbacks without leaving a timer or another frame', async () => {
    const s = scheduler(),
      signal = { aborted: false }
    const result = waitForPresentation(s.frame, signal)
    s.tick()
    signal.aborted = true
    s.tick()
    await expect(result).rejects.toThrow('cancelled')
    expect(s.tasks.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('does not register a callback for an already cancelled probe', async () => {
    const frame = vi.fn()
    await expect(waitForPresentation(frame, { aborted: true })).rejects.toThrow(
      'cancelled',
    )
    expect(frame).not.toHaveBeenCalled()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('cleans up when scheduling a native frame throws', async () => {
    await expect(
      waitForPresentation(() => {
        throw new Error('No display')
      }),
    ).rejects.toThrow('No display')
    expect(vi.getTimerCount()).toBe(0)
  })
})
