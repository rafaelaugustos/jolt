import { effectOptions, effectTarget } from './effect.js'
import type { PlatformHost } from './platform-host.js'
import type { WebInteraction } from './interaction.js'
import type {
  WebSharedLayoutOptions,
  WebSharedLayoutResult,
  WebSharedLayoutAnimation,
} from './shared-layout.js'
import { bounded } from './surface-effect.js'

export interface WebSharedNavigationOptions extends WebSharedLayoutOptions {
  navigationTimeout?: number
}
export interface WebSharedNavigationRequest {
  tag: string
  /** Commit the route exactly once. Attach its destination before resolving. */
  navigate(context: { animated: false }): unknown | Promise<unknown>
  transition?: WebSharedLayoutOptions['transition']
}
export interface WebSharedNavigationResult {
  status: WebSharedLayoutResult['status'] | 'failed'
  reason?:
    | WebSharedLayoutResult['reason']
    | 'busy'
    | 'paused'
    | 'disposed'
    | 'navigation-timeout'
    | 'navigation-error'
  navigated: boolean
  error?: unknown
}
export interface WebSharedNavigationOperation {
  readonly finished: Promise<WebSharedNavigationResult>
  cancel(): void
}
export interface WebSharedNavigation extends WebInteraction {
  readonly state: 'idle' | 'preparing' | 'running' | 'disposed'
  attach(target: HTMLElement, tag: string): () => void
  navigate(request: WebSharedNavigationRequest): WebSharedNavigationOperation
}

/** Router ownership stays with the application; cancellation only ends the visual flight. */
export function createSharedNavigation(
  container: HTMLElement,
  options: WebSharedNavigationOptions,
  host: PlatformHost,
): WebSharedNavigation {
  effectTarget(container, host)
  effectOptions(options, [
    'transition',
    'layoutTimeout',
    'maxElements',
    'navigationTimeout',
  ])
  const timeout = bounded(
    options.navigationTimeout ?? 3000,
    'navigationTimeout',
    1,
    10000,
  )
  const layoutTimeout = bounded(options.layoutTimeout ?? 500, 'layoutTimeout', 1, 10000)
  const layout = host.sharedLayout(container, {
    ...options,
    layoutTimeout: Math.min(10000, timeout + layoutTimeout),
  })
  const attached = new Map<string, HTMLElement>()
  let ended = false,
    held = false,
    state: WebSharedNavigation['state'] = 'idle'
  let operation:
    | {
        tag: string
        ready: boolean
        attach?: () => void
        finish(result: WebSharedNavigationResult): void
      }
    | undefined
  let unregister = () => {}
  const handle: WebSharedNavigation = {
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    get state() {
      return state
    },
    attach(target, tag) {
      if (ended) throw new Error('Shared navigation is disposed.')
      effectTarget(target, host)
      if (!container.contains(target) || typeof tag !== 'string' || !tag.trim())
        throw new TypeError('Attach a tagged element inside the navigation container.')
      if (attached.has(tag) && (!operation || operation.tag !== tag))
        throw new Error('Duplicate shared navigation tag.')
      attached.set(tag, target)
      if (operation?.tag === tag && operation.ready) operation.attach?.()
      return () => {
        if (attached.get(tag) === target) attached.delete(tag)
      }
    },
    navigate(request) {
      effectOptions(request, ['tag', 'navigate', 'transition'])
      if (
        typeof request.tag !== 'string' ||
        !request.tag.trim() ||
        typeof request.navigate !== 'function'
      )
        throw new TypeError('Navigation needs a tag and route callback.')
      const unavailable = (
        reason: WebSharedNavigationResult['reason'],
      ): WebSharedNavigationOperation => ({
        finished: Promise.resolve({ status: 'unavailable', reason, navigated: false }),
        cancel() {},
      })
      if (ended) return unavailable('disposed')
      if (held) return unavailable('paused')
      if (operation) return unavailable('busy')
      let resolve!: (value: WebSharedNavigationResult) => void
      const finished = new Promise<WebSharedNavigationResult>((done) => {
        resolve = done
      })
      let done = false,
        navigated = false,
        routeReady = false,
        visualResult: WebSharedLayoutResult | undefined,
        flight: WebSharedLayoutAnimation | undefined
      let detachSource: (() => void) | undefined,
        detachTarget: (() => void) | undefined,
        clearTimer: (() => void) | undefined
      const finish = (result: WebSharedNavigationResult) => {
        if (done) return
        done = true
        clearTimer?.()
        flight?.cancel()
        detachSource?.()
        detachTarget?.()
        if (operation === current) {
          operation = undefined
          if (!ended) state = 'idle'
        }
        resolve(result)
      }
      const current = {
        tag: request.tag,
        ready: false,
        attach: () => {
          const target = attached.get(request.tag)
          if (target?.isConnected && !done) {
            detachTarget?.()
            detachTarget = layout.attach(target, request.tag)
          }
        },
        finish,
      }
      operation = current
      state = 'preparing'
      const conclude = () => {
        if (routeReady && visualResult) finish({ ...visualResult, navigated })
      }
      try {
        const source = attached.get(request.tag)
        if (source?.isConnected) detachSource = layout.attach(source, request.tag)
        clearTimer = host.after(timeout, () =>
          finish({ status: 'unavailable', reason: 'navigation-timeout', navigated }),
        )
        flight = layout.transition(() => {
          detachSource?.()
          attached.delete(request.tag)
          navigated = true
          const result = request.navigate({ animated: false })
          void Promise.resolve(result).then(
            () => {
              if (done) return
              routeReady = true
              current.ready = true
              clearTimer?.()
              state = 'running'
              try {
                current.attach()
                conclude()
              } catch (error) {
                finish({ status: 'failed', reason: 'navigation-error', error, navigated })
              }
            },
            (error) =>
              finish({ status: 'failed', reason: 'navigation-error', error, navigated }),
          )
        }, request.transition)
        if (done) flight.cancel()
        void flight.finished.then((result) => {
          visualResult = result
          conclude()
        })
      } catch (error) {
        finish({ status: 'failed', reason: 'navigation-error', error, navigated })
      }
      return {
        finished,
        cancel: () => finish({ status: 'cancelled', reason: 'cancelled', navigated }),
      }
    },
    cancel() {
      operation?.finish({ status: 'cancelled', reason: 'cancelled', navigated: true })
    },
    pause() {
      if (!ended) {
        held = true
        handle.cancel()
        layout.pause()
      }
    },
    play() {
      if (!ended) {
        held = false
        layout.play()
      }
    },
    dispose() {
      if (ended) return
      ended = true
      handle.cancel()
      state = 'disposed'
      attached.clear()
      layout.dispose()
      unregister()
    },
  }
  try {
    unregister = host.register(container, handle, () => {
      if (!container.isConnected) handle.dispose()
    })
    return handle
  } catch (error) {
    handle.dispose()
    throw error
  }
}
