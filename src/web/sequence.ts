import {
  parsePosition,
  type PreparedStep,
  type SequencePosition,
  type PlayableAnimation,
  type TimelineAnimation,
} from '../core/sequence.js'
import type { Animation } from '../core/playback.js'
import type { AnimateOptions, Keyframes, SpringName } from './types.js'
import type { WebMotionValue } from './value.js'
import type { WebValueAnimationOptions } from './value-playback.js'
export type { SequencePosition, PlayableAnimation, TimelineAnimation }
export type WebSequenceOptions = AnimateOptions & { at?: SequencePosition }
export type WebStep =
  | readonly [
      HTMLElement | readonly HTMLElement[],
      Keyframes | string,
      (WebSequenceOptions | SpringName)?,
    ]
  | (() => Animation)
export type WebTimelineStep =
  | Exclude<WebStep, () => Animation>
  | readonly [
      WebMotionValue,
      number | readonly (number | null)[],
      ((WebValueAnimationOptions & { at?: SequencePosition }) | SpringName)?,
    ]
  | (() => PlayableAnimation)
  | { readonly at?: SequencePosition; readonly run: () => PlayableAnimation }
export function sequenceSteps(
  steps: readonly WebStep[] | readonly WebTimelineStep[],
  controlled: boolean,
  prepare: (target: unknown, animation: unknown, options: unknown) => () => Animation,
): PreparedStep[] {
  if (!Array.isArray(steps)) throw new TypeError('Expected an array of timeline steps.')
  return steps.map((step) => {
    if (typeof step === 'function') return { step, position: undefined }
    if (!Array.isArray(step)) {
      if (
        !controlled ||
        !step ||
        typeof step !== 'object' ||
        typeof step.run !== 'function' ||
        Object.keys(step).some((k) => k !== 'run' && k !== 'at')
      )
        throw new TypeError('Expected a playable timeline factory.')
      return { step: step.run, position: parsePosition(step.at) }
    }
    if (step.length < 2 || step.length > 3)
      throw new TypeError(
        'Timeline tuples need target, animation and optional transition.',
      )
    const [target, animation, options] = step
    if (typeof options !== 'object' || options === null)
      return { step: prepare(target, animation, options), position: undefined }
    if (Array.isArray(options)) throw new TypeError('Invalid timeline transition.')
    const { at, ...transition } = options
    return { step: prepare(target, animation, transition), position: parsePosition(at) }
  })
}
