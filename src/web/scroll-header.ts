import {
  headerGeometry,
  resizedOffset,
  type ScrollHeaderGeometry,
} from '../core/scroll-header.js'
import { constrain } from '../core/gesture-math.js'
import { itemKeys, type ReorderKey } from '../core/reorder.js'
import {
  cleanupResources,
  inputBlocked,
  inputEvents,
  ownAttribute,
  type InteractionHost,
  type WebInteraction,
} from './interaction.js'
import type { WebBinding } from './value.js'
import type { WebGestures } from './gestures.js'
import type { FrameTask } from './scheduler.js'
export interface WebHeaderItem {
  key: ReorderKey
  target: HTMLElement
}
export interface WebRefreshContext {
  readonly cancelled: boolean
  /** Guard invocation and anchor restoration; async callbacks must also check cancelled before their own writes. */
  commit(change: () => void | Promise<void>): Promise<boolean>
}
export interface WebScrollHeaderOptions {
  header: HTMLElement
  artwork?: HTMLElement
  title?: HTMLElement
  toolbarTitle?: HTMLElement
  section?: HTMLElement
  /** Defaults to measured header height; a function supports responsive geometry. */
  expanded?: number | (() => number)
  minimum: number | (() => number)
  parallax?: number
  titleFade?: readonly [number, number]
  toolbarFade?: readonly [number, number]
  items?: () => readonly WebHeaderItem[]
  /** Input ancestor, or the scroll source itself. */
  inputSurface?: HTMLElement
  onRefresh?: (context: WebRefreshContext) => void | Promise<void>
  onRefreshError?: (error: unknown) => void
  refreshThreshold?: number
}
export interface WebScrollHeader extends WebInteraction {
  readonly geometry: Readonly<ScrollHeaderGeometry>
  readonly state: Readonly<{
    offset: number
    progress: number
    pull: number
    refreshing: boolean
    error: unknown
  }>
  remeasure(): void
  preserveAnchor(change: () => void | Promise<void>): Promise<boolean>
  scrollToItem(key: ReorderKey, options?: { behavior?: ScrollBehavior }): boolean
  scrollToTop(options?: { behavior?: ScrollBehavior }): void
  refresh(): Promise<boolean>
  cancelRefresh(): void
}
function titleVisibility(target: HTMLElement | undefined) {
  if (!target) return { set(_hidden: boolean) {}, focus() {}, restore() {} }
  const original = target.getAttribute('aria-hidden'),
    inert = target.hasAttribute('inert')
  let written: string | undefined, ownInert: boolean | undefined
  let restoreFocus: (() => void) | undefined
  const clearFocus = () => {
    target.removeEventListener('blur', clearFocus)
    restoreFocus?.()
    restoreFocus = undefined
  }
  return {
    set(hidden: boolean) {
      if (written !== undefined && target.getAttribute('aria-hidden') !== written) return
      if (ownInert !== undefined && target.hasAttribute('inert') !== ownInert) return
      written = String(hidden)
      target.setAttribute('aria-hidden', written)
      ownInert = hidden || inert
      target.toggleAttribute('inert', ownInert)
    },
    focus() {
      if (target.hasAttribute('inert') || target.getAttribute('aria-hidden') === 'true')
        return
      if (!target.hasAttribute('tabindex')) {
        restoreFocus = ownAttribute(target, 'tabindex', '-1')
        target.addEventListener('blur', clearFocus)
      }
      target.focus({ preventScroll: true })
    },
    restore() {
      clearFocus()
      if (target.getAttribute('aria-hidden') === written) {
        if (original === null) target.removeAttribute('aria-hidden')
        else target.setAttribute('aria-hidden', original)
      }
      if (target.hasAttribute('inert') === ownInert)
        target.toggleAttribute('inert', inert)
    },
  }
}
export function createScrollHeader(
  source: HTMLElement,
  options: WebScrollHeaderOptions,
  host: InteractionHost,
): WebScrollHeader {
  if (!options || typeof options !== 'object')
    throw new TypeError('Expected scroll header options.')
  const document = source.ownerDocument,
    view = document.defaultView! as Window & typeof globalThis
  const surfaces = [
    options.header,
    options.artwork,
    options.title,
    options.toolbarTitle,
    options.section,
  ].filter((x): x is HTMLElement => !!x)
  if (
    !(options.header instanceof view.HTMLElement) ||
    surfaces.some(
      (el) => el.ownerDocument !== document || !el.isConnected || el === source,
    )
  )
    throw new TypeError(
      'Header surfaces must be connected, distinct from the scroll source and in its document.',
    )
  if (options.title && options.title === options.toolbarTitle)
    throw new TypeError('Expanded and compact titles must be distinct.')
  const threshold = options.refreshThreshold ?? 80
  if (!Number.isFinite(threshold) || threshold <= 0)
    throw new RangeError('Refresh threshold must be positive.')
  for (const fn of [options.items, options.onRefresh, options.onRefreshError])
    if (fn !== undefined && typeof fn !== 'function')
      throw new TypeError('Header callbacks must be functions.')
  const readGeometry = () => {
    const resolve = (value: number | (() => number) | undefined, fallback: number) =>
      typeof value === 'function' ? value() : (value ?? fallback)
    const expanded = resolve(options.expanded, options.header.offsetHeight),
      minimum = resolve(options.minimum, 0)
    return headerGeometry(
      expanded,
      minimum,
      options.section?.offsetHeight ?? 0,
      1,
      options.parallax ?? (expanded - minimum) * 0.3,
      0,
      options.titleFade,
      options.toolbarFade,
    )
  }
  let geometry = readGeometry(),
    disposed = false,
    paused = false,
    error: unknown,
    version = 0,
    anchorVersion = 0
  let request:
    | {
        version: number
        promise: Promise<boolean>
        cancelled: boolean
        finish(value: boolean): void
      }
    | undefined
  const offset = host.scrollValue(source),
    pull = host.motionValue(0),
    translate = host.motionValue(0),
    artwork = host.motionValue(0),
    title = host.motionValue(1),
    toolbar = host.motionValue(0)
  const values = [offset, pull, translate, artwork, title, toolbar],
    bindings: WebBinding[] = [],
    restores: (() => void)[] = []
  const expandedTitle = titleVisibility(options.title),
    compactTitle = titleVisibility(options.toolbarTitle)
  const spacer = document.createElement('div')
  spacer.setAttribute('aria-hidden', 'true')
  spacer.dataset.joltHeaderSpacer = ''
  spacer.style.cssText = 'flex:none;pointer-events:none;'
  const events = inputEvents(source),
    layer = host.layer('header')
  let gesture: WebGestures | undefined,
    lastCompact = false
  const rows = () => {
    const items = [...(options.items?.() ?? [])]
    itemKeys(items, (item) => item.key)
    if (
      new Set(items.map((row) => row.target)).size !== items.length ||
      items.some(
        (row) =>
          !(row.target instanceof view.HTMLElement) ||
          !source.contains(row.target) ||
          !row.target.isConnected,
      )
    )
      throw new TypeError('Header items require unique connected descendants.')
    return items
  }
  const fade = (p: number, interval: readonly [number, number]) =>
    constrain((p - interval[0]) / (interval[1] - interval[0]), 0, 1)
  const update = () => {
    if (disposed || paused) return
    const y = offset.get(),
      progress = constrain(y / geometry.range, 0, 1),
      drag = gesture?.position.y ?? 0
    pull.set(drag)
    translate.set(-Math.min(geometry.range, Math.max(0, y)) + drag)
    artwork.set(host.reduced() ? 0 : progress * geometry.parallax)
    title.set(1 - fade(progress, geometry.titleFade))
    toolbar.set(fade(progress, geometry.toolbarFade))
    const compact = progress >= geometry.focusHandoff
    const old = compact ? options.title : options.toolbarTitle
    const transferFocus = compact !== lastCompact && old?.contains(document.activeElement)
    // Update our visibility ownership before moving focus; mutating inert outside
    // that owner would look like an application override and strand aria-hidden.
    expandedTitle.set(compact)
    compactTitle.set(!compact)
    if (compact !== lastCompact) {
      if (transferFocus) (compact ? compactTitle : expandedTitle).focus()
      lastCompact = compact
    }
  }
  const task: FrameTask = { update }
  const schedule = () => {
    if (!paused && !disposed) host.scheduler.add(task)
  }
  const snapshotAnchor = () => {
    const items = rows(),
      edge = source.getBoundingClientRect().top + geometry.minimum + geometry.section
    const index = items.findIndex(
      (item) => item.target.getBoundingClientRect().bottom > edge,
    )
    const row = items[Math.max(0, index)]
    return row
      ? {
          key: row.key,
          index: Math.max(0, index),
          top: row.target.getBoundingClientRect().top,
        }
      : undefined
  }
  const preserve = async (
    change: () => void | Promise<void>,
    valid: () => boolean = () => true,
  ) => {
    if (disposed || !valid()) return false
    if (typeof change !== 'function')
      throw new TypeError('Expected an anchor-preserving change.')
    const saved = snapshotAnchor(),
      generation = ++anchorVersion
    await change()
    if (disposed || !valid() || generation !== anchorVersion) return false
    measure(false)
    if (saved) {
      const items = rows(),
        row =
          items.find((row) => row.key === saved.key) ??
          items[Math.min(saved.index, items.length - 1)]
      if (row) source.scrollTop += row.target.getBoundingClientRect().top - saved.top
    }
    offset.refresh()
    schedule()
    return true
  }
  const measure = (preserveOffset = true) => {
    if (disposed) return
    const next = readGeometry(),
      before = geometry,
      current = source.scrollTop
    geometry = next
    spacer.style.height = `${next.spacer}px`
    for (const surface of surfaces) host.refresh(surface)
    if (preserveOffset) source.scrollTop = resizedOffset(current, before, next)
    offset.refresh()
    schedule()
  }
  const measureTask: FrameTask = { read: () => measure() }
  const resize = new view.ResizeObserver(() => {
    if (!disposed && !paused) host.scheduler.add(measureTask)
  })
  const cancelRefresh = () => {
    version++
    if (request) {
      request.cancelled = true
      request.finish(false)
    }
    request = undefined
    if (!disposed && paused) gesture?.jumpTo({ y: 0 })
    if (!disposed && !paused) {
      gesture?.play()
      gesture?.settleTo({ y: 0 })
    }
    schedule()
  }
  const handle: WebScrollHeader = {
    get geometry() {
      return { ...geometry }
    },
    get state() {
      return {
        offset: offset.get(),
        progress: constrain(offset.get() / geometry.range, 0, 1),
        pull: gesture?.position.y ?? 0,
        refreshing: !!request,
        error,
      }
    },
    get paused() {
      return paused
    },
    get disposed() {
      return disposed
    },
    remeasure() {
      if (!disposed) host.scheduler.add(measureTask)
    },
    preserveAnchor: (change) => preserve(change),
    scrollToItem(key, config = {}) {
      if (disposed) return false
      const row = rows().find((row) => row.key === key)
      if (!row) return false
      const top =
        row.target.getBoundingClientRect().top -
        source.getBoundingClientRect().top +
        source.scrollTop -
        geometry.minimum -
        geometry.section
      source.scrollTo({
        top: Math.max(0, top),
        behavior: host.reduced() ? 'instant' : (config.behavior ?? 'auto'),
      })
      return true
    },
    scrollToTop(config = {}) {
      if (!disposed)
        source.scrollTo({
          top: 0,
          behavior: host.reduced() ? 'instant' : (config.behavior ?? 'auto'),
        })
    },
    refresh() {
      if (disposed || paused || !options.onRefresh) return Promise.resolve(false)
      if (request) return request.promise
      error = undefined
      const id = ++version
      let finish!: (value: boolean) => void
      const current = {
        version: id,
        cancelled: false,
        finish(value: boolean) {
          finish(value)
        },
        promise: new Promise<boolean>((resolve) => {
          finish = resolve
        }),
      }
      request = current
      const valid = () =>
        !disposed && !current.cancelled && request === current && version === id
      const context: WebRefreshContext = {
        get cancelled() {
          return !valid()
        },
        commit: (change) => preserve(change, valid),
      }
      gesture?.jumpTo({ y: threshold })
      gesture?.pause()
      schedule()
      void Promise.resolve()
        .then(() => (valid() ? options.onRefresh!(context) : undefined))
        .then(
          () => {
            if (!valid()) {
              finish(false)
              return
            }
            request = undefined
            gesture?.play()
            gesture?.settleTo({ y: 0 })
            schedule()
            finish(true)
          },
          (reason) => {
            if (valid()) {
              error = reason
              request = undefined
              gesture?.play()
              gesture?.settleTo({ y: 0 })
              schedule()
              try {
                options.onRefreshError?.(reason)
              } catch (callback) {
                host.error(callback)
              }
            }
            finish(false)
          },
        )
      return current.promise
    },
    cancelRefresh,
    cancel() {
      gesture?.cancel()
      cancelRefresh()
    },
    pause() {
      if (disposed || paused) return
      paused = true
      cancelRefresh()
      gesture?.pause()
      host.scheduler.remove(task)
      host.scheduler.remove(measureTask)
    },
    play() {
      if (disposed || !paused) return
      paused = false
      gesture?.play()
      measure()
    },
    dispose() {
      if (disposed) return
      disposed = true
      version++
      anchorVersion++
      if (request) {
        request.cancelled = true
        request.finish(false)
      }
      request = undefined
      host.scheduler.remove(task)
      host.scheduler.remove(measureTask)
      resize.disconnect()
      events.dispose()
      cleanupResources([
        () => gesture?.dispose(),
        ...restores.reverse(),
        ...bindings.reverse().map((binding) => () => binding.dispose()),
        ...values.map((value) => () => value.dispose()),
        () => expandedTitle.restore(),
        () => compactTitle.restore(),
        () => spacer.remove(),
      ])
    },
  }
  try {
    source.prepend(spacer)
    spacer.style.height = `${geometry.spacer}px`
    bindings.push(host.bindLayer(options.header, { y: translate }, layer))
    if (options.section)
      bindings.push(host.bindLayer(options.section, { y: translate }, layer))
    if (options.artwork)
      bindings.push(host.bindLayer(options.artwork, { y: artwork }, layer))
    if (options.title)
      bindings.push(host.bindLayer(options.title, { opacity: title }, layer))
    if (options.toolbarTitle)
      bindings.push(host.bindLayer(options.toolbarTitle, { opacity: toolbar }, layer))
    if (options.onRefresh) {
      gesture = host.gestures(options.inputSurface ?? source, {
        pan: { axis: 'y', bounds: { top: 0, bottom: threshold * 1.8 } },
        scroll: { element: source },
        onEnd() {
          if (gesture!.position.y >= threshold) void handle.refresh()
          else gesture!.settleTo({ y: 0 })
        },
      })
      restores.push(gesture.y.subscribe(schedule))
    }
    restores.push(offset.subscribe(schedule), host.onReduced(schedule))
    const refresh = () => {
      if (
        !source.isConnected ||
        source.ownerDocument !== document ||
        surfaces.some((node) => !node.isConnected)
      )
        handle.dispose()
      else if (inputBlocked(source)) handle.cancel()
    }
    restores.push(host.register(source, handle, refresh))
    for (const node of new Set([source, ...surfaces])) resize.observe(node)
    events.on(document, 'visibilitychange', () => {
      if (document.hidden) handle.cancel()
    })
    events.on(source, 'scroll', schedule)
    rows()
    update()
  } catch (reason) {
    handle.dispose()
    throw reason
  }
  return handle
}
