import { Label } from '@nativescript/core'
import { animate, press, sequence, stop, type Keyframes } from '../src/index.js'
const view = new Label()
const shape: Keyframes = {
  borderRadius: [null, 32],
  borderWidth: 4,
  shadowOpacity: 0.5,
  shadowRadius: 12,
  shadowOffsetX: -4,
  shadowOffsetY: [0, 8],
  elevation: 16,
  translationZ: 4,
}
animate(view, shape, { borderRadius: 'bouncy', shadowRadius: { duration: 800 } })
sequence([[view, shape]])
stop(view, ['borderRadius', 'shadowOffsetY', 'elevation'])
press(view, { borderRadius: 12 })
// @ts-expect-error Dimensions are numeric DIPs.
animate(view, { borderRadius: '50%' })
// @ts-expect-error The boxShadow CSS string itself is not interpolated.
animate(view, { boxShadow: '0 4 10 black' })
