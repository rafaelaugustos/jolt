import { afterEach, describe, expect, it, vi } from 'vitest'
import { Application } from '@nativescript/core'
import { View } from './shims/core.js'
import { configure } from '../src/config.js'
import {
  reorder,
  type ReorderAdapter,
  type ReorderNativeEvent,
} from '../src/reorder/index.js'
import { itemKeys, moveAt } from '../src/reorder/model.js'

vi.mock('../src/driver/index.js', () => ({
  getDriver: () => ({ reducedMotion: () => false, watchReducedMotion: () => () => {} }),
}))
vi.mock('@nativescript/core', async (original) => {
  const core = await original<typeof import('./shims/core.js')>()
  return { ...core, GridLayout: class extends core.View {} }
})

type Item = { id: string; height: number }
const cleanups: (() => void)[] = []
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup())
  configure({ reducedMotion: 'user' })
})
function fixture() {
  const view = new View()
  let rows = Array.from({ length: 200 }, (_, index) => ({
    id: `row-${index}`,
    height: 60 + (index % 3) * 24,
  }))
  let notify = () => {},
    emit = (_: ReorderNativeEvent) => {}
  const driver = {
    cancel: vi.fn(),
    setEnabled: vi.fn(),
    setReducedMotion: vi.fn(),
    dispose: vi.fn(),
  }
  const adapter: ReorderAdapter<Item> = {
    view: view as unknown as import('@nativescript/core').View,
    items: () => rows,
    subscribe(callback) {
      notify = callback
      return () => {
        notify = () => {}
      }
    },
    attach: vi.fn((config) => {
      emit = config.event
      return driver
    }),
  }
  const commits = vi.fn(),
    cancelled = vi.fn(),
    started = vi.fn()
  const options = {
    key: (item: Item) => item.id,
    onCommit: commits,
    onCancel: cancelled,
    onStart: started,
  }
  const control = reorder(adapter, options)
  cleanups.push(() => control.dispose())
  return {
    view,
    driver,
    adapter,
    commits,
    cancelled,
    started,
    control,
    emit: (event: ReorderNativeEvent) => emit(event),
    set: (next: Item[], announce = true) => {
      rows = next
      if (announce) notify()
    },
    rows: () => rows,
    notify,
    options,
  }
}

