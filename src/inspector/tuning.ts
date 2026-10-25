import { resolveTransition } from '../transition.js'
import type { SpringParams } from '../spring.js'

export type InspectorSpring =
  | { duration: number; bounce: number }
  | { stiffness: number; damping: number; mass: number }

/** A fresh plain configuration, usable unchanged after an application restart. */
export function inspectorSpring(
  value: InspectorSpring,
): SpringParams & { type: 'spring' } {
  const fields =
    'duration' in value
      ? (['duration', 'bounce'] as const)
      : (['stiffness', 'damping', 'mass'] as const)
  for (const key of fields) {
    const n = (value as unknown as Record<string, number>)[key]
    if (!Number.isFinite(n)) throw new RangeError(`Invalid spring ${key}.`)
  }
  const result =
    'duration' in value
      ? { type: 'spring' as const, duration: value.duration, bounce: value.bounce }
      : {
          type: 'spring' as const,
          stiffness: value.stiffness,
          damping: value.damping,
          mass: value.mass,
        }
  if ('duration' in value) {
    if (value.duration <= 0 || value.bounce <= -1 || value.bounce >= 1)
      throw new RangeError('Use a positive spring duration and bounce between -1 and 1.')
  } else if (value.stiffness <= 0 || value.damping < 0 || value.mass <= 0) {
    throw new RangeError(
      'Spring stiffness/mass must be positive and damping nonnegative.',
    )
  }
  resolveTransition(result, 'x', 2)
  return result
}

export function springCode(options: {
  target?: string
  to: number
  spring: InspectorSpring
}) {
  const target = options.target ?? 'card'
  if (!/^[A-Za-z_$][\w$]*$/.test(target) || !Number.isFinite(options.to))
    throw new TypeError('Use a target identifier and a finite translation.')
  const spring = inspectorSpring(options.spring)
  return `import { animate } from '@rafaelaugusto/jolt'\n\nanimate(${target}, { x: [0, ${options.to}] }, ${JSON.stringify({ ...spring, velocity: 0 }, null, 2)})\n`
}
