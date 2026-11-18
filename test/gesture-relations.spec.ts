import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GestureArbiter,
  gestureRelations,
  registerGestureEndpoints,
} from '../src/core/gesture-relations.js'
const cleanup: (() => void)[] = []
afterEach(() => {
  for (const release of cleanup.splice(0).reverse()) release()
})
function surface() {
  const cancel = vi.fn(),
    start = vi.fn(),
    peer = new GestureArbiter(cancel),
    controller = {}
  cleanup.push(
    registerGestureEndpoints(controller, () => peer),
    () => peer.dispose(),
  )
  return { peer, controller, cancel, start }
}
function pair(kind: 'simultaneous' | 'waitFor' | 'block') {
  const a = surface(),
    b = surface()
  const group = gestureRelations([
    { gesture: a.controller, other: b.controller, relation: kind },
  ])
  cleanup.push(() => group.dispose())
  return { a, b, group }
}
describe('recognition relationships', () => {
  it('waits without moving, starts once after failure, and keeps the winner through release', () => {
    const { a, b } = pair('waitFor')
    a.peer.begin(1)
    b.peer.begin(1)
    expect(a.peer.request(a.start)).toBe(false)
    expect(a.start).not.toHaveBeenCalled()
    b.peer.fail()
    expect(a.start).toHaveBeenCalledTimes(1)
    a.peer.request(a.start)
    expect(a.start).toHaveBeenCalledTimes(1)
    a.peer.finish()
    a.peer.begin(2)
    b.peer.begin(2)
    a.peer.request(a.start)
    b.peer.request(b.start)
    b.peer.finish()
    b.peer.fail()
    expect(a.cancel).toHaveBeenCalledTimes(1)
    expect(a.start).toHaveBeenCalledTimes(1)
  })
  it('blocks an active loser once, including reentrant input cancellation', () => {
    const { a, b } = pair('block')
    b.cancel.mockImplementation(() => {
      b.peer.fail()
      a.peer.request(a.start)
    })
    a.peer.begin(4)
    b.peer.begin(4)
    b.peer.request(b.start)
    a.peer.request(a.start)
    a.peer.request(a.start)
    expect(b.cancel).toHaveBeenCalledTimes(1)
    expect(a.start).toHaveBeenCalledTimes(1)
    expect(b.peer.request(b.start)).toBe(false)
  })
  it('keeps simultaneous contacts independent and ignores other contact sequences', () => {
    const { a, b } = pair('simultaneous')
    a.peer.begin(1)
    b.peer.begin(1)
    expect(a.peer.request(a.start)).toBe(true)
    expect(b.peer.request(b.start)).toBe(true)
    expect(a.cancel).not.toHaveBeenCalled()
    expect(b.cancel).not.toHaveBeenCalled()
    const c = pair('waitFor')
    c.a.peer.begin(2)
    c.b.peer.begin(3)
    expect(c.a.peer.request(c.a.start)).toBe(true)
  })
  it('rejects cycles across groups and contradictory pairs before connecting anything', () => {
    const { a, b } = pair('waitFor'),
      c = surface()
    expect(() =>
      gestureRelations([
        { gesture: b.controller, other: c.controller, relation: 'waitFor' },
        { gesture: c.controller, other: a.controller, relation: 'waitFor' },
      ]),
    ).toThrow(/cycles/)
    expect(c.peer.coordinated).toBe(false)
    expect(() =>
      gestureRelations([
        { gesture: b.controller, other: a.controller, relation: 'simultaneous' },
      ]),
    ).toThrow(/simultaneous/)
    a.peer.begin(4)
    expect(() =>
      gestureRelations([
        { gesture: a.controller, other: c.controller, relation: 'block' },
      ]),
    ).toThrow(/before contact/)
  })
  it('disposes either endpoint without activating stale waiting input, then accepts new contacts', () => {
    const { a, b, group } = pair('waitFor')
    a.peer.begin(4)
    b.peer.begin(4)
    a.peer.request(a.start)
    b.peer.dispose()
    b.peer.dispose()
    group.dispose()
    group.dispose()
    expect(a.cancel).toHaveBeenCalledTimes(1)
    expect(a.start).not.toHaveBeenCalled()
    expect(a.peer.coordinated).toBe(false)
    a.peer.begin(5)
    a.peer.request(a.start)
    expect(a.start).toHaveBeenCalledTimes(1)
    expect(() =>
      gestureRelations([
        { gesture: a.controller, other: b.controller, relation: 'waitFor' },
      ]),
    ).toThrow()
  })
})
