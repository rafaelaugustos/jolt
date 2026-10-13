export interface SpringPhysics {
  stiffness: number
  damping: number
  mass: number
}

export interface SpringParams {
  stiffness?: number
  damping?: number
  mass?: number
  bounce?: number
  duration?: number
}

export interface SpringMotion {
  /** Milliseconds until the spring settles. */
  duration: number
  position(time: number): number
  /** Units per second. */
  velocity(time: number): number
}

const MAX_DURATION = 10_000
const STEP = 1000 / 120

export function springPhysics({
  stiffness,
  damping,
  mass,
  bounce,
  duration,
}: SpringParams): SpringPhysics {
  if (stiffness !== undefined || damping !== undefined || mass !== undefined) {
    return { stiffness: stiffness ?? 170, damping: damping ?? 26, mass: mass ?? 1 }
  }

  // The same model as SwiftUI: duration is the period of the undamped spring,
  // bounce 0 is critically damped, negative values are overdamped.
  const omega = (2 * Math.PI) / ((duration ?? 400) / 1000)
  const b = Math.min(Math.max(bounce ?? 0.15, -0.99), 0.99)
  const ratio = b >= 0 ? 1 - b : 1 / (1 + b)
  return { stiffness: omega * omega, damping: 2 * ratio * omega, mass: 1 }
}

export function solveSpring(
  { stiffness, damping, mass }: SpringPhysics,
  from: number,
  to: number,
  velocity: number,
  precision: number,
): SpringMotion {
  const x0 = from - to
  const w0 = Math.sqrt(stiffness / mass)
  const zeta = damping / (2 * Math.sqrt(stiffness * mass))

  let displacement: (t: number) => number
  if (Math.abs(zeta - 1) < 1e-6) {
    const b = velocity + w0 * x0
    displacement = (t) => Math.exp(-w0 * t) * (x0 + b * t)
  } else if (zeta < 1) {
    const wd = w0 * Math.sqrt(1 - zeta * zeta)
    const b = (velocity + zeta * w0 * x0) / wd
    displacement = (t) =>
      Math.exp(-zeta * w0 * t) * (x0 * Math.cos(wd * t) + b * Math.sin(wd * t))
  } else {
    const s = w0 * Math.sqrt(zeta * zeta - 1)
    const r1 = -zeta * w0 + s
    const r2 = -zeta * w0 - s
    const c1 = (velocity - r2 * x0) / (r1 - r2)
    const c2 = x0 - c1
    displacement = (t) => c1 * Math.exp(r1 * t) + c2 * Math.exp(r2 * t)
  }

  const position = (time: number) => to + displacement(time / 1000)
  const speed = (time: number) => {
    const t = time / 1000
    return (displacement(t + 0.0005) - displacement(t - 0.0005)) / 0.001
  }

  let duration = 0
  while (
    duration < MAX_DURATION &&
    (Math.abs(displacement(duration / 1000)) > precision ||
      Math.abs(speed(duration)) > precision * 10)
  ) {
    duration += STEP
  }
  duration = Math.ceil(duration)

  return {
    duration,
    position: (time) => (time >= duration ? to : position(time)),
    velocity: (time) => (time >= duration ? 0 : speed(time)),
  }
}
