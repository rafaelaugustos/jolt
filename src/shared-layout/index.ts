import { Application, type View } from '@nativescript/core'
import { toView } from '../animate.js'
import { reducedMotion, onReducedMotion } from '../config.js'
import { getDriver } from '../driver/index.js'
import { createTrack } from '../track.js'
import {
  resolveTransition,
  springs,
  type Spring,
  type Tween,
  type SpringName,
} from '../transition.js'
import type { Target } from '../types.js'
import { capture, type Flight } from './native.js'

export type SharedLayoutTransition =
  | Omit<Spring, 'repeat' | 'repeatType' | 'repeatDelay'>
  | Omit<Tween, 'repeat' | 'repeatType' | 'repeatDelay'>
  | SpringName
export interface SharedLayoutOptions {
  transition?: SharedLayoutTransition
  /** Bound the wait for Vue/native layout, in milliseconds. Default: 500. */
  layoutTimeout?: number
  /** Total pixel budget, including temporary reversal captures. Default: 8 million (32 MB RGBA). */
  maxSnapshotPixels?: number
}
export interface SharedLayoutAttachment {
  /** Images scale uniformly to fill the moving clip. Container content crossfades at its original size. */
  content?: 'image' | 'container'
  /** Uniform clipping radius in DIPs; defaults to the view's numeric borderRadius. */
  radius?: number
}
export interface SharedLayoutResult {
  status: 'completed' | 'cancelled' | 'unavailable'
  reason?:
    | 'interrupted'
    | 'cancelled'
    | 'unloaded'
    | 'suspended'
    | 'reduced-motion'
    | 'missing-source'
    | 'missing-target'
    | 'unsupported-target'
    | 'layout-timeout'
    | 'geometry-changed'
}
export interface SharedLayoutAnimation {
  readonly finished: Promise<SharedLayoutResult>
  cancel(): void
  stop(): void
}
export interface SharedLayout {
  /** Register one identity. Replacing it is allowed inside transition(); stale disposers cannot detach its replacement. */
  attach(view: Target, key: string, options?: SharedLayoutAttachment): () => void
  /** Captures before the synchronous mutation, then resolves identities after the next native layout. */
  transition(
    change: () => void,
    transition?: SharedLayoutTransition,
  ): SharedLayoutAnimation
  readonly active: boolean
  readonly paused: boolean
  cancel(): void
  pause(): void
  play(): void
  dispose(): void
}
interface Attachment {
  view: View
  image: boolean
  radius: () => number
  detach(): void
}
interface Operation {
  flights: Map<string, Flight>
  preparing: boolean
  finish(result: SharedLayoutResult, preserve?: boolean): void
}
const scopes = new WeakMap<View, SharedLayout>()
const owners = new WeakMap<View, SharedLayout>()
const inside = (view: View, host: View): boolean => {
  for (
    let current: View | undefined = view;
    current;
    current = current.parent as View | undefined
  )
    if (current === host) return true
  return false
}
function timing(input: SharedLayoutTransition | undefined): Spring | Tween {
  const result = typeof input === 'string' ? springs[input] : (input ?? springs.smooth)
  if (!result || typeof result !== 'object')
    throw new TypeError('Unknown shared layout transition.')
  const allowed = new Set([
    'type',
    'duration',
    'ease',
    'times',
    'easeTrack',
    'stiffness',
    'damping',
    'mass',
    'bounce',
    'velocity',
    'delay',
  ])
  for (const [key, value] of Object.entries(result)) {
    if (!allowed.has(key))
      throw new TypeError(`Unsupported shared layout transition option: ${key}.`)
    if (typeof value === 'number' && !Number.isFinite(value))
      throw new RangeError(`${key} must be finite.`)
  }
  if (result.type !== undefined && result.type !== 'spring' && result.type !== 'tween')
    throw new TypeError('Unknown shared layout transition type.')
  const spring = result as Spring
  for (const key of ['stiffness', 'mass'] as const)
    if (spring[key] !== undefined && spring[key]! <= 0)
      throw new RangeError(`${key} must be positive.`)
  if (spring.damping !== undefined && spring.damping < 0)
    throw new RangeError('damping must be nonnegative.')
  // Validate before touching the visible tree.
  const resolved = resolveTransition(result, 'x', 2)
  if (
    resolved.curve.type === 'spring' &&
    result.duration !== undefined &&
    result.duration <= 0
  )
    throw new RangeError('Spring duration must be positive.')
  if ((result.duration ?? 0) > 30_000 || (result.delay ?? 0) > 30_000)
    throw new RangeError('Shared layout playback must finish within 30 seconds.')
  return { ...result }
}
function tracks(
  flight: Flight,
  destination: number[],
  transition: Spring | Tween,
): string {
  const state = JSON.parse(flight.state()) as { pose: number[]; velocity: number[] }
  const geometry = destination.map((to, index) => {
    const property = index === 4 ? 'borderRadius' : 'x'
    return createTrack(
      property,
      [state.pose[index]!, to],
      resolveTransition(transition, property, 2),
      state.velocity[index] ?? 0,
    )
  })
  const duration = Math.max(...geometry.map((track) => track.end))
  if (!Number.isFinite(duration) || duration > 30_000)
    throw new RangeError('Shared layout playback must finish within 30 seconds.')
  const blend = createTrack(
    'opacity',
    [0, 1],
    resolveTransition({ duration: 180, ease: 'linear' }, 'opacity', 2),
    0,
  )
  return JSON.stringify({
    tracks: [...geometry, blend].map((track) => {
      const times = track.times.map((time) => track.delay + time * track.duration)
      const values = [...track.values]
      if (track.delay > 0) {
        times.unshift(0)
        values.unshift(values[0]!)
      }
      return { times, values }
    }),
  })
}

