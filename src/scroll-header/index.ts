import {
  Application,
  ListView,
  Label,
  LayoutBase,
  View,
  Trace,
  isIOS,
} from '@nativescript/core'
import { bind, motionValue, springValue, type SpringValue } from '../motion-value.js'
import { set } from '../animate.js'
import { reducedMotion, onReducedMotion } from '../config.js'
import { getDriver } from '../driver/index.js'
import {
  createScrollHeaderDriver,
  type ScrollHeaderDriver,
  type ScrollHeaderSnapshot,
} from './native.js'
import {
  headerGeometry,
  resizedOffset,
  restoredOffset,
  type ScrollHeaderGeometry,
} from './geometry.js'
export type { ScrollHeaderGeometry, ScrollHeaderSnapshot }

export interface ScrollHeaderOptions {
  /** Retained overlay siblings of the list. The header owns artwork/title descendants. */
  header: LayoutBase
  artwork: View
  title: View
  toolbar: View
  toolbarTitle: View
  section: View
  /** Fixed data-row height in DIPs. Row zero is a separate, non-accessible spacer. */
  rowHeight: number
  /** Update only spacer row zero, then refresh the list. Called at layout boundaries. */
  setSpacerHeight(height: number): void
  /** Original spacer height to restore at disposal; defaults to zero. */
  originalSpacerHeight?: number
  expandedHeight?: number
  minimumHeight?: number
  parallax?: number
  /** Fractions of the collapse range, from zero to one. */
  titleFade?: readonly [number, number]
  toolbarFade?: readonly [number, number]
  /** iOS bounce stretches artwork. Android ListView uses its ordinary no-stretch behavior. */
  stretch?: boolean
  /** Stable data keys, excluding spacer row zero. Required by preserveAnchor(). */
  keys?: () => readonly string[]
  diagnostic?: Label
  onState?: (state: ScrollHeaderSnapshot) => void
}
export interface ScrollHeader {
  readonly ready: boolean
  readonly disposed: boolean
  readonly state: ScrollHeaderSnapshot
  readonly geometry: ScrollHeaderGeometry | undefined
  remeasure(): Promise<void>
  preserveAnchor(change: () => void | Promise<void>): Promise<void>
  /** Data index, excluding spacer. Aligns below the compact toolbar and pinned section. */
  scrollToItem(index: number, animated?: boolean): void
  scrollToTop(animated?: boolean): void
  pause(): void
  play(): void
  dispose(): void
}
const owners = new WeakMap<ListView, ScrollHeader>()
const descendant = (view: View, parent: View) => {
  for (let current: View['parent'] = view; current; current = current.parent)
    if (current === parent) return true
  return false
}
const initialState = (): ScrollHeaderSnapshot => ({
  offset: 0,
  minimumOffset: 0,
  maximumOffset: 0,
  phase: 'expanded',
  updates: 0,
  callbacks: 0,
  first: 0,
  visible: 0,
  total: 0,
})

