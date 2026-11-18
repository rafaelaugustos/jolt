import { describe, expect, it, vi } from 'vitest'
import { gestureRelations } from '../src/core/gesture-relations.js'
import { nativeGestureRecognizer } from '../src/gesture-relations-native.js'

vi.mock('@nativescript/core', () => ({ isIOS: false }))

function appPeer() {
  const links = new Set<object>()
  const peer = {
    isActive: () => false,
    isDisposed: () => false,
    dispose: vi.fn(),
    connect(other: { links: Set<object> }, _kind: string) {
      const link = {}
      links.add(link)
      other.links.add(link)
      return {
        dispose() {
          links.delete(link)
          other.links.delete(link)
        },
      }
    },
    links,
  }
  return peer
}

describe('app-owned native gesture endpoints', () => {
  it.each(['first', 'second'] as const)(
    'removes links when the %s wrapper is disposed without destroying app recognizers',
    (side) => {
      const first = appPeer(),
        second = appPeer(),
        third = appPeer()
      const a = nativeGestureRecognizer(first),
        b = nativeGestureRecognizer(second),
        c = nativeGestureRecognizer(third)
      const group = gestureRelations([{ gesture: a, other: b, relation: 'waitFor' }])
      const retained = gestureRelations([
        { gesture: b, other: c, relation: 'simultaneous' },
      ])
      expect(first.links.size).toBe(1)
      expect(second.links.size).toBe(2)
      const removed = side === 'first' ? a : b
      removed.dispose()
      removed.dispose()
      expect(first.links.size).toBe(0)
      expect(second.links.size).toBe(side === 'first' ? 1 : 0)
      expect(third.links.size).toBe(side === 'first' ? 1 : 0)
      expect(first.dispose).not.toHaveBeenCalled()
      expect(second.dispose).not.toHaveBeenCalled()
      group.dispose()
      retained.dispose()
      a.dispose()
      b.dispose()
      c.dispose()
      expect(second.links.size).toBe(0)
      expect(third.links.size).toBe(0)
    },
  )
})
