import { motionScope, motionStates } from '../src/index.js'
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
