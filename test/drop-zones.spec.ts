import { describe, expect, it, vi } from 'vitest'
import { configure, drag, dropZones, type DropMoveEvent } from '../src/index.js'
import { createView, driver, flush } from './helpers.js'

type ShimView = ReturnType<typeof createView>
const window = { isEqual: (other: unknown) => other === window }

function placed(frame: { x: number; y: number; width: number; height: number }) {
  const view = createView()
  const layout = { ...frame }
  view.nativeViewProtected = {
    window,
    hidden: false,
    bounds: {
      origin: { x: 0, y: 0 },
      size: { width: frame.width, height: frame.height },
    },
    convertRectToView: () => ({
      origin: { x: layout.x + view.translateX, y: layout.y + view.translateY },
      size: { width: layout.width, height: layout.height },
    }),
  }
  return { view, layout }
}
function child(parent: ShimView) {
  const view = createView()
  view.parent = parent
  parent.children.push(view)
  return view
}
function pan(view: ShimView, state: number, x = 0, y = 0) {
  view.notify({ eventName: 'pan', object: view, state, deltaX: x, deltaY: y })
}
function board(options: Partial<Parameters<typeof dropZones>[1]> = {}) {
  const card = placed({ x: 0, y: 100, width: 40, height: 40 })
  const grip = child(card.view)
  const column = placed({ x: 200, y: 0, width: 80, height: 60 })
  const moves: DropMoveEvent<unknown>[] = []
  const onDrop = vi.fn()
  const zones = dropZones(card.view, {
    targets: [{ id: 'column', target: column.view, padding: { bottom: 60 } }],
    drag: { handle: grip, snap: [0] },
    onMove: (event) => moves.push(event),
    onDrop,
    ...options,
  })
  return { card, grip, column, moves, onDrop, zones }
}

describe('native drag handle', () => {
  it('pans from the handle only and moves the dragged view', () => {
    const card = createView(),
      grip = child(card)
    const controller = drag(card, { handle: grip })
    pan(card, 1)
    pan(card, 2, 40, 0)
    expect(card.translateX).toBe(0)
    expect(card.listenerCount('pan')).toBe(0)
    expect(grip.listenerCount('pan')).toBe(1)
    grip.touch('down')
    pan(grip, 1)
    pan(grip, 2, 40, 10)
    expect(card.translateX).toBe(40)
    expect(card.translateY).toBe(10)
    expect(grip.translateX).toBe(0)
    controller.cancel()
    grip.unload()
    grip.notify({ eventName: 'unloaded', object: grip })
    expect(grip.listenerCount('pan')).toBe(0)
    grip.load()
    expect(grip.listenerCount('pan')).toBe(1)
    controller.dispose()
    expect(grip.listenerCount('pan')).toBe(0)
    expect(grip.listenerCount('loaded')).toBe(0)
  })
  it('validates the handle as a descendant before replacing input', () => {
    const card = createView(),
      outside = createView()
    const current = drag(card)
    expect(() => drag(card, { handle: outside })).toThrow('descendant')
    expect(() => drag(card, { handle: card })).toThrow('descendant')
    expect(current.disposed).toBe(false)
    current.dispose()
  })
  it('cancels a contact when the handle leaves the dragged view', () => {
    const card = createView(),
      grip = child(card),
      onCancel = vi.fn()
    const controller = drag(card, { handle: grip, onCancel })
    grip.touch('down')
    pan(grip, 1)
    pan(grip, 2, 30)
    ;(grip as { parent: unknown }).parent = undefined
    pan(grip, 2, 60)
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(card.translateX).toBe(30)
    controller.dispose()
  })
})

describe('native drop zones', () => {
  it('reports moves with bounds and hovered padded targets after hit testing', () => {
    const { card, grip, moves, onDrop, zones } = board()
    grip.touch('down')
    pan(grip, 1)
    pan(grip, 2, 200, 30)
    expect(moves.at(-1)).toEqual({
      id: undefined,
      source: card.view,
      bounds: { x: 200, y: 130, width: 40, height: 40 },
      method: 'drag',
    })
    pan(grip, 2, 220, -20)
    expect(zones.hovered).toBe('column')
    expect(moves.at(-1)).toMatchObject({ id: 'column', bounds: { x: 220, y: 80 } })
    pan(grip, 3, 220, -20)
    expect(onDrop).toHaveBeenCalledTimes(1)
    expect(moves).toHaveLength(3)
    zones.dispose()
  })
  it('stops move reports on cancellation, pause and disposal', () => {
    const { grip, moves, zones } = board()
    grip.touch('down')
    pan(grip, 1)
    pan(grip, 2, 10)
    expect(moves).toHaveLength(2)
    zones.cancel()
    pan(grip, 2, 20)
    expect(moves).toHaveLength(2)
    zones.pause()
    grip.touch('down')
    pan(grip, 1)
    pan(grip, 2, 30)
    expect(moves).toHaveLength(2)
    zones.play()
    zones.dispose()
    pan(grip, 1)
    pan(grip, 2, 40)
    expect(moves).toHaveLength(2)
  })
  it('re-anchors the source after a layout change during the drag', () => {
    const { card, grip, moves, zones } = board()
    grip.touch('down')
    pan(grip, 1)
    pan(grip, 2, 30, 20)
    expect(card.view.translateY).toBe(20)
    card.layout.y = 160
    card.view.notify({ eventName: 'layoutChanged', object: card.view })
    expect(card.view.translateY).toBe(-40)
    expect(moves.at(-1)!.bounds.y).toBe(120)
    pan(grip, 2, 30, 30)
    expect(card.view.translateY).toBe(-30)
    expect(moves.at(-1)!.bounds.y).toBe(130)
    zones.cancel()
    card.layout.y = 100
    card.view.notify({ eventName: 'layoutChanged', object: card.view })
    expect(card.view.translateY).toBe(-30)
    zones.dispose()
  })
  it('keeps direct tracking and returns a rejected drop at once under reduced motion', async () => {
    configure({ reducedMotion: 'always' })
    const moves: DropMoveEvent<unknown>[] = []
    const { card, grip, zones } = board({
      targets: [
        {
          id: 'column',
          target: placed({ x: 200, y: 0, width: 80, height: 60 }).view,
          padding: { bottom: 60 },
          accept: () => false,
        },
      ],
      onMove: (event) => moves.push(event),
    })
    grip.touch('down')
    pan(grip, 1)
    pan(grip, 2, 220, -20)
    expect(card.view.translateX).toBe(220)
    expect(moves.at(-1)?.id).toBe('column')
    pan(grip, 3, 220, -20)
    await flush()
    expect(card.view.translateX).toBe(0)
    expect(card.view.translateY).toBe(0)
    expect(driver.played).toHaveLength(0)
    expect(moves).toHaveLength(2)
    zones.dispose()
  })
})
