import type { WebAnimation } from './public.js'
import type { AnimateOptions, Keyframes, SpringName } from './types.js'

export interface WebViewportOptions {
  keyframes?: Keyframes | string
  transition?: AnimateOptions | SpringName
  root?: HTMLElement | null
  rootMargin?: string
  threshold?: number
  once?: boolean
  disabled?: boolean
}
export interface WebViewportEntrance {
  readonly disposed: boolean
  readonly suspended: boolean
  readonly pending: number
  readonly completed: number
  update(state: { disabled: boolean }): void
  refresh(): void
  suspend(): void
  resume(): void
  dispose(): void
}
export interface ViewportHost {
  document: Document
  alive(): boolean
  reduced(): boolean
  preference(listener: () => void): () => void
  play(index: number): WebAnimation
  forget(): void
}

export function createViewportEntrance(
  targets: readonly HTMLElement[],
  options: WebViewportOptions,
  host: ViewportHost,
  identities: readonly unknown[] = targets,
): WebViewportEntrance & {
  reconcile(targets: readonly HTMLElement[], identities: readonly unknown[]): void
} {
  const threshold = options.threshold ?? 0,
    once = options.once ?? true
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1)
    throw new RangeError('Viewport threshold must be between 0 and 1.')
  for (const [key, value] of [
    ['once', options.once],
    ['disabled', options.disabled],
  ] as const)
    if (value !== undefined && typeof value !== 'boolean')
      throw new TypeError(`${key} must be boolean.`)
  if (options.rootMargin !== undefined && typeof options.rootMargin !== 'string')
    throw new TypeError('rootMargin must be a CSS margin string.')
  const document = host.document,
    view = document.defaultView! as Window & typeof globalThis
  if (
    options.root &&
    (!(options.root instanceof view.HTMLElement) ||
      options.root.ownerDocument !== document ||
      !options.root.isConnected)
  )
    throw new TypeError(
      'The viewport root must be a mounted HTMLElement in this document.',
    )
  type State = {
    identity: unknown
    target: HTMLElement
    index: number
    visible: boolean
    done: boolean
    removed: boolean
    epoch: number
    animation?: WebAnimation
  }
  const stateFor = (target: HTMLElement, index: number, identity: unknown): State => ({
    identity,
    target,
    index,
    visible: false,
    done: false,
    removed: false,
    epoch: 0,
  })
  let states = targets.map((target, index) => stateFor(target, index, identities[index]))
  let disposed = false,
    suspended = false,
    disabled = options.disabled ?? false,
    generation = 0
  let observer: IntersectionObserver | undefined, mutations: MutationObserver | undefined
  let listening = false
  let geometryEpoch = 0,
    input: AbortController | undefined,
    resize: ResizeObserver | undefined
  const stop = (state: State, complete = false) => {
    const animation = state.animation
    state.animation = undefined
    // Finish only channels still owned by this handle. Never set/release the
    // whole target: a newer application animation may already own one channel.
    if (animation) {
      if (
        host.alive() &&
        state.target.isConnected &&
        state.target.ownerDocument === document &&
        state.target.getClientRects().length
      )
        animation.progress = 1
      animation.stop()
    }
    if (complete) state.done = true
  }
  const detach = () => {
    generation++
    observer?.disconnect()
    observer = undefined
    mutations?.disconnect()
    mutations = undefined
    input?.abort()
    input = undefined
    resize?.disconnect()
    resize = undefined
    if (listening) document.removeEventListener('visibilitychange', visibility)
    listening = false
  }
  const idle = () => states.every((state) => state.removed || (once && state.done))
  const cleanCompleted = () => {
    if (idle()) detach()
  }
  const removed = () => {
    if (
      options.root &&
      (!options.root.isConnected || options.root.ownerDocument !== document)
    ) {
      controller.dispose()
      return
    }
    for (const state of states)
      if (
        !state.removed &&
        (!state.target.isConnected || state.target.ownerDocument !== document)
      ) {
        state.removed = true
        observer?.unobserve(state.target)
        stop(state)
      }
    cleanCompleted()
  }
  const start = (state: State) => {
    if (state.animation || state.removed || (once && state.done)) return
    const animation = host.play(state.index)
    state.animation = animation
    state.epoch = geometryEpoch
    void animation.finished.then((completed) => {
      if (disposed || state.animation !== animation) return
      state.animation = undefined
      if (completed) {
        state.done = true
        if (once) observer?.unobserve(state.target)
        if (once) resize?.unobserve(state.target)
        cleanCompleted()
      }
    })
  }
  const attach = () => {
    if (disposed || suspended || disabled || document.hidden || host.reduced() || idle())
      return
    if (!view.IntersectionObserver) {
      for (const state of states) state.done = true
      return // Progressive enhancement: content was never hidden.
    }
    const epoch = ++generation
    observer = new view.IntersectionObserver(
      (records) => {
        if (
          disposed ||
          epoch !== generation ||
          suspended ||
          disabled ||
          document.hidden ||
          host.reduced()
        )
          return
        const latest = new Map<Element, IntersectionObserverEntry>()
        for (const record of records) latest.set(record.target, record)
        // Stable input identity/order; delays were compiled for the entire group.
        for (const state of states) {
          const record = latest.get(state.target)
          if (!record || state.removed || (once && state.done)) continue
          if (!state.target.isConnected) {
            removed()
            continue
          }
          const visible =
            record.isIntersecting &&
            record.intersectionRatio >= threshold &&
            record.intersectionRect.width > 0 &&
            record.intersectionRect.height > 0
          // The entrance itself can translate/scale its observed box across the
          // threshold. Do not interpret that as a new scroll/layout exit. A real
          // scroll, resize, DOM layout change or explicit refresh invalidates it.
          if (!visible && state.animation && state.epoch === geometryEpoch) continue
          if (visible === state.visible) continue
          state.visible = visible
          if (visible) {
            try {
              start(state)
            } catch (error) {
              controller.dispose()
              throw error
            }
          } else stop(state)
        }
      },
      { root: options.root, rootMargin: options.rootMargin, threshold },
    )
    mutations = new view.MutationObserver(() => {
      geometryEpoch++
      removed()
    })
    mutations.observe(document, { subtree: true, childList: true })
    input = new view.AbortController()
    const invalidate = () => {
      geometryEpoch++
    }
    document.addEventListener('scroll', invalidate, {
      signal: input.signal,
      passive: true,
      capture: true,
    })
    view.addEventListener('resize', invalidate, { signal: input.signal, passive: true })
    resize = new view.ResizeObserver(invalidate)
    resize.observe(options.root ?? document.documentElement)
    for (const state of states) {
      if (state.removed || (once && state.done)) continue
      state.visible = false
      observer.observe(state.target)
      resize.observe(state.target)
      const root = state.target.getRootNode()
      if (root !== document) mutations.observe(root, { subtree: true, childList: true })
    }
  }
  const listen = () => {
    if (disposed || suspended || disabled || idle()) return
    if (!listening) {
      document.addEventListener('visibilitychange', visibility)
      listening = true
    }
    attach()
  }
  const interrupt = (complete = false) => {
    detach()
    for (const state of states) stop(state, complete && state.visible)
  }
  const visibility = () => {
    if (document.hidden) {
      // Keep the visibility listener to re-observe when the document returns.
      interrupt()
      listen()
    } else controller.refresh()
  }
  const preference = () => {
    interrupt(host.reduced())
    listen()
  }
  const unwatch = host.preference(preference)
  const controller: WebViewportEntrance & {
    reconcile(targets: readonly HTMLElement[], identities: readonly unknown[]): void
  } = {
    reconcile(targets, identities) {
      if (disposed) throw new Error('Viewport controller is disposed.')
      const previous = new Map(states.map((state) => [state.identity, state]))
      const next = targets.map((target, index) => {
        const old = previous.get(identities[index])
        if (old && old.target === target && !old.removed) {
          old.index = index
          return old
        }
        return stateFor(target, index, identities[index])
      })
      const kept = new Set(next)
      detach()
      for (const state of states) if (!kept.has(state)) stop(state)
      states = next
      listen()
    },
    get disposed() {
      return disposed
    },
    get suspended() {
      return suspended
    },
    get pending() {
      return states.filter((s) => s.animation).length
    },
    get completed() {
      return states.filter((s) => s.done).length
    },
    update(state) {
      if (disposed) throw new Error('Viewport controller is disposed.')
      if (!state || typeof state.disabled !== 'boolean')
        throw new TypeError('disabled must be boolean.')
      disabled = state.disabled
      interrupt(disabled)
      listen()
    },
    refresh() {
      if (disposed) return
      geometryEpoch++
      removed()
      detach()
      listen()
    },
    suspend() {
      if (!disposed && !suspended) {
        suspended = true
        interrupt()
      }
    },
    resume() {
      if (!disposed && suspended) {
        suspended = false
        controller.refresh()
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      try {
        interrupt()
      } finally {
        unwatch()
        host.forget()
      }
    },
  }
  try {
    listen()
  } catch (error) {
    controller.dispose()
    throw error
  }
  return controller
}
