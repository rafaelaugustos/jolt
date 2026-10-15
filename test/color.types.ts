import { Color } from '@nativescript/core'
import {
  animate,
  press,
  sequence,
  stop,
  type ColorKeyframes,
  type Target,
} from '../src/index.js'

export function colorTypes(view: Target) {
  const colors: ColorKeyframes = [null, new Color('#ff0000'), 'blue']
  animate(
    view,
    { backgroundColor: colors, borderColor: 'red', color: new Color('blue') },
    { backgroundColor: { duration: 400 } },
  )
  sequence([[view, { color: ['red', 'blue'] }]])
  press(view, { backgroundColor: 'red' })
  stop(view, ['backgroundColor', 'borderColor', 'color'])
  // @ts-expect-error Colors are color strings or NativeScript Color objects.
  animate(view, { color: 0xff0000 })
  // @ts-expect-error Numeric properties do not accept color keyframes.
  animate(view, { opacity: ['red', 'blue'] })
}
