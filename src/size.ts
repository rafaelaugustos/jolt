import { Application } from '@nativescript/core'
import type { View } from '@nativescript/core'
import { toView } from './animate.js'
import { onReducedMotion, reducedMotion } from './config.js'
import { getDriver } from './driver/index.js'
import type { Animation } from './engine.js'
import { createClock, type PlaybackClock } from './playback.js'
import { createTrack, type Track } from './track.js'
import {
  resolveTransition,
  springs,
  type Spring,
  type SpringName,
  type Tween,
} from './transition.js'
import {
  dimension,
  sizeLayout,
  type SizeAxis,
  type SizePixels,
  type SizeValues,
} from './size-layout.js'
import type { Target } from './types.js'

export type SizeDimensions = SizeValues
export type SizeOptions =
  | Omit<Spring, 'repeat' | 'repeatType' | 'repeatDelay'>
  | Omit<Tween, 'repeat' | 'repeatType' | 'repeatDelay' | 'times' | 'easeTrack'>
export interface SizeAnimation extends Animation {
  pause(): void
  play(): void
  readonly paused: boolean
  /** Hold the current size; restore:true releases the temporary size back to the original declaration. */
  stop(options?: { restore?: boolean }): void
}
const owners = new WeakMap<
  View,
  { animation: SizeAnimation; axes: readonly SizeAxis[] }
>()

/** Animate the actual layout box, including intrinsic auto sizes. Layout runs in JS on the UI thread. */
export function animateSize(
  target: Target,
  dimensions: SizeDimensions,
  options?: SizeOptions | SpringName,
): SizeAnimation
export function animateSize(
  target: Target,
  dimensions: SizeDimensions,
  change: () => void,
  options?: SizeOptions | SpringName,
): SizeAnimation
export function animateSize(
  target: Target,
  dimensions: SizeDimensions,
  changeOrOptions?: (() => void) | SizeOptions | SpringName,
  options?: SizeOptions | SpringName,
): SizeAnimation {
  const view = toView(target)
  if (!dimensions || typeof dimensions !== 'object' || Array.isArray(dimensions))
    throw new TypeError('animateSize takes a width/height object.')
  const axes = Object.keys(dimensions) as SizeAxis[]
  if (!axes.length || axes.some((axis) => axis !== 'width' && axis !== 'height'))
    throw new TypeError('animateSize needs width and/or height.')
  for (const axis of axes) dimension(dimensions[axis], axis)
  const destination = { ...dimensions }
  const change = typeof changeOrOptions === 'function' ? changeOrOptions : undefined
  if (change?.constructor.name === 'AsyncFunction')
    throw new TypeError('animateSize changes must be synchronous.')
  const transition = normalize(
    change ? options : (changeOrOptions as SizeOptions | SpringName | undefined),
  )
  // Solve before ownership changes, including custom easing/physical-spring validation.
  const validation = createTrack('x', [0, 100], transition, 0)
  if (!Number.isFinite(validation.end) || !validation.values.every(Number.isFinite))
    throw new RangeError('animateSize needs a finite curve with finite samples.')
  const previous = owners.get(view)
  const driver = getDriver()
  const layout = sizeLayout(view, axes, previous?.axes, () => {
    const frame = driver.layoutFrame?.(view)
    return frame ? { width: frame.width, height: frame.height } : view.getActualSize()
  })
  // Release the previous overlay only after every caller-supplied input was validated.
  const start = layout.read()
  previous?.animation.stop({ restore: true })
  let resolve!: (value: boolean) => void
  let reject!: (error: unknown) => void
  const finished = new Promise<boolean>((done, fail) => {
    resolve = done
    reject = fail
  })
  let settled = false
  let paused = false
  let initialized = false
  let cancelFrame: (() => void) | undefined
  let unwatch: (() => void) | undefined
  let clock: PlaybackClock | undefined
  let tracks = new Map<SizeAxis, Track>()
  let endpoint: SizePixels | undefined
  const cleanup = () => {
    cancelFrame?.()
    cancelFrame = undefined
    clock?.cancel()
    clock = undefined
    unwatch?.()
    layout.dispose()
    view.off('unloaded', unloaded)
    Application.off(Application.suspendEvent, unloaded)
    if (owners.get(view)?.animation === animation) owners.delete(view)
  }
  const finish = (success: boolean, error?: unknown) => {
    if (settled) return
    settled = true
    cleanup()
    if (error !== undefined) reject(error)
    else resolve(success)
  }
  const complete = () => {
    layout.commit(destination)
    layout.layout()
    finish(true)
  }
  const stop = (restore = false) => {
    if (settled) return
    layout.commit(restore ? undefined : layout.read())
    finish(false)
    view.requestLayout()
  }
  function unloaded() {
    stop(true)
  }
  const schedule = () => {
    if (!cancelFrame && !settled && !paused) cancelFrame = driver.frame(tick)
  }
  function tick() {
    cancelFrame = undefined
    if (settled || paused) return
    try {
      if (!view.isLoaded || view.visibility === 'collapse' || !view.nativeViewProtected) {
        stop(true)
        return
      }
      const next = layout.measure(destination)
      if (settled) return
      if (axes.some((axis) => !Number.isFinite(next[axis]) || next[axis] < 0))
        throw new Error('animateSize measured an invalid native size.')
      if (reducedMotion()) {
        complete()
        return
      }
      if (
        !initialized &&
        axes.every((axis) => Math.abs(next[axis] - start[axis]) < 0.5)
      ) {
        complete()
        return
      }
      const elapsed = clock?.time() ?? 0
      if (
        !endpoint ||
        axes.some((axis) => Math.abs(next[axis] - endpoint![axis]) > 0.5)
      ) {
        const from = initialized ? layout.read() : start
        const fresh = new Map<SizeAxis, Track>()
        for (const axis of axes)
          fresh.set(
            axis,
            createTrack(
              'x',
              [from[axis], next[axis]],
              initialized ? { ...transition, delay: 0 } : transition,
              tracks.get(axis)?.velocityAt(elapsed) ?? 0,
            ),
          )
        tracks = fresh
        endpoint = next
        clock?.cancel()
        const end = Math.max(...[...tracks.values()].map((track) => track.end))
        clock = driver.clock?.(end) ?? createClock(() => driver.now())
        initialized = true
      }
      const time = clock!.time()
      if ([...tracks.values()].every((track) => time >= track.end)) {
        complete()
        return
      }
      const values: SizeValues = {}
      for (const [axis, track] of tracks) values[axis] = Math.max(0, track.valueAt(time))
      layout.write(values)
      layout.layout()
      if (settled) return
      schedule()
    } catch (error) {
      layout.commit()
      view.requestLayout()
      finish(false, error)
    }
  }
  const animation: SizeAnimation = {
    finished,
    then: (done, fail) => finished.then(done, fail),
    get paused() {
      return paused
    },
    stop: (options) => stop(options?.restore === true),
    pause() {
      if (settled || paused) return
      paused = true
      clock?.pause()
      cancelFrame?.()
      cancelFrame = undefined
    },
    play() {
      if (settled || !paused) return
      paused = false
      clock?.play()
      schedule()
    },
  }
  owners.set(view, { animation, axes })
  try {
    layout.watch(() => stop(true))
    layout.write(start)
    view.on('unloaded', unloaded)
    Application.on(Application.suspendEvent, unloaded)
    unwatch = onReducedMotion((reduced) => {
      if (reduced && !settled) {
        try {
          complete()
        } catch (error) {
          finish(false, error)
        }
      }
    })
    const result: unknown = change?.()
    if (result && typeof (result as PromiseLike<unknown>).then === 'function')
      throw new TypeError('animateSize changes must be synchronous.')
    if (!view.isLoaded || view.visibility === 'collapse' || !layout.ready()) {
      layout.commit(destination)
      finish(false)
    } else schedule()
  } catch (error) {
    stop(true)
    throw error
  }
  return animation
}

