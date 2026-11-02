import type { WebAnimation } from './public.js'
import type { AnimateOptions, SpringName } from './types.js'
import type { FrameScheduler, FrameTask } from './scheduler.js'
import { renderedAncestors } from './geometry.js'
import { validateLayout } from './layout.js'

export interface WebSharedLayoutOptions {
  transition?: AnimateOptions | SpringName
  layoutTimeout?: number
  /** Total copied elements across all current identities/crossfades. Default 512. */
  maxElements?: number
}
export interface WebSharedLayoutResult {
  status: 'completed' | 'cancelled' | 'unavailable'
  reason?:
    | 'interrupted'
    | 'cancelled'
    | 'unloaded'
    | 'suspended'
    | 'reduced-motion'
    | 'missing-source'
    | 'missing-target'
    | 'unsupported-target'
    | 'layout-timeout'
    | 'geometry-changed'
}
export interface WebSharedLayoutAnimation {
  readonly finished: Promise<WebSharedLayoutResult>
  cancel(): void
  stop(): void
}
export interface WebSharedLayout {
  attach(target: HTMLElement, key: string): () => void
  transition(
    change: () => void,
    transition?: AnimateOptions | SpringName,
  ): WebSharedLayoutAnimation
  readonly active: boolean
  readonly paused: boolean
  readonly suspended: boolean
  readonly disposed: boolean
  cancel(): void
  pause(): void
  play(): void
  suspend(): void
  resume(): void
  dispose(): void
}
interface SharedHost {
  scheduler: FrameScheduler
  reduced(): boolean
  preference(listener: () => void): () => void
  animate(
    target: HTMLElement,
    frames: import('./types.js').Keyframes,
    options?: AnimateOptions | SpringName,
  ): WebAnimation
  hide(target: HTMLElement): void
  reveal(target: HTMLElement): void
  release(target: HTMLElement): void
  forget(): void
}
interface Copy {
  element: HTMLElement
  rect: DOMRect
}
interface Flight {
  copies: Copy[]
  target?: HTMLElement
}
interface Operation {
  flights: Map<string, Flight>
  preparing: boolean
  finish(result: WebSharedLayoutResult): void
}

