import type { EventData, TouchGestureEventData } from '@nativescript/core'
import { animate, toView } from './animate.js'
import { isProperty, readValue, type Property } from './properties.js'
import type { SpringName, Transition } from './transition.js'
import type { AnimateOptions, Keyframes, Target } from './types.js'

const pressIn: Transition = { type: 'spring', duration: 200, bounce: 0 }
const release: Transition = { type: 'spring', duration: 450, bounce: 0.35 }

/**
 * Animates the view to `pressed` while a finger is on it, and back once it's lifted.
 * Returns a function that removes the effect.
 *
 * ```ts
 * press(button)
 * press(card, { scale: 0.97, opacity: 0.85 })
 * ```
 */
export function press(
  target: Target,
  pressed: Keyframes = { scale: 0.96 },
  options?: AnimateOptions | SpringName,
): () => void {
  const view = toView(target)
  const properties = Object.keys(pressed).flatMap((key): Property[] =>
    key === 'scale' ? ['scaleX', 'scaleY'] : isProperty(key) ? [key] : [],
  )
  let rest: Keyframes | undefined

  const onTouch = (event: EventData) => {
    const { action } = event as TouchGestureEventData
    if (action === 'down' && !rest && view.isEnabled !== false) {
      rest = Object.fromEntries(properties.map((p) => [p, readValue(view, p)]))
      animate(view, pressed, options ?? pressIn)
    } else if ((action === 'up' || action === 'cancel') && rest) {
      animate(
        view,
        rest,
        typeof options === 'object'
          ? { ...options, relative: false }
          : (options ?? release),
      )
      rest = undefined
    }
  }

  view.on('touch', onTouch)
  return () => view.off('touch', onTouch)
}
