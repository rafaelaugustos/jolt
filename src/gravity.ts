export interface GravityMotion {
  duration: number
  /** Exact impact and turning-point times, in milliseconds. */
  breakpoints: number[]
  position(time: number): number
  velocity(time: number): number
  interpolationError(start: number, end: number): number
}

export const DEFAULT_ACCELERATION = 1800
export const DEFAULT_RESTITUTION = 0.55
const MAX_FLIGHTS = 512
const MAX_DURATION = 60_000

/** Ballistic flights against one fixed boundary; no numerical integration or frame loop. */
export function solveGravity(
  from: number,
  to: number,
  acceleration: number,
  restitution: number,
  velocity: number,
  precision: number,
): GravityMotion {
  if (
    ![from, to, acceleration, restitution, velocity, precision].every(Number.isFinite) ||
    acceleration <= 0 ||
    restitution < 0 ||
    restitution >= 1 ||
    precision <= 0
  )
    throw new RangeError(
      'Invalid gravity position, acceleration, restitution or velocity.',
    )

  const direction = to < from ? -1 : 1
  const distance = Math.abs(to - from)
  let speed = velocity * direction
  const impact = Math.hypot(speed, Math.sqrt(2 * acceleration * distance))
  if (!Number.isFinite(impact))
    throw new RangeError('Gravity motion exceeds the finite numeric range.')
  // This form avoids cancellation when moving quickly toward a nearby boundary.
  let seconds =
    speed >= 0
      ? distance === 0
        ? 0
        : (2 * distance) / (impact + speed)
      : (impact - speed) / acceleration
  let duration = 0
  const flights: { start: number; end: number; origin: number; speed: number }[] = []
  const breakpoints: number[] = []
  const addFlight = (origin: number, initial: number, length: number) => {
    const end = duration + length * 1000
    if (!Number.isFinite(end) || end > MAX_DURATION || flights.length >= MAX_FLIGHTS)
      throw new RangeError(
        'Gravity motion must settle within 60 seconds and 512 flights.',
      )
    if (length > 0) {
      const apex = duration - (initial / acceleration) * 1000
      if (apex > duration && apex < end) breakpoints.push(apex)
      flights.push({ start: duration, end, origin, speed: initial })
      breakpoints.push(end)
      duration = end
    }
  }
  addFlight(-distance, speed, seconds)
  speed = impact * restitution
  while (speed > precision * 10 || (speed * speed) / (2 * acceleration) > precision) {
    seconds = (2 * speed) / acceleration
    addFlight(0, -speed, seconds)
    speed *= restitution
  }
  const flightAt = (time: number) => {
    let lo = 0,
      hi = flights.length - 1
    while (lo < hi) {
      const mid = (lo + hi) >>> 1
      if (time >= flights[mid]!.end) lo = mid + 1
      else hi = mid
    }
    return flights[lo]!
  }
  return {
    duration,
    breakpoints,
    position(time) {
      if (time >= duration) return to
      if (time <= 0) return from
      const flight = flightAt(time)
      const t = (time - flight.start) / 1000
      return (
        to +
        direction *
          Math.min(0, flight.origin + flight.speed * t + (acceleration * t * t) / 2)
      )
    },
    velocity(time) {
      if (duration === 0 || time >= duration) return 0
      const flight = flightAt(Math.max(0, time))
      return (
        direction *
        (flight.speed + (acceleration * (Math.max(0, time) - flight.start)) / 1000)
      )
    },
    // Valid between mandatory impact seams. Each flight is an exact quadratic.
    interpolationError: (start, end) => (acceleration * ((end - start) / 1000) ** 2) / 8,
  }
}
