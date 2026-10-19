import type { View, ViewBase } from '@nativescript/core'
import { toView } from './animate.js'
import type { Target } from './types.js'

const surfaces = new WeakMap<ViewBase, Set<object>>()
export interface InteractionSurface {
  readonly disposed: boolean
  /** Existing animations retain their driver until they end. Disables future opt-in. */
  dispose(): void
}

/** Opt a view/subtree into native geometry updates before starting its animations. */
export function interactionSurface(target: Target): InteractionSurface {
  const view = toView(target)
  let tokens = surfaces.get(view)
  if (!tokens) surfaces.set(view, (tokens = new Set()))
  const token = {}
  tokens.add(token)
  let disposed = false
  return {
    get disposed() {
      return disposed
    },
    dispose() {
      if (disposed) return
      disposed = true
      tokens.delete(token)
      if (!tokens.size) surfaces.delete(view)
    },
  }
}

/** Evaluated at animation start; no per-frame JS traversal. */
export function hasInteractionSurface(view: View): boolean {
  let current: ViewBase | undefined = view
  while (current) {
    if (surfaces.get(current)?.size) return true
    current = current.parent
  }
  return false
}
