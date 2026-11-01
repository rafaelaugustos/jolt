import type { PlaybackAnimation, SpringName, Transition, Values } from './types.js'

export interface WebPressState {
  disabled?: boolean
  loading?: boolean
}
export interface WebPressOptions extends WebPressState {
  transition?: Transition | SpringName
}
export interface WebPress {
  readonly pressed: boolean
  /** Latest finite feedback transition, including its cancellation result. */
  readonly animation?: PlaybackAnimation & { readonly ready: Promise<void> }
  update(state: WebPressState): void
  dispose(): void
}

export function validatePressState(state: WebPressState) {
  if (!state || typeof state !== 'object') throw new TypeError('Expected press state.')
  for (const name of ['disabled', 'loading'] as const)
    if (state[name] !== undefined && typeof state[name] !== 'boolean')
      throw new TypeError(`${name} must be boolean.`)
}

/** Input only: the context owns the private contribution and finite playback. */
export function createPress(
  target: HTMLElement,
  values: Values,
  options: WebPressOptions,
  animate: (values: Values) => NonNullable<WebPress['animation']>,
  remove: () => void,
) {
  const view = target.ownerDocument.defaultView! as Window & typeof globalThis
  const document = target.ownerDocument
  const abort = new view.AbortController()
  const neutral = Object.fromEntries(
    Object.keys(values).map((p) => [p, p === 'opacity' || p.startsWith('scale') ? 1 : 0]),
  ) as Values
  let state: WebPressState = { disabled: options.disabled, loading: options.loading }
  let pointer: number | undefined
  let key: string | undefined
  let pressed = false
  let disposed = false
  let animation: WebPress['animation']

  const ancestors = () => {
    const nodes: Node[] = []
    let node: Node | null = target
    while (node) {
      nodes.push(node)
      node = node.parentNode ?? (node instanceof view.ShadowRoot ? node.host : null)
    }
    return nodes
  }
  const blocked = () =>
    state.disabled ||
    state.loading ||
    target.matches(':disabled') ||
    target.getAttribute('aria-busy') === 'true' ||
    ancestors().some(
      (node) =>
        node instanceof view.Element &&
        (node.hasAttribute('inert') || node.getAttribute('aria-disabled') === 'true'),
    )

  const change = (next: boolean) => {
    if (disposed || next === pressed) return
    // Let runtime transactions validate/prepare before committing the input state.
    const nextAnimation = animate(next ? values : neutral)
    pressed = next
    animation = nextAnimation
  }
  const cancel = () => {
    pointer = undefined
    key = undefined
    change(false)
  }
  const listen = <E extends Event>(
    node: EventTarget,
    type: string,
    callback: (event: E) => void,
    capture = false,
  ) =>
    node.addEventListener(type, callback as EventListener, {
      signal: abort.signal,
      capture,
      passive: true,
    })

  listen(target, 'pointerdown', (event: PointerEvent) => {
    if (
      disposed ||
      event.defaultPrevented ||
      blocked() ||
      pointer !== undefined ||
      key ||
      !event.isPrimary ||
      event.button !== 0
    )
      return
    // A card's nested control owns its own interaction.
    for (const node of event.composedPath()) {
      if (node === target) break
      if (
        node instanceof view.Element &&
        node.matches(
          'button, a[href], input, select, textarea, [contenteditable], [role="button"]',
        )
      )
        return
    }
    change(true)
    pointer = event.pointerId
  })
  const endPointer = (event: PointerEvent) => {
    if (event.pointerId === pointer) cancel()
  }
  // No explicit pointer capture: preserve native click hit-testing on release.
  // Touch's implicit capture and scroll cancellation remain the browser's job.
  listen(view, 'pointerup', endPointer, true)
  listen(view, 'pointercancel', endPointer, true)
  listen(target, 'lostpointercapture', endPointer)
  listen(target, 'pointerleave', (event: PointerEvent) => {
    if (event.pointerType === 'mouse') endPointer(event)
  })
  listen(
    view,
    'pointermove',
    (event: PointerEvent) => {
      if (event.pointerId === pointer && !(event.buttons & 1)) cancel()
    },
    true,
  )
  listen(target, 'keydown', (event: KeyboardEvent) => {
    if (
      !(target instanceof view.HTMLButtonElement) ||
      event.composedPath()[0] !== target ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      blocked() ||
      pointer !== undefined ||
      key ||
      ![' ', 'Enter'].includes(event.key)
    )
      return
    change(true)
    key = event.key
  })
  listen(
    view,
    'keyup',
    (event: KeyboardEvent) => {
      if (event.key === key) cancel()
    },
    true,
  )
  listen(target, 'blur', cancel)
  listen(view, 'blur', cancel)
  listen(document, 'visibilitychange', () => {
    if (document.hidden) cancel()
  })
  const scroll = (event: Event) => {
    if (pointer !== undefined && ancestors().includes(event.target as Node)) cancel()
  }
  listen(document, 'scroll', scroll, true)
  // Scroll events do not cross shadow boundaries. Follow connected reparenting.
  let scrollRoot: Node | undefined
  const watchRoot = () => {
    const next = target.getRootNode()
    if (next === scrollRoot) return
    scrollRoot?.removeEventListener('scroll', scroll, true)
    scrollRoot = next
    if (next !== document)
      next.addEventListener('scroll', scroll, { capture: true, passive: true })
  }
  watchRoot()

  const detach = () => {
    disposed = true
    pressed = false
    pointer = undefined
    key = undefined
    abort.abort()
    scrollRoot?.removeEventListener('scroll', scroll, true)
    scrollRoot = undefined
  }
  const handle: WebPress = {
    get pressed() {
      return pressed
    },
    get animation() {
      return animation
    },
    update(next) {
      if (disposed) return
      validatePressState(next)
      state = { ...state, ...next }
      if (blocked()) cancel()
    },
    dispose() {
      if (disposed) return
      remove()
      detach()
    },
  }
  return {
    handle,
    detach,
    refresh: () => {
      if (!disposed) {
        watchRoot()
        if (blocked()) cancel()
      }
    },
  }
}
