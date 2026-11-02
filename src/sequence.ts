import { timeScale } from './config.js'
import { getDriver } from './driver/index.js'
import { isDecorationProperty, validateDecorationTarget } from './decoration.js'
import type { View } from '@nativescript/core'
import { animate, startingValues, toViews } from './animate.js'
import { stopView, type Animation } from './engine.js'
import { composePrepared, parsePosition } from './core/sequence.js'
import {
  isMotionValue,
  type MotionValue,
  type ValueAnimationOptions,
} from './motion-value.js'
import type { PresetName } from './presets.js'
import { writeValue, type Property } from './properties.js'
import type { SpringName } from './transition.js'
import type { AnimateOptions, Keyframes, Target } from './types.js'

/** Absolute milliseconds, a signed offset from the previous arrival, or its start. */
export type SequencePosition = number | '<' | `${'+' | '-'}${number}`
export type SequenceOptions = AnimateOptions & { at?: SequencePosition }

export type Step =
  | readonly [
      target: Target | readonly Target[],
      animation: Keyframes | PresetName,
      options?: SequenceOptions | SpringName,
    ]
  | (() => Animation)

/** A participant that can genuinely freeze and continue, rather than restart. */
export interface PlayableAnimation extends Animation {
  pause(): void
  play(): void
  readonly paused: boolean
  readonly duration?: number
}

export type TimelineStep =
  | Exclude<Step, () => Animation>
  | readonly [
      MotionValue,
      number | readonly (number | null)[],
      ((ValueAnimationOptions & { at?: SequencePosition }) | SpringName)?,
    ]
  | { readonly at?: SequencePosition; readonly run: () => PlayableAnimation }
  | (() => PlayableAnimation)

export interface TimelineAnimation extends PlayableAnimation {
  /** Unknown until every step has activated and every participant reports a duration. */
  readonly duration: number | undefined
}

/** Overlapping steps with a shared pause/resume control, including pending launches. */
export function timeline(steps: readonly TimelineStep[]): TimelineAnimation {
  return compose(steps, true) as TimelineAnimation
}

/**
 * By default a step starts once the previous one looks done. `at` can overlap
 * that arrival, share the previous start, or select an absolute timeline time.
 * Views in later steps take their first absolute keyframe right away, so a title
 * that fades in third doesn't show up before its turn. Relative and null keyframes
 * read the current value when their step starts.
 *
 * ```ts
 * await sequence([
 *   [logo, 'popIn'],
 *   [title, 'fadeInUp', { at: '-150' }],
 *   [buttons, 'fadeInUp', { stagger: 50, at: '<' }],
 * ])
 * ```
 */
export function sequence(steps: readonly Step[]): Animation {
  return compose(steps, false)
}

function compose(
  steps: readonly TimelineStep[] | readonly Step[],
  controlled: boolean,
): Animation {
  const prepared = steps.map((step) => {
    if (typeof step === 'function') return { step, position: undefined }
    if (!Array.isArray(step)) {
      const descriptor = step as { at?: SequencePosition; run: () => PlayableAnimation }
      if (typeof descriptor.run !== 'function')
        throw new TypeError('A timeline step needs a run() factory.')
      return { step: descriptor.run, position: parsePosition(descriptor.at) }
    }
    const [target, animation, options] = step as Exclude<
      TimelineStep,
      Function | { run: () => PlayableAnimation }
    >
    if (typeof options !== 'object' || options === null)
      return { step, position: undefined }
    const { at, ...transition } = options
    const position = parsePosition(at)
    return { step: [target, animation, transition] as Step, position }
  })
  applyStartingValues(
    prepared
      .map(({ step }) => step as Step)
      .filter((step) => typeof step === 'function' || !isMotionValue(step[0])),
  )

  return composePrepared(
    prepared.map(({ step, position }) => ({
      position,
      step:
        typeof step === 'function'
          ? step
          : () => (animate as (...args: any[]) => Animation)(...(step as any[])),
    })),
    controlled,
    { driver: getDriver(), slowdown: 1 / timeScale() },
  )
}

function applyStartingValues(steps: readonly Step[]) {
  const claimed = new Map<View, Set<Property>>()
  for (const step of steps) {
    if (typeof step === 'function') continue
    const [target, animation, options] = step
    const starts = startingValues(animation, options)

    for (const view of toViews(target)) {
      for (const property of starts.keys())
        if (isDecorationProperty(property)) validateDecorationTarget(view, property)
      let properties = claimed.get(view)
      if (!properties) claimed.set(view, (properties = new Set()))

      const fresh = [...starts].filter(
        ([property, value]) => !properties.has(property) && value !== null,
      )
      stopView(
        view,
        fresh.map(([property]) => property),
      )
      for (const [property, value] of fresh) {
        if (value !== null) writeValue(view, property, value)
      }
      getDriver().sync?.(view)
      for (const property of starts.keys()) properties.add(property)
    }
  }
}