/** Optional same-page shared identities; all moving snapshots are evaluated by the native runtime. */
export function sharedLayout(
  container: Target,
  options: SharedLayoutOptions = {},
): SharedLayout {
  const host = toView(container)
  if (scopes.has(host))
    throw new Error('This container already has a shared layout owner.')
  const defaultTiming = timing(options.transition)
  const timeout = options.layoutTimeout ?? 500,
    budget = options.maxSnapshotPixels ?? 8_000_000
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 10_000)
    throw new RangeError('layoutTimeout must be between 0 and 10000 ms.')
  if (!Number.isSafeInteger(budget) || budget <= 0 || budget > 32_000_000)
    throw new RangeError('maxSnapshotPixels must be a positive integer at most 32000000.')
  const attached = new Map<string, Attachment>()
  let operation: Operation | undefined,
    disposed = false,
    paused = false,
    suspended = false
  const cancel = (reason: SharedLayoutResult['reason'] = 'cancelled') =>
    operation?.finish({ status: 'cancelled', reason })
  const unload = () => cancel('unloaded')
  const suspend = () => {
    suspended = true
    cancel('suspended')
  }
  const resume = () => {
    suspended = false
  }
  const releaseMotion = onReducedMotion((value) => {
    if (value) cancel('reduced-motion')
  })
  const control: SharedLayout = {
    get active() {
      return !!operation
    },
    get paused() {
      return paused || suspended
    },
    attach(target, key, config = {}) {
      if (disposed) throw new Error('Shared layout is disposed.')
      if (typeof key !== 'string' || !key.trim())
        throw new TypeError('Shared layout needs a nonempty string identity.')
      if (
        config.content !== undefined &&
        config.content !== 'image' &&
        config.content !== 'container'
      )
        throw new TypeError('Unknown shared layout content mode.')
      if (
        config.radius !== undefined &&
        (!Number.isFinite(config.radius) || config.radius < 0)
      )
        throw new RangeError('Shared layout radius must be finite and nonnegative.')
      const view = toView(target)
      if (view === host || !inside(view, host))
        throw new Error('Attach a descendant of the shared layout container.')
      const previous = attached.get(key)
      if (previous?.view === view)
        throw new Error(`Identity "${key}" is already attached.`)
      if (previous && !operation?.preparing)
        throw new Error(`Duplicate shared layout identity "${key}".`)
      if (owners.has(view))
        throw new Error('This view already belongs to a shared layout identity.')
      for (const [id, entry] of attached)
        if (id !== key && (inside(view, entry.view) || inside(entry.view, view)))
          throw new Error('Shared layout identities cannot overlap.')
      if (!previous && attached.size >= 8)
        throw new RangeError(
          'A shared layout supports at most eight simultaneous identities.',
        )
      previous?.detach()
      const entry: Attachment = {
        view,
        image: config.content === 'image',
        radius: () =>
          config.radius ??
          (typeof view.borderRadius === 'number' ? view.borderRadius : 0),
        detach() {
          view.off('unloaded', entry.detach)
          if (attached.get(key) === entry) attached.delete(key)
          if (owners.get(view) === control) owners.delete(view)
        },
      }
      attached.set(key, entry)
      owners.set(view, control)
      view.on('unloaded', entry.detach)
      return entry.detach
    },
    transition(change, input) {
      if (disposed) throw new Error('Shared layout is disposed.')
      if (paused || suspended) throw new Error('Shared layout is paused.')
      if (typeof change !== 'function')
        throw new TypeError('Shared layout needs a synchronous mutation.')
      const transition = timing(input ?? defaultTiming)
      let settle!: (value: SharedLayoutResult) => void,
        ended = false,
        timer: ReturnType<typeof setTimeout> | undefined,
        detach: (() => void) | undefined
      const finished = new Promise<SharedLayoutResult>((resolve) => {
        settle = resolve
      })
      const previous = operation
      const flights = previous?.flights ?? new Map<string, Flight>()
      previous?.finish({ status: 'cancelled', reason: 'interrupted' }, true)
      const current: Operation = {
        flights,
        preparing: true,
        finish(result, preserve = false) {
          if (ended) return
          ended = true
          if (timer !== undefined) clearTimeout(timer)
          detach?.()
          if (!preserve) {
            for (const flight of flights.values()) flight.dispose()
            flights.clear()
          }
          if (operation === current) operation = undefined
          settle(result)
        },
      }
      operation = current
      const handle: SharedLayoutAnimation = {
        finished,
        cancel: () => current.finish({ status: 'cancelled', reason: 'cancelled' }),
        stop: () => handle.cancel(),
      }
      const used = () =>
        [...flights.values()].reduce((sum, flight) => sum + flight.pixels(), 0)
      try {
        let unavailable: SharedLayoutResult['reason']
        if (reducedMotion()) unavailable = 'reduced-motion'
        else if (!host.isLoaded || !host.nativeViewProtected) unavailable = 'unloaded'
        else {
          for (const [key, flight] of flights)
            if (!flight.freeze(budget - used() + flight.pixels())) {
              unavailable = 'unsupported-target'
              break
            }
          if (!unavailable)
            for (const [key, entry] of attached) {
              if (flights.has(key)) continue
              const flight = capture(
                entry.view,
                entry.image,
                entry.radius(),
                budget - used(),
              )
              if (!flight) {
                unavailable = 'unsupported-target'
                break
              }
              flights.set(key, flight)
            }
          if (!flights.size) unavailable ??= 'missing-source'
        }
        const result = change() as unknown
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          void Promise.resolve(result).catch(() => {})
          throw new TypeError(
            'Shared layout mutations must be synchronous; await data before transition().',
          )
        }
        if (unavailable) current.finish({ status: 'unavailable', reason: unavailable })
        if (!ended) {
          timer = setTimeout(
            () => current.finish({ status: 'unavailable', reason: 'layout-timeout' }),
            timeout,
          )
          void Promise.resolve().then(() => {
            if (ended) return
            try {
              if (!getDriver().afterLayout) {
                current.finish({ status: 'unavailable', reason: 'unsupported-target' })
                return
              }
              detach = getDriver().afterLayout!(host, () => {
                if (ended) return
                current.preparing = false
                if (timer !== undefined) clearTimeout(timer)
                try {
                  const prepared: { flight: Flight; json: string }[] = []
                  for (const [key, flight] of flights) {
                    const entry = attached.get(key)
                    if (!entry || !entry.view.isLoaded || !inside(entry.view, host)) {
                      current.finish({ status: 'unavailable', reason: 'missing-target' })
                      return
                    }
                    const target = flight.prepare(
                      entry.view,
                      entry.image,
                      entry.radius(),
                      budget - used() + flight.pixels(),
                    )
                    if (!target) {
                      current.finish({
                        status: 'unavailable',
                        reason: 'unsupported-target',
                      })
                      return
                    }
                    prepared.push({
                      flight,
                      json: tracks(flight, JSON.parse(target) as number[], transition),
                    })
                  }
                  let remaining = prepared.length
                  for (const { flight, json } of prepared)
                    flight.play(json, (completed) => {
                      if (ended) return
                      if (!completed)
                        current.finish({
                          status: 'cancelled',
                          reason: 'geometry-changed',
                        })
                      else if (--remaining === 0) current.finish({ status: 'completed' })
                    })
                } catch {
                  current.finish({ status: 'unavailable', reason: 'unsupported-target' })
                }
              })
              host.requestLayout()
            } catch {
              current.finish({ status: 'unavailable', reason: 'unsupported-target' })
            }
          })
        }
      } catch (error) {
        handle.cancel()
        throw error
      }
      return handle
    },
    cancel: () => cancel(),
    pause() {
      paused = true
      cancel()
    },
    play() {
      paused = false
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancel()
      for (const entry of [...attached.values()]) entry.detach()
      releaseMotion()
      host.off('unloaded', unload)
      Application.off(Application.suspendEvent, suspend)
      Application.off(Application.resumeEvent, resume)
      scopes.delete(host)
    },
  }
  scopes.set(host, control)
  host.on('unloaded', unload)
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  return control
}
