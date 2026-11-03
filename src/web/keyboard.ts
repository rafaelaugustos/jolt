import { effectOptions, effectOwnership, effectTarget } from './effect.js'
import { bounded } from './surface-effect.js'
import type { PlatformHost } from './platform-host.js'

export interface WebKeyboardState {
  readonly visible: boolean
  /** Layout viewport CSS pixels covered from the bottom; zero for floating keyboards. */
  readonly height: number
  /** Browsers do not expose the native keyboard curve or duration. */
  readonly duration: 0
  readonly transition: { readonly duration: 0 }
  readonly backend: 'virtual-keyboard' | 'visual-viewport' | 'none'
  readonly accuracy: 'exact' | 'estimated' | 'unavailable'
  readonly rect: Readonly<{ left: number; top: number; right: number; bottom: number }>
}
export interface WebKeyboardOptions {
  offset?: number
}
export interface WebKeyboardSubscription {
  (): void
  readonly disposed: boolean
  readonly paused: boolean
  pause(): void
  play(): void
  dispose(): void
  cancel(): void
  snapshot(): WebKeyboardState
}
interface VirtualKeyboard extends EventTarget {
  readonly boundingRect: DOMRectReadOnly
}
const sources = new WeakMap<object, KeyboardSource>()
function source(host: PlatformHost) {
  let entry = sources.get(host.identity)
  if (!entry) {
    entry = new KeyboardSource(host)
    sources.set(host.identity, entry)
  }
  return entry
}
function editable(document: Document) {
  let element = document.activeElement
  while (element?.shadowRoot?.activeElement) element = element.shadowRoot.activeElement
  return !!element?.matches(
    'textarea:not([readonly]):not(:disabled),input:not([readonly]):not(:disabled):not([type=button]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=submit]):not([type=reset]):not([type=file]):not([type=color]),[contenteditable=""],[contenteditable="true"]',
  )
}
class KeyboardSource {
  private listeners = new Set<(state: WebKeyboardState) => void>()
  private off: (() => void)[] = []
  private value: WebKeyboardState
  constructor(readonly host: PlatformHost) {
    this.value = this.measure()
  }
  private measure(): WebKeyboardState {
    const document = this.host.document,
      view = document.defaultView!
    const keyboard = (view.navigator as Navigator & { virtualKeyboard?: VirtualKeyboard })
      .virtualKeyboard
    const viewport = view.visualViewport,
      height = view.innerHeight
    let rect = { left: 0, top: height, right: view.innerWidth, bottom: height },
      covered = 0,
      visible = false
    let backend: WebKeyboardState['backend'] = 'none',
      accuracy: WebKeyboardState['accuracy'] = 'unavailable'
    if (
      keyboard &&
      typeof keyboard.addEventListener === 'function' &&
      keyboard.boundingRect
    ) {
      backend = 'virtual-keyboard'
      accuracy = 'exact'
      const box = keyboard.boundingRect
      visible = box.height > 0 && box.width > 0
      if (visible) {
        rect = { left: box.left, top: box.top, right: box.right, bottom: box.bottom }
        if (box.bottom >= height - 2)
          covered = Math.max(0, Math.min(height, height - box.top))
      }
    } else if (viewport) {
      backend = 'visual-viewport'
      accuracy = 'estimated'
      // Focus plus a substantial unscaled viewport reduction is only an estimate.
      // Do not double-count browsers that already resized the layout viewport.
      const gap = height - viewport.height - viewport.offsetTop
      if (editable(document) && Math.abs(viewport.scale - 1) < 0.01 && gap > 80) {
        visible = true
        covered = Math.min(height, gap)
        rect = { left: 0, top: height - covered, right: view.innerWidth, bottom: height }
      }
    }
    return Object.freeze({
      visible,
      height: covered,
      duration: 0 as const,
      transition: Object.freeze({ duration: 0 as const }),
      backend,
      accuracy,
      rect: Object.freeze(rect),
    })
  }
  private refresh = () => {
    const next = this.measure()
    if (JSON.stringify(next) === JSON.stringify(this.value)) return
    this.value = next
    for (const listener of [...this.listeners]) this.deliver(listener)
  }
  private deliver(listener: (state: WebKeyboardState) => void) {
    try {
      listener(this.value)
    } catch (error) {
      this.host.error(error)
    }
  }
  subscribe(listener: (state: WebKeyboardState) => void) {
    if (!this.listeners.size) {
      this.value = this.measure()
      const document = this.host.document,
        view = document.defaultView!
      const keyboard = (
        view.navigator as Navigator & { virtualKeyboard?: VirtualKeyboard }
      ).virtualKeyboard
      const on = (target: EventTarget | null | undefined, name: string) => {
        if (!target?.addEventListener) return
        target.addEventListener(name, this.refresh, { passive: true })
        this.off.push(() => target.removeEventListener(name, this.refresh))
      }
      on(keyboard, 'geometrychange')
      on(view.visualViewport, 'resize')
      on(view.visualViewport, 'scroll')
      on(view, 'resize')
      on(view, 'orientationchange')
      on(document, 'focusin')
      on(document, 'focusout')
    }
    this.listeners.add(listener)
    this.deliver(listener)
    return () => {
      this.listeners.delete(listener)
      if (!this.listeners.size) for (const off of this.off.splice(0)) off()
    }
  }
  snapshot() {
    return this.measure()
  }
}

