import {
  Application,
  ListView,
  ScrollView,
  Label,
  LayoutBase,
  View,
  Trace,
  isIOS,
} from '@nativescript/core'
import { bind, motionValue, springValue, type SpringValue } from '../motion-value.js'
import { set } from '../animate.js'
import { ScrollHeaderSurface } from './surface.js'
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

export interface ScrollHeaderRefreshContext {
  /** Becomes true on pause, suspension, unload, replacement or disposal. */
  readonly cancelled: boolean
  /** Apply loaded data at the current keyed scroll anchor. Stale commits are ignored. */
  commit(change: () => void | Promise<void>): Promise<boolean>
}

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
  /** One callback per accepted pull. Await commit() after loading new data. */
  onRefresh?: (context: ScrollHeaderRefreshContext) => void | Promise<void>
  onRefreshError?: (error: unknown) => void
  /** Native pull distance in DIPs; defaults to 80. */
  refreshThreshold?: number
  diagnostic?: Label
  onState?: (state: ScrollHeaderSnapshot) => void
}
export interface ScrollHeaderItem {
  key: string
  target: View
}
export interface ScrollViewHeaderOptions extends Omit<
  ScrollHeaderOptions,
  'rowHeight' | 'setSpacerHeight' | 'originalSpacerHeight' | 'keys'
> {
  /** Realized, vertically ordered rows; heights may differ. The app owns the children. */
  items(): readonly ScrollHeaderItem[]
}
export interface ScrollHeader {
  readonly ready: boolean
  readonly disposed: boolean
  readonly state: ScrollHeaderSnapshot
  readonly geometry: ScrollHeaderGeometry | undefined
  /** Coalesces concurrent calls. Resolves false on failure, cancellation or unavailable input. */
  refresh(): Promise<boolean>
  cancelRefresh(): void
  remeasure(): Promise<void>
  preserveAnchor(change: () => void | Promise<void>): Promise<void>
  /** Data index, excluding spacer. Aligns below the compact toolbar and pinned section. */
  scrollToItem(index: number, animated?: boolean): void
  scrollToTop(animated?: boolean): void
  pause(): void
  play(): void
  dispose(): void
}
const owners = new WeakMap<ListView | ScrollView, ScrollHeader>()
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
  refresh: 'idle',
  refreshRequests: 0,
  updates: 0,
  callbacks: 0,
  first: 0,
  visible: 0,
  total: 0,
})

