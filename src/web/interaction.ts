import type { WebRuntime } from './public.js'
import type { WebBinding } from './value.js'
import type { FrameScheduler } from './scheduler.js'
import { renderedAncestors } from './geometry.js'

export interface OwnedBinding extends WebBinding {
  owns(): boolean
}
export interface WebInteraction {
  readonly disposed: boolean
  readonly paused: boolean
  pause(): void
  play(): void
  cancel(): void
  dispose(): void
}
export interface InteractionHost extends Pick<
  WebRuntime,
  | 'gestures'
  | 'motionValue'
  | 'animate'
  | 'bind'
  | 'set'
  | 'stop'
  | 'refresh'
  | 'scrollValue'
  | 'animateLayout'
  | 'scope'
> {
  bindLayer(
    target: HTMLElement,
    values: import('./value.js').WebBindings,
    layer: string,
  ): OwnedBinding
  layer(name: string): string
  scheduler: FrameScheduler
  error(error: unknown): void
  after(ms: number, action: () => void): () => void
  reduced(): boolean
  onReduced(callback: () => void): () => void
  register(target: HTMLElement, resource: WebInteraction, refresh: () => void): () => void
}
export function inputBlocked(target: HTMLElement, document = target.ownerDocument) {
  if (
    !target.isConnected ||
    target.ownerDocument !== document ||
    target.matches(':disabled') ||
    !target.getClientRects().length
  )
    return true
  for (const node of renderedAncestors(target))
    if (
      node.hasAttribute('inert') ||
      node.getAttribute('aria-disabled') === 'true' ||
      node.getAttribute('aria-busy') === 'true'
    )
      return true
  return false
}
export function inputChild(event: Event, target: HTMLElement) {
  const Element = (target.ownerDocument.defaultView! as Window & typeof globalThis)
    .Element
  for (const node of event.composedPath()) {
    if (node === target) break
    if (
      node instanceof Element &&
      node.matches(
        'button,a[href],input,select,textarea,[contenteditable],[role="button"]',
      )
    )
      return true
  }
  return false
}
/** Restore only the exact value still owned here, including its priority. */
export function ownStyle(target: HTMLElement, property: string, value: string) {
  const style = target.style,
    before = style.getPropertyValue(property),
    priority = style.getPropertyPriority(property)
  style.setProperty(property, value)
  return () => {
    if (
      style.getPropertyValue(property) === value &&
      !style.getPropertyPriority(property)
    ) {
      if (before) style.setProperty(property, before, priority)
      else style.removeProperty(property)
    }
  }
}
export function ownAttribute(target: Element, name: string, value: string) {
  const before = target.getAttribute(name)
  target.setAttribute(name, value)
  return () => {
    if (target.getAttribute(name) === value) {
      if (before === null) target.removeAttribute(name)
      else target.setAttribute(name, before)
    }
  }
}
export function inputEvents(target: HTMLElement) {
  const view = target.ownerDocument.defaultView! as Window & typeof globalThis
  const abort = new view.AbortController()
  return {
    view,
    on<E extends Event>(
      node: EventTarget,
      type: string,
      callback: (event: E) => void,
      passive = true,
      capture = false,
    ) {
      node.addEventListener(type, callback as EventListener, {
        signal: abort.signal,
        passive,
        capture,
      })
    },
    dispose: () => abort.abort(),
  }
}
export function releasePointer(target: HTMLElement, id: number) {
  if (target.hasPointerCapture(id)) target.releasePointerCapture(id)
}

/** Cleanup keeps running after one resource fails; callers still receive the failure. */
export function cleanupResources(actions: readonly (() => void)[]) {
  const errors: unknown[] = []
  for (const action of actions)
    try {
      action()
    } catch (error) {
      errors.push(error)
    }
  if (errors.length) throw new AggregateError(errors, 'Interaction cleanup failed.')
}
