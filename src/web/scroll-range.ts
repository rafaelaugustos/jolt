import type { FrameScheduler, FrameTask } from './scheduler.js'
import type { WebScrollSource } from './scroll.js'

export type WebScrollEdge = 'start' | 'center' | 'end'
/** Element edge followed by viewport edge, in the selected axis's reading direction. */
export type WebScrollAlignment = `${WebScrollEdge} ${WebScrollEdge}`
export interface WebElementScrollRange {
  element: HTMLElement
  /** Defaults to 'start end': the element starts entering the viewport. */
  start?: WebScrollAlignment
  /** Defaults to 'end start': the element finishes leaving the viewport. */
  end?: WebScrollAlignment
}

const edges = { start: 0, center: 0.5, end: 1 }
function alignment(value: string) {
  if (typeof value !== 'string') throw new TypeError('Scroll alignments must be strings.')
  const parts = value.split(' ')
  if (parts.length !== 2 || parts.some((part) => !Object.hasOwn(edges, part)))
    throw new TypeError('Scroll alignment needs two edges: start, center or end.')
  return parts.map((part) => edges[part as WebScrollEdge]) as [number, number]
}

/** Event-driven layout tracking. It never polls a settled page or replaces a binding. */
export class ElementScrollRange {
  private readonly view: Window & typeof globalThis
  private readonly viewport: HTMLElement
  private readonly start: [number, number]
  private readonly end: [number, number]
  private readonly element: HTMLElement
  private ended = false
  private resize?: ResizeObserver
  private mutations?: MutationObserver
  private observed = new Set<Element>()
  private queued?: readonly [number, number]
  private readonly task: FrameTask
  private readonly invalidate: () => void

  constructor(
    private readonly document: Document,
    private readonly source: WebScrollSource,
    private readonly axis: 'x' | 'y',
    options: WebElementScrollRange,
    private readonly scheduler: FrameScheduler,
  ) {
    this.view = document.defaultView as Window & typeof globalThis
    if (
      !options ||
      typeof options !== 'object' ||
      Object.keys(options).some((key) => !['element', 'start', 'end'].includes(key)) ||
      !(options.element instanceof this.view.HTMLElement)
    )
      throw new TypeError(
        'An element scroll range needs element and optional start/end alignments.',
      )
    this.element = options.element
    this.viewport = (
      source === document ? document.scrollingElement : source
    ) as HTMLElement
    this.start = alignment(options.start ?? 'start end')
    this.end = alignment(options.end ?? 'end start')
    this.task = {}
    this.invalidate = () => {
      if (!this.ended) scheduler.add(this.task)
    }
  }

  measure(): readonly [number, number] {
    const element = this.element,
      viewport = this.viewport
    if (
      !(viewport instanceof this.view.HTMLElement) ||
      !viewport.isConnected ||
      viewport.ownerDocument !== this.document ||
      !element.isConnected ||
      element.ownerDocument !== this.document ||
      element === viewport ||
      !viewport.contains(element)
    )
      throw new TypeError(
        'The scroll range element must remain mounted inside its scroll source.',
      )
    // A transformed/sticky anchor would feed its moving pose back into its own range.
    for (let node: HTMLElement | null = element; node; node = node.parentElement) {
      const css = this.view.getComputedStyle(node)
      if (
        css.position === 'fixed' ||
        css.position === 'sticky' ||
        css.perspective !== 'none' ||
        (parseFloat(css.zoom) || 1) !== 1 ||
        !new this.view.DOMMatrix(css.transform === 'none' ? undefined : css.transform)
          .isIdentity ||
        [css.translate, css.rotate, css.scale].some((value) => value !== 'none')
      )
        throw new TypeError(
          'Element scroll ranges need an untransformed, non-sticky layout anchor and ancestors. Animate a child instead.',
        )
      if (
        node !== element &&
        node !== viewport &&
        viewport.contains(node) &&
        (this.axis === 'y'
          ? node.scrollHeight > node.clientHeight
          : node.scrollWidth > node.clientWidth) &&
        /auto|scroll|hidden/.test(this.axis === 'y' ? css.overflowY : css.overflowX)
      )
        throw new TypeError(
          'An element scroll range cannot cross another scroll container.',
        )
    }
    const rect = element.getBoundingClientRect(),
      box = viewport.getBoundingClientRect()
    const horizontal = this.axis === 'x'
    const rtl = horizontal && this.view.getComputedStyle(viewport).direction === 'rtl'
    const documentSource = this.source === this.document
    const extent = horizontal ? rect.width : rect.height
    const size = horizontal ? viewport.clientWidth : viewport.clientHeight
    const left = documentSource ? 0 : box.left + viewport.clientLeft
    const top = documentSource ? 0 : box.top + viewport.clientTop
    const offset = horizontal ? viewport.scrollLeft * (rtl ? -1 : 1) : viewport.scrollTop
    const position =
      offset +
      (horizontal ? (rtl ? left + size - rect.right : rect.left - left) : rect.top - top)
    const resolve = ([local, visible]: [number, number]) =>
      position + extent * local - size * visible
    const range = [resolve(this.start), resolve(this.end)] as const
    if (
      range.some((n) => !Number.isFinite(n) || Math.abs(n) > 1e9) ||
      range[1] <= range[0]
    )
      throw new RangeError(
        'Element scroll alignments must produce an increasing finite range.',
      )
    return range
  }

