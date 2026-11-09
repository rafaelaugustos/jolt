import { sensorKinds, type SensorKind } from './sensor-kinds.js'

/** Canonical, explicitly synthetic input; timestamps are relative milliseconds. */
export interface SensorSample {
  time: number
  /** Quaternion xyzw for rotation; canonical device-coordinate xyz for vectors. */
  values: readonly number[]
  orientation?: 0 | 90 | 180 | 270
}

export function validateSensorSamples(
  kind: SensorKind,
  samples: readonly SensorSample[],
): SensorSample[] {
  if (!sensorKinds.includes(kind)) throw new TypeError('Unknown sensor kind.')
  if (!Array.isArray(samples) || samples.length < 2 || samples.length > 10000)
    throw new RangeError('Use 2–10000 sensor samples.')
  let previous = -1
  return samples.map((sample) => {
    if (
      !sample ||
      !Number.isFinite(sample.time) ||
      sample.time <= previous ||
      sample.time > 60000 ||
      sample.time < 0
    )
      throw new RangeError('Sensor times must increase within 0–60000 milliseconds.')
    previous = sample.time
    if (
      !Array.isArray(sample.values) ||
      sample.values.length !== (kind === 'rotation' ? 4 : 3) ||
      sample.values.some((v: number) => !Number.isFinite(v))
    )
      throw new TypeError('Invalid canonical sensor sample.')
    if (kind === 'rotation' && Math.hypot(...sample.values) < 1e-8)
      throw new RangeError('A quaternion cannot be zero.')
    if (
      sample.orientation !== undefined &&
      ![0, 90, 180, 270].includes(sample.orientation)
    )
      throw new RangeError('Invalid interface orientation.')
    return {
      time: sample.time,
      values: [...sample.values],
      ...(sample.orientation === undefined ? {} : { orientation: sample.orientation }),
    }
  })
}
