import type { View } from '@nativescript/core'
import { animate, bind, motionValue, set, stop, type Animation } from '../src/index.js'
declare const sheet: View
const progress = motionValue(0)
const y = progress.to([0, 1], [600, 0])
const tint = progress.to([0, 1], ['#000000', '#ffffff'])
const run: Animation = animate(progress, 1, 'snappy')
animate(progress, [0, 1, 0.5], { duration: 600, times: [0, 0.4, 1] })
set(progress, 0.5)
stop(progress)
const release: () => void = bind(sheet, { y, opacity: progress, backgroundColor: tint })
release()
y.to([0, 600], [1, 0.9]).get().toFixed()
tint.get().argb
void run
// @ts-expect-error a derived value follows its source; animate the source
animate(y, 1)
// @ts-expect-error a color can't be mapped again
tint.to([0, 1], [0, 1])
// @ts-expect-error numeric properties take numbers
bind(sheet, { x: tint })
// @ts-expect-error color properties take colors
bind(sheet, { color: y })
