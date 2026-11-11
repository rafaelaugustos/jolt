import { describe, expect, it, vi } from 'vitest'
import {
  createDropPolicy,
  dropHits,
  dropPadding,
  type DropHost,
  type DropMoveEvent,
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
  it('extends either hit policy by explicit per-edge padding', () => {
    const target = { x: 100, y: 100, width: 40, height: 20 }
    const below = { x: 110, y: 150, width: 20, height: 20 }
    expect(dropHits(below, target, 'center')).toBe(false)
    expect(dropHits(below, target, 'center', { bottom: 40 })).toBe(true)
    expect(dropHits(below, target, 'center', { bottom: 39 })).toBe(false)
    expect(dropHits(below, target, 'overlap', { bottom: 30 })).toBe(false)
    expect(dropHits(below, target, 'overlap', { bottom: 31, top: 500 })).toBe(true)
    expect(dropHits(below, target, 'overlap', { top: 500, left: 500 })).toBe(false)
    expect(dropHits({ ...below, x: 60 }, target, 'center', 40)).toBe(true)
    expect(
      dropHits({ ...below, x: 60 }, target, 'center', { right: 40, bottom: 40 }),
    ).toBe(false)
    expect(
      dropHits(below, { ...target, height: 0 }, 'overlap', { top: 100, bottom: 100 }),
    ).toBe(false)
    expect(dropPadding(undefined)).toEqual({ top: 0, right: 0, bottom: 0, left: 0 })
    expect(dropPadding({ bottom: 60 })).toEqual({ top: 0, right: 0, bottom: 60, left: 0 })
    for (const invalid of [-1, 1001, NaN, Infinity, { bottom: -2 }, { inset: 3 }, [4]])
      expect(() => dropHits(below, target, 'center', invalid as never)).toThrow('padding')
    expect(() =>
      fixture({ targets: [{ id: 'a', target: 'a', padding: { left: Infinity } }] }),
    ).toThrow('padding')
    const f = fixture({ targets: [{ id: 'a', target: 'a', padding: { left: 30 } }] })
    f.begin()
    f.move(50)
    expect(f.handle.hovered).toBe('a')
    f.move(49)
    expect(f.handle.hovered).toBeUndefined()
  })
  it('reports every move after hit testing and never after cancellation or disposal', () => {
    const order: string[] = []
    const onMove = vi.fn((event: DropMoveEvent<string>) => {
      order.push('move:' + (event.id ?? '-'))
    })
    const f = fixture({
      onMove,
      onEnter: ({ id }) => {
        order.push('enter:' + id)
      },
    })
    f.move(100)
    expect(onMove).not.toHaveBeenCalled()
    f.begin()
    f.move(40)
    f.move(100)
    f.move(110)
    expect(order).toEqual(['move:-', 'enter:b', 'move:b', 'move:b'])
    expect(onMove).toHaveBeenLastCalledWith({
      id: 'b',
      source: 'source',
      bounds: { x: 110, y: 10, width: 20, height: 20 },
      method: 'drag',
    })
    const reported = onMove.mock.calls.at(-1)![0].bounds
    f.boxes.set('source', { x: 0, y: 0, width: 1, height: 1 })
    expect(reported.x).toBe(110)
    f.handle.cancel()
    f.move(120)
    f.handle.refresh()
    expect(onMove).toHaveBeenCalledTimes(3)
    f.begin()
    f.move(120)
    expect(onMove).toHaveBeenCalledTimes(4)
    f.release()
    f.move(120)
    f.begin()
    f.handle.pause()
    f.move(120)
    f.handle.play()
    f.begin()
    f.handle.dispose()
    f.move(120)
    expect(onMove).toHaveBeenCalledTimes(4)
    const g = fixture({
      onMove: () => {
        throw new Error('application move failed')
      },
    })
    g.begin()
    expect(() => g.move(100)).toThrow('application move failed')
    expect(g.handle.dragging).toBe(false)
    expect(g.cancelDrag).toHaveBeenCalled()
    const h = fixture({ onMove, onEnter: () => h.handle.cancel() })
    h.begin()
    h.move(100)
    expect(onMove).toHaveBeenCalledTimes(4)
  })
  it('re-anchors the drag translation after a layout change around the source', () => {
    let translation = { x: 0, y: 0 }
    let layout = { x: 0, y: 0 }
    const shift = vi.fn((x: number, y: number) => {
      translation = { x: translation.x + x, y: translation.y + y }
    })
    const visual = () => ({
      x: layout.x + translation.x,
      y: layout.y + translation.y,
      width: 20,
      height: 20,
    })
    const host: DropHost<string> = {
      bounds: (id) =>
        id === 'source' ? visual() : { x: 200, y: 0, width: 40, height: 40 },
      enabled: () => true,
      cancelDrag: () => {},
      translation: () => translation,
      shift,
    }
    const policy = createDropPolicy(
      'source',
      { targets: [{ id: 'a', target: 'a' }] },
      host,
    )
    policy.handle.refresh()
    expect(shift).not.toHaveBeenCalled()
    policy.begin()
    translation = { x: 30, y: 15 }
    policy.move()
    expect(shift).not.toHaveBeenCalled()
    const before = visual()
    layout = { x: 0, y: 60 }
    policy.handle.refresh()
    expect(shift).toHaveBeenCalledTimes(1)
    expect(shift).toHaveBeenLastCalledWith(-0, -60)
    expect(visual()).toEqual(before)
    expect(translation).toEqual({ x: 30, y: -45 })
    layout = { x: -10, y: 20 }
    policy.move()
    expect(shift).toHaveBeenLastCalledWith(10, 40)
    expect(visual()).toEqual(before)
    policy.handle.cancel()
    layout = { x: 0, y: 0 }
    policy.handle.refresh()
    policy.move()
    expect(shift).toHaveBeenCalledTimes(2)
  })
})
