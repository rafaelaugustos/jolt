import {
  sensorKinds,
  sensorUnits,
  type SensorKind,
  type VectorSensorKind,
  type SensorUnit,
} from '../core/sensor-kinds.js'
import { effectOptions, type Realm } from './effect.js'
import type { PlatformHost } from './platform-host.js'
import { NumericValue, type WebReadableValue } from './value.js'
import type { WebInteraction } from './interaction.js'
import { registerSensorReplay, type SensorReplaySession } from './sensor-replay-bridge.js'

export type WebSensorKind = SensorKind
export type WebSensorStatus =
  | 'idle'
  | 'permission-required'
  | 'starting'
  | 'active'
  | 'paused'
  | 'unavailable'
  | 'denied'
  | 'disposed'
export interface WebSensorOptions {
  interval?: number | 'auto'
  coordinates?: 'device' | 'interface'
  reducedMotion?: 'pause' | 'continue'
  onStatus?: (status: WebSensorStatus) => void
}
export interface WebSensor extends WebInteraction {
  readonly kind: WebSensorKind
  readonly unit: SensorUnit
  readonly status: WebSensorStatus
  /** True only after a valid reading, never inferred from the presence of an API. */
  readonly available: boolean
  readonly x: WebReadableValue
  readonly y: WebReadableValue
  readonly z: WebReadableValue
  /** Call directly from a user gesture. Never prompts during construction/resume. */
  requestPermission(): Promise<'granted' | 'denied' | 'unavailable'>
  snapshot(): {
    unit: SensorUnit
    status: WebSensorStatus
    available: boolean
    timestamp: number | null
    samples: number
    values: number[]
    reason?: string
    backend: 'device-orientation' | 'device-motion' | 'replay' | 'none'
    /** Describes the retained values, including after a replay has finished. */
    sampleSource: 'device-event' | 'replay' | 'none'
  }
}
export interface WebRotationSensor extends WebSensor {
  readonly kind: 'rotation'
  /** Relative XYZ radians and normalized Hamilton quaternion xyzw. */
  readonly quaternion: Readonly<{
    x: WebReadableValue
    y: WebReadableValue
    z: WebReadableValue
    w: WebReadableValue
  }>
  recenter(): void
}
export interface WebVectorSensor<
  K extends VectorSensorKind = VectorSensorKind,
> extends WebSensor {
  readonly kind: K
}
export interface WebGravitySensor extends WebVectorSensor<'gravity'> {}
export class SensorValueNode extends NumericValue {
  demand?: (active: boolean) => void
  protected override demandChanged() {
    this.demand?.(this.demanded)
  }
  override dispose() {
    if (this.disposed) return
    super.dispose()
    this.demand?.(false)
  }
}
type Q = [number, number, number, number]
const identity = (): Q => [0, 0, 0, 1]
export const multiply = (a: Q, b: Q): Q => [
  a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
  a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
  a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
]
const inverse = (q: Q): Q => [-q[0], -q[1], -q[2], q[3]]
export function orientationQuaternion(alpha: number, beta: number, gamma: number): Q {
  const a = (alpha * Math.PI) / 360,
    b = (beta * Math.PI) / 360,
    c = (gamma * Math.PI) / 360
  // DeviceOrientation is intrinsic Z-X'-Y'', in degrees; Jolt uses Hamilton xyzw.
  return multiply(
    multiply([0, 0, Math.sin(a), Math.cos(a)], [Math.sin(b), 0, 0, Math.cos(b)]),
    [0, Math.sin(c), 0, Math.cos(c)],
  )
}
export function interfaceVector(v: readonly number[], degrees: number) {
  const a = (degrees * Math.PI) / 180,
    c = Math.cos(a),
    s = Math.sin(a)
  return [c * v[0]! + s * v[1]!, -s * v[0]! + c * v[1]!, v[2]!]
}
export function rotationValues(q: Q, degrees: number, previous: readonly number[]) {
  let [x, y, z] = interfaceVector(q, degrees) as [number, number, number],
    w = q[3]
  if (x * previous[0]! + y * previous[1]! + z * previous[2]! + w * previous[3]! < 0) {
    x = -x
    y = -y
    z = -z
    w = -w
  }
  return [
    Math.atan2(2 * (w * x + y * z), 1 - 2 * (x * x + y * y)),
    Math.asin(Math.max(-1, Math.min(1, 2 * (w * y - z * x)))),
    Math.atan2(2 * (w * z + x * y), 1 - 2 * (y * y + z * z)),
    x,
    y,
    z,
    w,
  ]
}
interface Sample {
  values: number[]
  timestamp: number
}
/** DeviceMotion vectors follow the native contract: m/s², downward gravity, radians/s. */
export function motionVector(
  kind: Exclude<WebSensorKind, 'rotation'>,
  event: DeviceMotionEvent,
): number[] | undefined {
  const xyz = (value: DeviceMotionEventAcceleration | null) =>
    value && [value.x, value.y, value.z]
  let values: (number | null)[] | null | undefined
  if (kind === 'acceleration') values = xyz(event.accelerationIncludingGravity)
  else if (kind === 'linearAcceleration') values = xyz(event.acceleration)
  else if (kind === 'gyroscope') {
    const rate = event.rotationRate
    // DeviceMotion alpha/beta/gamma are rates about Z/X/Y, in degrees/s.
    values = rate && [rate.beta, rate.gamma, rate.alpha]
  } else if (kind === 'gravity') {
    const linear = xyz(event.acceleration),
      total = xyz(event.accelerationIncludingGravity)
    if (linear?.every(finite) && total?.every(finite))
      values = linear.map((v, i) => v! - total[i]!)
  }
  if (!values?.every(finite)) return
  return (values as number[]).map((v) => (kind === 'gyroscope' ? (v * Math.PI) / 180 : v))
}
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
// One DOM listener per actual hardware event per document, even across kinds/runtimes.
type HardwareEvent = 'deviceorientation' | 'devicemotion'
const hubs = new WeakMap<
  Document,
  Map<HardwareEvent, { listeners: Set<(event: Event) => void>; stop(): void }>
