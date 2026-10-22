import type { View } from '@nativescript/core'
import {
  animate,
  bind,
  drag,
  motionValue,
  set,
  stop,
  type Animation,
} from '../src/index.js'
declare const sheet: View
const progress = motionValue(0)
const y = progress.to([0, 1], [600, 0])
const tint = progress.to([0, 1], ['#000000', '#ffffff'])
const run: Animation = animate(progress, 1, 'snappy')
animate(progress, [0, 0.2, 0], { duration: 600, layer: 'pulse' })
stop(progress, { layer: 'pulse' })
// @ts-expect-error value layers are named
animate(progress, 1, { layer: 2 })
// @ts-expect-error motion values do not have view property selections
stop(progress, ['x'])
animate(progress, [0, 1, 0.5], { duration: 600, times: [0, 0.4, 1] })
set(progress, 0.5)
stop(progress)
const release: () => void = bind(sheet, { y, opacity: progress, backgroundColor: tint })
release()
y.to([0, 600], [1, 0.9]).get().toFixed()
tint.get().argb
const unsubscribe: () => void = progress.subscribe((value, time) => {
  value.toFixed()
  time.toFixed()
})
unsubscribe()
y.subscribe((value) => value.toFixed(), { immediate: false })
tint.subscribe((value) => value.argb)
// @ts-expect-error numeric subscriptions receive a number
progress.subscribe((value: string) => value.toUpperCase())
// @ts-expect-error color subscriptions receive a Color
tint.subscribe((value: number) => value.toFixed())
void run
// @ts-expect-error a derived value follows its source; animate the source
animate(y, 1)
// @ts-expect-error a color can't be mapped again
tint.to([0, 1], [0, 1])
// @ts-expect-error numeric properties take numbers
bind(sheet, { x: tint })
// @ts-expect-error color properties take colors
bind(sheet, { color: y })
drag(sheet, {
  axis: 'y',
  value: progress,
  snap: [0, 600],
  onRelease: ({ animation }) => void animation.then((done: boolean) => done),
})
// @ts-expect-error a dragged value moves along one axis
drag(sheet, { axis: 'both', value: progress })
// @ts-expect-error a derived value follows its source; drag the source
drag(sheet, { axis: 'y', value: y })
// @ts-expect-error snap points of a value are one list
drag(sheet, { axis: 'y', value: progress, snap: { y: [0, 600] } })
drag(sheet, {
  axis: 'y',
  value: progress,
  // @ts-expect-error a value's release has no playback controls yet
  onRelease: ({ animation }) => animation.pause(),
})
drag(sheet, { onRelease: ({ animation }) => animation.pause() })