/** Core ListView adapter: one spacer, fixed data rows, retained header/toolbar/section. */
export function scrollHeader(list: ListView, options: ScrollHeaderOptions): ScrollHeader
export function scrollHeader(
  list: ScrollView,
  options: ScrollViewHeaderOptions,
): ScrollHeader
export function scrollHeader(
  list: ListView | ScrollView,
  input: ScrollHeaderOptions | ScrollViewHeaderOptions,
): ScrollHeader {
  const scroll = list instanceof ScrollView ? list : undefined
  const items = scroll ? (input as ScrollViewHeaderOptions).items : undefined
  const content = scroll?.content as LayoutBase | undefined
  if (
    scroll &&
    (scroll.orientation !== 'vertical' ||
      !(content instanceof LayoutBase) ||
      typeof items !== 'function')
  )
    throw new TypeError(
      'scrollHeader requires a vertical ScrollView with LayoutBase content and items().',
    )
  let savedPadding = content?.paddingTop
  if (
    scroll &&
    (typeof savedPadding !== 'number' ||
      !Number.isFinite(savedPadding) ||
      savedPadding < 0)
  )
    throw new TypeError(
      'ScrollView header content needs nonnegative numeric paddingTop in DIPs.',
    )
  let writtenPadding: number | undefined
  const options: ScrollHeaderOptions = scroll
    ? {
        ...input,
        rowHeight: 1,
        keys: () => items!().map((item) => item.key),
        setSpacerHeight(height) {
          if (!content) return
          if (height === 0) {
            if (content.paddingTop === writtenPadding) content.paddingTop = savedPadding!
            writtenPadding = undefined
          } else {
            writtenPadding = (savedPadding as number) + height
            content.paddingTop = writtenPadding
          }
        },
      }
    : (input as ScrollHeaderOptions)
  if (
    !scroll &&
    (!(list instanceof ListView) ||
      list.sectioned ||
      list.stickyHeader ||
      list.showSearch)
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
  for (const key of [
    'rowHeight',
    'expandedHeight',
    'minimumHeight',
    'refreshThreshold',
  ] as const)
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
  for (const callback of [
    options.keys,
    options.onState,
    options.onRefresh,
    options.onRefreshError,
  ])
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Scroll header callbacks must be functions.')
  if (options.onRefresh && !options.keys)
    throw new TypeError('Pull-to-refresh requires keys() for current-item anchoring.')
  if (
    options.onRefresh &&
    !scroll &&
    !isIOS &&
    !(list.parent instanceof ScrollHeaderSurface)
  )
    throw new TypeError('Android pull-to-refresh requires a ScrollHeaderSurface parent.')
  if (options.onRefresh && isIOS && list.ios?.refreshControl)
    throw new TypeError(
      'Remove the app-owned iOS refreshControl before enabling onRefresh.',
    )
  owners.get(list)?.dispose()
  if (content) savedPadding = content.paddingTop
  const host = list.parent
  const realized = () => {
    if (!scroll || !content || !items) return []
    const rows = [...items()]
    if (
      rows.length > 1000 ||
      new Set(rows.map((row) => row.key)).size !== rows.length ||
      new Set(rows.map((row) => row.target)).size !== rows.length
    )
      throw new TypeError(
        'ScrollView header rows require unique keys/targets and at most 1000 realized rows.',
      )
    const measured = rows.map((row) => {
      if (
        typeof row.key !== 'string' ||
        !row.key ||
        !(row.target instanceof View) ||
        !descendant(row.target, content) ||
        !row.target.isLoaded
      )
        throw new TypeError(
          'ScrollView header rows must be mounted keyed descendants of its content.',
        )
      const position = row.target.getLocationRelativeTo(content)
      const height = row.target.getActualSize().height
      if (
        !position ||
        !Number.isFinite(position.y) ||
        !Number.isFinite(height) ||
        height <= 0
      )
        throw new RangeError(
          'Wait for nonempty row geometry before using the scroll header.',
        )
      return { ...row, top: position.y, height }
    })
    if (
      measured.some(
        (row, i) =>
          i > 0 && row.top < measured[i - 1]!.top + measured[i - 1]!.height - 0.5,
      )
    )
      throw new TypeError('ScrollView header items must be ordered nonoverlapping rows.')
    return measured
  }
  const saved = {
    clip: host.clipToBounds,
    nativeClip: isIOS ? (host.nativeViewProtected as UIView)?.clipsToBounds : undefined,
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
    ready = false,
    held = false,
    background = false,
    queued = false,
    invalidated = false,
    revision = 0
  let measuring: Promise<void> | undefined,
    restoringOffset: number | undefined,
    operation = false
  let detachBindings: (() => void)[] = [],
    pending = new Set<() => void>(),
    last = initialState()
  let refreshRun:
    | {
        cancelled: boolean
        promise: Promise<boolean>
        settle(value: boolean): void
      }
    | undefined
  const cancelRefresh = () => {
    const run = refreshRun
    refreshRun = undefined
    if (run) {
      run.cancelled = true
      run.settle(false)
    }
    native?.refreshing(false)
  }
  const notify = () => {
    if (ended || !ready) return
    last = native?.snapshot() ?? last
    if (last.refresh === 'refreshing' && !refreshRun) void control.refresh()
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
    // Core's default-valued property can be true while a plain UIView still
    // has clipping disabled. Apply it when the native host exists, too.
    if (isIOS && host.nativeViewProtected) {
      const container = host.nativeViewProtected as UIView
      saved.nativeClip ??= container.clipsToBounds
      container.clipsToBounds = true
    }
    const generation = revision
    await layout(host)
    if (ended || generation !== revision) return
    const expanded = options.expandedHeight ?? header.getActualSize().height
    const minimum = options.minimumHeight ?? toolbar.getActualSize().height
    const divider =
      isIOS || scroll
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
    if (
      ready &&
      geometry &&
      JSON.stringify(next) === JSON.stringify(geometry) &&
      native
    ) {
      if (scroll) native.rows(realized().map((row) => row.target))
      return
    }
    const before = geometry,
      offset = native?.snapshot().offset ?? (last.updates ? last.offset : undefined)
    ready = false
    native?.enabled(false)
    try {
      native?.configure(next, reducedMotion())
      options.setSpacerHeight(next.spacer)
      await layout(list)
      if (ended || generation !== revision) return
      geometry = next
      value ??= springValue(motionValue(0), { duration: 0 })
      maps()
      if (!native)
        native = createScrollHeaderDriver(
          list,
          value,
          { header, title, toolbarTitle, toolbar, diagnostic: options.diagnostic },
          next,
          reducedMotion(),
          () => {
            void Promise.resolve().then(notify)
          },
          { enabled: !!options.onRefresh, threshold: options.refreshThreshold ?? 80 },
        )
      if (scroll) native.rows(realized().map((row) => row.target))
      if (offset !== undefined) {
        restoringOffset = before ? resizedOffset(offset, before, next) : offset
        native.scroll(restoringOffset, false)
        await layout(list)
        if (ended || generation !== revision) return
      }
      native.enabled(!held && !background)
      ready = true
      notify()
    } finally {
      restoringOffset = undefined
      native?.enabled(!held && !background)
    }
  }
  const queueMeasure = () => {
    if (ended) return
    if (measuring || operation) {
      invalidated = true
      return
    }
    if (queued) return
    queued = true
    void Promise.resolve()
      .then(() => {
        queued = false
        invalidated = false
        return control.remeasure()
      })
      .catch((error) => {
        if (!ended && list.isLoaded)
          Trace.write(`Scroll header: ${String(error)}`, 'Jolt', Trace.messageType.error)
      })
  }
  const detach = () => {
    cancelRefresh()
    revision++
    ready = false
    for (const cancel of [...pending]) cancel()
    last = native?.snapshot() ?? last
    if (restoringOffset !== undefined) last = { ...last, offset: restoringOffset }
    native?.dispose()
    native = undefined
    detachBindings.splice(0).forEach((off) => off())
    value?.dispose()
    value = undefined
  }
  const suspend = () => {
    cancelRefresh()
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
      return ready && !ended
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
    refresh() {
      if (refreshRun) return refreshRun.promise
      if (ended || !ready || held || background || !native || !options.onRefresh) {
        native?.refreshing(false)
        return Promise.resolve(false)
      }
      let settle!: (value: boolean) => void
      const run = {
        cancelled: false,
        promise: new Promise<boolean>((resolve) => {
          settle = resolve
        }),
        settle: (value: boolean) => settle(value),
      }
      refreshRun = run
      native.refreshing(true)
      const context: ScrollHeaderRefreshContext = {
        get cancelled() {
          return run.cancelled
        },
        async commit(change) {
          if (run.cancelled || refreshRun !== run || ended) return false
          // A cover/font remeasurement can overlap application loading. Finish
          // that geometry boundary before capturing the new keyed anchor.
          if (measuring) await measuring
          if (run.cancelled || refreshRun !== run || ended || !ready) return false
          if (typeof change !== 'function')
            throw new TypeError('Provide a refresh commit callback.')
          await control.preserveAnchor(async () => {
            if (!run.cancelled && refreshRun === run) await change()
          })
          return !run.cancelled && refreshRun === run
        },
      }
      void Promise.resolve()
        .then(() => {
          if (!run.cancelled) return options.onRefresh!(context)
        })
        .then(
          () => finish(true),
          (error) => {
            if (!run.cancelled && refreshRun === run) {
              try {
                options.onRefreshError?.(error)
              } catch (callbackError) {
                Trace.write(String(callbackError), 'Jolt', Trace.messageType.error)
              }
              if (!options.onRefreshError)
                Trace.write(
                  `Scroll header refresh: ${String(error)}`,
                  'Jolt',
                  Trace.messageType.error,
                )
            }
            finish(false)
          },
        )
      const finish = (success: boolean) => {
        if (refreshRun !== run) return
        refreshRun = undefined
        native?.refreshing(false)
        run.settle(success)
      }
      return run.promise
    },
    cancelRefresh,
    remeasure() {
      invalidated = true
      if (measuring) return measuring
      measuring = (async () => {
        do {
          invalidated = false
          await measure()
        } while (invalidated && !ended && list.isLoaded && !operation)
      })().finally(() => {
        measuring = undefined
        if (invalidated) queueMeasure()
      })
      return measuring
    },
    async preserveAnchor(change) {
      if (ended || !native || !geometry)
        throw new Error('Wait for scrollHeader to be ready.')
      if (operation) throw new Error('A scroll anchor update is already in progress.')
      if (!options.keys || typeof change !== 'function')
        throw new TypeError('preserveAnchor requires keys() and an update callback.')
      const generation = revision,
        source = native,
        current = () => !ended && revision === generation && native === source
      const before = geometry,
        offset = native.snapshot().offset,
        keys = [...options.keys()]
      const beforeRows = scroll ? realized() : undefined
      if (
        new Set(keys).size !== keys.length ||
        keys.some((key) => typeof key !== 'string' || !key)
      )
        throw new TypeError('Data keys must be unique nonempty strings.')
      const firstVisible = beforeRows?.findIndex(
        (row) => row.top + row.height > offset + before.minimum + before.section,
      )
      const index = beforeRows
          ? firstVisible! < 0
            ? Math.max(0, beforeRows.length - 1)
            : firstVisible!
          : Math.min(
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
        if (!current()) return
        await layout(list)
        if (!current()) return
        const next = [...options.keys()]
        if (
          new Set(next).size !== next.length ||
          next.some((key) => typeof key !== 'string' || !key)
        )
          throw new TypeError('Data keys must remain unique.')
        const found = next.indexOf(key!),
          destination = found >= 0 ? found : Math.min(index, Math.max(0, next.length - 1))
        if (beforeRows) {
          const afterRows = realized()
          source.rows(afterRows.map((row) => row.target))
          source.scroll(
            Math.max(
              0,
              offset +
                ((afterRows[destination]?.top ?? 0) - (beforeRows[index]?.top ?? 0)),
            ),
            false,
          )
        } else
          source.scroll(
            restoredOffset(offset, before, geometry!, index, destination),
            false,
          )
        await layout(list)
        if (current()) notify()
      } finally {
        operation = false
        if (current()) source.enabled(!held && !background)
        queueMeasure()
      }
    },
    scrollToItem(index, animated = false) {
      if (!Number.isSafeInteger(index) || index < 0)
        throw new RangeError('Use a nonnegative data-item index.')
      if (geometry)
        native?.scroll(
          scroll
            ? Math.max(
                0,
                (realized()[index]?.top ??
                  (() => {
                    throw new RangeError('Scroll item index is out of range.')
                  })()) -
                  geometry.minimum -
                  geometry.section,
              )
            : geometry.range +
                geometry.divider +
                index * (geometry.rowHeight + geometry.divider),
          animated && !reducedMotion(),
        )
    },
    scrollToTop(animated = false) {
      native?.scroll(0, animated && !reducedMotion())
    },
    pause() {
      cancelRefresh()
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
      for (const view of [
        list,
        header,
        toolbar,
        section,
        host,
        ...(content ? [content] : []),
      ]) {
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
      if (isIOS && host.nativeViewProtected && saved.nativeClip !== undefined) {
        const container = host.nativeViewProtected as UIView
        if (container.clipsToBounds) container.clipsToBounds = saved.nativeClip
      }
      header.clipToBounds = saved.headerClip
      options.setSpacerHeight(options.originalSpacerHeight ?? 0)
      if (owners.get(list) === control) owners.delete(list)
    },
  }
  owners.set(list, control)
  host.clipToBounds = true
  if (isIOS) header.clipToBounds = false
  artwork.originY = 0
  for (const view of [
    list,
    header,
    toolbar,
    section,
    host,
    ...(content ? [content] : []),
  ]) {
    view.on('loaded', queueMeasure)
    view.on('layoutChanged', queueMeasure)
  }
  list.on('unloaded', detach)
  Application.on(Application.suspendEvent, suspend)
  Application.on(Application.resumeEvent, resume)
  queueMeasure()
  return control
}
