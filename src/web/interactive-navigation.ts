import { effectOptions, effectOwnership, effectTarget } from './effect.js'
import type { PlatformHost } from './platform-host.js'
import type { WebInteraction } from './interaction.js'
import type { WebGestures } from './gestures.js'
import type { SpringParams } from '../core/spring.js'

export type WebNavigationState =
  | 'idle'
  | 'tracking'
  | 'finishing'
  | 'cancelling'
  | 'committing'
  | 'completed'
  | 'disposed'
export interface WebInteractiveNavigationOptions {
  axis?: 'x' | 'y'
  /** CSS pixels; defaults to the current viewport size. */
  distance?: number
  /** Horizontal back starts at the leading edge; vertical defaults to the whole surface. */
  edgeWidth?: number
  spring?: SpringParams
  canBegin?: () => boolean
  /** Application-owned routing, called once after the visual exit. False rolls back. */
  commit(context: {
    animated: false
    signal: AbortSignal
  }): boolean | void | Promise<boolean | void>
  onState?: (state: WebNavigationState) => void
  navigationTimeout?: number
}
export interface WebInteractiveNavigation extends WebInteraction {
  readonly state: WebNavigationState
  readonly progress: number
  back(): void
  cancel(): void
}
export function createInteractiveNavigation(
  target: HTMLElement,
  options: WebInteractiveNavigationOptions,
  host: PlatformHost,
): WebInteractiveNavigation {
  const view = effectTarget(target, host)
  effectOptions(options, [
    'axis',
    'distance',
    'edgeWidth',
    'spring',
    'canBegin',
    'commit',
    'onState',
    'navigationTimeout',
  ])
  const axis = options.axis ?? 'x',
    edge = options.edgeWidth ?? (axis === 'x' ? 32 : Infinity),
    timeout = options.navigationTimeout ?? 3000
  if (
    !['x', 'y'].includes(axis) ||
    (options.distance !== undefined &&
      (!Number.isFinite(options.distance) || options.distance <= 0)) ||
    (options.edgeWidth !== undefined && (!Number.isFinite(edge) || edge <= 0)) ||
    !Number.isFinite(timeout) ||
    timeout <= 0 ||
    timeout > 10000
  )
    throw new RangeError('Invalid navigation geometry or timeout.')
  if (
    typeof options.commit !== 'function' ||
    [options.canBegin, options.onState].some(
      (f) => f !== undefined && typeof f !== 'function',
    )
  )
    throw new TypeError('Navigation callbacks must be functions.')
  let state: WebNavigationState = 'idle',
    ended = false,
    held = false,
    generation = 0
  let gesture: WebGestures | undefined,
    binding: ReturnType<PlatformHost['bindLayer']> | undefined,
    controller: AbortController | undefined,
    timer: (() => void) | undefined
  const off: (() => void)[] = []
  const distance = () =>
    options.distance ?? (axis === 'x' ? view.innerWidth : view.innerHeight)
  const notify = (next: WebNavigationState) => {
    if (state === next) return
    state = next
    try {
      options.onState?.(next)
    } catch (e) {
      host.error(e)
    }
  }
  const allowed = () => {
    try {
      return options.canBegin?.() ?? true
    } catch (e) {
      host.error(e)
      return false
    }
  }
  const cancel = () => {
    if (ended || state === 'completed') return
    generation++
    controller?.abort()
    timer?.()
    timer = undefined
    notify('cancelling')
    gesture?.settleTo({ [axis]: 0 })
  }
  const commit = () => {
    if (ended || state !== 'finishing') return
    notify('committing')
    if (ended || handle.state !== 'committing') return
    const version = ++generation
    controller = new view.AbortController()
    timer = host.after(timeout, () => {
      if (version === generation) cancel()
    })
    let result: boolean | void | Promise<boolean | void>
    try {
      result = options.commit({ animated: false, signal: controller.signal })
    } catch (e) {
      host.error(e)
      cancel()
      return
    }
    void Promise.resolve(result).then(
      (accepted) => {
        if (ended || version !== generation) return
        timer?.()
        timer = undefined
        if (accepted === false) {
          cancel()
          return
        }
        notify('completed')
        gesture?.pause()
      },
      (e) => {
        if (!ended && version === generation) {
          host.error(e)
          cancel()
        }
      },
    )
  }
  const bounds = () =>
    gesture?.updateBounds(
      axis === 'x'
        ? { left: 0, right: distance(), top: 0, bottom: 0 }
        : { left: 0, right: 0, top: 0, bottom: distance() },
    )
  const handle: WebInteractiveNavigation = {
    get state() {
      return state
    },
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    get progress() {
      return Math.max(0, Math.min(1, (gesture?.position[axis] ?? 0) / distance()))
    },
    back() {
      if (
        ended ||
        held ||
        ['finishing', 'committing', 'completed'].includes(state) ||
        !allowed()
      )
        return
      bounds()
      notify('finishing')
      if (!ended && state === 'finishing') gesture?.settleTo({ [axis]: distance() })
    },
    cancel,
    pause() {
      if (ended || held) return
      cancel()
      held = true
      gesture?.pause()
    },
    play() {
      if (ended || !held) return
      held = false
      gesture?.play()
    },
    dispose() {
      if (ended) return
      ended = true
      generation++
      controller?.abort()
      timer?.()
      gesture?.dispose()
      binding?.dispose()
      off
        .splice(0)
        .reverse()
        .forEach((fn) => fn())
      notify('disposed')
    },
  }
  try {
    off.push(effectOwnership(target, 'interactive-navigation', host, handle.dispose))
    gesture = host.gestures(target, {
      pan: {
        axis,
        bounds:
          axis === 'x'
            ? { left: 0, right: distance(), top: 0, bottom: 0 }
            : { left: 0, right: 0, top: 0, bottom: distance() },
      },
      spring: options.spring,
      onContactStart(event) {
        const rect = target.getBoundingClientRect(),
          coordinate = axis === 'x' ? event.clientX - rect.left : event.clientY - rect.top
        if (
          held ||
          ['committing', 'completed'].includes(state) ||
          coordinate > edge ||
          !allowed()
        )
          gesture?.cancel()
        else {
          generation++
          controller?.abort()
          timer?.()
          bounds()
        }
      },
      onStart() {
        notify('tracking')
      },
      onEnd(event) {
        const position = event[axis],
          velocity = axis === 'x' ? event.velocityX : event.velocityY
        if (position + velocity * 0.2 > distance() * 0.35) handle.back()
        else cancel()
      },
      onCancel() {
        if (state === 'tracking')
          queueMicrotask(() => {
            if (state === 'tracking') cancel()
          })
      },
      onSettled() {
        if (state === 'finishing') commit()
        else if (state === 'cancelling') notify('idle')
      },
    })
    binding = host.bindLayer(
      target,
      { [axis]: axis === 'x' ? gesture.x : gesture.y },
      host.layer('navigation'),
    )
    const resize = () => {
      if (!ended) {
        bounds()
        cancel()
      }
    }
    view.addEventListener('resize', resize)
    off.push(() => view.removeEventListener('resize', resize))
    off.push(
      host.visibility(() => {
        if (host.document.hidden) cancel()
      }),
      host.register(target, handle, () => {
        if (!target.isConnected || !binding?.owns()) handle.dispose()
      }),
    )
    return handle
  } catch (e) {
    handle.dispose()
    throw e
  }
}
