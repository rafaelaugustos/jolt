import { drag, motionScope, motionStates, type DragRelease } from '../src/index.js'
import type { View } from '@nativescript/core'
declare const icon: View
declare const label: View
const states = motionStates(
  { icon, label },
  { idle: { icon: { scale: 1 } }, loading: { label: { opacity: 0 } } },
)
states.to('loading')
// @ts-expect-error names are inferred
states.to('missing')
// @ts-expect-error unknown target
motionStates({ icon }, { idle: { unknown: { scale: 1 } } })
// @ts-expect-error state values are endpoints
motionStates({ icon }, { idle: { icon: { scale: [0, 1] } } })
const scope = motionScope()
const owned = scope.states({ icon }, { idle: { icon: { x: 0 } } })
// @ts-expect-error scope retains inferred names
owned.to('loading')
// @ts-expect-error finite state transitions cannot loop
states.to('idle', { repeat: Infinity })
// @ts-expect-error misspelled target is rejected even beside a valid target
motionStates({ icon }, { idle: { icon: { x: 0 }, typo: { x: 10 } } })
// @ts-expect-error misspelled property is rejected even beside a valid property
motionStates({ icon }, { idle: { icon: { x: 0, typo: 10 } } })
const dragged = scope.drag(icon, {
  axis: 'y',
  bounds: { top: 0, bottom: 200 },
  snap: [0, 100, 200],
})
dragged.cancel()
// @ts-expect-error bounds are numeric DIPs
drag(icon, { bounds: { right: '100%' } })
// @ts-expect-error only supported axis names
drag(icon, { axis: 'horizontal' })
drag(label, {
  onRelease(event: DragRelease) {
    void event.animation.finished.then((completed: boolean) => completed)
    // @ts-expect-error release targets are readonly snapshots
    event.target.x = 1
  },
})
const later = motionStates({ icon: null, label }, { idle: { icon: { scale: 1 } } })
later.attach('icon', icon)
later.attach('icon', null)
later.ref('label')({ nativeView: label })
// @ts-expect-error unknown attached target
later.attach('missing', icon)
