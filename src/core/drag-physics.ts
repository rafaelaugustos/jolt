import { solveDecay } from './decay.js'
import { solveSpring, springPhysics } from './spring.js'

export interface DragCurve {
  type: 'drag'
  velocity: number
  friction: number
  bounds: readonly [number, number]
  snap?: readonly number[]
  rubberband: boolean
}

export const clampDrag = (value: number, [min, max]: readonly [number, number]) =>
  Math.max(min, Math.min(max, value))

/** Bounded resistance; coordinates and the resistance length are DIPs. */
export function resistDrag(
  value: number,
  bounds: readonly [number, number],
  length: number,
) {
  const edge = clampDrag(value, bounds)
  const distance = value - edge
  return edge + (distance / (1 + Math.abs(distance) / length)) * 0.55
}

/** Recover the finger-space origin when grabbing an already rubberbanded pose. */
export function resumeDrag(
  value: number,
  bounds: readonly [number, number],
  length: number,
) {
  const edge = clampDrag(value, bounds)
  const distance = value - edge
  // A native edge spring or external owner can exceed the usual resistance range.
  // Expand it for this gesture so every finite visible pose has a stable inverse.
  length = Math.max(length, Math.abs(distance) * 4)
  return { origin: edge + distance / (0.55 - Math.abs(distance) / length), length }
}

export function dragDestination(from: number, curve: DragCurve) {
  const projected = solveDecay(from, curve.velocity, curve.friction, 0.25).to
  if (curve.snap)
    return curve.snap.reduce((best, point) =>
      Math.abs(point - projected) < Math.abs(best - projected) ? point : best,
    )
  return clampDrag(projected, curve.bounds)
}

/** One precomputed motion. Native keyframes play both the coast and edge recovery. */
export function solveDragRelease(from: number, curve: DragCurve) {
  const to = dragDestination(from, curve)
  const coast = solveDecay(from, curve.velocity, curve.friction, 0.25)
  const edge = clampDrag(from, curve.bounds)
  const springTo = (start: number, target: number, velocity: number) => {
    const motion = solveSpring(
      springPhysics({ duration: 500, bounce: 0 }),
      start,
      target,
      velocity,
      0.25,
    )
    const position = (time: number) => {
      const value = time >= motion.duration ? target : motion.position(time)
      return curve.rubberband ? value : clampDrag(value, curve.bounds)
    }
    return {
      ...motion,
      position,
      velocity: (time: number) => {
        const raw = motion.position(time)
        return time >= motion.duration ||
          (!curve.rubberband && raw !== clampDrag(raw, curve.bounds))
          ? 0
          : motion.velocity(time)
      },
    }
  }
  if (curve.snap || from !== edge)
    return {
      ...springTo(from, curve.snap ? to : edge, curve.velocity),
      to: curve.snap ? to : edge,
    }
  if (to === coast.to) return coast

  // Reach the boundary with the decay's actual velocity, then absorb that velocity.
  const rate = -Math.log(curve.friction)
  const collision = Math.max(
    0,
    -Math.log1p((-(to - from) * rate * 1000) / curve.velocity) / rate,
  )
  const recovery = springTo(to, to, coast.velocity(collision))
  const duration = collision + (curve.rubberband ? recovery.duration : 0)
  return {
    to,
    duration,
    position: (time: number) =>
      time >= duration
        ? to
        : time < collision
          ? coast.position(time)
          : recovery.position(time - collision),
    velocity: (time: number) =>
      time >= duration
        ? 0
        : time < collision
          ? coast.velocity(time)
          : recovery.velocity(time - collision),
  }
}