export function createKeyboardSubscription(
  callback: (state: WebKeyboardState) => void,
  host: PlatformHost,
): WebKeyboardSubscription {
  if (typeof callback !== 'function') throw new TypeError('onKeyboard needs a callback.')
  const keyboard = source(host)
  let ended = false,
    held = false,
    unlisten: (() => void) | undefined,
    unregister: (() => void) | undefined
  const stop = () => {
    if (ended) return
    ended = true
    unlisten?.()
    unregister?.()
  }
  const handle = Object.defineProperties(
    Object.assign(stop, {
      pause() {
        if (!ended && !held) {
          held = true
          unlisten?.()
          unlisten = undefined
        }
      },
      play() {
        if (!ended && held) {
          held = false
          unlisten = keyboard.subscribe(callback)
          if (ended || held) {
            unlisten()
            unlisten = undefined
          }
        }
      },
      dispose: stop,
      cancel: stop,
      snapshot: () => keyboard.snapshot(),
    }),
    { disposed: { get: () => ended }, paused: { get: () => held } },
  ) as WebKeyboardSubscription
  try {
    unregister = host.register(host.document.documentElement, handle, () => {})
    unlisten = keyboard.subscribe(callback)
    if (ended) unlisten()
    return handle
  } catch (error) {
    stop()
    throw error
  }
}

export function createKeyboardFollower(
  target: HTMLElement,
  options: WebKeyboardOptions,
  host: PlatformHost,
): WebKeyboardSubscription {
  const view = effectTarget(target, host)
  effectOptions(options, ['offset'])
  const offset = bounded(options.offset ?? 0, 'offset', 0, 10000)
  let ended = false,
    held = false,
    keyboard: WebKeyboardSubscription | undefined
  const y = host.motionValue(0),
    off: (() => void)[] = []
  let binding: ReturnType<PlatformHost['bindLayer']> | undefined
  const stop = () => {
    if (ended) return
    ended = true
    keyboard?.dispose()
    binding?.dispose()
    y.dispose()
    for (const release of off.splice(0).reverse()) release()
  }
  const refresh = () => {
    if (ended) return
    if (
      !target.isConnected ||
      target.ownerDocument !== host.document ||
      !binding?.owns()
    ) {
      stop()
      return
    }
    if (held) return
    const state = source(host).snapshot(),
      rect = target.getBoundingClientRect()
    const scale = target.offsetHeight > 0 ? rect.height / target.offsetHeight : 1
    const bottom = rect.bottom - y.get() * scale
    const intersects = rect.right > state.rect.left && rect.left < state.rect.right
    y.set(
      state.visible && intersects
        ? Math.min(0, (state.rect.top - bottom - offset) / (scale || 1))
        : 0,
    )
  }
  const handle = Object.defineProperties(
    Object.assign(stop, {
      pause() {
        if (!ended && !held) {
          held = true
          keyboard?.pause()
        }
      },
      play() {
        if (!ended && held) {
          held = false
          keyboard?.play()
          refresh()
        }
      },
      dispose: stop,
      cancel: stop,
      snapshot: () => source(host).snapshot(),
    }),
    { disposed: { get: () => ended }, paused: { get: () => held } },
  ) as WebKeyboardSubscription
  try {
    off.push(effectOwnership(target, 'keyboard', host, stop))
    binding = host.bindLayer(target, { y }, host.layer('keyboard'))
    keyboard = createKeyboardSubscription(refresh, host)
    off.push(host.register(target, handle, refresh))
    const resize = new view.ResizeObserver(refresh)
    resize.observe(target)
    off.push(() => resize.disconnect())
    view.addEventListener('resize', refresh)
    off.push(() => view.removeEventListener('resize', refresh))
    refresh()
    return handle
  } catch (error) {
    stop()
    throw error
  }
}