describe('reorder ownership and identities', () => {
  it('commits once across 200 recycled items and never mutates app data during dragging', () => {
    const f = fixture(),
      original = [...f.rows()]
    f.emit({ type: 'start', index: 2 })
    expect(f.control.activeKey).toBe('row-2')
    expect(f.rows()).toEqual(original)
    expect(f.commits).not.toHaveBeenCalled()
    f.emit({ type: 'commit', index: 2, toIndex: 180 })
    f.emit({ type: 'commit', index: 2, toIndex: 180 })
    expect(f.commits).toHaveBeenCalledExactlyOnceWith({
      key: 'row-2',
      beforeKey: 'row-181',
      fromIndex: 2,
      toIndex: 180,
    })
    expect(f.rows()).toEqual(original)
    expect(f.control.activeKey).toBeUndefined()
  })
  it('reports stable beforeKey for upward, downward and end insertion with unequal heights', () => {
    const keys = ['a', 'b', 'c', 'd']
    expect(moveAt(keys, 0, 2)?.beforeKey).toBe('d')
    expect(moveAt(keys, 3, 1)?.beforeKey).toBe('b')
    expect(moveAt(keys, 0, 3)?.beforeKey).toBeNull()
    expect(moveAt(keys, 2, 2)).toBeUndefined()
    expect(moveAt(keys, -1, 2)).toBeUndefined()
    expect(moveAt(keys, 0, 9)).toBeUndefined()
  })
  it('cancels when the dragged item is removed, without committing a recycled index', () => {
    const f = fixture()
    f.emit({ type: 'start', index: 2 })
    f.set(f.rows().filter((item) => item.id !== 'row-2'))
    f.emit({ type: 'commit', index: 2, toIndex: 5 })
    expect(f.commits).not.toHaveBeenCalled()
    expect(f.cancelled).toHaveBeenCalledExactlyOnceWith({
      key: 'row-2',
      reason: 'removed',
    })
  })
  it('cancels filtering or replacement even if the dragged identity survives', () => {
    const f = fixture()
    f.emit({ type: 'start', index: 2 })
    f.set(f.rows().slice(1))
    expect(f.cancelled).toHaveBeenCalledExactlyOnceWith({
      key: 'row-2',
      reason: 'data-changed',
    })
    expect(f.control.activeKey).toBeUndefined()
  })
  it('checks plain arrays again at commit if an application forgot refresh()', () => {
    const f = fixture()
    f.emit({ type: 'start', index: 2 })
    f.set(f.rows().toReversed(), false)
    f.emit({ type: 'commit', index: 2, toIndex: 7 })
    expect(f.commits).not.toHaveBeenCalled()
    expect(f.cancelled).toHaveBeenCalledWith({ key: 'row-2', reason: 'data-changed' })
  })
  it('allows synchronous data changes in onStart and never commits after cancellation', () => {
    const f = fixture()
    f.started.mockImplementation(() => f.set([]))
    f.emit({ type: 'start', index: 2 })
    expect(f.control.activeKey).toBeUndefined()
    expect(f.cancelled).toHaveBeenCalledExactlyOnceWith({
      key: 'row-2',
      reason: 'removed',
    })
    f.emit({ type: 'commit', index: 2, toIndex: 3 })
    expect(f.commits).not.toHaveBeenCalled()
  })
  it('ignores unchanged drops and cancels native geometry changes exactly once', () => {
    const f = fixture()
    f.emit({ type: 'start', index: 2 })
    f.emit({ type: 'commit', index: 2, toIndex: 2 })
    expect(f.cancelled).toHaveBeenCalledWith({ key: 'row-2', reason: 'unchanged' })
    f.emit({ type: 'start', index: 4 })
    f.emit({ type: 'cancel', geometryChanged: true })
    f.emit({ type: 'cancel' })
    expect(f.cancelled).toHaveBeenCalledTimes(2)
    expect(f.cancelled).toHaveBeenLastCalledWith({
      key: 'row-4',
      reason: 'geometry-changed',
    })
    expect(f.commits).not.toHaveBeenCalled()
  })
  it('offers keyboard/accessibility moves and leaves applying them to the app', () => {
    const f = fixture()
    expect(f.control.moveUp('row-0')).toBe(false)
    expect(f.control.moveDown('row-199')).toBe(false)
    expect(f.control.move('missing', null)).toBe(false)
    expect(f.control.move('row-2', 'row-2')).toBe(false)
    expect(f.control.move('row-2', 'missing')).toBe(false)
    expect(f.control.moveDown('row-2')).toBe(true)
    expect(f.commits).toHaveBeenLastCalledWith({
      key: 'row-2',
      beforeKey: 'row-4',
      fromIndex: 2,
      toIndex: 3,
    })
    expect(f.control.move('row-2', null)).toBe(true)
    expect(f.commits).toHaveBeenLastCalledWith({
      key: 'row-2',
      beforeKey: null,
      fromIndex: 2,
      toIndex: 199,
    })
  })
  it('supports synchronous application-owned reorder and repeated accessible moves', () => {
    const f = fixture()
    f.commits.mockImplementation(({ key, beforeKey }) => {
      const item = f.rows().find((item) => item.id === key)!
      const result = f.rows().filter((row) => row.id !== key)
      result.splice(
        beforeKey === null
          ? result.length
          : result.findIndex((row) => row.id === beforeKey),
        0,
        item,
      )
      f.set(result)
    })
    f.control.moveDown('row-2')
    f.control.moveDown('row-2')
    expect(f.rows()[4]!.id).toBe('row-2')
    expect(f.commits).toHaveBeenCalledTimes(2)
  })
  it('releases native input on unload and reattaches once when loaded', () => {
    const f = fixture()
    f.emit({ type: 'start', index: 1 })
    f.view.notify({ eventName: 'unloaded', object: f.view })
    expect(f.driver.dispose).toHaveBeenCalledTimes(1)
    expect(f.cancelled).toHaveBeenCalledWith({ key: 'row-1', reason: 'unloaded' })
    f.view.notify({ eventName: 'loaded', object: f.view })
    f.view.notify({ eventName: 'loaded', object: f.view })
    expect(f.adapter.attach).toHaveBeenCalledTimes(2)
  })
  it('stops on pause/background/dispose and reacts to reduced-motion changes', () => {
    const f = fixture()
    f.emit({ type: 'start', index: 1 })
    f.control.pause()
    expect(f.cancelled).toHaveBeenLastCalledWith({ key: 'row-1', reason: 'disabled' })
    expect(f.control.moveDown('row-1')).toBe(false)
    f.control.play()
    configure({ reducedMotion: 'always' })
    expect(f.driver.setReducedMotion).toHaveBeenCalledWith(true)
    f.emit({ type: 'start', index: 1 })
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    expect(f.control.activeKey).toBeUndefined()
    f.control.dispose()
    f.control.dispose()
    expect(f.driver.dispose).toHaveBeenCalledTimes(1)
    expect(f.control.moveDown('row-1')).toBe(false)
  })
  it('validates identities before replacing an existing owner', () => {
    expect(() => itemKeys([{ id: 'same' }, { id: 'same' }], (item) => item.id)).toThrow(
      /unique/,
    )
    expect(() => itemKeys([Infinity], (item) => item)).toThrow(/finite/)
    expect(itemKeys([{ id: 1 }, { id: '1' }], (item) => item.id)).toEqual([1, '1'])
    const f = fixture()
    expect(() => reorder(f.adapter, { ...f.options, longPress: 0 })).toThrow()
    expect(f.control.disposed).toBe(false)
    const next = reorder(f.adapter, f.options)
    cleanups.push(() => next.dispose())
    expect(f.control.disposed).toBe(true)
  })
})
