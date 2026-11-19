import { expect, it, vi } from 'vitest'
import type { ScrollView } from '@nativescript/core'
import { retainScrollDelegate } from '../src/driver/ios-scroll-delegate.js'

it('refreshes native forwarding only at Core listener changes and restores the original methods', () => {
  const events: string[] = []
  const proto = {
    attachNative() {
      events.push('attach')
    },
    detachNative() {
      events.push('detach')
    },
  }
  const scroll = Object.create(proto) as ScrollView & typeof proto
  const release = retainScrollDelegate(scroll, () => events.push('refresh'))
  expect(events).toEqual([])
  scroll.attachNative()
  scroll.detachNative()
  expect(events).toEqual(['attach', 'refresh', 'detach', 'refresh'])
  release()
  release()
  expect(scroll.attachNative).toBe(proto.attachNative)
  expect(Object.hasOwn(scroll, 'detachNative')).toBe(false)
  scroll.attachNative()
  expect(events.at(-1)).toBe('attach')
})

it('does not replace a hook another owner installed later', () => {
  const scroll = {
    attachNative: vi.fn(),
    detachNative: vi.fn(),
  } as unknown as ScrollView & { attachNative(): void; detachNative(): void }
  const release = retainScrollDelegate(scroll, vi.fn())
  const replacement = vi.fn()
  scroll.attachNative = replacement
  release()
  expect(scroll.attachNative).toBe(replacement)
})

it('forwards CollectionView layout arguments before restoring its native delegate wrapper', () => {
  const events: unknown[] = []
  const layout = (...bounds: number[]) => events.push(bounds)
  const scroll = { onLayout: layout } as unknown as ScrollView
  const release = retainScrollDelegate(scroll, () => events.push('refresh'))
  scroll.onLayout(1, 2, 301, 402)
  expect(events).toEqual([[1, 2, 301, 402], 'refresh'])
  release()
  expect(scroll.onLayout).toBe(layout)
})