function normalize(input?: SizeOptions | SpringName) {
  if (typeof input === 'string') {
    if (!Object.hasOwn(springs, input))
      throw new TypeError(`Unknown size spring "${input}".`)
    input = springs[input]
  }
  if (
    input !== undefined &&
    (!input || typeof input !== 'object' || Array.isArray(input))
  )
    throw new TypeError('Invalid animateSize options.')
  const allowed = new Set([
    'type',
    'duration',
    'ease',
    'stiffness',
    'damping',
    'mass',
    'bounce',
    'velocity',
    'delay',
  ])
  for (const [key, value] of Object.entries(input ?? {})) {
    if (!allowed.has(key))
      throw new TypeError(
        `Unsupported animateSize option "${key}"; repeat and seek are not supported.`,
      )
    if (value === undefined) continue
    if (
      key !== 'type' &&
      key !== 'ease' &&
      (typeof value !== 'number' || !Number.isFinite(value))
    )
      throw new RangeError(`animateSize ${key} must be finite.`)
    if (key === 'type' && value !== 'spring' && value !== 'tween')
      throw new TypeError('Invalid size transition type.')
    if (typeof value === 'number') {
      if (['duration', 'delay', 'damping'].includes(key) && value < 0)
        throw new RangeError(`${key} must be nonnegative.`)
      if (['mass', 'stiffness'].includes(key) && value <= 0)
        throw new RangeError(`${key} must be positive.`)
      if (key === 'bounce' && (value < -1 || value > 1))
        throw new RangeError('bounce must be between -1 and 1.')
    }
  }
  const resolved = resolveTransition(input ?? {}, 'x', 2)
  if (
    resolved.curve.type === 'spring' &&
    input?.duration === 0 &&
    !('stiffness' in input || 'damping' in input || 'mass' in input)
  )
    throw new RangeError('Use a zero-duration tween for immediate sizing.')
  return resolved
}
