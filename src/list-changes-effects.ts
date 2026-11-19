import type { View } from '@nativescript/core'
import { animate } from './animate.js'
import { captureExit } from './layout-exit.js'
import { getDriver } from './driver/index.js'
import { propertyRevision } from './engine.js'
import { readValue, writeValue, type NumericProperty } from './properties.js'
import { interactionSurface } from './interaction-surface.js'
import type { ResolvedLayoutExit } from './core/layout-exit.js'
import type { Transition } from './transition.js'

/** Native effects shared by Core ListView and plugin adapters. */
export function nativeListEffects(transition: Transition) {
  return {
    capture(view: View, budget: number) {
      const copy = captureExit(view, budget)
      return copy
        ? {
            pixels: copy.pixels(),
            play: (exit: ResolvedLayoutExit) => copy.play(exit, transition),
            dispose: copy.dispose,
          }
        : undefined
    },
    move(view: View, x: number, y: number, enter: boolean) {
      const properties: NumericProperty[] = enter ? ['x', 'y', 'opacity'] : ['x', 'y']
      const rest = new Map(
        properties.map((property) => [property, readValue(view, property)]),
      )
      const surface = interactionSurface(view)
      let animation: ReturnType<typeof animate>
      try {
        animation = animate(
          view,
          {
            x: [rest.get('x')! + x, rest.get('x')!],
            y: [rest.get('y')! + y, rest.get('y')!],
            ...(enter ? { opacity: [0, rest.get('opacity')!] } : {}),
          },
          transition,
        )
      } finally {
        surface.dispose()
      }
      const tokens = new Map(
        properties.map((property) => [property, propertyRevision(view, property)]),
      )
      let ended = false
      return {
        animation,
        dispose() {
          if (ended) return
          ended = true
          const owned = properties.filter(
            (property) => propertyRevision(view, property) === tokens.get(property),
          )
          animation.stop()
          for (const property of owned)
            if (propertyRevision(view, property) === tokens.get(property))
              writeValue(view, property, rest.get(property)!)
          getDriver().sync?.(view)
        },
      }
    },
  }
}
