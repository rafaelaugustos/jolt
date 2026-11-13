import { presentationCopy } from './presentation-copy.js'

/** Hook only the affected parent/children, for one layout pass. Never patches global DOM prototypes. */
export function watchDOMRemovals(
  container: HTMLElement,
  capture: (element: HTMLElement) => void,
) {
  const view = container.ownerDocument.defaultView! as Window & typeof globalThis
  const restore: (() => void)[] = []
  const removed = (node: Node) => {
    if (node.parentNode === container && node instanceof view.HTMLElement) capture(node)
  }
  function method(
    target: object,
    name: string,
    wrap: (original: (...args: any[]) => any) => (...args: any[]) => any,
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(target, name)
    if (
      (descriptor && !descriptor.configurable) ||
      (!descriptor && !Object.isExtensible(target))
    )
      return
    const original = (target as Record<string, any>)[name]
    const replacement = wrap(original)
    Object.defineProperty(target, name, {
      configurable: true,
      writable: true,
      value: replacement,
    })
    restore.push(() => {
      if ((target as Record<string, unknown>)[name] !== replacement) return
      if (descriptor) Object.defineProperty(target, name, descriptor)
      else delete (target as Record<string, unknown>)[name]
    })
  }
  method(
    container,
    'removeChild',
    (original) =>
      function (this: HTMLElement, node: Node) {
        removed(node)
        return original.call(this, node)
      },
  )
  method(
    container,
    'replaceChild',
    (original) =>
      function (this: HTMLElement, next: Node, old: Node) {
        if (next !== old) removed(old)
        return original.call(this, next, old)
      },
  )
  method(
    container,
    'replaceChildren',
    (original) =>
      function (this: HTMLElement, ...next: (Node | string)[]) {
        for (const child of [...this.children]) if (!next.includes(child)) removed(child)
        return original.apply(this, next)
      },
  )
  for (const child of [...container.children])
    if (child instanceof view.HTMLElement) {
      method(
        child,
        'remove',
        (original) =>
          function (this: HTMLElement) {
            removed(this)
            return original.call(this)
          },
      )
      method(
        child,
        'replaceWith',
        (original) =>
          function (this: HTMLElement, ...next: (Node | string)[]) {
            if (!next.includes(this)) removed(this)
            return original.apply(this, next)
          },
      )
    }
  for (const name of ['innerHTML', 'textContent']) {
    const own = Object.getOwnPropertyDescriptor(container, name)
    let parent: object | null = container,
      descriptor: PropertyDescriptor | undefined
    while (parent && !descriptor) {
      descriptor = Object.getOwnPropertyDescriptor(parent, name)
      parent = Object.getPrototypeOf(parent)
    }
    if (
      !descriptor?.set ||
      (own && !own.configurable) ||
      (!own && !Object.isExtensible(container))
    )
      continue
    const original = descriptor,
      setter = function (this: HTMLElement, value: unknown) {
        for (const child of [...this.children]) removed(child)
        original.set!.call(this, value)
      }
    Object.defineProperty(container, name, {
      configurable: true,
      get: original.get,
      set: setter,
    })
    restore.push(() => {
      if (Object.getOwnPropertyDescriptor(container, name)?.set !== setter) return
      if (own) Object.defineProperty(container, name, own)
      else delete (container as unknown as Record<string, unknown>)[name]
    })
  }
  return () => {
    for (const stop of restore.reverse()) stop()
    restore.length = 0
  }
}

export interface DOMExitCopy {
  element: HTMLElement
  pixels: number
  dispose(): void
}
export function captureDOMExit(
  source: HTMLElement,
  remaining: number,
): DOMExitCopy | undefined {
  const document = source.ownerDocument,
    view = document.defaultView!
  const rect = source.getBoundingClientRect(),
    pixels = Math.ceil(rect.width * rect.height * view.devicePixelRatio ** 2)
  if (!pixels || pixels > remaining) return
  let copy: ReturnType<typeof presentationCopy>
  try {
    copy = presentationCopy(source, { remaining: 512 })
  } catch {
    return
  }
  const stage = document.createElement('div')
  if (typeof stage.showPopover !== 'function') return
  stage.dataset.joltLayoutExit = ''
  stage.inert = true
  stage.setAttribute('aria-hidden', 'true')
  stage.setAttribute('popover', 'manual')
  Object.assign(stage.style, {
    all: 'initial',
    position: 'fixed',
    inset: '0px',
    width: '100vw',
    height: '100vh',
    margin: '0px',
    padding: '0px',
    border: 'none',
    background: 'transparent',
    pointerEvents: 'none',
    overflow: 'hidden',
  })
  copy.element.style.transformOrigin = '50% 50%'
  stage.append(copy.element)
  document.documentElement.append(stage)
  try {
    stage.showPopover()
  } catch {
    stage.remove()
    return
  }
  let ended = false
  return {
    element: copy.element,
    pixels,
    dispose() {
      if (ended) return
      ended = true
      stage.remove()
    },
  }
}