>()
function subscribe(
  document: Document,
  kind: WebSensorKind,
  listener: (s: Sample) => void,
) {
  const name: HardwareEvent = kind === 'rotation' ? 'deviceorientation' : 'devicemotion'
  let map = hubs.get(document)
  if (!map) hubs.set(document, (map = new Map()))
  let hub = map.get(name)
  if (!hub) {
    const view = document.defaultView!,
      listeners = new Set<(event: Event) => void>()
    const read = (event: Event) => {
      for (const fn of [...listeners]) fn(event)
    }
    view.addEventListener(name, read)
    hub = { listeners, stop: () => view.removeEventListener(name, read) }
    map.set(name, hub)
  }
  const read = (event: Event) => {
    if (!finite(event.timeStamp)) return
    let values: number[] | undefined
    if (kind === 'rotation') {
      const e = event as DeviceOrientationEvent
      if ([e.alpha, e.beta, e.gamma].every(finite))
        values = orientationQuaternion(e.alpha!, e.beta!, e.gamma!)
    } else values = motionVector(kind, event as DeviceMotionEvent)
    if (values) listener({ values, timestamp: event.timeStamp })
  }
  hub.listeners.add(read)
  const source = hub
  return () => {
    source.listeners.delete(read)
    if (!source.listeners.size) {
      source.stop()
      map!.delete(name)
    }
  }
}

