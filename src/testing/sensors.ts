import type { Sensor } from '../sensors/index.js'
import { sensorDriver } from '../sensors/native.js'
/** Explicit canonical test inputs. These are synthetic samples, never evidence from device hardware. */
export interface SensorSample {
  /** Relative milliseconds from the start of playback. */
  time: number
  /** Device-coordinate quaternion xyzw for rotation; downward m/s² xyz for gravity. */
  values: readonly number[]
  /** Interface clockwise basis angle from device coordinates, in degrees. */
  orientation?: 0 | 90 | 180 | 270
}
/** Play finite test inputs through the native sensor pipeline; hardware is detached during playback. */
export function replaySensor(source: Sensor, samples: readonly SensorSample[]): void {
  if (!Array.isArray(samples) || samples.length < 2 || samples.length > 10000)
    throw new RangeError('Use 2–10000 sensor samples.')
  let previous = -1
  for (const sample of samples) {
    if (
      !Number.isFinite(sample.time) ||
      sample.time <= previous ||
      sample.time > 60000 ||
      sample.time < 0
    )
      throw new RangeError('Sensor times must increase within 0–60000 milliseconds.')
    previous = sample.time
    if (
      !Array.isArray(sample.values) ||
      sample.values.length !== (source.kind === 'rotation' ? 4 : 3) ||
      sample.values.some((value: number) => !Number.isFinite(value))
    )
      throw new TypeError('Invalid canonical sensor sample.')
    if (source.kind === 'rotation' && Math.hypot(...sample.values) < 1e-8)
      throw new RangeError('A quaternion cannot be zero.')
    if (
      sample.orientation !== undefined &&
      ![0, 90, 180, 270].includes(sample.orientation)
    )
      throw new RangeError('Invalid interface orientation.')
  }
  sensorDriver(source).replay(JSON.stringify(samples))
}
