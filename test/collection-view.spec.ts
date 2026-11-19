import { expect, it, vi } from 'vitest'
import { GridLayout, type View } from '@nativescript/core'
import { collectionViewListAdapter } from '../src/collection-view.js'
import './helpers.js'

function collection() {
  const view = new GridLayout() as unknown as View & {
    orientation: string
    reverseLayout: boolean
    reorderEnabled: boolean
    computeSpanCount(): number
    items: { id: number }[]
    refresh(): void
    findFirstVisibleItemIndex(): number
    findLastVisibleItemIndex(): number
    getViewForItemAtIndex(index: number): View | undefined
  }
  const rows = [new GridLayout(), new GridLayout(), new GridLayout()]
  Object.assign(view, {
    orientation: 'vertical',
    reverseLayout: false,
    reorderEnabled: false,
    computeSpanCount: () => 1,
    items: Array.from({ length: 200 }, (_, id) => ({ id })),
    refresh() {},
    findFirstVisibleItemIndex: () => 98,
    findLastVisibleItemIndex: () => 100,
    getViewForItemAtIndex: (index: number) => rows[index - 98],
  })
  return { view, rows }
}
it('uses current keyed content for recycled plugin targets, without visiting 200 offscreen rows', () => {
  const { view, rows } = collection(),
    adapter = collectionViewListAdapter<{ id: number }>(view)
  expect(adapter.rows().map((row) => row.item.id)).toEqual([98, 99, 100])
  const replacement = [...view.items].reverse()
  adapter.render(replacement)
  replacement.pop()
  expect(view.items).toHaveLength(200)
  expect(adapter.rows().map((row) => row.item.id)).toEqual([101, 100, 99])
  expect(adapter.rows()[0]!.target).toBe(rows[0])
  const reset = vi.fn(),
    off = adapter.observeRecycling(reset)
  const inner = new GridLayout()
  inner.parent = rows[0]!
  rows[0]!.parent = view
  view.notify({ eventName: 'itemLoading', view: inner } as never)
  expect(reset.mock.calls.map((args) => args[0])).toEqual([inner, rows[0]])
  off()
  view.notify({ eventName: 'itemRecycling', view: inner } as never)
  expect(reset).toHaveBeenCalledTimes(2)
})
it('rejects incompatible collection layouts before claiming native animation ownership', () => {
  const { view } = collection()
  view.orientation = 'horizontal'
  expect(() => collectionViewListAdapter(view)).toThrow(/vertical/)
  view.orientation = 'vertical'
  view.computeSpanCount = () => 2
  expect(() => collectionViewListAdapter(view)).toThrow(/one span/)
  view.computeSpanCount = () => 1
  view.reorderEnabled = true
  expect(() => collectionViewListAdapter(view)).toThrow(/reorderEnabled/)
})