/** Static DOM presentation copies; no rasterization, script, interactive clone or navigation. */
export function createSharedLayout(
  container: HTMLElement,
  options: WebSharedLayoutOptions,
  host: SharedHost,
): WebSharedLayout {
  if (!options || typeof options !== 'object')
    throw new TypeError('Expected shared layout options.')
  validateLayout(undefined, options.transition)
  const timeout = options.layoutTimeout ?? 500,
    maxElements = options.maxElements ?? 512
  if (
    !Number.isFinite(timeout) ||
    timeout <= 0 ||
    timeout > 10000 ||
    !Number.isInteger(maxElements) ||
    maxElements < 1 ||
    maxElements > 4096
  )
    throw new RangeError(
      'Shared layout needs layoutTimeout in (0, 10000] and maxElements in [1, 4096].',
    )
  const document = container.ownerDocument,
    view = document.defaultView! as Window & typeof globalThis
  const attached = new Map<string, HTMLElement>()
  let disposed = false,
    paused = false,
    operation: Operation | undefined
  let stage: HTMLElement | undefined
  const assert = () => {
    if (disposed) throw new Error('Shared layout is disposed.')
    if (!container.isConnected || container.ownerDocument !== document)
      throw new Error('The shared layout container is unavailable.')
  }
  const sameSpace = (element: HTMLElement) => {
    for (const node of renderedAncestors(element)) {
      const css = view.getComputedStyle(node),
        matrix = new view.DOMMatrixReadOnly(
          css.transform === 'none' ? undefined : css.transform,
        )
      if (
        !matrix.is2D ||
        matrix.b !== 0 ||
        matrix.c !== 0 ||
        matrix.a <= 0 ||
        matrix.d <= 0 ||
        css.perspective !== 'none' ||
        (css.rotate !== 'none' && css.rotate !== '0deg') ||
        (css.scale !== 'none' && css.scale.split(/\s+/).some((n) => Number(n) <= 0))
      )
        return false
    }
    return true
  }
  const snapshot = (element: HTMLElement, budget: { remaining: number }): Copy => {
    const rect = element.getBoundingClientRect()
    if (!rect.width || !rect.height || !sameSpace(element))
      throw new Error('unsupported-target')
    // Never clone active documents, custom-element constructors, media/canvas
    // state or form controls. These need a renderer-specific snapshot provider.
    const elements = [element, ...element.querySelectorAll('*')]
    if (
      elements.length > budget.remaining ||
      elements.some(
        (node) =>
          !(node instanceof view.HTMLElement) ||
          node.localName.includes('-') ||
          node.shadowRoot ||
          node.matches(
            'script,style,link,iframe,object,embed,canvas,video,audio,input,textarea,select',
          ) ||
          ['::before', '::after'].some((pseudo) => {
            const content = view.getComputedStyle(node, pseudo).content
            if (
              content === '-moz-alt-content' &&
              node instanceof view.HTMLImageElement &&
              node.complete &&
              node.naturalWidth > 0
            )
              return false
            return content !== 'none' && content !== 'normal' && content !== '""'
          }),
      )
    )
      throw new Error('unsupported-target')
    budget.remaining -= elements.length
    const clone = element.cloneNode(true) as HTMLElement
    const copies = [clone, ...clone.querySelectorAll<HTMLElement>('*')]
    for (let index = 0; index < elements.length; index++) {
      const source = elements[index]!,
        copy = copies[index]!,
        css = view.getComputedStyle(source)
      for (const attribute of [...copy.attributes]) copy.removeAttribute(attribute.name)
      for (const name of css) copy.style.setProperty(name, css.getPropertyValue(name))
      copy.style.animation = 'none'
      copy.style.transition = 'none'
      copy.style.pointerEvents = 'none'
      copy.removeAttribute('id')
      copy.tabIndex = -1
      copy.inert = true
      if (source instanceof view.HTMLImageElement) {
        const image = copy as HTMLImageElement
        image.src = source.currentSrc || source.src
        image.alt = ''
      }
    }
    // Flatten the root's presented translation/scale into a viewport rectangle;
    // child geometry is frozen through computed declarations.
    const width = element.offsetWidth,
      height = element.offsetHeight
    if (!width || !height) throw new Error('unsupported-target')
    Object.assign(clone.style, {
      position: 'absolute',
      inset: 'auto',
      left: '0px',
      top: '0px',
      margin: '0px',
      width: `${width}px`,
      height: `${height}px`,
      minWidth: '0px',
      maxWidth: 'none',
      minHeight: '0px',
      maxHeight: 'none',
      boxSizing: 'border-box',
      transformOrigin: '0px 0px',
      translate: 'none',
      rotate: 'none',
      scale: 'none',
      transform: `scale(${rect.width / width}, ${rect.height / height})`,
    })
    const shell = document.createElement('div')
    shell.dataset.joltSharedCopy = ''
    shell.inert = true
    shell.setAttribute('aria-hidden', 'true')
    Object.assign(shell.style, {
      all: 'initial',
      position: 'absolute',
      left: `${rect.left}px`,
      top: `${rect.top}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
      transformOrigin: '0px 0px',
      pointerEvents: 'none',
      overflow: 'hidden',
    })
    shell.append(clone)
    return { element: shell, rect }
  }
  const ensureStage = () => {
    if (stage) return stage
    const root = document.createElement('div')
    if (typeof root.showPopover !== 'function') throw new Error('unsupported-target')
    root.dataset.joltSharedStage = ''
    root.setAttribute('popover', 'manual')
    root.setAttribute('aria-hidden', 'true')
    root.inert = true
    Object.assign(root.style, {
      all: 'initial',
      position: 'fixed',
      inset: '0px',
      width: '100vw',
      height: '100vh',
      margin: '0px',
      padding: '0px',
      border: 'none',
      background: 'transparent',
      overflow: 'visible',
      pointerEvents: 'none',
    })
    document.documentElement.append(root)
    try {
      root.showPopover()
    } catch (error) {
      root.remove()
      throw error
    }
    stage = root
    return root
  }
  const removeStage = () => {
    stage?.remove()
    stage = undefined
  }
  const cancel = (reason: WebSharedLayoutResult['reason'] = 'cancelled') =>
    operation?.finish({ status: 'cancelled', reason })
  const unwatch = host.preference(() => {
    if (host.reduced()) cancel('reduced-motion')
  })
  const visibility = () => {
    if (document.hidden) cancel('suspended')
  }
  document.addEventListener('visibilitychange', visibility)
  const controller: WebSharedLayout = {
    get active() {
      return !!operation
    },
    get disposed() {
      return disposed
    },
    get paused() {
      return paused
    },
    get suspended() {
      return paused
    },
    attach(target, key) {
      assert()
      if (
        !(target instanceof view.HTMLElement) ||
        target.ownerDocument !== document ||
        !container.contains(target)
      )
        throw new TypeError(
          'Attach a declared HTMLElement inside the shared layout container.',
        )
      if (typeof key !== 'string' || !key.trim())
        throw new TypeError('A shared identity must be a nonempty string.')
      if (attached.has(key) && !operation?.preparing)
        throw new Error('Duplicate shared identity outside a transition.')
      for (const [other, element] of attached)
        if (other !== key && (element.contains(target) || target.contains(element)))
          throw new Error('Shared identities cannot overlap.')
      if (!attached.has(key) && attached.size >= 8)
        throw new RangeError('At most eight shared identities may be attached.')
      attached.set(key, target)
      return () => {
        if (attached.get(key) === target) attached.delete(key)
      }
    },
    transition(change, transition = options.transition) {
      assert()
      if (paused) throw new Error('Shared layout is paused.')
      validateLayout(change, transition)
      const previous = operation,
        budget = { remaining: maxElements }
      const flights = new Map<string, Flight>()
      let captureError: WebSharedLayoutResult['reason']
      try {
        for (const [key, target] of attached) {
          const moving = previous?.flights.get(key)
          const sources = moving?.copies.filter((copy) => copy.element.isConnected) ?? []
          if (sources.length)
            flights.set(key, {
              copies: sources.map((copy) => snapshot(copy.element, budget)),
            })
          else if (target.isConnected)
            flights.set(key, { copies: [snapshot(target, budget)] })
        }
      } catch {
        captureError = 'unsupported-target'
      }
      previous?.finish({ status: 'cancelled', reason: 'interrupted' })
      let resolve!: (result: WebSharedLayoutResult) => void
      const finished = new Promise<WebSharedLayoutResult>((done) => {
        resolve = done
      })
      const hidden = new Set<HTMLElement>(),
        handles: WebAnimation[] = []
      const started = host.scheduler.now()
      let abort: AbortController | undefined,
        observer: MutationObserver | undefined,
        resize: ResizeObserver | undefined
      let ended = false
      const finish = (result: WebSharedLayoutResult) => {
        if (ended) return
        ended = true
        host.scheduler.remove(task)
        abort?.abort()
        observer?.disconnect()
        resize?.disconnect()
        for (const handle of handles) handle.stop()
        for (const flight of flights.values())
          for (const copy of flight.copies) {
            host.release(copy.element)
            copy.element.remove()
          }
        for (const target of hidden) host.reveal(target)
        hidden.clear()
        flights.clear()
        if (operation === current) {
          operation = undefined
          removeStage()
        }
        resolve(result)
      }
      const current: Operation = { flights, preparing: true, finish }
      operation = current
      const task: FrameTask = {
        read() {
          if (ended) return
          if (!container.isConnected) {
            finish({ status: 'cancelled', reason: 'unloaded' })
            return
          }
          if (host.reduced()) {
            finish({ status: 'cancelled', reason: 'reduced-motion' })
            return
          }
          try {
            const ready = [...flights.keys()].every((key) => {
              const target = attached.get(key),
                box = target?.getBoundingClientRect()
              return target?.isConnected && box && box.width > 0 && box.height > 0
            })
            if (!ready) {
              if (host.scheduler.now() - started >= timeout)
                finish({
                  status: 'unavailable',
                  reason: [...flights.keys()].some(
                    (key) => !attached.get(key)?.isConnected,
                  )
                    ? 'missing-target'
                    : 'layout-timeout',
                })
              return
            }
            current.preparing = false
            const root = ensureStage()
            for (const [key, flight] of flights) {
              const target = attached.get(key)!
              if (hidden.has(target)) host.reveal(target)
              const incoming = snapshot(target, budget)
              flight.target = target
              const source = flight.copies[0]!.rect,
                destination = incoming.rect
              for (const copy of flight.copies) root.append(copy.element)
              root.append(incoming.element)
              host.hide(target)
              hidden.add(target)
              const from = (copy: Copy, to: DOMRect) => ({
                x: to.left - copy.rect.left,
                y: to.top - copy.rect.top,
                scaleX: to.width / copy.rect.width,
                scaleY: to.height / copy.rect.height,
              })
              for (const copy of flight.copies)
                handles.push(
                  host.animate(
                    copy.element,
                    { ...from(copy, destination), opacity: [1, 0] },
                    transition,
                  ),
                )
              handles.push(
                host.animate(
                  incoming.element,
                  {
                    x: [source.left - destination.left, 0],
                    y: [source.top - destination.top, 0],
                    scaleX: [source.width / destination.width, 1],
                    scaleY: [source.height / destination.height, 1],
                    opacity: [0, 1],
                  },
                  transition,
                ),
              )
              flight.copies.push(incoming)
            }
            abort = new view.AbortController()
            const invalidate = () =>
              finish({ status: 'cancelled', reason: 'geometry-changed' })
            document.addEventListener('scroll', invalidate, {
              capture: true,
              passive: true,
              signal: abort.signal,
            })
            view.addEventListener('resize', invalidate, {
              passive: true,
              signal: abort.signal,
            })
            observer = new view.MutationObserver(() => {
              if (
                !container.isConnected ||
                [...flights.values()].some((flight) => !flight.target?.isConnected)
              )
                finish({ status: 'cancelled', reason: 'unloaded' })
            })
            observer.observe(document, { subtree: true, childList: true })
            const boxes = new Map(
              [...flights.values()].map((flight) => [
                flight.target!,
                flight.target!.getBoundingClientRect(),
              ]),
            )
            resize = new view.ResizeObserver(() => {
              for (const [target, original] of boxes) {
                const box = target.getBoundingClientRect()
                if (
                  Math.abs(box.width - original.width) > 0.5 ||
                  Math.abs(box.height - original.height) > 0.5
                ) {
                  invalidate()
                  return
                }
              }
            })
            for (const target of boxes.keys()) resize.observe(target)
            void Promise.all(handles.map((handle) => handle.finished)).then((results) =>
              finish({
                status: results.every(Boolean) ? 'completed' : 'cancelled',
                ...(results.every(Boolean) ? {} : { reason: 'interrupted' as const }),
              }),
            )
          } catch {
            finish({ status: 'unavailable', reason: 'unsupported-target' })
          }
        },
        update: () => !ended && current.preparing,
      }
      const handle: WebSharedLayoutAnimation = {
        finished,
        cancel: () => finish({ status: 'cancelled', reason: 'cancelled' }),
        stop: () => finish({ status: 'cancelled', reason: 'cancelled' }),
      }
      try {
        try {
          if (!captureError && flights.size && !host.reduced()) {
            const root = ensureStage()
            for (const [key, flight] of flights) {
              for (const copy of flight.copies) root.append(copy.element)
              const target = attached.get(key)!
              host.hide(target)
              hidden.add(target)
            }
          }
        } catch {
          captureError = 'unsupported-target'
        }
        const result = change() as unknown
        if (result && typeof (result as { then?: unknown }).then === 'function')
          throw new TypeError(
            'Shared layout mutations must be synchronous; await data before transitioning.',
          )
        if (captureError || !flights.size)
          finish({ status: 'unavailable', reason: captureError ?? 'missing-source' })
        else if (host.reduced()) finish({ status: 'cancelled', reason: 'reduced-motion' })
        else host.scheduler.add(task)
      } catch (error) {
        finish({ status: 'cancelled', reason: 'cancelled' })
        throw error
      }
      return handle
    },
    cancel: () => cancel(),
    pause() {
      if (!disposed) {
        paused = true
        cancel('suspended')
      }
    },
    play() {
      if (!disposed) paused = false
    },
    suspend() {
      controller.pause()
    },
    resume() {
      controller.play()
    },
    dispose() {
      if (disposed) return
      disposed = true
      try {
        cancel('unloaded')
        removeStage()
      } finally {
        attached.clear()
        unwatch()
        document.removeEventListener('visibilitychange', visibility)
        host.forget()
      }
    },
  }
  return controller
}