  observe(
    changed: (range: readonly [number, number]) => void,
    failed: (error: unknown) => void,
  ) {
    const refresh = () => {
      if (this.ended) return
      try {
        this.watchBoxes()
        this.queued = this.measure()
      } catch (error) {
        this.dispose()
        failed(error)
      }
    }
    this.task.read = refresh
    this.task.write = () => {
      if (this.ended || !this.queued) return
      const range = this.queued
      this.queued = undefined
      try {
        changed(range)
      } catch (error) {
        this.dispose()
        failed(error)
      }
    }
    this.resize = new this.view.ResizeObserver(this.invalidate)
    // Ignore paint-only inline writes, including Jolt's scheduler fallback.
    const style = this.document.createElement('span').style
    const signature = (text: string, anchorPath: boolean) => {
      style.cssText = text
      return Array.from(style)
        .filter(
          (name) =>
            name.startsWith('--') ||
            /^(width|height|min-|max-|display|position|inset|top|right|bottom|left|margin|padding|border.*width|box-sizing|font|line-height|letter-spacing|white-space|word-|text-|flex|grid|gap|align|justify|order|overflow|writing-mode|direction|zoom)/.test(
              name,
            ) ||
            (anchorPath && /^(transform|translate|rotate|scale|perspective)/.test(name)),
        )
        .sort()
        .map(
          (name) =>
            `${name}:${style.getPropertyValue(name)}!${style.getPropertyPriority(name)}`,
        )
        .join(';')
    }
    this.mutations = new this.view.MutationObserver((records) => {
      if (
        records.some((record) => {
          if (record.type !== 'attributes' || record.attributeName !== 'style')
            return true
          const node = record.target as Element
          const anchorPath = node === this.element || node.contains(this.element)
          return (
            signature(record.oldValue ?? '', anchorPath) !==
            signature(node.getAttribute('style') ?? '', anchorPath)
          )
        })
      )
        this.invalidate()
    })
    this.mutations.observe(this.viewport, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeOldValue: true,
    })
    for (
      let ancestor = this.viewport.parentElement;
      ancestor;
      ancestor = ancestor.parentElement
    )
      this.mutations.observe(ancestor, { attributes: true, attributeOldValue: true })
    this.watchBoxes()
    this.view.addEventListener('resize', this.invalidate)
    this.document.fonts?.addEventListener('loadingdone', this.invalidate)
  }
  private watchBoxes() {
    const wanted = new Set<Element>([this.element, this.viewport])
    for (
      let node: HTMLElement | null = this.element.parentElement;
      node;
      node = node.parentElement
    ) {
      wanted.add(node)
      for (const sibling of node.children) wanted.add(sibling)
      if (node === this.viewport) break
    }
    for (const node of this.observed) if (!wanted.has(node)) this.resize?.unobserve(node)
    for (const node of wanted) if (!this.observed.has(node)) this.resize?.observe(node)
    this.observed = wanted
  }
  dispose() {
    if (this.ended) return
    this.ended = true
    this.resize?.disconnect()
    this.mutations?.disconnect()
    this.observed.clear()
    this.scheduler.remove(this.task)
    this.view.removeEventListener('resize', this.invalidate)
    this.document.fonts?.removeEventListener('loadingdone', this.invalidate)
  }
}