export function createSensor(
  kind: WebSensorKind,
  options: WebSensorOptions,
  host: PlatformHost,
  makeValue: (initial: number) => { node: SensorValueNode; value: WebReadableValue },
): WebRotationSensor | WebVectorSensor {
  effectOptions(options, ['interval', 'coordinates', 'reducedMotion', 'onStatus'])
  if (!sensorKinds.includes(kind)) throw new TypeError(`Unknown sensor kind: ${kind}`)
  const interval =
    options.interval === 'auto' || options.interval === undefined ? 0 : options.interval
  if (
    typeof interval !== 'number' ||
    !Number.isFinite(interval) ||
    (options.interval !== undefined &&
      options.interval !== 'auto' &&
      (interval < 5 || interval > 1000))
  )
    throw new RangeError('Sensor interval must be auto or 5–1000 ms.')
  if (
    !['device', 'interface'].includes(options.coordinates ?? 'interface') ||
    !['pause', 'continue'].includes(options.reducedMotion ?? 'pause')
  )
    throw new TypeError('Invalid sensor policy.')
  if (options.onStatus !== undefined && typeof options.onStatus !== 'function')
    throw new TypeError('onStatus must be a function.')
  const view = host.document.defaultView as Realm
  const constructor = (
    kind === 'rotation' ? view.DeviceOrientationEvent : view.DeviceMotionEvent
  ) as (Function & { requestPermission?: () => Promise<string> }) | undefined
  // DeviceMotion exposes no magnetic vector. Do not synthesize one from orientation.
  const supported =
    kind !== 'magneticField' && view.isSecureContext && typeof constructor === 'function'
  let permission: 'granted' | 'denied' | 'required' = constructor?.requestPermission
    ? 'required'
    : 'granted'
  let state: WebSensorStatus = 'idle',
    ended = false,
    held = false,
    available = false,
    reason: string | undefined
  let replay: { session: SensorReplaySession; orientation: number } | undefined
  let sampleSource: 'device-event' | 'replay' | 'none' = 'none'
  let timestamp: number | null = null,
    samples = 0,
    reference = identity(),
    relative = identity(),
    rebase = true,
    reset = true
  let values = kind === 'rotation' ? [0, 0, 0, 0, 0, 0, 1] : [0, 0, 0]
  const nodes = values.map(makeValue),
    demand = new Set<number>(),
    off: (() => void)[] = []
  let detach: (() => void) | undefined,
    timeout: (() => void) | undefined,
    pending: Promise<'granted' | 'denied' | 'unavailable'> | undefined
  const status = (next: WebSensorStatus) => {
    if (state === next) return
    state = next
    try {
      options.onStatus?.(next)
    } catch (e) {
      host.error(e)
    }
  }
  const stop = () => {
    detach?.()
    detach = undefined
    timeout?.()
    timeout = undefined
    rebase = true
    timestamp = null
  }
  let rawVector = [0, 0, 0]
  const paint = () => {
    const angle =
      options.coordinates === 'device'
        ? 0
        : replay
          ? replay.orientation
          : (view.screen.orientation?.angle ??
            (view as unknown as { orientation?: number }).orientation ??
            0)
    values =
      kind === 'rotation'
        ? rotationValues(relative, angle, values.slice(3))
        : interfaceVector(rawVector, angle)
    values.forEach((value, index) => {
      if (!nodes[index]!.node.disposed) nodes[index]!.node.set(value)
    })
  }
  const orientationChanged = () => {
    // Screen orientation can change without another hardware reading. Remap the
    // retained canonical sample without incrementing its count or timestamp.
    if (state === 'active' && !ended && !held && !host.document.hidden) paint()
  }
  const update = () => {
    if (ended) return
    if (replay) {
      const current = replay
      detach?.()
      detach = undefined
      timeout?.()
      timeout = undefined
      available = false
      reason = 'synthetic-replay'
      const paused =
        held ||
        host.document.hidden ||
        (options.reducedMotion !== 'continue' && host.reduced())
      const active = !paused && demand.size > 0
      status(
        paused
          ? 'paused'
          : !demand.size
            ? 'idle'
            : sampleSource === 'replay'
              ? 'active'
              : 'starting',
      )
      if (!ended && replay === current) current.session.allowed(active)
      return
    }
    if (!supported) {
      reason = !view.isSecureContext
        ? 'insecure-context'
        : kind === 'magneticField'
          ? 'unsupported-kind'
          : 'missing-api'
      stop()
      status('unavailable')
      return
    }
    if (
      held ||
      host.document.hidden ||
      (options.reducedMotion !== 'continue' && host.reduced())
    ) {
      stop()
      status('paused')
      return
    }
    if (permission !== 'granted') {
      stop()
      status(permission === 'denied' ? 'denied' : 'permission-required')
      return
    }
    if (!demand.size) {
      stop()
      status('idle')
      return
    }
    if (detach) return
    reason = undefined
    status('starting')
    if (
      ended ||
      detach ||
      held ||
      host.document.hidden ||
      !demand.size ||
      permission !== 'granted' ||
      (options.reducedMotion !== 'continue' && host.reduced())
    )
      return
    detach = subscribe(host.document, kind, (sample) => {
      if (
        ended ||
        held ||
        !demand.size ||
        host.document.hidden ||
        (options.reducedMotion !== 'continue' && host.reduced())
      )
        return
      if (timestamp !== null && sample.timestamp - timestamp < interval) return
      if (kind === 'rotation') {
        const q = sample.values as Q
        if (rebase) {
          if (reset) relative = identity()
          reference = multiply(q, inverse(relative))
          rebase = false
          reset = false
        }
        relative = multiply(inverse(reference), q)
      } else rawVector = sample.values
      timestamp = sample.timestamp
      samples++
      available = true
      sampleSource = 'device-event'
      reason = undefined
      timeout?.()
      timeout = undefined
      paint()
      status('active')
    })
    timeout = host.after(2000, () => {
      reason = 'no-data'
      status('unavailable')
    })
  }
  const handle = {
    kind,
    unit: sensorUnits[kind],
    x: nodes[0]!.value,
    y: nodes[1]!.value,
    z: nodes[2]!.value,
    ...(kind === 'rotation'
      ? {
          quaternion: Object.freeze({
            x: nodes[3]!.value,
            y: nodes[4]!.value,
            z: nodes[5]!.value,
            w: nodes[6]!.value,
          }),
          recenter: () => {
            rebase = true
            reset = true
          },
        }
      : {}),
    get status() {
      return state
    },
    get available() {
      return available && !ended
    },
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    requestPermission() {
      if (ended || !supported) return Promise.resolve('unavailable' as const)
      if (pending) return pending
      if (!constructor?.requestPermission) {
        permission = 'granted'
        update()
        return Promise.resolve('granted' as const)
      }
      let request: Promise<string>
      try {
        request = constructor.requestPermission()
      } catch {
        request = Promise.resolve('denied')
      }
      pending = Promise.resolve(request)
        .then(
          (result) => {
            permission = result === 'granted' ? 'granted' : 'denied'
            update()
            return ended ? 'unavailable' : permission
          },
          () => {
            permission = 'denied'
            update()
            return ended ? 'unavailable' : 'denied'
          },
        )
        .finally(() => {
          pending = undefined
        }) as Promise<'granted' | 'denied' | 'unavailable'>
      return pending!
    },
    snapshot: () => ({
      unit: sensorUnits[kind],
      status: state,
      available: available && !ended,
      timestamp,
      samples,
      values: [...values],
      reason,
      sampleSource,
      backend: replay
        ? ('replay' as const)
        : !supported
          ? ('none' as const)
          : kind === 'rotation'
            ? ('device-orientation' as const)
            : ('device-motion' as const),
    }),
    pause() {
      if (!ended) {
        held = true
        update()
      }
    },
    play() {
      if (!ended) {
        held = false
        update()
      }
    },
    cancel() {
      handle.pause()
    },
    dispose() {
      if (ended) return
      ended = true
      replay?.session.dispose()
      replay = undefined
      stop()
      nodes.forEach((n) => n.node.dispose())
      off
        .splice(0)
        .reverse()
        .forEach((fn) => fn())
      status('disposed')
    },
  } as WebRotationSensor | WebVectorSensor
  try {
    off.push(
      registerSensorReplay(handle, (session) => {
        if (ended) throw new Error('Sensor is disposed.')
        replay?.session.dispose()
        if (ended) throw new Error('Sensor was disposed during replay replacement.')
        stop()
        const current = { session, orientation: 0 }
        replay = current
        available = false
        sampleSource = 'none'
        rebase = true
        reset = true
        update()
        return {
          now: () => host.scheduler.now(),
          after: (ms, action) => host.after(ms, action),
          inject(sample) {
            if (
              ended ||
              replay !== current ||
              held ||
              !demand.size ||
              host.document.hidden ||
              (options.reducedMotion !== 'continue' && host.reduced())
            )
              return
            current.orientation = sample.orientation ?? 0
            if (kind === 'rotation') {
              const length = Math.hypot(...sample.values)
              const q = sample.values.map((v) => v / length) as Q
              if (rebase) {
                if (reset) relative = identity()
                reference = multiply(q, inverse(relative))
                rebase = false
                reset = false
              }
              relative = multiply(inverse(reference), q)
            } else rawVector = [...sample.values]
            timestamp = sample.time
            samples++
            sampleSource = 'replay'
            available = false
            reason = 'synthetic-replay'
            paint()
            status('active')
          },
          end() {
            if (replay !== current) return
            replay = undefined
            available = false
            stop()
            update()
          },
        }
      }),
    )
    view.screen.orientation?.addEventListener('change', orientationChanged)
    view.addEventListener('orientationchange', orientationChanged)
    off.push(
      () => view.screen.orientation?.removeEventListener('change', orientationChanged),
      () => view.removeEventListener('orientationchange', orientationChanged),
    )
    nodes.forEach(({ node }, i) => {
      node.demand = (active) => {
        if (active) demand.add(i)
        else demand.delete(i)
        update()
      }
    })
    off.push(
      host.onReduced(update),
      host.visibility(update),
      host.register(host.document.documentElement, handle, update),
    )
    update()
    return handle
  } catch (e) {
    handle.dispose()
    throw e
  }
}
