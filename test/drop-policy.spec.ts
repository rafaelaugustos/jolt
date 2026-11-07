import { describe, expect, it, vi } from 'vitest'
import {
  createDropPolicy,
  dropHits,
  type DropOptions,
  type DropRect,
} from '../src/core/drop.js'

function fixture(options: Partial<DropOptions<string>> = {}) {
  const boxes = new Map<string, DropRect>([
    ['source', { x: 0, y: 0, width: 20, height: 20 }],
    ['a', { x: 90, y: 0, width: 80, height: 80 }],
    ['b', { x: 90, y: 0, width: 80, height: 80 }],
  ])
  let enabled = true
  const cancelDrag = vi.fn(),
    onDrop = vi.fn(),
    onReject = vi.fn(),
    onEnter = vi.fn(),
    onLeave = vi.fn()
  const policy = createDropPolicy(
    'source',
    {
      targets: [
        { id: 'a', target: 'a' },
        { id: 'b', target: 'b', priority: 1 },
      ],
      onDrop,
      onReject,
      onEnter,
      onLeave,
      ...options,
    },
    { bounds: (id) => boxes.get(id), enabled: () => enabled, cancelDrag },
  )
  return {
    ...policy,
    boxes,
    cancelDrag,
    onDrop,
    onReject,
    onEnter,
    onLeave,
    move(x: number) {
      boxes.set('source', { x, y: 10, width: 20, height: 20 })
      policy.move()
    },
    disable() {
      enabled = false
    },
  }
}

describe('portable drop policy', () => {
  it('selects by priority, changes hover once, and checks the final release position', () => {
    const f = fixture()
    f.begin()
    f.move(100)
    f.move(110)
    expect(f.handle.hovered).toBe('b')
    expect(f.onEnter).toHaveBeenCalledTimes(1)
    f.boxes.set('source', { x: 0, y: 0, width: 20, height: 20 })
    expect(f.release()).toBe(false)
    expect(f.onDrop).not.toHaveBeenCalled()
    expect(f.onLeave).toHaveBeenCalledTimes(1)
    expect(f.cancelDrag).not.toHaveBeenCalled()
    f.begin()
    f.move(100)
    expect(f.release()).toBe(true)
    expect(f.release()).toBe(false)
    expect(f.onDrop).toHaveBeenCalledTimes(1)
    expect(f.cancelDrag).toHaveBeenCalledTimes(1)
  })
  it('uses positive overlap or center, with stable tie ordering and empty geometry excluded', () => {
    const f = fixture({
      hitTest: 'overlap',
      targets: [
        { id: 'a', target: 'a' },
        { id: 'b', target: 'b' },
      ],
    })
    f.begin()
    f.move(71)
    expect(f.handle.hovered).toBe('a')
    f.move(70)
    expect(f.handle.hovered).toBeUndefined()
    expect(
      dropHits({ x: 95, y: 0, width: 0, height: 20 }, f.boxes.get('a')!, 'center'),
    ).toBe(false)
    expect(
      dropHits({ x: NaN, y: 0, width: 20, height: 20 }, f.boxes.get('a')!, 'overlap'),
    ).toBe(false)
  })
  it('preserves rejection/return ownership and rejects asynchronous acceptance', () => {
    const f = fixture({ targets: [{ id: 'a', target: 'a', accept: () => false }] })
    f.begin()
    f.move(100)
    expect(f.release()).toBe(false)
    expect(f.cancelDrag).not.toHaveBeenCalled()
    expect(f.onReject).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }))
    const invalid = fixture({
      targets: [{ id: 'a', target: 'a', accept: (() => Promise.resolve(true)) as never }],
    })
    expect(() => invalid.handle.request('a')).toThrow('boolean')
    expect(invalid.onDrop).not.toHaveBeenCalled()
  })
  it('cancels accepted effects on regrab, target removal, suspension and disposal', () => {
    const dispose = vi.fn(),
      f = fixture({ onDrop: () => ({ dispose }) })
    f.handle.request('a')
    f.begin()
    expect(dispose).toHaveBeenCalledTimes(1)
    f.handle.request('a')
    f.handle.pause()
    expect(dispose).toHaveBeenCalledTimes(2)
    expect(f.handle.request('a')).toBe(false)
    f.handle.play()
    f.handle.request('a')
    f.boxes.delete('a')
    f.handle.refresh()
    expect(dispose).toHaveBeenCalledTimes(3)
    f.handle.request('b')
    f.handle.dispose()
    f.handle.dispose()
    expect(dispose).toHaveBeenCalledTimes(4)
    expect(f.handle.accepted).toBeUndefined()
  })
  it('prevents callbacks cancelled or disposed during acceptance from committing stale effects', () => {
    const f = fixture({
      targets: [
        {
          id: 'a',
          target: 'a',
          accept: () => {
            f.handle.cancel()
            return true
          },
        },
      ],
    })
    expect(f.handle.request('a')).toBe(false)
    expect(f.onDrop).not.toHaveBeenCalled()
    const dispose = vi.fn()
    const g = fixture({
      onDrop: () => {
        g.handle.dispose()
        return { dispose }
      },
    })
    expect(g.handle.request('a')).toBe(false)
    expect(dispose).toHaveBeenCalledTimes(1)
    const h = fixture({ onLeave: () => h.handle.pause() })
    h.begin()
    h.move(100)
    expect(h.release()).toBe(false)
    expect(h.onDrop).not.toHaveBeenCalled()
  })
  it('offers explicit accessible requests while respecting source/target availability', () => {
    const f = fixture()
    expect(f.handle.request('a')).toBe(true)
    expect(f.onDrop).toHaveBeenCalledWith({
      id: 'a',
      source: 'source',
      target: 'a',
      method: 'request',
    })
    f.disable()
    expect(f.handle.request('b')).toBe(false)
    expect(() => f.handle.request('unknown')).toThrow('Unknown')
  })
  it('validates registration without cancelling application input', () => {
    expect(() => fixture({ targets: [] })).toThrow('1–64')
    expect(() => fixture({ targets: [{ id: 'a', target: 'source' }] })).toThrow(
      'distinct',
    )
    expect(() =>
      fixture({
        targets: [
          { id: 'a', target: 'a' },
          { id: 'a', target: 'b' },
        ],
      }),
    ).toThrow('unique')
  })
})
