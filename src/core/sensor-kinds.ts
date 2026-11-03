/** Canonical sensor names shared by native drivers and browser adapters. */
export const sensorKinds = [
  'rotation',
  'gravity',
  'acceleration',
  'linearAcceleration',
  'gyroscope',
  'magneticField',
] as const
export type SensorKind = (typeof sensorKinds)[number]
export type VectorSensorKind = Exclude<SensorKind, 'rotation'>
export type SensorUnit = 'rad' | 'm/s²' | 'rad/s' | 'µT'
export const sensorUnits: Readonly<Record<SensorKind, SensorUnit>> = {
  rotation: 'rad',
  gravity: 'm/s²',
  acceleration: 'm/s²',
  linearAcceleration: 'm/s²',
  gyroscope: 'rad/s',
  magneticField: 'µT',
}
