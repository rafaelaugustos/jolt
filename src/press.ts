import { Color, type EventData, type TouchGestureEventData } from '@nativescript/core'
import { isColorProperty } from './color.js'
import { animate, startingValues, stop, toView } from './animate.js'
import { identity } from './mixer.js'
import type { PlaybackAnimation } from './playback.js'
import { readValue } from './properties.js'
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
  const properties = [...startingValues(pressed, options).keys()]
  const layer = typeof options === 'object' ? options.layer : undefined
  let rest: Keyframes | undefined
  let active: PlaybackAnimation | undefined

  const onTouch = (event: EventData) => {
    const { action } = event as TouchGestureEventData
    if (action === 'down' && !rest && view.isEnabled !== false) {
      rest = Object.fromEntries(
        properties.map((p) => [
          p,
          layer !== undefined
            ? identity(p)
            : isColorProperty(p)
              ? new Color(readValue(view, p))
              : readValue(view, p),
        ]),
      )
      active = animate(view, pressed, options ?? pressIn)
    } else if ((action === 'up' || action === 'cancel') && rest) {
      active = animate(
        view,
        rest,
        typeof options === 'object'
          ? { ...options, relative: false }
          : (options ?? release),
      )
      rest = undefined
    }
  }

  const cancel = () => {
    active?.stop()
    // A completed press still holds its layer contribution until it is removed.
    if (layer !== undefined) stop(view, properties, { layer })
    active = undefined
    rest = undefined
  }
  view.on('touch', onTouch)
  view.on('unloaded', cancel)
  return () => {
    view.off('touch', onTouch)
    view.off('unloaded', cancel)
    cancel()
  }
}
