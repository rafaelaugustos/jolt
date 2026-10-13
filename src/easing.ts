export type EasingFunction = (progress: number) => number

export type CubicBezier = readonly [x1: number, y1: number, x2: number, y2: number]

export type EasingName =
  | 'linear'
  | 'ease'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'circIn'
  | 'circOut'
  | 'circInOut'
  | 'backIn'
  | 'backOut'
  | 'backInOut'
  | 'anticipate'

export type Easing = EasingName | CubicBezier | EasingFunction

export const linear: EasingFunction = (p) => p

export function cubicBezier(x1: number, y1: number, x2: number, y2: number) {
  if (x1 === y1 && x2 === y2) return linear

  const cx = 3 * x1
  const bx = 3 * (x2 - x1) - cx
  const ax = 1 - cx - bx
  const cy = 3 * y1
  const by = 3 * (y2 - y1) - cy
  const ay = 1 - cy - by

  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx

  const solveX = (x: number) => {
    let t = x
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x
      if (Math.abs(error) < 1e-7) return t
      const slope = slopeX(t)
      if (Math.abs(slope) < 1e-6) break
      t -= error / slope
    }

    let low = 0
    let high = 1
    t = x
    for (let i = 0; i < 40; i++) {
      const value = sampleX(t)
      if (Math.abs(value - x) < 1e-7) break
      if (value < x) low = t
      else high = t
      t = (low + high) / 2
    }
    return t
  }

  return (p: number) => (p <= 0 ? 0 : p >= 1 ? 1 : sampleY(solveX(p)))
}

const backIn = cubicBezier(0.36, 0, 0.66, -0.56)
const circIn: EasingFunction = (p) => 1 - Math.sqrt(1 - Math.min(p * p, 1))

const reverse =
  (easing: EasingFunction): EasingFunction =>
  (p) =>
    1 - easing(1 - p)

const mirror =
  (easing: EasingFunction): EasingFunction =>
  (p) =>
    p <= 0.5 ? easing(2 * p) / 2 : (2 - easing(2 * (1 - p))) / 2

const easings: Record<EasingName, EasingFunction> = {
  linear,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  easeIn: cubicBezier(0.42, 0, 1, 1),
  easeOut: cubicBezier(0, 0, 0.58, 1),
  easeInOut: cubicBezier(0.42, 0, 0.58, 1),
  circIn,
  circOut: reverse(circIn),
  circInOut: mirror(circIn),
  backIn,
  backOut: reverse(backIn),
  backInOut: mirror(backIn),
  anticipate: (p) =>
    p <= 0.5 ? backIn(2 * p) / 2 : p >= 1 ? 1 : 1 - Math.pow(2, 10 - 20 * p) / 2,
}

export function resolveEasing(easing: Easing): EasingFunction {
  if (typeof easing === 'function') return easing
  if (typeof easing === 'string') {
    const resolved = easings[easing]
    if (!resolved) throw new Error(`Unknown easing "${easing}".`)
    return resolved
  }
  return cubicBezier(...easing)
}
