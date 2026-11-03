import { effectOptions, effectTarget } from './effect.js'
import {
  createSharedNavigation,
  type WebSharedNavigationOperation,
  type WebSharedNavigationResult,
} from './shared-navigation.js'
import type { PlatformHost } from './platform-host.js'
import type { WebInteraction } from './interaction.js'
import type { WebReturnTarget } from './return-target.js'
import type { WebPhotoDismissal } from './zoomable.js'
import type { WebSharedLayoutOptions } from './shared-layout.js'

export interface WebNavigationEntryOptions extends WebSharedLayoutOptions {
  tag: string
  source(): HTMLElement | undefined
  detail(): HTMLElement | undefined
  returnTarget: WebReturnTarget
  /** Resolve only once the list route has committed. False leaves detail usable. */
  back(context: {
    animated: false
    signal: AbortSignal
  }): boolean | void | Promise<boolean | void>
  navigationTimeout?: number
  onState?: (state: WebNavigationEntry['state']) => void
}
export interface WebNavigationEntry extends WebInteraction {
  readonly state: 'ready' | 'opening' | 'idle' | 'returning' | 'returned' | 'disposed'
  open(
    navigate: (context: {
      animated: false
      signal: AbortSignal
    }) => unknown | Promise<unknown>,
  ): Promise<WebSharedNavigationResult>
  back(): Promise<WebSharedNavigationResult>
  /** Captures the current zoom/dismissal pose before routing, carrying release velocity. */
  returnFrom(intent: WebPhotoDismissal): Promise<WebSharedNavigationResult>
}
export function createNavigationEntry(
  container: HTMLElement,
  options: WebNavigationEntryOptions,
  host: PlatformHost,
): WebNavigationEntry {
  const view = effectTarget(container, host)
  effectOptions(options, [
    'tag',
    'source',
    'detail',
    'returnTarget',
    'back',
    'navigationTimeout',
    'onState',
    'transition',
    'layoutTimeout',
    'maxElements',
  ])
  const target = options.returnTarget,
    timeout = target?.timeout ?? 1500
  if (
    typeof options.tag !== 'string' ||
    !options.tag.trim() ||
    !target ||
    typeof target.key !== 'string' ||
    !target.key.trim() ||
    [options.source, options.detail, options.back, target.resolve].some(
      (f) => typeof f !== 'function',
    ) ||
    (target.fallbackFocus !== undefined && typeof target.fallbackFocus !== 'function') ||
    (options.onState !== undefined && typeof options.onState !== 'function')
  )
    throw new TypeError(
      'A navigation entry requires source/detail callbacks, a route owner and a keyed return target.',
    )
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 5000)
    throw new RangeError('Return target timeout must be in (0, 5000].')
  const navigation = createSharedNavigation(
    container,
    {
      transition: options.transition,
      layoutTimeout: options.layoutTimeout,
      maxElements: options.maxElements,
      navigationTimeout: Math.min(10000, (options.navigationTimeout ?? 3000) + timeout),
    },
    host,
  )
  let state: WebNavigationEntry['state'] = 'ready',
    ended = false,
    held = false,
    version = 0
  let operation: WebSharedNavigationOperation | undefined,
    controller: AbortController | undefined,
    detach: (() => void) | undefined,
    pending: Promise<WebSharedNavigationResult> | undefined,
    heldIntent: WebPhotoDismissal | undefined
  const off: (() => void)[] = []
  const notify = (next: WebNavigationEntry['state']) => {
    state = next
    try {
      options.onState?.(next)
    } catch (e) {
      host.error(e)
    }
  }
  const unavailable = (
    reason: 'busy' | 'paused' | 'disposed',
  ): Promise<WebSharedNavigationResult> =>
    Promise.resolve({ status: 'unavailable', reason, navigated: false })
  const attach = (element: HTMLElement | undefined) => {
    detach?.()
    detach = undefined
    if (element?.isConnected && container.contains(element))
      detach = navigation.attach(element, options.tag)
  }
  const run = (
    returning: boolean,
    navigate: WebNavigationEntry['open'] extends (f: infer F) => unknown ? F : never,
    intent?: WebPhotoDismissal,
  ): Promise<WebSharedNavigationResult> => {
    if (ended) return unavailable('disposed')
    if (held) return unavailable('paused')
    if (pending) return pending
    if (returning ? state !== 'idle' : state !== 'ready') return unavailable('busy')
    const current = ++version
    controller = new view.AbortController()
    const signal = controller.signal
    heldIntent = intent
    attach(returning ? options.detail() : options.source())
    notify(returning ? 'returning' : 'opening')
    if (ended || current !== version) return unavailable('disposed')
    if (signal.aborted) {
      intent?.cancel()
      notify(returning ? 'idle' : 'ready')
      return Promise.resolve({
        status: 'cancelled',
        reason: 'cancelled',
        navigated: false,
      })
    }
    let committed = false,
      rejected = false,
      missingTarget = false,
      focus: HTMLElement | undefined
    const abortable = <T>(promise: Promise<T>): Promise<T | undefined> =>
      new Promise((resolve, reject) => {
        const abort = () => resolve(undefined)
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
        void promise
          .then(resolve, reject)
          .finally(() => signal.removeEventListener('abort', abort))
          .catch(() => {})
      })
    operation = navigation.navigate({
      tag: options.tag,
      transition: intent
        ? {
            type: 'spring',
            stiffness: 300,
            damping: 32,
            y: { type: 'spring', stiffness: 300, damping: 32, velocity: intent.velocity },
          }
        : options.transition,
      async navigate() {
        const result = await abortable(
          Promise.resolve(navigate({ animated: false, signal })),
        )
        if (signal.aborted) return
        if (result === false) {
          rejected = true
          throw new Error('The application rejected navigation.')
        }
        committed = true
        if (returning) {
          intent?.complete()
          const resolution = new view.AbortController(),
            abort = () => resolution.abort()
          signal.addEventListener('abort', abort, { once: true })
          let cancelTimer = () => {}
          try {
            const resolved = await Promise.race([
              Promise.resolve(
                target.resolve({ key: target.key, signal: resolution.signal }),
              ),
              new Promise<undefined>((resolve) => {
                cancelTimer = host.after(timeout, () => {
                  resolution.abort()
                  resolve(undefined)
                })
              }),
              new Promise<undefined>((resolve) => {
                resolution.signal.addEventListener('abort', () => resolve(undefined), {
                  once: true,
                })
                if (signal.aborted) abort()
              }),
            ])
            if (!signal.aborted) {
              if (resolved?.isConnected && container.contains(resolved)) {
                attach(resolved)
                focus = resolved
              } else {
                focus = target.fallbackFocus?.()
                missingTarget = true
                operation?.cancel()
              }
            }
          } catch {
            if (!signal.aborted) {
              focus = target.fallbackFocus?.()
              missingTarget = true
              operation?.cancel()
            }
          } finally {
            cancelTimer()
            resolution.abort()
            signal.removeEventListener('abort', abort)
          }
        } else {
          const detail = options.detail()
          attach(detail)
          if (!detail?.isConnected) {
            missingTarget = true
            operation?.cancel()
          }
        }
      },
    })
    const flight = operation
    pending = flight.finished.then((result) => {
      if (ended || current !== version) return result
      operation = undefined
      pending = undefined
      heldIntent = undefined
      if (!committed) {
        intent?.cancel()
        attach(returning ? options.detail() : options.source())
        notify(returning ? 'idle' : 'ready')
      } else {
        notify(returning ? 'returned' : 'idle')
        if (returning && focus?.isConnected && container.contains(focus))
          (focus.closest<HTMLElement>('button,a[href],[tabindex]') ?? focus).focus({
            preventScroll: true,
          })
      }
      controller?.abort()
      return rejected
        ? { ...result, navigated: false }
        : missingTarget
          ? { ...result, status: 'unavailable', reason: 'missing-target' }
          : result
    })
    return pending
  }
  const handle: WebNavigationEntry = {
    get state() {
      return state
    },
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    open(navigate) {
      if (typeof navigate !== 'function')
        throw new TypeError('open requires a route callback.')
      return run(false, navigate)
    },
    back() {
      return run(true, options.back)
    },
    returnFrom(intent) {
      if (
        !intent ||
        typeof intent.cancel !== 'function' ||
        typeof intent.complete !== 'function' ||
        !Number.isFinite(intent.velocity)
      )
        throw new TypeError('Expected a live photo dismissal.')
      return run(true, options.back, intent)
    },
    cancel() {
      controller?.abort()
      operation?.cancel()
      heldIntent?.cancel()
    },
    pause() {
      if (ended) return
      held = true
      handle.cancel()
      navigation.pause()
    },
    play() {
      if (ended) return
      held = false
      navigation.play()
    },
    dispose() {
      if (ended) return
      ended = true
      version++
      handle.cancel()
      detach?.()
      navigation.dispose()
      off
        .splice(0)
        .reverse()
        .forEach((fn) => fn())
      notify('disposed')
    },
  }
  try {
    off.push(
      host.visibility(() => {
        if (host.document.hidden) handle.cancel()
      }),
      host.register(container, handle, () => {
        if (!container.isConnected) handle.dispose()
      }),
    )
    return handle
  } catch (e) {
    handle.dispose()
    throw e
  }
}
