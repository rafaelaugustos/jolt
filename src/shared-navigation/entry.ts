import {
  Application,
  Image,
  isIOS,
  isAndroid,
  Trace,
  type Frame,
  type NavigationTransition,
  type Page,
  type View,
} from '@nativescript/core'
import { onReducedMotion, reducedMotion } from '../config.js'
import {
  interactiveNavigation,
  type InteractiveNavigation,
} from '../interactive-navigation/index.js'
import { predictiveBack, type PredictiveBack } from '../predictive-back/index.js'
import { nativeBackSessions } from '../predictive-back/presentation.js'
import { springs, type Spring } from '../transition.js'
import { timing } from '../shared-layout/timing.js'
import { find, radius, supportedImage } from './targets.js'
import { validateReturnTarget, type SharedReturnTarget } from './return-target.js'
import { navigationScopes } from './scope.js'
import {
  sharedNavigation,
  type SharedNavigationAnimation,
  type SharedNavigationResult,
} from './index.js'

export interface SharedNavigationRouteOptions {
  animated?: boolean
  transition?: NavigationTransition
}
export interface SharedNavigationEntryEvent {
  state:
    | 'ready'
    | 'opening'
    | 'idle'
    | 'tracking'
    | 'finishing'
    | 'cancelling'
    | 'committing'
    | 'disposed'
  shared?: { status: 'ready' | 'unavailable'; reason?: string }
  outcome?: 'completed' | 'cancelled'
  release?: Readonly<{ progress: number; velocity: number }>
}
export interface SharedNavigationEntryOptions {
  tag: string
  returnTarget?: SharedReturnTarget
  /** Gate iOS edge start and Android back commitment when another interaction owns the image. */
  canBegin?: () => boolean
  /** Route owner. Map a rejected router navigation to false. Called once per committed back. */
  back(options: SharedNavigationRouteOptions): boolean | void | Promise<boolean | void>
  spring?:
    | keyof typeof springs
    | Pick<Spring, 'duration' | 'bounce' | 'stiffness' | 'damping' | 'mass'>
  maxSnapshotPixels?: number
  navigationTimeout?: number
  onState?: (event: SharedNavigationEntryEvent) => void
}
export interface SharedNavigationEntry {
  readonly state: SharedNavigationEntryEvent['state']
  /** A single push. Repeated calls reject without invoking their route. */
  open(
    navigate: (options: SharedNavigationRouteOptions) => unknown,
  ): Promise<SharedNavigationResult>
  /** A request during entry is serialized until entry completes. Repeated requests coalesce. */
  back(): void
  /** Return from a held image pose. Capture precedes routing; rejection leaves the entry usable. */
  returnToSource(options?: {
    velocity?: Readonly<{ x: number; y: number }>
  }): Promise<SharedNavigationResult>
  cancel(): void
  dispose(): void
}

