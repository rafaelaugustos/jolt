import { resolveEasing, type Easing, type EasingFunction } from './easing.js'
import type { Property } from './properties.js'
import { isDecorationProperty } from './decoration.js'
import { isColorProperty } from './color.js'
import { springPhysics, type SpringPhysics } from './spring.js'
import type { DragCurve } from './drag-physics.js'

export interface Timing {
  /** Milliseconds to wait before starting. The first keyframe is applied right away. */
  delay?: number
  /** How many more times to play it. `Infinity` keeps going until stopped. */
  repeat?: number
  /** `reverse` plays every other repeat backwards. */
  repeatType?: 'loop' | 'reverse'
  /** Milliseconds to hold the end value before each repeat. The first play doesn't wait. */
  repeatDelay?: number
}

export interface Tween extends Timing {
  type?: 'tween'
  /** Milliseconds. */
  duration?: number
  /** One easing, or one per segment between keyframes. */
  ease?: Easing | readonly Easing[]
  /** Where each keyframe sits, from 0 to 1. Evenly spaced by default. */
  times?: readonly number[]
}

export interface Spring extends Timing {
  type?: 'spring'
  stiffness?: number
  damping?: number
  mass?: number
  /** From -1 to 1. 0 settles without overshooting, higher values bounce more. */
  bounce?: number
  /** How long the spring feels, in milliseconds. Goes with `bounce`, ignored with `stiffness`, `damping` or `mass`. */
  duration?: number
  /** Units per second. Defaults to the velocity of the animation it interrupts. */
  velocity?: number
}

export type Transition = Tween | Spring

export type SpringName = 'smooth' | 'snappy' | 'bouncy'

export const springs: Record<SpringName, Spring> = {
  smooth: { type: 'spring', duration: 500, bounce: 0 },
  snappy: { type: 'spring', duration: 400, bounce: 0.15 },
  bouncy: { type: 'spring', duration: 550, bounce: 0.4 },
}

export type Curve =
  | DragCurve
  | {
      type: 'tween'
      duration: number
      ease: readonly EasingFunction[]
      times: readonly number[] | undefined
    }
  | { type: 'spring'; physics: SpringPhysics; velocity: number | undefined }
  | {
      type: 'decay'
      friction: number
      velocity: number
      snap: readonly number[] | undefined
    }

export interface ResolvedTransition {
  curve: Curve
  delay: number
  repeat: number
  reverse: boolean
  repeatDelay?: number
}

const springKeys = ['stiffness', 'damping', 'mass', 'bounce', 'velocity'] as const
const curveKeys = ['type', 'duration', 'ease', 'times', ...springKeys] as const
const timingKeys = ['delay', 'repeat', 'repeatType', 'repeatDelay'] as const

export const DEFAULT_DURATION = 300

export function hasCurve(transition: Transition): boolean {
  return curveKeys.some(
    (key) => (transition as Record<string, unknown>)[key] !== undefined,
  )
}

export function timingOf(transition: Transition): Timing {
  const timing: Record<string, unknown> = {}
  for (const key of timingKeys) {
    if (transition[key] !== undefined) timing[key] = transition[key]
  }
  return timing
}

/** Timing merges key by key, the curve is taken whole from whichever side has one. */
export function mergeTransitions(base: Transition, override: Transition): Transition {
  return hasCurve(override)
    ? { ...timingOf(base), ...override }
    : { ...base, ...timingOf(override) }
}

export function resolveTransition(
  transition: Transition,
  property: Property,
  keyframes: number,
): ResolvedTransition {
  const type =
    transition.type ??
    (springKeys.some((key) => (transition as Spring)[key] !== undefined)
      ? 'spring'
      : hasCurve(transition) ||
          property === 'opacity' ||
          isColorProperty(property) ||
          isDecorationProperty(property) ||
          keyframes > 2
        ? 'tween'
        : 'spring')

  const delay = transition.delay ?? 0
  const repeat = transition.repeat ?? 0
  if (delay < 0 || Number.isNaN(delay)) throw new RangeError(`Invalid delay: ${delay}.`)
  if (repeat < 0 || Number.isNaN(repeat))
    throw new RangeError(`Invalid repeat: ${repeat}.`)
  const repeatDelay = transition.repeatDelay ?? 0
  if (!Number.isFinite(repeatDelay) || repeatDelay < 0)
    throw new RangeError(`Invalid repeat delay: ${repeatDelay}.`)
  const timing = {
    delay,
    repeat,
    reverse: transition.repeatType === 'reverse',
    ...(repeatDelay > 0 && repeat > 0 && { repeatDelay }),
  }

  if (type === 'spring') {
    if (keyframes > 2) {
      throw new Error(
        `A spring goes from one value to another, but "${property}" has ${keyframes} keyframes. Use a tween for keyframes.`,
      )
    }
    const spring = transition as Spring
    return {
      ...timing,
      curve: { type, physics: springPhysics(spring), velocity: spring.velocity },
    }
  }

  const tween = transition as Tween
  const duration = tween.duration ?? DEFAULT_DURATION
  if (
    duration < 0 ||
    Number.isNaN(duration) ||
    ((isColorProperty(property) || isDecorationProperty(property)) &&
      !Number.isFinite(duration))
  ) {
    throw new RangeError(`Invalid duration: ${duration}.`)
  }

  const segments = keyframes - 1
  const ease = tween.ease ?? 'easeOut'
  const eases = isEasingList(ease) ? ease : Array.from({ length: segments }, () => ease)
  if (eases.length !== segments) {
    throw new Error(
      `"${property}" has ${segments} segments between keyframes but ${eases.length} easings.`,
    )
  }

  const times = tween.times
  if (times) {
    const valid =
      times.length === keyframes &&
      times[0] === 0 &&
      times.at(-1) === 1 &&
      times.every((time, i) => i === 0 || time >= times[i - 1]!)
    if (!valid) {
      throw new Error(
        `"times" needs one value per keyframe (${keyframes}), going from 0 to 1 without going back.`,
      )
    }
  }

  return {
    ...timing,
    curve: { type, duration, ease: eases.map(resolveEasing), times },
  }
}

function isEasingList(ease: Easing | readonly Easing[]): ease is readonly Easing[] {
  return Array.isArray(ease) && ease.length > 0 && typeof ease[0] !== 'number'
}
