import { ReturnScope } from './return-signal.js'
import { Application, Image, type Frame, type Page } from '@nativescript/core'
import { find, radius, supportedImage } from './targets.js'
import { reducedMotion, onReducedMotion } from '../config.js'
import { getDriver } from '../driver/index.js'
import { capture, captureNavigationImage, type Flight } from '../shared-layout/native.js'
import {
  resolveReturnTarget,
  validateReturnTarget,
  focusReturnTarget,
  type SharedReturnTarget,
} from './return-target.js'
export { resolveListTarget } from './return-target.js'
export type { SharedReturnSignal } from './return-signal.js'
export type { SharedReturnContext, SharedReturnTarget } from './return-target.js'
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
  /** Capture a dragged static image with its current viewport clipping. */
  allowClippedSource?: boolean
  /** Current window-space translation velocity, in DIPs per second. Spring flights only. */
  velocity?: Readonly<{ x: number; y: number }>
  /** Resolve the current return view after the destination page has been mounted. */
  returnTarget?: SharedReturnTarget
  /** Retain the visible source page while the return target is realized (within the pixel budget). */
  holdSource?: boolean
  /** Called after native capture, before route mutation; useful for releasing a held viewer pose. */
  onCaptured?: () => void
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
      validateReturnTarget(request.returnTarget)
      if (
        request.velocity &&
        (!Number.isFinite(request.velocity.x) || !Number.isFinite(request.velocity.y))
      )
        throw new RangeError('Navigation velocity must contain finite x and y values.')
      for (const key of ['holdSource', 'allowClippedSource'] as const)
        if (request[key] !== undefined && typeof request[key] !== 'boolean')
          throw new TypeError(`${key} must be boolean.`)
      if (request.onCaptured !== undefined && typeof request.onCaptured !== 'function')
        throw new TypeError('onCaptured must be a function.')
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
      const targetScope = new ReturnScope()
      let resolvedTarget: import('@nativescript/core').View | undefined
      let fallbackRunning = false
      let ended = false,
        navigated = false,
        navigationStarted = false
      let detachIdentity: (() => void) | undefined
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
        if (
          !fallbackRunning &&
          flight?.fade &&
          navigated &&
          status === 'unavailable' &&
          request.returnTarget &&
          !targetScope.signal.aborted &&
          !reducedMotion()
        ) {
          fallbackRunning = true
          targetScope.abort()
          detach?.()
          detach = undefined
          if (timer !== undefined) clearTimeout(timer)
          timer = setTimeout(() => finish(status, reason, error), 500)
          flight.fade(180, () => finish(status, reason, error))
          return
        }
        ended = true
        targetScope.abort()
        if (timer !== undefined) clearTimeout(timer)
        detach?.()
        detachIdentity?.()
        frame.off('navigatingTo', navigating)
        frame.off('navigatedTo', arrived)
        destination?.off('unloaded', targetUnloaded)
        flight?.dispose()
        flight = undefined
        cancel = undefined
        if (state !== 'disposed') state = 'idle'
        if (navigated && destination && request.returnTarget) {
          let target = resolvedTarget
          if (!target)
            try {
              target = request.returnTarget.fallbackFocus?.(destination)
            } catch {}
          focusReturnTarget(destination, target)
        }
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
      const sources = find(sourcePage, request.tag, true)
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
        if (unavailable && !request.returnTarget) {
          finish('unavailable', unavailable)
          return
        }
        if (!destination || (!flight && !request.returnTarget)) {
          finish('unavailable', 'missing-target')
          return
        }
        destination.on('unloaded', targetUnloaded)
        bound(
          request.returnTarget
            ? (request.returnTarget.timeout ?? 1500) + 100
            : layoutTimeout,
          'unavailable',
          'layout-timeout',
        )
        // Vue can mount the returning page's contents in its navigatedTo hook.
        void Promise.resolve().then(async () => {
          if (ended || !destination) return
          if (request.returnTarget) {
            const result = await resolveReturnTarget(
              request.returnTarget,
              request.tag,
              destination,
              targetScope.signal,
            )
            if (ended || targetScope.signal.aborted) return
            resolvedTarget = result.view
            if (result.reason) {
              finish('unavailable', result.reason)
              return
            }
            if (unavailable || !flight) {
              finish('unavailable', unavailable ?? 'unsupported-source')
              return
            }
          }
          try {
            const driver = getDriver()
            if (!driver.afterLayout) {
              finish('unavailable', 'unsupported-layout')
              return
            }
            detach = driver.afterLayout(destination, () => {
              if (ended || !flight) return
              try {
                const targets = find(destination, request.tag, true)
                if (targets.length !== 1) {
                  finish(
                    'unavailable',
                    targets.length ? 'duplicate-target' : 'missing-target',
                  )
                  return
                }
                const target = targets[0]!
                if (request.returnTarget && target !== resolvedTarget) {
                  finish('unavailable', 'stale-target')
                  return
                }
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
                const identityChanged = () =>
                  finish('cancelled', 'target-identity-changed')
                const identityEvents = [
                  'bindingContextChange',
                  'sharedTransitionTagChange',
                  'imageSourceChange',
                  'unloaded',
                ]
                for (const event of identityEvents) target.on(event, identityChanged)
                detachIdentity = () => {
                  for (const event of identityEvents) target.off(event, identityChanged)
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
                const json = tracks(
                  flight,
                  JSON.parse(geometry) as number[],
                  transition,
                  request.velocity,
                )
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
              ? request.allowClippedSource
                ? captureNavigationImage(source!, radius(source!), flightBudget, true)
                : captureNavigationImage(source!, radius(source!), flightBudget)
              : capture(source!, false, radius(source!), flightBudget)
            if (!flight) unavailable = 'unsupported-source'
            else if (
              request.holdSource &&
              !flight.holdPage?.(sourcePage!, flightBudget)
            ) {
              flight.dispose()
              flight = undefined
              unavailable = 'unsupported-source-page'
            }
          } catch {
            unavailable = 'native-unavailable'
          }
        }
        if (flight) request.onCaptured?.()
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
