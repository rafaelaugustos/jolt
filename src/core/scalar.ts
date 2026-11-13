/** Portable scalar algebra. Velocities are units/second; angles passed to sin/cos are radians. */
export type ScalarOperation =
  | 'add'
  | 'sub'
  | 'mul'
  | 'div'
  | 'min'
  | 'max'
  | 'clamp'
  | 'abs'
  | 'sin'
  | 'cos'
  | 'velocity'

export interface ScalarOperations<T> {
  add(value: T | number): T
  sub(value: T | number): T
  mul(value: T | number): T
  div(value: T | number): T
  min(value: T | number): T
  max(value: T | number): T
  clamp(minimum: number, maximum: number): T
  abs(): T
  sin(): T
  cos(): T
  velocity(): T
}
export interface ScalarSample {
  value: number
  velocity: number
}

/** Invalid arithmetic settles to zero, never NaN/Infinity in a native property. */
export function scalarSample(
  op: ScalarOperation,
  a: number,
  av: number,
  b = 0,
  bv = 0,
  c = 0,
): ScalarSample {
  let value: number, velocity: number
  switch (op) {
    case 'add':
      value = a + b
      velocity = av + bv
      break
    case 'sub':
      value = a - b
      velocity = av - bv
      break
    case 'mul':
      value = a * b
      velocity = av * b + a * bv
      break
    case 'div':
      value = b === 0 ? 0 : a / b
      velocity = b === 0 ? 0 : (av * b - a * bv) / (b * b)
      break
    case 'min':
      value = Math.min(a, b)
      velocity = a < b ? av : a > b ? bv : 0
      break
    case 'max':
      value = Math.max(a, b)
      velocity = a > b ? av : a < b ? bv : 0
      break
    case 'clamp':
      value = Math.min(c, Math.max(b, a))
      velocity = a <= b || a >= c ? 0 : av
      break
    case 'abs':
      value = Math.abs(a)
      velocity = Math.sign(a) * av
      break
    case 'sin':
      value = Math.sin(a)
      velocity = Math.cos(a) * av
      break
    case 'cos':
      value = Math.cos(a)
      velocity = -Math.sin(a) * av
      break
    // This is a first-derivative source, not an acceleration estimator.
    case 'velocity':
      value = av
      velocity = 0
      break
  }
  return {
    value: Number.isFinite(value) ? value : 0,
    velocity: Number.isFinite(value) && Number.isFinite(velocity) ? velocity : 0,
  }
}

export function scalarBounds(minimum: number, maximum: number) {
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum > maximum)
    throw new RangeError('Scalar bounds must be finite and ordered.')
}

/** Adapters validate identity/lifecycle; this factory keeps the public vocabulary shared. */
export function scalarOperations<T>(
  make: (op: ScalarOperation, operand?: T | number, maximum?: number) => T,
): ScalarOperations<T> {
  const binary = (op: ScalarOperation, value: T | number) => {
    if (value === undefined) throw new TypeError('A scalar operation needs an operand.')
    return make(op, value)
  }
  return {
    add: (value) => binary('add', value),
    sub: (value) => binary('sub', value),
    mul: (value) => binary('mul', value),
    div: (value) => binary('div', value),
    min: (value) => binary('min', value),
    max: (value) => binary('max', value),
    clamp: (minimum, maximum) => {
      scalarBounds(minimum, maximum)
      return make('clamp', minimum, maximum)
    },
    abs: () => make('abs'),
    sin: () => make('sin'),
    cos: () => make('cos'),
    velocity: () => make('velocity'),
  }
}
