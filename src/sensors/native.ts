import { Application, isIOS } from '@nativescript/core'
import { nativeLiveNode } from '../live-spring-driver.js'
import { liveValueInput, type SpringValue } from '../motion-value.js'
import type { SensorKind, SensorSnapshot } from './index.js'
export interface SensorDriver {
  enabled(active: boolean, paused: boolean): void
  snapshot(): SensorSnapshot
  recenter(): void
  replay(trace: string): void
  dispose(): void
}
const drivers = new WeakMap<object, SensorDriver>()
export function rememberSensorDriver(source: object, driver: SensorDriver) {
  drivers.set(source, driver)
}
export function sensorDriver(source: { disposed: boolean }): SensorDriver {
  const driver = drivers.get(source)
  if (!driver || source.disposed) throw new Error('Expected a live Jolt sensor.')
  return driver
}
export type SensorFactory = (
  kind: SensorKind,
  options: { interval: number; coordinates: string },
  nodes: readonly SpringValue[],
  changed: () => void,
) => SensorDriver
let override: SensorFactory | undefined
export function setSensorFactory(factory: SensorFactory | undefined) {
  override = factory
}
export const createSensorDriver: SensorFactory = (kind, options, values, changed) => {
  if (override) return override(kind, options, values, changed)
  const nodes = values.map((value) => nativeLiveNode(liveValueInput(value).node))
  if (isIOS) {
    if (typeof JoltSensorSource === 'undefined')
      throw new Error('Rebuild the native app to use sensor().')
    const native = JoltSensorSource.createOptionsOnState(
      kind,
      JSON.stringify(options),
      changed,
    )
    nodes.forEach((node, index) => native.connectIndex(node as JoltLiveSpring, index))
    return {
      enabled: (active, paused) => native.setEnabledPaused(active, paused),
      snapshot: () => JSON.parse(native.snapshot()),
      recenter: () => native.recenter(),
      replay: (trace) => native.replay(trace),
      dispose: () => native.dispose(),
    }
  }
  if (
    typeof org === 'undefined' ||
    typeof org.rafaelaugusto.jolt.SensorSource !== 'function'
  )
    throw new Error('Rebuild the native app to use sensor().')
  const native = new org.rafaelaugusto.jolt.SensorSource(
    Application.android.context,
    kind,
    JSON.stringify(options),
    new org.rafaelaugusto.jolt.SensorSource.Listener({ changed }),
  )
  nodes.forEach((node, index) =>
    native.connect(node as org.rafaelaugusto.jolt.LiveSpring, index),
  )
  return {
    enabled: (active, paused) => native.setEnabled(active, paused),
    snapshot: () => JSON.parse(native.snapshot()),
    recenter: () => native.recenter(),
    replay: (trace) => native.replay(trace),
    dispose: () => native.dispose(),
  }
}