/** One stable image/card entry. Routes stay with Frame/router; native back owns shared presentation. */
export function sharedNavigationEntry(
  frame: Frame,
  options: SharedNavigationEntryOptions,
): SharedNavigationEntry {
  if (!options || typeof options.tag !== 'string' || !options.tag.trim())
    throw new TypeError('A nonempty sharedTransitionTag is required.')
  validateReturnTarget(options.returnTarget)
  if (options.canBegin !== undefined && typeof options.canBegin !== 'function')
    throw new TypeError('canBegin must be a function.')
  if (typeof options.back !== 'function')
    throw new TypeError('A back callback is required.')
  const input =
    typeof options.spring === 'string'
      ? Object.hasOwn(springs, options.spring)
        ? springs[options.spring]
        : undefined
      : options.spring
  if (options.spring !== undefined && !input)
    throw new TypeError('Unknown shared navigation spring.')
  if (input !== undefined && (typeof input !== 'object' || Array.isArray(input)))
    throw new TypeError('spring must be a named spring or a physics object.')
  if (input && 'type' in input && input.type !== 'spring')
    throw new TypeError('Interactive shared navigation requires a spring.')
  for (const key of Object.keys(input ?? {}))
    if (!['type', 'duration', 'bounce', 'stiffness', 'damping', 'mass'].includes(key))
      throw new TypeError(`Unsupported spring option: ${key}.`)
  const transition = timing({ ...(input ?? springs.smooth), type: 'spring' })
  const budget = options.maxSnapshotPixels ?? 8_000_000,
    timeout = options.navigationTimeout ?? 5000
  if (!Number.isSafeInteger(budget) || budget <= 0 || budget > 32_000_000)
    throw new RangeError('maxSnapshotPixels must be a positive integer at most 32000000.')
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 10_000)
    throw new RangeError('navigationTimeout must be positive and at most 10000 ms.')
  if (!frame.isLoaded || !frame.currentPage)
    throw new Error('Create sharedNavigationEntry after the Frame is loaded.')
  const sourcePage = frame.currentPage
  let originalSource: View | undefined, originalStamp: string | undefined
  let page: Page | undefined,
    state: SharedNavigationEntry['state'] = 'ready'
  let shared: SharedNavigationEntryEvent['shared']
  let ios: InteractiveNavigation | undefined, android: PredictiveBack | undefined
  let scene: org.rafaelaugusto.jolt.SharedNavigationScene | undefined
  let flight: SharedNavigationAnimation | undefined
  let forwardOwner: ReturnType<typeof sharedNavigation> | undefined,
    ownedForward = false
  let opening = false,
    queuedBack = false,
    used = false,
    backInFlight = false
  let handingOff = false
  let timer: ReturnType<typeof setTimeout> | undefined,
    reload: ReturnType<typeof setTimeout> | undefined
  let finishOpen: ((result: SharedNavigationResult) => void) | undefined
  const emit = (
    next: SharedNavigationEntry['state'],
    extra: Partial<SharedNavigationEntryEvent> = {},
  ) => {
    if (state === 'disposed') return
    state = next
    try {
      options.onState?.({ state, ...(shared ? { shared } : {}), ...extra })
    } catch (error) {
      Trace.write(
        `Shared navigation observer failed: ${String(error)}`,
        'Jolt',
        Trace.messageType.error,
      )
    }
  }
  const unavailable = (reason: string) => {
    shared = { status: 'unavailable', reason }
  }
  function completeOpen(result: SharedNavigationResult) {
    if (!opening || state === 'disposed') return
    opening = false
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    if (ownedForward) forwardOwner?.dispose()
    forwardOwner = undefined
    flight = undefined
    const resolve = finishOpen
    finishOpen = undefined
    if (result.navigated) {
      page = frame.currentPage
      page.on('loaded', scheduleBind)
      bindAndroid()
      emit('idle')
      resolve?.(result)
      if (queuedBack) {
        queuedBack = false
        control.back()
      }
    } else {
      resolve?.(result)
      control.dispose()
    }
  }
  function scheduleBind() {
    if (reload !== undefined) clearTimeout(reload)
    reload = setTimeout(bindAndroid, 0)
  }
  function bindAndroid() {
    if (
      !isAndroid ||
      opening ||
      state === 'disposed' ||
      !page?.isLoaded ||
      frame.currentPage !== page ||
      (android?.supported && android.state !== 'disposed')
    )
      return
    android?.dispose()
    const targets = find(page, options.tag),
      target = targets[0]
    const sources = find(sourcePage, options.tag),
      source = sources[0]
    if (targets.length !== 1)
      unavailable(targets.length ? 'duplicate-target' : 'missing-target')
    else if (sources.length !== 1)
      unavailable(sources.length ? 'duplicate-source' : 'missing-source')
    else if (
      source instanceof Image &&
      (!supportedImage(target!) ||
        (source.src !== target!.src && source.imageSource !== target!.imageSource))
    )
      unavailable('unsupported-image')
    else if (source && source instanceof Image !== target instanceof Image)
      unavailable('content-mismatch')
    else if (scene && target) {
      scene.bind(target.nativeViewProtected, radius(target))
      shared = { status: 'ready' }
    }
    if (shared?.status === 'unavailable' && scene) {
      scene.dispose()
      scene = undefined
    }
    android = predictiveBack(
      page,
      options.returnTarget ? { scale: [1, 0.96], y: [0, 24] } : { opacity: [1, 1] },
      {
        spring: options.spring,
        commitTimeout: timeout,
        commit: async (opts) => {
          if (frame.currentPage !== page || backInFlight) return false
          if (options.canBegin && !options.canBegin()) return false
          backInFlight = true
          try {
            return options.returnTarget
              ? (await resolvedBack()).navigated
              : await options.back(opts)
          } finally {
            backInFlight = false
          }
        },
        onState(event) {
          if (state === 'disposed') return
          if (handingOff) return
          if ((event.state === 'tracking' || event.state === 'finishing') && scene) {
            const current = find(sourcePage, options.tag)
            if (
              current.length !== 1 ||
              current[0] !== originalSource ||
              sourceStamp(current[0]!, sourcePage) !== originalStamp
            ) {
              scene.dispose()
              scene = undefined
              unavailable('source-invalidated')
            }
          }
          if (event.state === 'tracking' || event.state === 'finishing') {
            if (reducedMotion()) unavailable('reduced-motion')
            else if (scene)
              shared = scene.isAnimating()
                ? { status: 'ready' }
                : { status: 'unavailable', reason: scene.getFailureReason() }
          }
          if (event.state === 'disposed') {
            android = undefined
            return
          }
          emit(
            event.state,
            event.outcome
              ? {
                  outcome: event.outcome,
                  ...(event.release ? { release: event.release } : {}),
                }
              : event.release
                ? { release: event.release }
                : {},
          )
          if (event.outcome === 'completed') control.dispose()
        },
      },
    )
    if (scene) nativeBackSessions.get(android)?.setSharedScene(scene)
    if (!android.supported) unavailable('unsupported-platform')
  }
  async function resolvedBack(handoff?: {
    velocity?: Readonly<{ x: number; y: number }>
  }): Promise<SharedNavigationResult> {
    const existing = navigationScopes.get(frame)
    const owner =
      existing ??
      sharedNavigation(frame, {
        transition,
        navigationTimeout: timeout,
        maxSnapshotPixels: budget,
      })
    const owned = !existing
    // Preserve a caller-owned Frame controller; only release the controller created here.
    try {
      const operation = owner.navigate({
        ...(handoff ? { allowClippedSource: true, velocity: handoff.velocity } : {}),
        tag: options.tag,
        returnTarget: options.returnTarget,
        holdSource: true,
        transition,
        navigate: (opts) => options.back(opts),
      })
      flight = operation
      const result = await operation.finished
      if (result.status === 'completed') shared = { status: 'ready' }
      else unavailable(result.reason ?? 'return-unavailable')
      return result
    } finally {
      flight = undefined
      if (owned) owner.dispose()
    }
  }

  function arrived() {
    if (opening && isIOS && ios && !ios.supported && frame.currentPage !== sourcePage) {
      completeOpen({
        status: 'unavailable',
        reason: 'unsupported-platform',
        navigated: true,
      })
      return
    }
    if (opening || !page || backInFlight || state === 'disposed') return
    if (frame.currentPage === page) scheduleBind()
    else if (!frame.backStack.some((entry) => entry.resolvedPage === page))
      void Promise.resolve().then(() => {
        if (
          state !== 'disposed' &&
          !backInFlight &&
          !opening &&
          ios?.state !== 'animating' &&
          ios?.state !== 'finishing' &&
          ios?.state !== 'dragging'
        )
          control.dispose()
      })
  }
  const suspend = () => control.dispose()
  const control: SharedNavigationEntry = {
    get state() {
      return state
    },
    open(navigate) {
      if (typeof navigate !== 'function')
        throw new TypeError('A navigation callback is required.')
      if (used || state !== 'ready')
        return Promise.resolve({
          status: 'unavailable',
          reason: state === 'disposed' ? 'disposed' : 'busy',
          navigated: false,
        })
      if (frame.currentPage !== sourcePage)
        return Promise.resolve({
          status: 'unavailable',
          reason: 'source-changed',
          navigated: false,
        })
      const sources = find(sourcePage, options.tag, true)
      originalSource = sources.length === 1 ? sources[0] : undefined
      originalStamp = originalSource ? sourceStamp(originalSource, sourcePage) : undefined
      used = true
      opening = true
      const promise = new Promise<SharedNavigationResult>((resolve) => {
        finishOpen = resolve
      })
      emit('opening')
      if (control.state === 'disposed') return promise
      timer = setTimeout(() => {
        completeOpen({
          status: 'unavailable',
          reason: 'navigation-timeout',
          navigated: frame.currentPage !== sourcePage,
        })
        control.dispose()
      }, timeout)
      try {
        if (isIOS) {
          ios = interactiveNavigation(frame, {
            spring: options.spring,
            shared: {
              tag: options.tag,
              maxSnapshotPixels: budget,
              ...(options.returnTarget ? { returnTarget: options.returnTarget } : {}),
            },
            canBegin: () => !backInFlight && (options.canBegin?.() ?? true),
            onState(event) {
              if (state === 'disposed') return
              if (handingOff) return
              if (event.shared) shared = event.shared
              if (event.state === 'idle') {
                if (opening)
                  completeOpen({
                    status: shared?.status === 'ready' ? 'completed' : 'unavailable',
                    navigated: frame.currentPage !== sourcePage,
                    ...(shared?.reason ? { reason: shared.reason } : {}),
                  })
                else {
                  backInFlight = false
                  if (timer !== undefined) clearTimeout(timer)
                  timer = undefined
                  const completed = frame.currentPage !== page
                  emit('idle', { outcome: completed ? 'completed' : 'cancelled' })
                  if (completed) control.dispose()
                }
              } else if (event.state === 'disposed') {
                if (!opening && frame.currentPage !== page) control.dispose()
              } else
                emit(
                  event.state === 'animating'
                    ? opening
                      ? 'opening'
                      : 'finishing'
                    : event.state === 'dragging'
                      ? 'tracking'
                      : event.state,
                  { ...(event.release ? { release: event.release } : {}) },
                )
            },
          })
          const result = navigate(
            ios.supported ? { transition: ios.transition } : { animated: false },
          )
          if (result && typeof (result as PromiseLike<unknown>).then === 'function')
            Promise.resolve(result).then(
              () => {
                if (opening && (ios?.state === 'ready' || !ios?.supported))
                  completeOpen({
                    status: 'unavailable',
                    reason:
                      frame.currentPage === sourcePage
                        ? 'route-unchanged'
                        : 'unsupported-platform',
                    navigated: frame.currentPage !== sourcePage,
                  })
              },
              (error) => {
                completeOpen({
                  status: 'failed',
                  reason: 'navigation-failed',
                  navigated: frame.currentPage !== sourcePage,
                  error,
                })
                control.dispose()
              },
            )
        } else {
          const matches = find(sourcePage, options.tag, true),
            source = matches[0]
          if (reducedMotion()) unavailable('reduced-motion')
          else if (matches.length !== 1)
            unavailable(matches.length ? 'duplicate-source' : 'missing-source')
          else if (source instanceof Image && !supportedImage(source))
            unavailable('unsupported-image')
          else if (options.returnTarget) unavailable('target-resolved-on-return')
          else if (isAndroid && androidVersionSupported()) {
            try {
              scene =
                org.rafaelaugusto.jolt.SharedNavigationScene.capture(
                  source!.nativeViewProtected,
                  sourcePage.nativeViewProtected,
                  source instanceof Image,
                  radius(source!),
                  budget,
                ) ?? undefined
            } catch {
              unavailable('unsupported-source')
            }
            if (!scene) unavailable('unsupported-source')
          } else unavailable('unsupported-platform')
          forwardOwner = navigationScopes.get(frame)
          ownedForward = !forwardOwner
          forwardOwner ??= sharedNavigation(frame, {
            transition,
            navigationTimeout: timeout,
            maxSnapshotPixels: budget,
            layoutTimeout: 1500,
          })
          flight = forwardOwner.navigate({
            tag: options.tag,
            navigate,
            transition,
            maxSnapshotPixels: Math.max(1, budget - (scene?.pixels() ?? 0)),
          })
          flight.finished.then((result) => completeOpen(result))
        }
      } catch (error) {
        completeOpen({
          status: 'failed',
          reason: 'navigation-failed',
          navigated: frame.currentPage !== sourcePage,
          error,
        })
        control.dispose()
      }
      return promise
    },
    back() {
      if (state === 'disposed' || state === 'ready' || backInFlight) return
      if (opening) {
        queuedBack = true
        return
      }
      if (state !== 'idle' && state !== 'cancelling') return
      if (android && android.state !== 'disposed') {
        android.back()
        return
      }
      backInFlight = true
      emit('committing')
      if (control.state === 'disposed') return
      timer = setTimeout(() => {
        unavailable('navigation-timeout')
        control.dispose()
      }, timeout)
      Promise.resolve()
        .then(() =>
          state === 'disposed'
            ? false
            : options.returnTarget && !ios?.supported
              ? resolvedBack().then((result) => result.navigated)
              : options.back(isIOS && ios?.supported ? {} : { animated: false }),
        )
        .then(
          (result) => {
            // Core.goBack() returns void before UIKit finishes its transition.
            if (
              result !== false &&
              isIOS &&
              ios?.supported &&
              ['animating', 'finishing', 'cancelling', 'dragging'].includes(ios.state)
            )
              return
            backInFlight = false
            if (timer !== undefined) clearTimeout(timer)
            timer = undefined
            if (state === 'disposed') return
            if (result === false || frame.currentPage === page)
              emit('idle', { outcome: 'cancelled' })
            else {
              emit('idle', { outcome: 'completed' })
              control.dispose()
            }
          },
          () => {
            backInFlight = false
            if (timer !== undefined) clearTimeout(timer)
            timer = undefined
            if (state !== 'disposed') emit('idle', { outcome: 'cancelled' })
          },
        )
    },
    async returnToSource(handoff = {}) {
      if (
        handoff.velocity &&
        (!Number.isFinite(handoff.velocity.x) || !Number.isFinite(handoff.velocity.y))
      )
        throw new RangeError('Navigation velocity must contain finite x and y values.')
      if (state !== 'idle' || backInFlight || opening || frame.currentPage !== page)
        return {
          status: 'unavailable',
          navigated: false,
          reason: state === 'disposed' ? 'disposed' : 'busy',
        }
      backInFlight = true
      handingOff = true
      emit('committing')
      let result: SharedNavigationResult
      try {
        result =
          control.state === 'disposed'
            ? { status: 'cancelled', navigated: false, reason: 'disposed' }
            : await resolvedBack(handoff)
      } catch (error) {
        result = {
          status: 'failed',
          navigated: frame.currentPage !== page,
          reason: 'navigation-failed',
          error,
        }
      } finally {
        handingOff = false
        backInFlight = false
      }
      if (control.state !== 'disposed') {
        emit('idle', { outcome: result.navigated ? 'completed' : 'cancelled' })
        if (result.navigated) control.dispose()
        else scheduleBind()
      }
      return result
    },
    cancel() {
      queuedBack = false
      if (opening) {
        flight?.cancel()
        control.dispose()
      } else {
        flight?.cancel()
        ios?.cancel()
        android?.cancel()
      }
    },
    dispose() {
      if (state === 'disposed') return
      emit('disposed')
      queuedBack = false
      if (timer !== undefined) clearTimeout(timer)
      if (reload !== undefined) clearTimeout(reload)
      finishOpen?.({
        status: 'cancelled',
        reason: 'disposed',
        navigated: frame.currentPage !== sourcePage,
      })
      finishOpen = undefined
      opening = false
      flight?.cancel()
      flight = undefined
      if (ownedForward) forwardOwner?.dispose()
      forwardOwner = undefined
      android?.dispose()
      android = undefined
      scene?.dispose()
      scene = undefined
      ios?.dispose()
      ios = undefined
      frame.off('navigatedTo', arrived)
      frame.off('unloaded', suspend)
      page?.off('loaded', scheduleBind)
      Application.off(Application.suspendEvent, suspend)
      offMotion()
    },
  }
  const offMotion = onReducedMotion((value) => {
    if (value) control.cancel()
  })
  frame.on('navigatedTo', arrived)
  frame.on('unloaded', suspend)
  Application.on(Application.suspendEvent, suspend)
  return control
}
function androidVersionSupported() {
  return (
    typeof org !== 'undefined' &&
    !!org.rafaelaugusto?.jolt?.SharedNavigationScene &&
    android.os.Build.VERSION.SDK_INT >= 34
  )
}

// Reject a changed static source before the first visual frame, including layout writes
// waiting for the covered page to be realized. Dynamic return targets resolve separately.
function sourceStamp(view: View, page: Page): string {
  const keys = [
    'width',
    'height',
    'minWidth',
    'minHeight',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'horizontalAlignment',
    'verticalAlignment',
    'translateX',
    'translateY',
    'scaleX',
    'scaleY',
    'rotate',
    'opacity',
    'borderRadius',
    'backgroundColor',
    'color',
    'fontSize',
    'fontFamily',
    'fontWeight',
  ]
  const rows: unknown[] = []
  const geometry = (v: View) =>
    keys.map((key) => String((v as unknown as Record<string, unknown>)[key] ?? ''))
  for (let p = view.parent as View | undefined; p; p = p.parent as View | undefined) {
    rows.push(geometry(p))
    if (p === page) break
  }
  function visit(v: View) {
    rows.push([
      geometry(v),
      String((v as unknown as { text?: unknown }).text ?? ''),
      v instanceof Image ? [String(v.src), v.stretch] : [],
    ])
    v.eachChildView((child) => {
      visit(child)
      return true
    })
  }
  visit(view)
  return JSON.stringify(rows)
}
