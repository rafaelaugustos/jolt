import type { Animation } from './playback.js'

const arrivals = new WeakMap<Animation, Promise<unknown>>()

/** Internal forecast for starting a timeline step before another one arrives. */
export interface ArrivalTiming {
  read(): { remaining: number | undefined; paused: boolean; arrived: boolean }
  subscribe(callback: () => void): () => void
}
const arrivalTimings = new WeakMap<Animation, ArrivalTiming>()

export function arrivalTimingOf(animation: Animation) {
  return arrivalTimings.get(animation)
}

export function setArrivalTiming(animation: Animation, timing: ArrivalTiming) {
  arrivalTimings.set(animation, timing)
}

/**
 * Resolves once the animation looks done, which for a spring is well before
 * `finished`. Sequences move on to the next step then.
 */
export function arrivalOf(animation: Animation): Promise<unknown> {
  return arrivals.get(animation) ?? animation.finished
}

export function setArrival(animation: Animation, arrival: Promise<unknown>) {
  arrivals.set(animation, arrival)
}
