import type { Sensor } from '../sensors/index.js'
import { sensorDriver } from '../sensors/native.js'
import { validateSensorSamples, type SensorSample } from '../core/sensor-replay.js'
export type { SensorSample } from '../core/sensor-replay.js'
/** Play finite test inputs through the native sensor pipeline; hardware is detached during playback. */
export function replaySensor(source: Sensor, samples: readonly SensorSample[]): void {
  const checked = validateSensorSamples(source.kind, samples)
  sensorDriver(source).replay(JSON.stringify(checked))
}
