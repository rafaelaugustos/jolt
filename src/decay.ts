export interface DecayMotion {
  duration: number
  to: number
  position(time: number): number
  velocity(time: number): number
  interpolationError(start: number, end: number): number
}

/** Velocity retains this fraction every millisecond, independently of the display's refresh rate. */
export const DEFAULT_FRICTION = 0.998

/** Exponential motion, with velocity in units per second and time in milliseconds. */
export function solveDecay(
  from: number,
  velocity: number,
  friction: number,
  precision: number,
): DecayMotion {
  const rate = -Math.log(friction)
  const distance = velocity / (1000 * rate)
  const to = from + distance
  // Stop only when both the remaining distance and speed are imperceptible.
  const duration =
    velocity === 0
      ? 0
      : Math.ceil(
          Math.max(
            0,
            Math.log(Math.abs(distance) / precision) / rate,
            Math.log(Math.abs(velocity) / (precision * 10)) / rate,
          ),
        )

  if (!Number.isFinite(to) || !Number.isFinite(duration) || duration > 2_147_483_647) {
    throw new RangeError('Decay velocity and friction produce an unplayable motion.')
  }

  return {
    duration,
    to,
    position: (time) =>
      time >= duration ? to : from - distance * Math.expm1(-rate * Math.max(0, time)),
    velocity: (time) =>
      time >= duration ? 0 : velocity * Math.exp(-rate * Math.max(0, time)),
    interpolationError: (start, end) =>
      (Math.abs(distance) *
        rate *
        rate *
        Math.exp(-rate * Math.max(0, start)) *
        (end - start) ** 2) /
        8 +
      (end >= duration ? Math.abs(distance) * Math.exp(-rate * duration) : 0),
  }
}
