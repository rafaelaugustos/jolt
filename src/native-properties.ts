import { registerNativeProperty } from './native-property.js'

export interface Coordinate {
  latitude: number
  longitude: number
}
export interface MapKitCamera extends Coordinate {
  altitude: number
  pitch: number
  heading: number
}
export interface MapLibreCamera extends Coordinate {
  zoom: number
  tilt: number
  bearing: number
}
export interface ScenePose {
  position: readonly [number, number, number]
  orientation: readonly [number, number, number, number]
}

/** Shortest longitude/heading interpolation. Coordinates use a local linear path, not a geodesic. */
export function shortestAngle(from: number, to: number, fraction: number) {
  const delta = ((((to - from + 180) % 360) + 360) % 360) - 180
  return from + delta * fraction
}
function validateCoordinate(value: Coordinate) {
  if (
    !Number.isFinite(value.latitude) ||
    Math.abs(value.latitude) > 90 ||
    !Number.isFinite(value.longitude)
  )
    throw new RangeError('Coordinates need latitude in -90..90 and a finite longitude.')
}
function coordinate(from: Coordinate, to: Coordinate, t: number): Coordinate {
  return {
    latitude: Math.max(
      -90,
      Math.min(90, from.latitude + (to.latitude - from.latitude) * t),
    ),
    longitude: shortestAngle(from.longitude, to.longitude, t),
  }
}

export const mapKitCoordinate = registerNativeProperty<Coordinate>({
  name: 'jolt.mapkit/coordinate',
  units: ['latitude degrees', 'longitude degrees'],
  platforms: ['ios'],
  spatial: true,
  encode: (v) => [v.latitude, v.longitude],
  decode: (v) => ({ latitude: v[0]!, longitude: v[1]! }),
  validate: validateCoordinate,
  interpolate: coordinate,
  create: (target) => JoltReferenceProperties.mapCoordinate(target as NSObject),
})
export const mapKitCamera = registerNativeProperty<MapKitCamera>({
  name: 'jolt.mapkit/camera',
  units: [
    'latitude degrees',
    'longitude degrees',
    'altitude meters',
    'pitch degrees',
    'heading degrees',
  ],
  platforms: ['ios'],
  spatial: true,
  encode: (v) => [v.latitude, v.longitude, v.altitude, v.pitch, v.heading],
  decode: (v) => ({
    latitude: v[0]!,
    longitude: v[1]!,
    altitude: v[2]!,
    pitch: v[3]!,
    heading: v[4]!,
  }),
  validate(v) {
    validateCoordinate(v)
    if (v.altitude < 1 || v.pitch < 0 || v.pitch > 80)
      throw new RangeError('MapKit camera needs altitude >= 1m and pitch 0..80 degrees.')
  },
  interpolate: (a, b, t) => ({
    ...coordinate(a, b, t),
    altitude: Math.max(1, a.altitude + (b.altitude - a.altitude) * t),
    pitch: Math.max(0, Math.min(80, a.pitch + (b.pitch - a.pitch) * t)),
    heading: shortestAngle(a.heading, b.heading, t),
  }),
  create: (target) => JoltReferenceProperties.mapCamera(target as NSObject),
})
export const mapLibreCoordinate = registerNativeProperty<Coordinate>({
  name: 'jolt.maplibre/coordinate',
  units: ['latitude degrees', 'longitude degrees'],
  platforms: ['android'],
  spatial: true,
  encode: (v) => [v.latitude, v.longitude],
  decode: (v) => ({ latitude: v[0]!, longitude: v[1]! }),
  validate: validateCoordinate,
  interpolate: coordinate,
  create: (target) => new org.rafaelaugusto.jolt.MapLibrePropertySink(target, false),
})
export const mapLibreCamera = registerNativeProperty<MapLibreCamera>({
  name: 'jolt.maplibre/camera',
  units: [
    'latitude degrees',
    'longitude degrees',
    'zoom level',
    'tilt degrees',
    'bearing degrees',
  ],
  platforms: ['android'],
  spatial: true,
  encode: (v) => [v.latitude, v.longitude, v.zoom, v.tilt, v.bearing],
  decode: (v) => ({
    latitude: v[0]!,
    longitude: v[1]!,
    zoom: v[2]!,
    tilt: v[3]!,
    bearing: v[4]!,
  }),
  validate(v) {
    validateCoordinate(v)
    if (v.zoom < 0 || v.zoom > 24 || v.tilt < 0 || v.tilt > 60)
      throw new RangeError('MapLibre camera needs zoom 0..24 and tilt 0..60 degrees.')
  },
  interpolate: (a, b, t) => ({
    ...coordinate(a, b, t),
    zoom: Math.max(0, Math.min(24, a.zoom + (b.zoom - a.zoom) * t)),
    tilt: Math.max(0, Math.min(60, a.tilt + (b.tilt - a.tilt) * t)),
    bearing: shortestAngle(a.bearing, b.bearing, t),
  }),
  create: (target) => new org.rafaelaugusto.jolt.MapLibrePropertySink(target, true),
})

/** Unit quaternion slerp; q and -q describe the same orientation. */
export function interpolatePose(a: ScenePose, b: ScenePose, t: number): ScenePose {
  const normalize = (q: readonly number[]) => {
    const length = Math.hypot(...q)
    if (!Number.isFinite(length) || length < 1e-12)
      throw new RangeError('Orientation must be a nonzero finite quaternion.')
    return q.map((v) => v / length)
  }
  const from = normalize(a.orientation),
    to = normalize(b.orientation)
  let dot = from.reduce((sum, v, i) => sum + v * to[i]!, 0)
  if (dot < 0) {
    dot = -dot
    for (let i = 0; i < 4; i++) to[i] = -to[i]!
  }
  const theta = Math.acos(Math.min(1, dot)),
    sine = Math.sin(theta)
  const x = sine < 1e-6 ? 1 - t : Math.sin((1 - t) * theta) / sine,
    y = sine < 1e-6 ? t : Math.sin(t * theta) / sine
  return {
    position: a.position.map(
      (v, i) => v + (b.position[i]! - v) * t,
    ) as unknown as ScenePose['position'],
    orientation: normalize(
      from.map((v, i) => v * x + to[i]! * y),
    ) as unknown as ScenePose['orientation'],
  }
}
export const sceneKitPose = registerNativeProperty<ScenePose>({
  name: 'jolt.scenekit/pose',
  units: [
    'x scene units',
    'y scene units',
    'z scene units',
    'quaternion x',
    'quaternion y',
    'quaternion z',
    'quaternion w',
  ],
  platforms: ['ios'],
  spatial: true,
  encode: (v) => [...v.position, ...v.orientation],
  decode: (v) => ({
    position: [v[0]!, v[1]!, v[2]!],
    orientation: [v[3]!, v[4]!, v[5]!, v[6]!],
  }),
  validate(v) {
    if (
      v.position.length !== 3 ||
      v.orientation.length !== 4 ||
      Math.hypot(...v.orientation) < 1e-12
    )
      throw new RangeError('Scene pose needs a 3D position and a nonzero quaternion.')
  },
  interpolate: interpolatePose,
  create: (target) => JoltReferenceProperties.scenePose(target as NSObject),
})