/** Core ListView adapter: one spacer, fixed data rows, retained header/toolbar/section. */
export function scrollHeader(list: ListView, options: ScrollHeaderOptions): ScrollHeader {
  if (
    !(list instanceof ListView) ||
    list.sectioned ||
    list.stickyHeader ||
    list.showSearch
  )
    throw new TypeError(
      'scrollHeader requires a flat Core ListView without built-in sticky headers or search.',
    )
  if (!options || typeof options.setSpacerHeight !== 'function')
    throw new TypeError('Provide setSpacerHeight() for list row zero.')
  if (options.diagnostic !== undefined && !(options.diagnostic instanceof Label))
    throw new TypeError('diagnostic must be a Core Label.')
  const { header, artwork, title, toolbar, toolbarTitle, section } = options
  if (
    ![header, artwork, title, toolbar, toolbarTitle, section].every(
      (view) => view instanceof View,
    ) ||
    !(list.parent instanceof LayoutBase) ||
    !(header instanceof LayoutBase) ||
    ![header, toolbar, section].every((view) => view.parent === list.parent) ||
    !descendant(artwork, header) ||
    !descendant(title, header) ||
    !descendant(toolbarTitle, toolbar) ||
    new Set([list, header, artwork, title, toolbar, toolbarTitle, section]).size !== 7
  )
    throw new TypeError(
      'Use distinct retained header, toolbar and section siblings with artwork/title descendants.',
    )
  for (const key of ['rowHeight', 'expandedHeight', 'minimumHeight'] as const)
    if (
      options[key] !== undefined &&
      (!Number.isFinite(options[key]) || options[key]! <= 0)
    )
      throw new RangeError(`${key} must be positive and finite.`)
  if (!Number.isFinite(options.rowHeight) || options.rowHeight <= 0)
    throw new RangeError('rowHeight must be positive and finite.')
  for (const key of ['parallax', 'originalSpacerHeight'] as const)
    if (
      options[key] !== undefined &&
      (!Number.isFinite(options[key]) || options[key]! < 0)
    )
      throw new RangeError(`${key} must be finite and nonnegative.`)
  if (options.stretch !== undefined && typeof options.stretch !== 'boolean')
    throw new TypeError('stretch must be boolean.')
  for (const callback of [options.keys, options.onState])
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Scroll header callbacks must be functions.')
  owners.get(list)?.dispose()
  const host = list.parent
  const saved = {
    clip: host.clipToBounds,
    headerClip: header.clipToBounds,
    headerY: header.translateY,
    titleY: title.translateY,
    titleOpacity: title.opacity,
    artworkY: artwork.translateY,
    scaleX: artwork.scaleX,
    scaleY: artwork.scaleY,
    originY: artwork.originY,
    toolbarOpacity: toolbar.opacity,
    sectionY: section.translateY,
  }
  let geometry: ScrollHeaderGeometry | undefined,
    native: ScrollHeaderDriver | undefined,
    value: SpringValue | undefined
  let ended = false,
    held = false,
    background = false,
    queued = false,
    revision = 0
  let measuring: Promise<void> | undefined,
    operation = false
  let detachBindings: (() => void)[] = [],
    pending = new Set<() => void>(),
    last = initialState()
  const notify = () => {
    if (ended) return
    last = native?.snapshot() ?? last
    try {
      options.onState?.(last)
    } catch (error) {
      Trace.write(String(error), 'Jolt', Trace.messageType.error)
    }
  }
  const layout = (view: View) =>
    new Promise<void>((resolve, reject) => {
      let release: (() => void) | undefined,
        done = false
      const finish = (error?: Error) => {
        if (done) return
        done = true
        clearTimeout(timer)
        release?.()
        pending.delete(cancel)
        if (error) reject(error)
        else resolve()
      }
      const cancel = () => finish(new Error('Scroll header layout was cancelled.'))
      const timer = setTimeout(
        () => finish(new Error('Scroll header layout timed out.')),
        1500,
      )
      pending.add(cancel)
      const driver = getDriver()
      if (!driver.afterLayout) {
        finish(new Error('Native layout is unavailable.'))
        return
      }
      release = driver.afterLayout(view, () => finish())
      if (done) release?.()
      else view.requestLayout()
    }).then(() => {
      if (isIOS) view.nativeViewProtected?.layoutIfNeeded?.()
    })
  const maps = () => {
    if (!value || !geometry) return
    detachBindings.splice(0).forEach((off) => off())
    const q = value,
      g = geometry,
      r = g.range,
      quiet = reducedMotion(),
      stretch = !quiet && options.stretch !== false && isIOS
    detachBindings = [
      bind(header, {
        y: q.to(
          [-10000, 0, r],
          [saved.headerY + 10000, saved.headerY, saved.headerY - r],
        ),
      }),
      bind(section, {
        y: q.to([-10000, 0, r], [g.expanded + 10000, g.expanded, g.minimum]),
      }),
      bind(title, {
        opacity: quiet
          ? q.to(
              [
                0,
                r * g.handoff,
                r * g.handoff + Math.min(0.01, (r * (1 - g.handoff)) / 2),
                r,
              ],
              [saved.titleOpacity, saved.titleOpacity, 0, 0],
            )
          : q.to(
              g.titleFade.map((f) => f * r),
              [saved.titleOpacity, 0],
            ),
        y: q.to([0, r], [saved.titleY, saved.titleY]),
      }),
      bind(toolbar, {
        opacity: quiet
          ? q.to(
              [
                0,
                r * g.handoff,
                r * g.handoff + Math.min(0.01, (r * (1 - g.handoff)) / 2),
                r,
              ],
              [0, 0, saved.toolbarOpacity, saved.toolbarOpacity],
            )
          : q.to(
              g.toolbarFade.map((f) => f * r),
              [0, saved.toolbarOpacity],
            ),
      }),
      bind(artwork, {
        y: q.to(
          [-10000, 0, r],
          [
            saved.artworkY - (stretch ? 10000 : 0),
            saved.artworkY,
            saved.artworkY + (quiet ? 0 : g.parallax),
          ],
        ),
        scaleX: q.to(
          [-10000, 0],
          [
            saved.scaleX *
              (1 + (stretch ? 10000 / Math.max(1, artwork.getActualSize().height) : 0)),
            saved.scaleX,
          ],
        ),
        scaleY: q.to(
          [-10000, 0],
          [
            saved.scaleY *
              (1 + (stretch ? 10000 / Math.max(1, artwork.getActualSize().height) : 0)),
            saved.scaleY,
          ],
        ),
      }),
    ]
  }
  const measure = async () => {
    if (ended || !list.isLoaded || !header.isLoaded) return
    const generation = revision
    await layout(host)
    if (ended || generation !== revision) return
    const expanded = options.expandedHeight ?? header.getActualSize().height
    const minimum = options.minimumHeight ?? toolbar.getActualSize().height
    const divider = isIOS
      ? 0
      : list.android.getDividerHeight() /
        list.android.getResources().getDisplayMetrics().density
    const next = headerGeometry(
      expanded,
      minimum,
      section.getActualSize().height,
      isIOS
        ? options.rowHeight
        : Math.round(
            options.rowHeight * list.android.getResources().getDisplayMetrics().density,
          ) / list.android.getResources().getDisplayMetrics().density,
      options.parallax ?? Math.min(64, (expanded - minimum) * 0.25),
      divider,
      options.titleFade,
      options.toolbarFade,
    )
    if (geometry && JSON.stringify(next) === JSON.stringify(geometry) && native) return
    const before = geometry,
      offset = native?.snapshot().offset ?? (last.updates ? last.offset : undefined)
    geometry = next
    native?.enabled(false)
    try {
      native?.configure(next, reducedMotion())
      options.setSpacerHeight(next.spacer)
      await layout(list)
      if (ended || generation !== revision) return
      value ??= springValue(motionValue(0), { duration: 0 })
      maps()
      if (!native)
        native = createScrollHeaderDriver(
          list,
          value,
          { title, toolbarTitle, toolbar, diagnostic: options.diagnostic },
          next,
          reducedMotion(),
          () => {
            void Promise.resolve().then(notify)
          },
        )
      if (offset !== undefined)
        native.scroll(before ? resizedOffset(offset, before, next) : offset, false)
      native.enabled(!held && !background)
      notify()
    } finally {
      native?.enabled(!held && !background)
    }
  }
  const queueMeasure = () => {
    if (ended || queued || measuring || operation) return
    queued = true
    void Promise.resolve()
      .then(() => {
        queued = false
        return control.remeasure()
      })
      .catch((error) => {
        if (!ended && list.isLoaded)
          Trace.write(`Scroll header: ${String(error)}`, 'Jolt', Trace.messageType.error)
      })
  }
  const detach = () => {
    revision++
    for (const cancel of [...pending]) cancel()
    last = native?.snapshot() ?? last
    native?.dispose()
    native = undefined
    detachBindings.splice(0).forEach((off) => off())
    value?.dispose()
    value = undefined
  }
  const suspend = () => {
    background = true
    native?.enabled(false)
  }
  const resume = () => {
    background = false
    native?.enabled(!held)
    queueMeasure()
  }
  const offMotion = onReducedMotion(() => {
    maps()
    if (geometry) native?.configure(geometry, reducedMotion())
  })
  const control: ScrollHeader = {
    get ready() {
      return !!native && !ended
    },
    get disposed() {
      return ended
    },
    get state() {
      return native?.snapshot() ?? last
    },
    get geometry() {
      return geometry
    },
    remeasure() {
      if (measuring) return measuring
      measuring = measure().finally(() => {
        measuring = undefined
      })
      return measuring
    },
    async preserveAnchor(change) {
      if (ended || !native || !geometry)
        throw new Error('Wait for scrollHeader to be ready.')
      if (operation) throw new Error('A scroll anchor update is already in progress.')
      if (!options.keys || typeof change !== 'function')
        throw new TypeError('preserveAnchor requires keys() and an update callback.')
      const before = geometry,
        offset = native.snapshot().offset,
        keys = [...options.keys()]
      if (
        new Set(keys).size !== keys.length ||
        keys.some((key) => typeof key !== 'string' || !key)
      )
        throw new TypeError('Data keys must be unique nonempty strings.')
      const index = Math.min(
          Math.max(
            0,
            Math.floor(
              (offset - before.range - before.divider) /
                (before.rowHeight + before.divider),
            ),
          ),
          Math.max(0, keys.length - 1),
        ),
        key = keys[index]
      operation = true
      native.enabled(false)
      try {
        await change()
        await layout(list)
        if (ended || !native) return
        const next = [...options.keys()]
        if (
          new Set(next).size !== next.length ||
          next.some((key) => typeof key !== 'string' || !key)
        )
          throw new TypeError('Data keys must remain unique.')
        const found = next.indexOf(key!),
          destination = found >= 0 ? found : Math.min(index, Math.max(0, next.length - 1))
        native.scroll(
          restoredOffset(offset, before, geometry!, index, destination),
          false,
        )
        await layout(list)
        if (!ended) notify()
      } finally {
        operation = false
        native?.enabled(!held && !background)
        queueMeasure()
      }
    },
    scrollToItem(index, animated = false) {
      if (!Number.isSafeInteger(index) || index < 0)
        throw new RangeError('Use a nonnegative data-item index.')
      if (geometry)
        native?.scroll(
          geometry.range +
            geometry.divider +
            index * (geometry.rowHeight + geometry.divider),
          animated && !reducedMotion(),
        )
    },
    scrollToTop(animated = false) {
      native?.scroll(0, animated && !reducedMotion())
    },
    pause() {
      held = true
      native?.enabled(false)
    },
    play() {
      held = false
      native?.enabled(!background)
    },
    dispose() {
      if (ended) return
      ended = true
      detach()
      offMotion()
      for (const view of [list, header, toolbar, section, host]) {
        view.off('loaded', queueMeasure)
        view.off('layoutChanged', queueMeasure)
      }
      list.off('unloaded', detach)
      Application.off(Application.suspendEvent, suspend)
      Application.off(Application.resumeEvent, resume)
      set(header, { y: saved.headerY })
      set(title, { y: saved.titleY, opacity: saved.titleOpacity })
      set(toolbar, { opacity: saved.toolbarOpacity })
      set(section, { y: saved.sectionY })
      set(artwork, { y: saved.artworkY, scaleX: saved.scaleX, scaleY: saved.scaleY })
      artwork.originY = saved.originY
      host.clipToBounds = saved.clip
      header.clipToBounds = saved.headerClip
      options.setSpacerHeight(options.originalSpacerHeight ?? 0)
      if (owners.get(list) === control) owners.delete(list)
    },
  }
  owners.set(list, control)
  host.clipToBounds = true
  if (isIOS) header.clipToBounds = false
  artwork.originY = 0
  for (const view of [list, header, toolbar, section, host]) {
    view.on('loaded', queueMeasure)
    view.on('layoutChanged', queueMeasure)
  }
  list.on('unloaded', detach)
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  queueMeasure()
  return control
}
