import { Application, Image, type Frame, type Page } from '@nativescript/core'
import { find, radius, supportedImage } from './targets.js'
import { reducedMotion, onReducedMotion } from '../config.js'
import { getDriver } from '../driver/index.js'
import { capture, captureNavigationImage, type Flight } from '../shared-layout/native.js'
import { timing, tracks } from '../shared-layout/timing.js'
import type {
  SharedLayoutOptions,
  SharedLayoutTransition,
} from '../shared-layout/index.js'

export type SharedNavigationStatus = 'completed' | 'cancelled' | 'unavailable' | 'failed'
export interface SharedNavigationResult {
  status: SharedNavigationStatus
  reason?: string
  /** The Frame committed a different page. Cancelling motion never rolls a route back. */
  navigated: boolean
  error?: unknown
}
export interface SharedNavigationOptions extends SharedLayoutOptions {
  /** Bound route guards/page creation. Default 3000 ms; maximum 10000 ms. */
  navigationTimeout?: number
}
export interface SharedNavigationRequest {
  /** Optional lower per-flight budget when another native presentation retains pixels. */
  maxSnapshotPixels?: number
  /** Match exactly one sharedTransitionTag on each page in this Frame. */
  tag: string
  /** Called once, after capture. Pass these options to Frame.navigate/router.push/back. */
  navigate(options: Readonly<{ animated: false }>): unknown
  transition?: SharedLayoutTransition
}
export interface SharedNavigationAnimation {
  finished: Promise<SharedNavigationResult>
  /** Ends only the visual overlay. The route belongs to the Frame/router. */
  cancel(): void
}
export interface SharedNavigation {
  readonly state: 'idle' | 'preparing' | 'running' | 'disposed'
  /** Single flight: a concurrent request returns unavailable/busy without invoking its route. */
  navigate(request: SharedNavigationRequest): SharedNavigationAnimation
  dispose(): void
}
import { navigationScopes as scopes } from './scope.js'
export { sharedNavigationEntry } from './entry.js'
export type {
  SharedNavigationEntry,
  SharedNavigationEntryOptions,
  SharedNavigationEntryEvent,
  SharedNavigationRouteOptions,
} from './entry.js'
const routeOptions = Object.freeze({ animated: false as const })

