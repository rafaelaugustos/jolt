import { Application, type View } from '@nativescript/core'
import { toView } from '../animate.js'
import { parseColor } from '../color.js'
import type { Target } from '../types.js'
import {
  drawingPatch,
  drawingProgram,
  drawingSnapshot,
  drawingUpdate,
  prepareDrawing,
  type Drawing,
  type DrawingOptions,
  type DrawingState,
} from '../core/drawing.js'
import { createDrawing, type DrawingPainter } from './drawing-native.js'
export type {
  Drawing,
  DrawingOptions,
  DrawingValues,
  DrawingItem,
  DrawingStyle,
  DrawingSnapshot,
} from '../core/drawing.js'
export { drawingLimits } from '../core/drawing.js'
const owners = new WeakSet<View>()

/** Retained, ordered geometry on one native surface. Item updates are immediate,
 * not sampled animations; animate the host for whole-surface motion. */
export function drawBatch(target: Target, options: DrawingOptions): Drawing {
  let state = prepareDrawing(options, parseColor)
  let view: View | undefined = toView(target)
  if (owners.has(view)) throw new Error('This view already owns a drawing surface.')
  let painted: DrawingState | undefined,
    painter: DrawingPainter | undefined,
    native: object | undefined
  let disposed = false,
    held = false
  const alive = () => {
    if (disposed) throw new Error('Drawing is disposed.')
  }
  const blocked = () => held || Application.suspended
  const detach = () => {
    painter?.dispose()
    painter = undefined
    painted = undefined
    native = undefined
  }
  const paint = (next: DrawingState) => {
    const points = painter?.compact ? ([] as number[]) : undefined
    const program = drawingProgram(next, painted, points)
    if (painter && !blocked()) {
      painter.apply(program, points)
      painted = next
    }
    state = next
  }
  const refresh = () => {
    if (disposed || !view?.isLoaded || !view.nativeViewProtected) return
    if (native && native !== view.nativeViewProtected) detach()
    if (!painter) {
      const next = createDrawing(view)
      try {
        const points = next.compact ? ([] as number[]) : undefined
        next.apply(drawingProgram(state, undefined, points), points)
        next.resize()
      } catch (error) {
        next.dispose()
        throw error
      }
      painter = next
      native = view.nativeViewProtected
      painted = state
    } else {
      if (!blocked() && painted !== state) paint(state)
      painter.resize()
    }
  }
  const drawing: Drawing = {
    get disposed() {
      return disposed
    },
    get suspended() {
      return blocked()
    },
    set(values) {
      alive()
      paint(drawingUpdate(state, values, parseColor))
    },
    update(items) {
      alive()
      paint(drawingPatch(state, items, parseColor))
    },
    snapshot() {
      return drawingSnapshot(state, !!painter)
    },
    suspend() {
      if (!disposed) held = true
    },
    resume() {
      if (!disposed) {
        held = false
        refresh()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      detach()
      view?.off('loaded', refresh)
      view?.off('layoutChanged', refresh)
      view?.off('unloaded', detach)
      Application.off(Application.resumeEvent, refresh)
      if (view) owners.delete(view)
      view = undefined
      state = {
        ...state,
        items: [],
        styles: [],
        sourceStyles: {},
        commands: 0,
        components: 0,
      }
    },
  }
  owners.add(view)
  try {
    view.on('loaded', refresh)
    view.on('layoutChanged', refresh)
    view.on('unloaded', detach)
    Application.on(Application.resumeEvent, refresh)
    refresh()
  } catch (error) {
    drawing.dispose()
    throw error
  }
  return drawing
}
