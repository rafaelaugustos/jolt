import { describe, expect, it } from 'vitest'
import { FrameScheduler, type FrameTask } from '../src/web/scheduler.js'
import { NumericValue } from '../src/web/value.js'

function clock() {
  let now = 0,
    id = 0
  const frames = new Map<number, (t: number) => void>()
  const errors: unknown[] = []
  const scheduler = new FrameScheduler({
    now: () => now,
    request: (cb) => {
      frames.set(++id, cb)
      return id
    },
    cancel: (key) => {
      frames.delete(key)
    },
    error: (e) => {
      errors.push(e)
    },
  })
  return {
    scheduler,
    frames,
    errors,
    time: (t: number) => {
      now = t
    },
    frame: (t: number) => {
      now = t
      const batch = [...frames.values()]
      frames.clear()
      for (const cb of batch) cb(t)
    },
  }
}

describe('context frame scheduling', () => {
  it('coalesces demand, batches every read before writes and stops at rest', () => {
    const c = clock(),
      order: string[] = []
    const a = {
      read: () => {
        order.push('read a')
      },
      update: () => {
        order.push('update a')
      },
      write: () => {
        order.push('write a')
      },
    }
    c.scheduler.add(a)
    c.scheduler.add(a)
    c.scheduler.add({
      read: () => {
        order.push('read b')
      },
      update: () => {
        order.push('update b')
      },
      write: () => {
        order.push('write b')
      },
    })
    expect(c.frames.size).toBe(1)
    c.frame(1000 / 144)
    expect(order).toEqual([
      'read a',
      'read b',
      'update a',
      'update b',
      'write a',
      'write b',
    ])
    expect(c.frames.size).toBe(0)
  })
  it('freezes hidden time and resumes a retained task without catch-up', () => {
    const c = clock(),
      times: number[] = []
    const task = {
      update: (t: number) => {
        times.push(t)
        return true
      },
    }
    c.scheduler.add(task)
    c.frame(10)
    c.time(12)
    c.scheduler.hidden(true)
    expect(c.frames.size).toBe(0)
    c.time(10012)
    expect(c.scheduler.now()).toBe(12)
    c.scheduler.hidden(false)
    c.frame(10020)
    expect(times).toEqual([10, 20])
    c.scheduler.remove(task)
    expect(c.frames.size).toBe(0)
  })
  it('isolates failed jobs, respects cancellation in reads and defers reentrant work', () => {
    const c = clock(),
      order: string[] = [],
      fail = new Error('read failed')
    const cancelled: FrameTask = {
      update: () => {
        order.push('cancelled')
      },
    }
    const late: FrameTask = {
      write: () => {
        order.push('late')
      },
    }
    c.scheduler.add({
      read: () => {
        c.scheduler.remove(cancelled)
        throw fail
      },
    })
    c.scheduler.add(cancelled)
    c.scheduler.add({
      write: () => {
        order.push('first')
        c.scheduler.add(late)
      },
    })
    c.frame(10)
    expect(order).toEqual(['first'])
    expect(c.errors).toEqual([fail])
    c.frame(20)
    expect(order).toEqual(['first', 'late'])
    expect(c.frames.size).toBe(0)
  })
  it('cancels queued work and ignores future demand on disposal', () => {
    const c = clock()
    let called = false
    const task = {
      write: () => {
        called = true
      },
    }
    c.scheduler.add(task)
    c.scheduler.dispose()
    c.scheduler.add(task)
    c.frame(50)
    expect(called).toBe(false)
    expect(c.scheduler.size).toBe(0)
    expect(c.frames.size).toBe(0)
  })
})

describe('numeric Web values', () => {
  it('updates input immediately while coalescing observers after writes', () => {
    const c = clock(),
      observed: number[] = []
    const v = new NumericValue(
      c.scheduler,
      0,
      (e) => c.errors.push(e),
      () => {},
    )
    const stop = v.subscribe((n) => observed.push(n))
    c.time(10)
    v.set(2)
    c.time(20)
    v.set(4)
    expect(v.get()).toBe(4)
    expect(v.getVelocity()).toBe(200)
    expect(observed).toEqual([])
    c.frame(24)
    expect(observed).toEqual([4])
    expect(c.frames.size).toBe(0)
    v.set(5)
    stop()
    expect(c.frames.size).toBe(0)
  })
  it('retains valid input on errors and disconnects consumers exactly once', () => {
    const c = clock()
    let ended = 0,
      forgotten = 0
    const v = new NumericValue(
      c.scheduler,
      3,
      () => {},
      () => {
        forgotten++
      },
    )
    v.listen(
      () => {},
      () => {
        ended++
      },
    )
    v.subscribe(() => {
      throw new Error('observer')
    })
    expect(() => v.set(NaN)).toThrow()
    expect(v.get()).toBe(3)
    v.set(8)
    v.dispose()
    v.dispose()
    c.frame(10)
    expect(ended).toBe(1)
    expect(forgotten).toBe(1)
    expect(v.getVelocity()).toBe(0)
    expect(() => v.set(4)).toThrow(/disposed/)
    expect(c.frames.size).toBe(0)
  })
})
