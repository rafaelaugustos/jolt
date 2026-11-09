import { validateSensorSamples, type SensorSample } from '../core/sensor-replay.js'
import { sensorReplayDriver, type SensorReplayControl } from './sensor-replay-bridge.js'
import type { WebSensor } from './sensors.js'
export type { SensorSample } from '../core/sensor-replay.js'
export interface SensorReplayOptions {
  manual?: boolean
}
export interface SensorReplay {
  readonly finished: Promise<boolean>
  readonly paused: boolean
  readonly disposed: boolean
  readonly time: number
  readonly duration: number
  /** Manual mode only; monotonic relative time. No simulated intermediate hardware readings. */
  advanceTo(milliseconds: number): void
  pause(): void
  play(): void
  stop(): void
  dispose(): void
}

/** Explicit synthetic input. It never grants permission or proves hardware availability. */
export function replaySensor(
  source: WebSensor,
  input: readonly SensorSample[],
  options: SensorReplayOptions = {},
): SensorReplay {
  const samples = validateSensorSamples(source.kind, input)
  if (options.manual !== undefined && typeof options.manual !== 'boolean')
    throw new TypeError('manual must be boolean.')
  const begin = sensorReplayDriver(source)
  let driver: SensorReplayControl | undefined, timer: (() => void) | undefined
  let elapsed = 0,
    started = 0,
    index = 0,
    allowed = false,
    held = false,
    running = false,
    ended = false
  const duration = samples.at(-1)!.time
  let resolve!: (completed: boolean) => void
  const finished = new Promise<boolean>((done) => {
    resolve = done
  })
  const time = () => Math.min(duration, elapsed + (running ? driver!.now() - started : 0))
  const freeze = () => {
    if (running) elapsed = time()
    running = false
    timer?.()
    timer = undefined
  }
  const finish = (completed: boolean) => {
    if (ended) return
    freeze()
    ended = true
    const current = driver
    driver = undefined
    samples.length = 0
    try {
      current?.end()
    } finally {
      resolve(completed)
    }
  }
  const apply = (at: number) => {
    elapsed = at
    while (
      !ended &&
      allowed &&
      !held &&
      index < samples.length &&
      samples[index]!.time <= at
    )
      driver!.inject(samples[index++]!)
    if (!ended && index === samples.length) finish(true)
  }
  const schedule = () => {
    if (!driver || ended) return
    freeze()
    if (!allowed || held || options.manual) return
    started = driver.now()
    running = true
    timer = driver.after(Math.max(0, samples[index]!.time - elapsed), () => {
      const at = time()
      freeze()
      apply(at)
      if (!ended) schedule()
    })
  }
  driver = begin({
    allowed(active) {
      if (allowed === active) return
      // Capture the old running clock before changing permission/demand state.
      if (driver) freeze()
      allowed = active
      if (driver) schedule()
    },
    dispose: () => finish(false),
  })
  if (ended) {
    driver.end()
    driver = undefined
  } else schedule()
  return {
    finished,
    get paused() {
      return held || !allowed
    },
    get disposed() {
      return ended
    },
    get time() {
      return time()
    },
    duration,
    advanceTo(at) {
      if (!options.manual) throw new Error('advanceTo requires manual replay.')
      if (ended) throw new Error('Replay has finished.')
      if (!Number.isFinite(at) || at < elapsed || at > duration)
        throw new RangeError('Replay time must increase within its duration.')
      if (held || !allowed)
        throw new Error('Replay is paused or has no active sensor consumers.')
      apply(at)
    },
    pause() {
      if (!ended) {
        freeze()
        held = true
      }
    },
    play() {
      if (!ended) {
        held = false
        schedule()
      }
    },
    stop: () => finish(false),
    dispose: () => finish(false),
  }
}