/** Programmatic, same-Frame navigation. Core owns routes; Jolt owns a bounded native overlay. */
export function sharedNavigation(
  frame: Frame,
  options: SharedNavigationOptions = {},
): SharedNavigation {
  if (scopes.has(frame))
    throw new Error('This Frame already has a shared navigation owner.')
  const defaultTiming = timing(options.transition)
  const navigationTimeout = options.navigationTimeout ?? 3000
  const layoutTimeout = options.layoutTimeout ?? 500
  const budget = options.maxSnapshotPixels ?? 8_000_000
  for (const [key, value] of Object.entries({ navigationTimeout, layoutTimeout }))
    if (!Number.isFinite(value) || value <= 0 || value > 10_000)
      throw new RangeError(`${key} must be positive and at most 10000 ms.`)
  if (!Number.isSafeInteger(budget) || budget <= 0 || budget > 32_000_000)
    throw new RangeError('maxSnapshotPixels must be a positive integer at most 32000000.')
  let state: SharedNavigation['state'] = 'idle'
  let cancel: ((reason: string) => void) | undefined
  const suspend = () => cancel?.('suspended')
  const unload = () => control.dispose()
  const releaseMotion = onReducedMotion((value) => {
    if (value) cancel?.('reduced-motion')
  })
  const control: SharedNavigation = {
    get state() {
      return state
    },
    navigate(request) {
      if (typeof request.tag !== 'string' || !request.tag.trim())
        throw new TypeError('A nonempty sharedTransitionTag is required.')
      if (typeof request.navigate !== 'function')
        throw new TypeError('A navigation callback is required.')
      const requestedBudget = request.maxSnapshotPixels ?? budget
      if (
        !Number.isSafeInteger(requestedBudget) ||
        requestedBudget <= 0 ||
        requestedBudget > 32_000_000
      )
        throw new RangeError(
          'maxSnapshotPixels must be a positive integer at most 32000000.',
        )
      const flightBudget = Math.min(budget, requestedBudget)
      const transition = timing(request.transition ?? defaultTiming)
      if (state !== 'idle')
        return {
          finished: Promise.resolve({
            status: 'unavailable',
            reason: state === 'disposed' ? 'disposed' : 'busy',
            navigated: false,
          }),
          cancel() {},
        }
      state = 'preparing'
      let settle!: (result: SharedNavigationResult) => void
      const finished = new Promise<SharedNavigationResult>((resolve) => {
        settle = resolve
      })
      let ended = false,
        navigated = false,
        navigationStarted = false
      let flight: Flight | undefined, detach: (() => void) | undefined
      let timer: ReturnType<typeof setTimeout> | undefined
      let destination: Page | undefined
      let unavailable: string | undefined
      const sourcePage = frame.currentPage
      const finish = (
        status: SharedNavigationStatus,
        reason?: string,
        error?: unknown,
      ) => {
        if (ended) return
        ended = true
        if (timer !== undefined) clearTimeout(timer)
        detach?.()
        frame.off('navigatingTo', navigating)
        frame.off('navigatedTo', arrived)
        destination?.off('unloaded', targetUnloaded)
        flight?.dispose()
        flight = undefined
        cancel = undefined
        if (state !== 'disposed') state = 'idle'
        settle({
          status,
          navigated,
          ...(reason ? { reason } : {}),
          ...(error !== undefined ? { error } : {}),
        })
      }
      const bound = (
        milliseconds: number,
        status: SharedNavigationStatus,
        reason: string,
      ) => {
        if (timer !== undefined) clearTimeout(timer)
        timer = setTimeout(() => finish(status, reason), milliseconds)
      }
      const targetUnloaded = () => finish('cancelled', 'target-unloaded')
      const navigating = () => {
        if (navigationStarted) finish('cancelled', 'navigation-interrupted')
        navigationStarted = true
      }
      const sources = find(sourcePage, request.tag)
      const source = sources[0]
      const image = source instanceof Image
      const imageSrc = image ? source.src : undefined
      const imageSource = image ? source.imageSource : undefined
      const arrived = () => {
        if (ended) return
        destination = frame.currentPage
        navigated = !!destination && destination !== sourcePage
        if (!navigated) {
          finish('unavailable', 'route-unchanged')
          return
        }
        if (unavailable) {
          finish('unavailable', unavailable)
          return
        }
        if (!destination || !flight) {
          finish('unavailable', 'missing-target')
          return
        }
        destination.on('unloaded', targetUnloaded)
        bound(layoutTimeout, 'unavailable', 'layout-timeout')
        // Vue can mount the returning page's contents in its navigatedTo hook.
        void Promise.resolve().then(() => {
          if (ended || !destination) return
          try {
            const driver = getDriver()
            if (!driver.afterLayout) {
              finish('unavailable', 'unsupported-layout')
              return
            }
            detach = driver.afterLayout(destination, () => {
              if (ended || !flight) return
              try {
                const targets = find(destination, request.tag)
                if (targets.length !== 1) {
                  finish(
                    'unavailable',
                    targets.length ? 'duplicate-target' : 'missing-target',
                  )
                  return
                }
                const target = targets[0]!
                if (
                  image &&
                  (!supportedImage(target) ||
                    (imageSrc !== target.src && imageSource !== target.imageSource))
                ) {
                  finish('unavailable', 'unsupported-image')
                  return
                }
                if (!image && target instanceof Image) {
                  finish('unavailable', 'content-mismatch')
                  return
                }
                const geometry = flight.prepare(
                  target,
                  image,
                  radius(target),
                  flightBudget,
                )
                if (!geometry) {
                  finish('unavailable', 'unsupported-target')
                  return
                }
                const json = tracks(flight, JSON.parse(geometry) as number[], transition)
                const duration = Math.max(
                  ...(JSON.parse(json).tracks as { times: number[] }[]).map((track) =>
                    track.times.at(-1)!,
                  ),
                )
                state = 'running'
                bound(duration + 500, 'cancelled', 'playback-timeout')
                flight.play(json, (completed) =>
                  finish(
                    completed ? 'completed' : 'cancelled',
                    completed ? undefined : 'geometry-changed',
                  ),
                )
              } catch (error) {
                finish('failed', 'preparation-failed', error)
              }
            })
            destination.requestLayout()
          } catch (error) {
            finish('failed', 'preparation-failed', error)
          }
        })
      }
      cancel = (reason) => finish('cancelled', reason)
      const handle = { finished, cancel: () => finish('cancelled', 'cancelled') }
      try {
        if (reducedMotion()) unavailable = 'reduced-motion'
        else if (!frame.isLoaded || !sourcePage?.isLoaded) unavailable = 'unloaded'
        else if (sources.length !== 1)
          unavailable = sources.length ? 'duplicate-source' : 'missing-source'
        else if (image && !supportedImage(source!)) unavailable = 'unsupported-image'
        else {
          try {
            flight = image
              ? captureNavigationImage(source!, radius(source!), flightBudget)
              : capture(source!, false, radius(source!), flightBudget)
            if (!flight) unavailable = 'unsupported-source'
          } catch {
            unavailable = 'native-unavailable'
          }
        }
        frame.on('navigatingTo', navigating)
        frame.on('navigatedTo', arrived)
        bound(navigationTimeout, 'unavailable', 'navigation-timeout')
        const result = request.navigate(routeOptions)
        if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
          void Promise.resolve(result).then(
            () => {
              if (!ended && !navigated && frame.currentPage === sourcePage)
                finish('unavailable', 'route-unchanged')
            },
            (error) => finish('failed', 'navigation-failed', error),
          )
        }
      } catch (error) {
        finish('failed', 'navigation-failed', error)
      }
      return handle
    },
    dispose() {
      if (state === 'disposed') return
      state = 'disposed'
      cancel?.('disposed')
      releaseMotion()
      frame.off('unloaded', unload)
      Application.off(Application.suspendEvent, suspend)
      scopes.delete(frame)
    },
  }
  scopes.set(frame, control)
  frame.on('unloaded', unload)
  Application.on(Application.suspendEvent, suspend)
  return control
}
