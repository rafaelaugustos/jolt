import type { SensorSample } from '../core/sensor-replay.js'
export interface SensorReplaySession {
  allowed(active: boolean): void
  dispose(): void
}
export interface SensorReplayControl {
  now(): number
  after(ms: number, action: () => void): () => void
  inject(sample: SensorSample): void
  end(): void
}
type Driver = (session: SensorReplaySession) => SensorReplayControl
const drivers = new WeakMap<object, Driver>()
export function registerSensorReplay(source: object, driver: Driver) {
  drivers.set(source, driver)
  return () => drivers.delete(source)
}
export function sensorReplayDriver(source: object): Driver {
  const driver = drivers.get(source)
  if (!driver)
    throw new TypeError('Replay requires a live Web sensor from this Jolt module.')
  return driver
}
