import { Application, Trace } from '@nativescript/core'
import { onReducedMotion, reducedMotion } from '../config.js'
import {
  motionValue,
  springValue,
  liveValueInput,
  type DerivedValue,
  type SpringValue,
} from '../motion-value.js'
import type { MotionScope } from '../motion-scope.js'
import { createSensorDriver, rememberSensorDriver, type SensorDriver } from './native.js'

export type SensorKind = 'rotation' | 'gravity'
export type SensorStatus =
  | 'idle'
  | 'starting'
  | 'active'
  | 'paused'
  | 'unavailable'
  | 'error'
  | 'replaying'
  | 'disposed'
export interface SensorOptions {
  /** Milliseconds; 'auto' requests the display interval. Hardware may deliver less often. Minimum 5 ms. */
  interval?: number | 'auto'
  /** Right-handed x right, y up, z out of the screen. Defaults to interface coordinates. */
  coordinates?: 'device' | 'interface'
  /** Decorative motion stops sampling under Reduce Motion by default. */
  reducedMotion?: 'pause' | 'continue'
  scope?: MotionScope
  /** Availability/lifecycle boundaries only. Never a callback for every reading. */
  onStatus?: (status: SensorStatus) => void
}
export interface SensorSnapshot {
  status: SensorStatus
  available: boolean
  error: string | null
  /** Monotonic hardware timestamp, milliseconds since boot; not a wall-clock date. */
  timestamp: number | null
  samples: number
  frames: number
  callbacks: number
  processingMs: number
  interval: number
  values: number[]
}
interface SensorBase {
  readonly kind: SensorKind
  readonly status: SensorStatus
  readonly available: boolean
  readonly paused: boolean
  readonly disposed: boolean
  /** Read on demand; installs no JS polling. Rotation values are radians, then quaternion xyzw. */
  snapshot(): SensorSnapshot
  pause(): void
  play(): void
  dispose(): void
}
export interface RotationSensor extends SensorBase {
  readonly kind: 'rotation'
  /** Relative extrinsic XYZ angles (equivalently intrinsic ZYX), radians. Map to degrees for Jolt rotation. */
  readonly x: DerivedValue
  readonly y: DerivedValue
  readonly z: DerivedValue
  /** Unit quaternion xyzw; prefer quaternion interpolation for full rotations. */
  readonly quaternion: Readonly<{
    x: DerivedValue
    y: DerivedValue
    z: DerivedValue
    w: DerivedValue
  }>
  /** Set the current device pose as the identity rotation at the next reading. */
  recenter(): void
}
export interface GravitySensor extends SensorBase {
  readonly kind: 'gravity'
  /** Downward gravitational acceleration in m/s²; a flat, face-up phone reports z ≈ -9.80665. */
  readonly x: DerivedValue
  readonly y: DerivedValue
  readonly z: DerivedValue
}
export type Sensor = RotationSensor | GravitySensor
export function sensor(kind: 'rotation', options?: SensorOptions): RotationSensor
export function sensor(kind: 'gravity', options?: SensorOptions): GravitySensor
export function sensor(kind: SensorKind, options?: SensorOptions): Sensor
export function sensor(kind: SensorKind, options: SensorOptions = {}): Sensor {
  if (kind !== 'rotation' && kind !== 'gravity')
    throw new TypeError('sensor() supports rotation and gravity.')
  if (!options || typeof options !== 'object')
    throw new TypeError('Expected sensor options.')
  const interval = options.interval ?? 'auto'
  if (
    interval !== 'auto' &&
    (!Number.isFinite(interval) || interval < 5 || interval > 1000)
  )
    throw new RangeError('Sensor interval must be auto or 5–1000 milliseconds.')
  const coordinates = options.coordinates ?? 'interface'
  if (!['device', 'interface'].includes(coordinates))
    throw new TypeError('Invalid sensor coordinates.')
  if (
    options.reducedMotion !== undefined &&
    !['pause', 'continue'].includes(options.reducedMotion)
  )
    throw new TypeError('Invalid reduced-motion sensor policy.')
  if (options.onStatus !== undefined && typeof options.onStatus !== 'function')
    throw new TypeError('onStatus must be a function.')
  if (options.scope?.disposed || options.scope?.suspended)
    throw new Error('Sensor scope must be active.')
  const nodes: SpringValue[] = []
  const releases: (() => void)[] = []
  let native: SensorDriver | undefined,
    ended = false,
    held = false,
    background = false
  let lastStatus: SensorStatus | undefined
  const demand = new Set<number>()
  const blocked = () =>
    held || background || (options.reducedMotion !== 'continue' && reducedMotion())
  const changed = () => {
    if (!native || ended) return
    const status = native.snapshot().status
    for (const value of nodes)
      liveValueInput(value).active(
        status === 'active' || status === 'replaying' || status === 'starting',
      )
    if (status !== lastStatus) {
      lastStatus = status
      try {
        options.onStatus?.(status)
      } catch (error) {
        Trace.write(
          `Jolt sensor status listener failed: ${String(error)}`,
          Trace.categories.Error,
          Trace.messageType.error,
        )
      }
    }
  }
  const update = () => {
    native?.enabled(demand.size > 0 && !blocked(), blocked())
    changed()
  }
  const suspend = () => {
    background = true
    update()
  }
  const resume = () => {
    background = false
    update()
  }
  try {
    for (let i = 0; i < (kind === 'rotation' ? 7 : 3); i++)
      nodes.push(
        springValue(motionValue(kind === 'rotation' && i === 6 ? 1 : 0), { duration: 0 }),
      )
    native = createSensorDriver(
      kind,
      { interval: interval === 'auto' ? 0 : interval, coordinates },
      nodes,
      changed,
    )
    nodes.forEach((value, i) =>
      releases.push(
        liveValueInput(value).demand((active) => {
          if (active) demand.add(i)
          else demand.delete(i)
          update()
        }),
      ),
    )
    releases.push(onReducedMotion(update))
    Application.on(Application.suspendEvent, suspend)
    Application.on(Application.resumeEvent, resume)
    releases.push(() => {
      Application.off(Application.suspendEvent, suspend)
      Application.off(Application.resumeEvent, resume)
    })
    const source = {
      kind,
      x: nodes[0]!,
      y: nodes[1]!,
      z: nodes[2]!,
      ...(kind === 'rotation'
        ? {
            quaternion: Object.freeze({
              x: nodes[3]!,
              y: nodes[4]!,
              z: nodes[5]!,
              w: nodes[6]!,
            }),
            recenter: () => {
              if (!ended) native!.recenter()
            },
          }
        : {}),
      get status() {
        return ended ? ('disposed' as const) : native!.snapshot().status
      },
      get available() {
        return native!.snapshot().available
      },
      get paused() {
        return held
      },
      get disposed() {
        return ended
      },
      snapshot() {
        return {
          ...native!.snapshot(),
          ...(ended ? { status: 'disposed' as const } : {}),
        }
      },
      pause() {
        if (!ended) {
          held = true
          update()
        }
      },
      play() {
        if (!ended) {
          if (native!.snapshot().status === 'error') native!.enabled(false, true)
          held = false
          update()
        }
      },
      dispose() {
        if (ended) return
        ended = true
        native!.dispose()
        releases.splice(0).forEach((release) => release())
        nodes.forEach((value) => value.dispose())
      },
    } as Sensor
    rememberSensorDriver(source, native)
    options.scope?.add(source)
    changed()
    return source
  } catch (error) {
    ended = true
    native?.dispose()
    releases.forEach((release) => release())
    nodes.forEach((value) => value.dispose())
    throw error
  }
}
