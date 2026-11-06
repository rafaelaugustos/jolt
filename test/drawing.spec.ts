import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { Application } from './shims/core.js'
import { motionScope } from '../src/index.js'
import { drawBatch, type DrawingItem } from '../src/shapes/index.js'
import { drawingProgram, prepareDrawing, drawingPatch } from '../src/core/drawing.js'
import { setDrawingFactory } from '../src/shapes/drawing-native.js'
import { createView } from './helpers.js'

const item = (id = 'one'): DrawingItem => ({
  id,
  style: 'dots',
  kind: 'circle',
  cx: 50,
  cy: 50,
  radius: 4,
})
const options = () => ({
  viewBox: [0, 0, 100, 100] as const,
  styles: { dots: { fill: '#ffffff', strokeWidth: 0 } },
  items: [item()],
})
const painters: {
  apply: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
}[] = []
beforeEach(() => {
  painters.length = 0
  setDrawingFactory(() => {
    const painter = { apply: vi.fn(), resize: vi.fn(), dispose: vi.fn() }
    painters.push(painter)
    return painter
  })
})
afterEach(() => {
  setDrawingFactory(undefined)
  Application.suspended = false
})

it('bounds each geometry and the entire drawing without changing the ordinary shape parser', () => {
  expect(() =>
    prepareDrawing(
      { ...options(), items: Array.from({ length: 1025 }, (_, i) => item(String(i))) },
      () => 0,
    ),
  ).toThrow(/budget/)
  expect(() =>
    prepareDrawing(
      {
        ...options(),
        items: [
          { id: 'path', style: 'dots', kind: 'path', d: 'M0 0' + 'L1 1'.repeat(256) },
        ],
      },
      () => 0,
    ),
  ).toThrow(/256/)
  const dense = Array.from({ length: 40 }, (_, i): DrawingItem => ({
    id: String(i),
    style: 'dots',
    kind: 'path',
    d: 'M0 0' + 'L1 1'.repeat(250),
  }))
  expect(() => prepareDrawing({ ...options(), items: dense }, () => 0)).toThrow(
    /total geometry/,
  )
  expect(() =>
    prepareDrawing({ ...options(), items: [item(), item()] }, () => 0),
  ).toThrow(/unique/)
  expect(() =>
    prepareDrawing({ ...options(), items: [{ ...item(), style: 'missing' }] }, () => 0),
  ).toThrow(/style/)
  const padded = Array.from({ length: 120 }, (_, i): DrawingItem => ({
    id: String(i),
    style: 'dots',
    kind: 'path',
    d: 'M0 0L1 1' + ' '.repeat(19000),
  }))
  expect(() => prepareDrawing({ ...options(), items: padded }, () => 0)).toThrow(
    /retained payload/,
  )
})

it('prepares bounded targeted native updates and reuses untouched geometry', () => {
  const first = prepareDrawing({ ...options(), items: [item(), item('two')] }, () => 0)
  const second = drawingPatch(
    first,
    [{ ...item(), kind: 'circle', cx: 60, cy: 50, radius: 8 }],
    () => 0,
  )
  expect(second.items[1]).toBe(first.items[1])
  const payload = JSON.parse(drawingProgram(second, first))
  expect(payload.items.map((value: { id: string }) => value.id)).toEqual(['one'])
  expect(payload.order).toEqual(['one', 'two'])
  const points: number[] = []
  const compact = JSON.parse(drawingProgram(second, first, points))
  expect(compact.order).toBeUndefined()
  expect(compact.styles).toBeUndefined()
  expect(compact.items[0].offset).toBe(0)
  expect(compact.items[0].count).toBe(points.length)
  expect(points).toEqual(second.items[0]!.path.points)
  expect(() => drawingPatch(first, [item('new')], () => 0)).toThrow(/existing/)
})

it('preserves a valid native drawing when updates fail, owns one surface and releases it on unmount', () => {
  const view = createView(),
    scope = motionScope(),
    drawing = scope.resource(() => drawBatch(view, options()))
  expect(painters).toHaveLength(1)
  expect(() => drawBatch(view, options())).toThrow(/already owns/)
  expect(() =>
    drawing.update([{ ...item(), kind: 'circle', cx: NaN, cy: 0, radius: 2 }]),
  ).toThrow()
  expect(painters[0]!.apply).toHaveBeenCalledOnce()
  painters[0]!.apply.mockImplementationOnce(() => {
    throw new Error('native rejection')
  })
  expect(() => drawing.set({ items: [] })).toThrow(/native rejection/)
  expect(drawing.snapshot().items).toBe(1)
  view.notify({ eventName: 'unloaded' })
  expect(painters[0]!.dispose).toHaveBeenCalledOnce()
  view.notify({ eventName: 'loaded' })
  expect(painters).toHaveLength(2)
  scope.dispose()
  expect(painters[1]!.dispose).toHaveBeenCalledOnce()
  expect(drawing.disposed).toBe(true)
  expect(view.listenerCount('loaded')).toBe(0)
  expect(drawing.snapshot().components).toBe(0)
  const replacement = drawBatch(view, options())
  replacement.dispose()
})

it('retains static geometry while suspended and coalesces pending changes until resume', () => {
  const drawing = drawBatch(createView(), options())
  drawing.suspend()
  drawing.set({ items: [item(), item('two')] })
  drawing.set({ styles: { dots: { fill: '#123456', strokeWidth: 0 } } })
  expect(painters[0]!.apply).toHaveBeenCalledOnce()
  Application.suspended = true
  drawing.resume()
  expect(painters[0]!.apply).toHaveBeenCalledOnce()
  Application.suspended = false
  Application.notify({ eventName: Application.resumeEvent })
  expect(painters[0]!.apply).toHaveBeenCalledTimes(2)
  const payload = JSON.parse(painters[0]!.apply.mock.calls[1]![0])
  expect(payload.order).toEqual(['one', 'two'])
  expect(payload.items).toHaveLength(1)
  drawing.dispose()
})
