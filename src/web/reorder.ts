import {
  itemKeys,
  sameKeys,
  moveAt,
  type ReorderKey,
  type ReorderMove,
} from '../core/reorder.js'
import { constrain } from '../core/gesture-math.js'
import { assertDragSpace } from './drag.js'
import { createGestureScroll } from './gesture-scroll.js'
import {
  cleanupResources,
  inputBlocked,
  inputChild,
  inputEvents,
  ownStyle,
  ownAttribute,
  releasePointer,
  type InteractionHost,
  type WebInteraction,
  type OwnedBinding,
} from './interaction.js'
import type { WebMotionValue } from './value.js'
import type { Animation } from '../core/playback.js'
import type { FrameTask } from './scheduler.js'
export type WebReorderCancelReason =
  | 'cancelled'
  | 'unchanged'
  | 'data-changed'
  | 'removed'
  | 'unloaded'
  | 'disposed'
  | 'disabled'
  | 'geometry-changed'
export interface WebReorderItem<K extends ReorderKey = ReorderKey> {
  key: K
  target: HTMLElement
}
export interface WebReorderOptions<K extends ReorderKey = ReorderKey> {
  items: () => readonly WebReorderItem<K>[]
  handle?: string | ((row: HTMLElement) => HTMLElement | undefined)
  axis?: 'x' | 'y'
  scrollContainer?: HTMLElement
  onCommit: (move: ReorderMove<K>) => void
  onStart?: (key: K) => void
  onCancel?: (event: { key: K; reason: WebReorderCancelReason }) => void
  longPress?: number
  edge?: { size?: number; speed?: number }
  accessibility?: {
    label?: (key: K) => string
    announcement?: (
      key: K,
      position: number,
      total: number,
      phase: 'picked-up' | 'moved' | 'dropped' | 'cancelled',
    ) => string
  }
}
export interface WebReorder<K extends ReorderKey = ReorderKey> extends WebInteraction {
  readonly activeKey: K | undefined
  move(key: K, beforeKey: K | null): boolean
  moveTo(key: K, index: number): boolean
  moveUp(key: K): boolean
  moveDown(key: K): boolean
  refresh(): void
}
interface Row<K extends ReorderKey> extends WebReorderItem<K> {
  handle: HTMLElement
  restore: () => void
}
interface Preview<K extends ReorderKey> {
  row: Row<K>
  start: number
  size: number
  value: WebMotionValue
  binding: OwnedBinding
}
export function createReorder<K extends ReorderKey>(
  container: HTMLElement,
  options: WebReorderOptions<K>,
  host: InteractionHost,
): WebReorder<K> {
  if (
    !options ||
    typeof options.items !== 'function' ||
    typeof options.onCommit !== 'function'
  )
    throw new TypeError('Reorder requires keyed items and an onCommit callback.')
  const axis = options.axis ?? 'y',
    source = options.scrollContainer ?? container,
    delay = options.longPress ?? 350,
    edge = options.edge?.size ?? 72,
    speed = options.edge?.speed ?? 640
  if (
    !['x', 'y'].includes(axis) ||
    !Number.isFinite(delay) ||
    delay < 150 ||
    delay > 2000 ||
    ![edge, speed].every((v) => Number.isFinite(v) && v > 0)
  )
    throw new RangeError('Invalid reorder axis, activation delay or edge scrolling.')
  if (source.ownerDocument !== container.ownerDocument || !source.contains(container))
    throw new TypeError('The scroll container must contain the reorder container.')
  for (const fn of [
    options.onStart,
    options.onCancel,
    options.accessibility?.label,
    options.accessibility?.announcement,
  ])
    if (fn !== undefined && typeof fn !== 'function')
      throw new TypeError('Reorder callbacks must be functions.')
  assertDragSpace(container, true)
  const events = inputEvents(container),
    document = container.ownerDocument,
    view = events.view
  const scroll = createGestureScroll(source, { element: source, axis }, host)
  const layer = host.layer('reorder'),
    live = document.createElement('div')
  live.setAttribute('role', 'status')
  live.setAttribute('aria-live', 'polite')
  live.setAttribute('aria-atomic', 'true')
  live.style.cssText =
    'position:fixed;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);pointer-events:none;'
  let rows: Row<K>[] = [],
    preview: Preview<K>[] = [],
    disposed = false,
    paused = false,
    active: K | undefined,
    pointer: number | undefined
  let from = -1,
    to = -1,
    start = 0,
    latest = 0,
    last = 0,
    baseScroll = 0,
    baseStart = 0,
    gap = 0,
    suppressUntil = 0,
    keyboard = false,
    scrolling = false
  let cancelDelay: (() => void) | undefined,
    restoreDrag: (() => void) | undefined,
    layout: Animation | undefined
  let frameTime = 0,
    viewport: DOMRect | undefined,
    scrollVelocity = 0,
    moveTime = 0
  const position = (event: PointerEvent) => (axis === 'x' ? event.clientX : event.clientY)
  const scrollOffset = () => (axis === 'x' ? source.scrollLeft : source.scrollTop)
  const notify = (fn: (() => void) | undefined) => {
    try {
      fn?.()
    } catch (error) {
      host.error(error)
    }
  }
  const announce = (
    key: K,
    index: number,
    phase: 'picked-up' | 'moved' | 'dropped' | 'cancelled',
  ) => {
    const custom = options.accessibility?.announcement
    live.textContent = custom
      ? custom(key, index + 1, rows.length, phase)
      : `${options.accessibility?.label?.(key) ?? String(key)}, ${phase.replace('-', ' ')}, position ${index + 1} of ${rows.length}.`
  }
  const readRows = () => {
    const items = [...options.items()].filter((row) => row.target?.isConnected)
    itemKeys(items, (item) => item.key)
    if (
      new Set(items.map((row) => row.target)).size !== items.length ||
      items.some(
        (row) =>
          !(row.target instanceof view.HTMLElement) ||
          !container.contains(row.target) ||
          row.target === container,
      )
    )
      throw new TypeError('Reorder rows need unique descendant elements.')
    return items
  }
  const cleanupPreview = () => {
    const owned = preview,
      restore = restoreDrag
    preview = []
    restoreDrag = undefined
    cleanupResources([
      ...owned.flatMap((entry) => [
        () => entry.binding.dispose(),
        () => entry.value.dispose(),
      ]),
      () => restore?.(),
    ])
  }
  const reset = () => {
    cancelDelay?.()
    cancelDelay = undefined
    host.scheduler.remove(task)
    scroll.stop()
    const id = pointer
    pointer = undefined
    if (id !== undefined) releasePointer(container, id)
    scrolling = false
    keyboard = false
    active = undefined
    frameTime = 0
  }
  const cancel = (reason: WebReorderCancelReason = 'cancelled') => {
    const key = active,
      index = from
    reset()
    cleanupPreview()
    if (key !== undefined) {
      announce(key, index, 'cancelled')
      notify(() => options.onCancel?.({ key, reason }))
    }
  }
  const validate = () => {
    if (disposed) return false
    if (
      !container.isConnected ||
      container.ownerDocument !== document ||
      !source.isConnected
    ) {
      handle.dispose()
      return false
    }
    if (inputBlocked(container)) {
      cancel('disabled')
      return false
    }
    if (active !== undefined) {
      if (preview.some((entry) => !entry.binding.owns())) {
        cancel()
        return false
      }
      const items = readRows()
      if (
        !sameKeys(
          items.map((row) => row.key),
          rows.map((row) => row.key),
        ) ||
        items.some((row, i) => row.target !== rows[i]!.target)
      ) {
        cancel(items.some((row) => row.key === active) ? 'data-changed' : 'removed')
        return false
      }
      if (rows.some((row) => inputBlocked(row.target))) {
        cancel('disabled')
        return false
      }
    }
    return true
  }
  const reorderPreview = (index: number) => {
    to = constrain(index, 0, preview.length - 1)
    const order = preview.filter((_, i) => i !== from)
    order.splice(to, 0, preview[from]!)
    let offset = baseStart
    for (const entry of order) {
      if (entry !== preview[from]) entry.value.set(offset - entry.start)
      offset += entry.size + gap
    }
  }
  const begin = (row: Row<K>, isKeyboard = false) => {
    if (disposed || paused || !validate() || inputBlocked(row.target)) return
    assertDragSpace(container, true)
    layout?.stop()
    layout = undefined
    from = rows.indexOf(row)
    to = from
    active = row.key
    keyboard = isKeyboard
    frameTime = 0
    baseScroll = scrollOffset()
    try {
      const boxes = rows.map((row) => row.target.getBoundingClientRect())
      gap =
        boxes.length > 1
          ? Math.max(
              0,
              ...boxes
                .slice(1)
                .map((rect, i) =>
                  axis === 'y'
                    ? rect.top - boxes[i]!.bottom
                    : rect.left - boxes[i]!.right,
                ),
            )
          : 0
      baseStart = axis === 'y' ? boxes[0]!.top : boxes[0]!.left
      preview = []
      for (const [i, entry] of rows.entries()) {
        const box = boxes[i]!,
          value = host.motionValue(0)
        let binding: OwnedBinding
        try {
          binding = host.bindLayer(entry.target, { [axis]: value }, layer)
        } catch (error) {
          value.dispose()
          throw error
        }
        preview.push({
          row: entry,
          start: axis === 'y' ? box.top : box.left,
          size: axis === 'y' ? box.height : box.width,
          value,
          binding,
        })
      }
      restoreDrag = ownStyle(row.target, 'z-index', '1')
      announce(row.key, from, 'picked-up')
      notify(() => options.onStart?.(row.key))
    } catch (error) {
      cancel()
      throw error
    }
  }
  const commit = () => {
    if (active === undefined) return false
    if (!validate()) return false
    const key = active,
      move = moveAt(
        rows.map((row) => row.key),
        from,
        to,
      ),
      focus = rows[from]?.handle
    if (!move) {
      cancel('unchanged')
      return false
    }
    reset()
    announce(key, move.toIndex, 'dropped')
    try {
      // FLIP captures the preview, then the renderer commits during this layout turn.
      layout = host.animateLayout(
        container,
        () => {
          cleanupPreview()
          options.onCommit(move)
        },
        { type: 'spring', duration: 350, bounce: 0, size: false, enter: false },
      )
      const current = layout
      void current.finished.then(() => {
        if (layout === current) layout = undefined
      })
      queueMicrotask(() => {
        if (disposed) return
        refresh()
        const next = rows.find((row) => row.key === key)?.handle
        if (
          next &&
          (!document.activeElement ||
            document.activeElement === document.body ||
            document.activeElement === focus)
        )
          next.focus({ preventScroll: true })
      })
      return true
    } catch (error) {
      cleanupPreview()
      host.error(error)
      return false
    }
  }
  const task: FrameTask = {
    read() {
      if (!validate() || active === undefined) return
      viewport = source.getBoundingClientRect()
    },
    update(time) {
      if (active === undefined || keyboard || !viewport) return
      const dt = frameTime ? Math.min(32, time - frameTime) : 0
      frameTime = time
      const first = axis === 'y' ? viewport.top : viewport.left,
        end = axis === 'y' ? viewport.bottom : viewport.right
      const edgeSpeed =
        latest < first + edge
          ? -speed * constrain((first + edge - latest) / edge, 0, 1)
          : latest > end - edge
            ? speed * constrain((latest - end + edge) / edge, 0, 1)
            : 0
      if (edgeSpeed) scroll.consume((-edgeSpeed * dt) / 1000, 0, [0, 0])
      const delta = latest - start + scrollOffset() - baseScroll,
        entry = preview[from]!
      entry.value.set(delta)
      const center = entry.start + delta + entry.size / 2
      const index = preview.filter(
        (row, i) => i !== from && center > row.start + row.size / 2,
      ).length
      if (index !== to) {
        reorderPreview(index)
        announce(active, to, 'moved')
      }
      return !!edgeSpeed
    },
  }
  const refresh = () => {
    if (disposed || !validate()) return
    const next = readRows(),
      previous = new Map(rows.map((row) => [row.key, row]))
    rows = next.map((item) => {
      const existing = previous.get(item.key)
      const grip =
        typeof options.handle === 'string'
          ? item.target.querySelector<HTMLElement>(options.handle)
          : (options.handle?.(item.target) ?? item.target)
      if (!grip || !item.target.contains(grip))
        throw new TypeError('Every reorder row needs its declared handle.')
      if (existing?.target === item.target && existing.handle === grip) {
        previous.delete(item.key)
        return existing
      }
      existing?.restore()
      previous.delete(item.key)
      const restores = [
        ownStyle(grip, 'touch-action', 'none'),
        ownStyle(grip, 'user-select', 'none'),
      ]
      if (!grip.matches('button,a[href],input,select,textarea,[tabindex]'))
        restores.push(ownAttribute(grip, 'tabindex', '0'))
      return {
        ...item,
        handle: grip,
        restore: () => {
          for (const restore of restores.reverse()) restore()
        },
      }
    })
    for (const row of previous.values()) row.restore()
    observeRows()
  }
  events.on(container, 'pointerdown', (event: PointerEvent) => {
    if (
      disposed ||
      paused ||
      pointer !== undefined ||
      event.button !== 0 ||
      !event.isPrimary ||
      event.defaultPrevented
    )
      return
    refresh()
    if (!validate()) return
    const row = rows.find((row) => event.composedPath().includes(row.handle))
    if (
      !row ||
      inputBlocked(row.target) ||
      (!options.handle && inputChild(event, row.target))
    )
      return
    if (active !== undefined) cancel()
    pointer = event.pointerId
    start = latest = last = position(event)
    moveTime = event.timeStamp
    scrollVelocity = 0
    scrolling = false
    scroll.begin(event)
    try {
      container.setPointerCapture(pointer)
    } catch (error) {
      reset()
      host.error(error)
      return
    }
    if (event.pointerType === 'mouse') begin(row)
    else
      cancelDelay = host.after(delay, () => {
        cancelDelay = undefined
        if (pointer !== undefined && !scrolling) begin(row)
      })
  })
  events.on(
    view,
    'pointermove',
    (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      const next = position(event),
        delta = next - last,
        dt = event.timeStamp - moveTime
      if (dt > 0) scrollVelocity = constrain((delta / dt) * 1000, -5000, 5000)
      latest = next
      last = next
      moveTime = event.timeStamp
      if (active === undefined) {
        if (Math.abs(next - start) > 8) {
          cancelDelay?.()
          cancelDelay = undefined
          scrolling = true
        }
        if (scrolling) scroll.consume(delta, 0, [0, 0])
      } else host.scheduler.add(task)
    },
    true,
    true,
  )
  events.on(
    view,
    'pointerup',
    (event: PointerEvent) => {
      if (event.pointerId !== pointer) return
      if (active !== undefined) {
        latest = position(event)
        task.read?.(host.scheduler.now())
        task.update?.(host.scheduler.now())
        suppressUntil = view.performance.now() + 500
        commit()
      } else {
        const coast = scrolling,
          velocity = event.timeStamp - moveTime < 80 ? scrollVelocity : 0
        reset()
        if (coast)
          scroll.release(
            velocity,
            () => 0,
            () => [0, 0],
            () => {},
          )
      }
    },
    true,
    true,
  )
  for (const type of ['pointercancel', 'lostpointercapture'])
    events.on(
      view,
      type,
      (event: PointerEvent) => {
        if (event.pointerId === pointer) cancel()
      },
      true,
      true,
    )
  events.on(
    container,
    'keydown',
    (event: KeyboardEvent) => {
      if (
        disposed ||
        paused ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return
      refresh()
      const row = rows.find((row) => row.handle === event.target)
      if (!row) return
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        if (active === undefined) begin(row, true)
        else if (keyboard) commit()
      } else if (event.key === 'Escape' && active !== undefined) {
        event.preventDefault()
        cancel()
      } else if (
        active !== undefined &&
        keyboard &&
        ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
          event.key,
        )
      ) {
        event.preventDefault()
        const index =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? rows.length - 1
              : to + (['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1)
        reorderPreview(index)
        const item = preview[from]!,
          order = preview.filter((_, i) => i !== from)
        order.splice(to, 0, item)
        const target =
          baseStart + order.slice(0, to).reduce((sum, row) => sum + row.size + gap, 0)
        item.value.set(target - item.start)
        announce(active, to, 'moved')
        rows[to]?.target.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: 'instant',
        })
      }
    },
    false,
  )
  events.on(
    container,
    'click',
    (event: MouseEvent) => {
      if (event.detail > 0 && view.performance.now() < suppressUntil) {
        event.preventDefault()
        event.stopImmediatePropagation()
      }
    },
    false,
    true,
  )
  events.on(
    container,
    'dragstart',
    (event) => {
      if (pointer !== undefined) event.preventDefault()
    },
    false,
  )
  events.on(view, 'blur', () => cancel())
  events.on(document, 'visibilitychange', () => {
    if (document.hidden) cancel()
  })
  const sizes = new Map<HTMLElement, { width: number; height: number }>()
  const resize = new view.ResizeObserver((entries) => {
    let changed = false
    for (const entry of entries) {
      const node = entry.target as HTMLElement,
        before = sizes.get(node)
      const next = { width: node.offsetWidth, height: node.offsetHeight }
      changed ||=
        !!before && (before.width !== next.width || before.height !== next.height)
      sizes.set(node, next)
    }
    if (changed && active !== undefined) cancel('geometry-changed')
  })
  const observeRows = () => {
    const next = new Set([container, ...rows.map((row) => row.target)])
    for (const node of sizes.keys())
      if (!next.has(node)) {
        resize.unobserve(node)
        sizes.delete(node)
      }
    for (const node of next)
      if (!sizes.has(node)) {
        sizes.set(node, { width: node.offsetWidth, height: node.offsetHeight })
        resize.observe(node)
      }
  }
  let unregister = () => {}
  const handle: WebReorder<K> = {
    get activeKey() {
      return active
    },
    get disposed() {
      return disposed
    },
    get paused() {
      return paused
    },
    move(key, beforeKey) {
      refresh()
      const keys = rows.map((row) => row.key),
        index = keys.indexOf(key),
        before = beforeKey === null ? keys.length : keys.indexOf(beforeKey)
      if (index < 0 || before < 0 || beforeKey === key) return false
      return handle.moveTo(key, before > index ? before - 1 : before)
    },
    moveTo(key, index) {
      if (disposed || paused) return false
      refresh()
      if (!Number.isInteger(index) || index < 0 || index >= rows.length) return false
      const row = rows.find((row) => row.key === key)
      if (!row) return false
      cancel()
      begin(row, true)
      if (active === undefined) return false
      to = index
      return commit()
    },
    moveUp(key) {
      refresh()
      return handle.moveTo(key, rows.findIndex((row) => row.key === key) - 1)
    },
    moveDown(key) {
      refresh()
      const index = rows.findIndex((row) => row.key === key)
      return index < 0 ? false : handle.moveTo(key, index + 1)
    },
    refresh,
    cancel: () => cancel(),
    pause() {
      if (disposed || paused) return
      paused = true
      cancel()
      layout?.stop()
      layout = undefined
    },
    play() {
      if (disposed || !paused) return
      paused = false
      refresh()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancel('disposed')
      layout?.stop()
      layout = undefined
      events.dispose()
      resize.disconnect()
      for (const row of rows) row.restore()
      rows = []
      live.remove()
      unregister()
    },
  }
  try {
    refresh()
    document.body.append(live)
    observeRows()
    unregister = host.register(container, handle, refresh)
  } catch (error) {
    handle.dispose()
    throw error
  }
  return handle
}
