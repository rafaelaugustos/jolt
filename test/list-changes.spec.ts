import { describe, expect, it, vi } from 'vitest'
import { createListChanges, type ListChangeHost } from '../src/core/list-changes.js'
import type { Animation } from '../src/core/playback.js'
function motion() {
  let resolve!: (value: boolean) => void
  const finished = new Promise<boolean>((done) => (resolve = done))
  return {
    finished,
    stop: () => resolve(false),
    then: finished.then.bind(finished),
    resolve,
  } satisfies Animation & { resolve(value: boolean): void }
}
function scene() {
  type Item = { id: number }
  let items: Item[] = Array.from({ length: 200 }, (_, id) => ({ id })),
    offset = 501,
    reduced = false
  const targets = new Map<number, object>(),
    jobs = new Set<() => void>(),
    moves: {
      target: object
      x: number
      y: number
      enter: boolean
      animation: ReturnType<typeof motion>
      dispose: ReturnType<typeof vi.fn>
    }[] = [],
    copies: {
      key: number
      dispose: ReturnType<typeof vi.fn>
      animation: ReturnType<typeof motion>
    }[] = []
  let events!: Parameters<ListChangeHost<Item, number, object>['observe']>[0]
  const rowTarget = (id: number) => {
    let target = targets.get(id)
    if (!target) {
      target = { id }
      targets.set(id, target)
    }
    return target
  }
  const render = vi.fn((next: readonly Item[]) => {
    items = [...next]
  })
  const host: ListChangeHost<Item, number, object> = {
    items: () => items,
    render,
    reduced: () => reduced,
    rows: () =>
      items.flatMap((item, index) => {
        const y = index * 50 - offset
        return y + 50 > 0 && y < 200
          ? [{ key: item.id, target: rowTarget(item.id), x: 0, y }]
          : []
      }),
    layout: (callback) => {
      jobs.add(callback)
      return () => {
        jobs.delete(callback)
      }
    },
    anchor: (keys) => {
      const index = Math.floor(offset / 50),
        key = keys[index]!,
        local = offset - index * 50
      return (next) => {
        const found = next.indexOf(key)
        offset =
          (found < 0 ? Math.min(index, Math.max(0, next.length - 1)) : found) * 50 + local
      }
    },
    capture(target) {
      const animation = motion(),
        copy = { key: (target as Item).id, animation, dispose: vi.fn(animation.stop) }
      copies.push(copy)
      return { pixels: 5000, play: () => animation, dispose: copy.dispose }
    },
    move(target, x, y, enter) {
      const animation = motion(),
        result = { target, x, y, enter, animation, dispose: vi.fn(animation.stop) }
      moves.push(result)
      return result
    },
    observe(next) {
      events = next
      return () => {
        jobs.clear()
      }
    },
  }
  const controller = createListChanges(
    { key: (item: Item) => item.id, exit: 'fadeOut' },
    host,
  )
  const frame = () => {
    const batch = [...jobs]
    jobs.clear()
    batch.forEach((job) => job())
  }
  const layout = () => {
    frame()
    frame()
  }
  return {
    controller,
    host,
    moves,
    copies,
    render,
    rowTarget,
    layout,
    frame,
    jobs,
    get events() {
      return events
    },
    get items() {
      return items
    },
    get offset() {
      return offset
    },
    reduce() {
      reduced = true
      events.stop()
    },
  }
}
describe('keyed list update coordinator', () => {
  it('preserves a visible key on insertion above 200 rows without animating off-screen rows', async () => {
    const s = scene(),
      animation = s.controller.update([{ id: -1 }, ...s.items])
    s.layout()
    expect(s.offset).toBe(551)
    expect(s.moves).toHaveLength(0)
    expect(s.copies).toHaveLength(0)
    expect(await animation).toBe(true)
    s.controller.dispose()
  })
  it('snapshots only deleted visible keys and moves their realized neighbors', async () => {
    const s = scene(),
      animation = s.controller.update(s.items.filter((row) => row.id !== 12))
    s.layout()
    expect(s.copies.map((copy) => copy.key)).toEqual([12])
    expect(s.moves.length).toBeGreaterThan(0)
    expect(s.moves.length).toBeLessThan(6)
    expect(s.moves.every((move) => !move.enter && move.y === 50)).toBe(true)
    s.moves.forEach((move) => move.animation.resolve(true))
    s.copies[0]!.animation.resolve(true)
    expect(await animation).toBe(true)
    expect(s.copies[0]!.dispose).toHaveBeenCalledOnce()
    s.controller.dispose()
  })
  it('interrupts updates before the pending renderer boundary and after playback starts', async () => {
    const s = scene(),
      first = s.controller.update(s.items.filter((row) => row.id !== 12))
    const second = s.controller.update(s.items.filter((row) => row.id !== 13))
    expect(await first).toBe(false)
    s.layout()
    const third = s.controller.update([...s.items].reverse())
    expect(await second).toBe(false)
    s.layout()
    third.stop()
    expect(await third).toBe(false)
    expect(s.moves.every((move) => move.dispose.mock.calls.length === 1)).toBe(true)
    expect(s.jobs.size).toBe(0)
    s.controller.dispose()
  })
  it('resets a recycled target before another key can use it', async () => {
    const s = scene(),
      animation = s.controller.update(s.items.filter((row) => row.id !== 12))
    s.layout()
    const moving = s.moves[0]!
    s.events.recycle(moving.target)
    expect(moving.dispose).toHaveBeenCalledOnce()
    s.moves.forEach((move) => move.animation.resolve(true))
    s.copies.forEach((copy) => copy.animation.resolve(true))
    expect(await animation).toBe(false)
    s.controller.dispose()
  })
  it('keeps the previous operation for invalid keys and rejects mutation after disposal', () => {
    const s = scene()
    s.controller.update(s.items.filter((row) => row.id !== 12))
    expect(() => s.controller.update([{ id: 1 }, { id: 1 }])).toThrow('unique')
    expect(s.render).toHaveBeenCalledOnce()
    expect(s.jobs.size).toBe(1)
    s.controller.dispose()
    expect(() => s.controller.update([])).toThrow('disposed')
  })
  it('settles reduced motion, releases paused/unloaded work, and supports empty data', async () => {
    const s = scene()
    s.reduce()
    const animation = s.controller.update(s.items.filter((row) => row.id !== 12))
    s.layout()
    expect(await animation).toBe(true)
    expect(s.moves).toHaveLength(0)
    const empty = s.controller.update([])
    s.layout()
    expect(await empty).toBe(true)
    s.controller.pause()
    expect(s.controller.paused).toBe(true)
    s.controller.play()
    expect(s.controller.paused).toBe(false)
    s.events.dispose()
    expect(s.controller.disposed).toBe(true)
    expect(s.jobs.size).toBe(0)
  })
  it('cleans captures when a renderer throws without retaining pending layout work', () => {
    const s = scene()
    s.render.mockImplementation(() => {
      throw Error('renderer failed')
    })
    expect(() => s.controller.update(s.items.filter((row) => row.id !== 12))).toThrow(
      'renderer failed',
    )
    expect(s.copies[0]!.dispose).toHaveBeenCalledOnce()
    expect(s.jobs.size).toBe(0)
    s.controller.dispose()
  })
})
