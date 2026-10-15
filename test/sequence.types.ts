import { Label } from '@nativescript/core'
import {
  animate,
  sequence,
  springs,
  type Animation,
  type Step,
  type SequenceOptions,
  type SequencePosition,
} from '../src/index.js'
const view = new Label()
const at: SequencePosition = '-150'
const options: SequenceOptions = { ...springs.bouncy, at, stagger: 50 }
const steps: readonly Step[] = [
  [view, 'popIn', options],
  [view, 'fadeInUp', { at: '<' }],
  [[view], { opacity: [0, 1] }, { at: 250, opacity: { duration: 100 } }],
  () => animate(view, 'fadeIn'),
]
const animation: Animation = sequence(steps)
// @ts-expect-error Unsigned strings are not absolute positions.
sequence([[view, 'fadeIn', { at: '150' }]])
// @ts-expect-error Timeline positioning belongs to sequence, not animate.
animate(view, 'fadeIn', { at: '<' })
// @ts-expect-error Unsupported timeline labels.
sequence([[view, 'fadeIn', { at: 'hero' }]])
void animation
