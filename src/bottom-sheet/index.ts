import {
  Application,
  GridLayout,
  ScrollView,
  Trace,
  Utils,
  View,
  isAndroid,
} from '@nativescript/core'
import { bind, type SpringValueOptions } from '../motion-value.js'
import { GestureSurface, gestures, type Gestures } from '../gestures/index.js'
import { currentKeyboard, onKeyboard } from '../keyboard.js'
import {
  releaseStop,
  sheetGeometry,
  validateSnaps,
  type SheetGeometry,
  type SheetSnap,
} from './geometry.js'
import {
  captureFocus,
  dismissKeyboard,
  hostInsets,
  revealFocusedField,
  sheetActions,
  windowHeight,
} from './native.js'

export { GestureSurface }
export type { SheetSnap }

export interface BottomSheetOptions {
  /** A separate, focusable drag handle inside the panel; receives native accessibility actions. */
  handle: View
  snap: readonly SheetSnap[]
  /** A descendant vertical ScrollView. Native list plugins need their own integration. */
  scrollView?: ScrollView
  /** Measured content for the content snap; defaults to scrollView.content. */
  content?: View
  /** A sibling behind the panel, filling the same one-cell GridLayout. */
  backdrop?: View
  backdropOpacity?: number
  /** Follow temporarily expands above the keyboard, then restores the selected snap. */
  keyboard?: 'follow' | 'none'
  /** Whether dragging, the backdrop, back and accessibility can dismiss. Defaults to true. */
  dismissible?: boolean
  /**
   * Overrides the host's safe-area insets, in DIPs. Core already lays the host's children
   * out inside its insets, so a top override only adds to that placement.
   */
  safeArea?: { top?: number; bottom?: number }
  returnFocus?: View
  spring?: Pick<SpringValueOptions, 'stiffness' | 'damping' | 'mass'>
  accessibility?: { label?: string; expand?: string; collapse?: string; dismiss?: string }
  onChange?: (point: SheetSnap | null) => void
  /** Called after a close settles; interrupted closes do not dismiss. */
  onDismiss?: () => void
}

export interface BottomSheet {
  readonly isOpen: boolean
  readonly snapPoint: SheetSnap | null
  readonly visibleHeight: number
  readonly paused: boolean
  readonly disposed: boolean
  open(point?: SheetSnap): void
  snapTo(point: SheetSnap): void
  expand(): void
  collapse(): void
  dismiss(): void
  remeasure(): void
  pause(): void
  play(): void
  dispose(): void
}

const owners = new WeakMap<GestureSurface, BottomSheet>()
const descendant = (child: View, parent: View) => {
  for (let current = child.parent; current; current = current.parent)
    if (current === parent) return true
  return false
}
const report = (callback: (() => void) | undefined) => {
  try {
    callback?.()
  } catch (error) {
    Trace.write(
      `Jolt bottom sheet callback failed: ${String(error)}`,
      Trace.categories.Error,
      Trace.messageType.error,
    )
  }
}

/** An in-page sheet, built from native gestures and live spring bindings. */
export function bottomSheet(
  panel: GestureSurface,
  options: BottomSheetOptions,
): BottomSheet {
  if (!(panel instanceof GestureSurface) || !(panel.parent instanceof GridLayout))
    throw new TypeError(
      'bottomSheet() needs a GestureSurface inside an overlay GridLayout.',
    )
  if (!options || typeof options !== 'object')
    throw new TypeError('Sheet options are required.')
  validateSnaps(options.snap)
  const points = [...options.snap],
    host = panel.parent
  if (!(options.handle instanceof View) || !descendant(options.handle, panel))
    throw new TypeError('Provide a separate accessibility handle inside the sheet.')
  const handle = options.handle,
    scroll = options.scrollView
  if (
    scroll &&
    (!(scroll instanceof ScrollView) ||
      scroll.orientation !== 'vertical' ||
      !descendant(scroll, panel))
  )
    throw new TypeError('Sheet scrolling needs a descendant vertical ScrollView.')
  const content = options.content ?? scroll?.content
  if (content && (!(content instanceof View) || !descendant(content, panel)))
    throw new TypeError('Sheet content must be a descendant of its panel.')
  if (points.includes('content') && !content)
    throw new TypeError(
      'A content snap needs scrollView.content or an explicit content view.',
    )
  const backdrop = options.backdrop
  if (
    backdrop &&
    (!(backdrop instanceof View) || backdrop.parent !== host || backdrop === panel)
  )
    throw new TypeError('The backdrop must be a sibling behind the sheet.')
  const opacity = options.backdropOpacity ?? 0.45
  if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1)
    throw new RangeError('Backdrop opacity must be between zero and one.')
  if (options.keyboard !== undefined && !['follow', 'none'].includes(options.keyboard))
    throw new TypeError('Sheet keyboard behavior must be follow or none.')
  for (const inset of Object.values(options.safeArea ?? {}))
    if (!Number.isFinite(inset) || inset < 0)
      throw new RangeError('Safe-area insets must be finite and nonnegative.')
  if (options.dismissible !== undefined && typeof options.dismissible !== 'boolean')
    throw new TypeError('dismissible must be boolean.')
  for (const callback of [options.onChange, options.onDismiss])
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Sheet callbacks must be functions.')

  owners.get(panel)?.dispose()
  const original = {
    contentAlignment: content?.verticalAlignment,
    height: panel.height,
    ignoreSafeArea: panel.iosIgnoreSafeArea,
    paddingBottom: panel.paddingBottom,
    marginTop: panel.marginTop,
    marginBottom: panel.marginBottom,
    alignment: panel.verticalAlignment,
    visibility: panel.visibility,
    y: panel.translateY,
    clipping: host.clipToBounds,
    backdropOpacity: backdrop?.opacity,
    backdropVisibility: backdrop?.visibility,
    accessible: handle.accessible,
    label: handle.accessibilityLabel,
    value: handle.accessibilityValue,
  }
  let geometry: SheetGeometry | undefined, input: Gestures | undefined
  let extended = 0
  let opened = false,
    point = points[0]!,
    ended = false,
    held = false,
    changing = false,
    pendingDismiss = false,
    contactSettled = false,
    focusCaptured = false
  let keyboard = currentKeyboard(),
    timer: ReturnType<typeof setTimeout> | undefined
  let releasePanel = () => {},
    releaseBackdrop = () => {},
    releaseActions = () => {},
    releaseKeyboard = () => {}
  let releaseClose = () => {},
    restoreFocus = () => {}
  const dismissible = options.dismissible !== false
  const followKeyboard = options.keyboard !== 'none'
  const keyboardOpen = () => followKeyboard && keyboard.visible
  const targetY = () =>
    !opened
      ? geometry!.closedY
      : keyboardOpen()
        ? 0
        : geometry!.stops.find((stop) => stop.point === point)!.y
  const minimum = () =>
    keyboardOpen() ? 0 : Math.min(...geometry!.stops.map((stop) => stop.y))

  function finishClose() {
    releaseClose()
    releaseClose = () => {}
    if (ended || opened) return
    panel.visibility = 'hidden'
    if (backdrop) backdrop.visibility = 'hidden'
    input?.pause()
    if (pendingDismiss) {
      pendingDismiss = false
      const restore = restoreFocus
      restoreFocus = () => {}
      focusCaptured = false
      restore()
      report(options.onDismiss)
    }
  }
  function move() {
    if (!input || !geometry || held || ended) return
    changing = true
    try {
      input.updateBounds({
        top: minimum(),
        bottom:
          !opened || dismissible
            ? geometry.closedY
            : Math.max(...geometry.stops.map((stop) => stop.y)),
      })
      input.settleTo({ y: targetY() })
    } finally {
      changing = false
    }
    if (!opened) {
      releaseClose()
      const check = () => {
        if (
          !opened &&
          geometry &&
          input &&
          Math.abs(input.y.get() - geometry.closedY) < 0.01
        )
          finishClose()
      }
      releaseClose = input.y.subscribe(check, { immediate: false })
      check()
    }
  }
  function setTarget(next: SheetSnap | null) {
    if (ended) return
    if (next !== null && !points.includes(next))
      throw new RangeError('Choose one of the configured sheet snap points.')
    const wasOpen = opened,
      changed = (next !== null) !== opened || (next !== null && next !== point)
    releaseClose()
    releaseClose = () => {}
    if (next !== null) {
      if (!opened && !pendingDismiss && panel.isLoaded) {
        restoreFocus = captureFocus(panel, options.returnFocus)
        focusCaptured = true
      }
      opened = true
      pendingDismiss = false
      point = next
      panel.visibility = 'visible'
      if (backdrop) backdrop.visibility = 'visible'
      if (!held) input?.play()
    } else {
      opened = false
      pendingDismiss ||= wasOpen
      dismissKeyboard(panel)
    }
    handle.accessibilityValue = opened ? String(point) : 'Closed'
    move()
    if (changed) report(() => options.onChange?.(next))
  }
  function adjacent(expand: boolean) {
    if (ended) return
    if (!opened) {
      if (expand) setTarget(point)
      return
    }
    if (!geometry) return
    const current = geometry.stops.find((stop) => stop.point === point)!
    const candidates = geometry.stops
      .filter((stop) =>
        expand
          ? stop.height > current.height + 0.01
          : stop.height < current.height - 0.01,
      )
      .sort((a, b) => (expand ? a.height - b.height : b.height - a.height))
    if (candidates[0]) setTarget(candidates[0].point)
    else if (!expand && dismissible) setTarget(null)
  }
  function remeasure() {
    if (ended || !panel.isLoaded || !handle.isLoaded || (scroll && !scroll.isLoaded))
      return
    const size = host.getActualSize()
    if (!(size.height > 0)) return
    const safe = hostInsets(host)
    // The host places its children below its own top inset; the panel can only start lower.
    const top = Math.max(safe.top, options.safeArea?.top ?? safe.top)
    const bottom = options.safeArea?.bottom ?? safe.bottom
    // The padding that keeps rows above the bottom inset is not sheet chrome.
    const chrome = scroll
      ? Math.max(
          0,
          panel.getActualSize().height - scroll.getActualSize().height - extended,
        )
      : 0
    const contentHeight = (content?.getActualSize().height ?? 0) + chrome
    const next = sheetGeometry(
      points,
      size.height,
      (host.getLocationInWindow()?.y ?? 0) + size.height,
      windowHeight(host),
      followKeyboard ? keyboard.height : 0,
      top,
      bottom,
      contentHeight,
      safe.bottom === 0,
    )
    const previous = geometry
    geometry = next
    const panelHeight =
      (keyboardOpen()
        ? next.height
        : Math.max(...next.stops.map((stop) => stop.height))) + next.extension
    if (panel.height !== panelHeight) panel.height = panelHeight
    const margin = next.top - safe.top
    if (panel.marginTop !== margin) panel.marginTop = margin
    if (extended !== next.extension) {
      const base =
        Utils.layout.toDeviceIndependentPixels(panel.effectivePaddingBottom ?? 0) -
        extended
      panel.paddingBottom = base + next.extension
      extended = next.extension
    }
    if (!input) {
      input = gestures(panel, {
        pan: { axis: 'y', bounds: { top: minimum(), bottom: next.closedY } },
        initial: { y: next.closedY },
        scrollView: scroll,
        spring: options.spring,
        onContactStart() {
          const wasOpen = opened
          contactSettled = false
          releaseClose()
          releaseClose = () => {}
          opened = true
          pendingDismiss = false
          handle.accessibilityValue = String(point)
          if (!wasOpen) report(() => options.onChange?.(point))
        },
        onContactEnd(event) {
          if (contactSettled || changing || held || ended || !geometry) return
          const stop = releaseStop(geometry, event.y, 0, dismissible)
          setTarget(stop?.point ?? null)
        },
        onStart() {
          releaseClose()
          releaseClose = () => {}
          opened = true
          pendingDismiss = false
        },
        onEnd(event) {
          contactSettled = true
          if (!geometry) return
          const stop = releaseStop(geometry, event.y, event.velocityY, dismissible)
          setTarget(stop?.point ?? null)
        },
        onCancel() {
          contactSettled = true
          if (!changing && !held && !ended) move()
        },
      })
      releasePanel = bind(panel, { y: input.y })
      if (held || !opened) input.pause()
    }
    if (
      !previous ||
      previous.closedY !== next.closedY ||
      previous.height !== next.height ||
      previous.stops.some((stop, i) => stop.y !== next.stops[i]!.y)
    ) {
      releaseBackdrop()
      releaseBackdrop = backdrop
        ? bind(backdrop, { opacity: input.y.to([minimum(), next.closedY], [opacity, 0]) })
        : () => {}
      if (!input.active) move()
      else
        input.updateBounds({
          top: minimum(),
          bottom: dismissible
            ? next.closedY
            : Math.max(...next.stops.map((stop) => stop.y)),
        })
    }
    if (opened && keyboardOpen()) revealFocusedField(panel, scroll)
  }
  function queueMeasure() {
    if (ended || timer !== undefined) return
    timer = setTimeout(() => {
      timer = undefined
      remeasure()
    }, 0)
  }
  function back(event: { cancel: boolean }) {
    if (opened && panel.isLoaded && dismissible) {
      event.cancel = true
      setTarget(null)
    }
  }
  function backdropTap() {
    if (opened && dismissible) setTarget(null)
  }
  function attach() {
    if (ended || !panel.isLoaded || !handle.isLoaded || (scroll && !scroll.isLoaded))
      return
    if (opened) {
      panel.visibility = 'visible'
      if (backdrop) backdrop.visibility = 'visible'
    }
    if (opened && !focusCaptured) {
      restoreFocus = captureFocus(panel, options.returnFocus)
      focusCaptured = true
    }
    releaseActions()
    const labels = options.accessibility
    releaseActions = sheetActions(handle, [
      { label: labels?.expand ?? 'Expand', run: () => adjacent(true) },
      { label: labels?.collapse ?? 'Collapse', run: () => adjacent(false) },
      ...(dismissible
        ? [{ label: labels?.dismiss ?? 'Dismiss', run: () => setTarget(null) }]
        : []),
    ])
    releaseKeyboard()
    releaseKeyboard = onKeyboard((state) => {
      keyboard = state
      remeasure()
      if (opened) move()
      queueMeasure()
    })
    keyboard = currentKeyboard()
    remeasure()
    queueMeasure()
  }
  function detach() {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    releaseClose()
    releaseClose = () => {}
    if (backdrop) backdrop.visibility = 'hidden'
    releaseActions()
    releaseActions = () => {}
    releaseKeyboard()
    releaseKeyboard = () => {}
    releasePanel()
    releasePanel = () => {}
    releaseBackdrop()
    releaseBackdrop = () => {}
    changing = true
    input?.dispose()
    input = undefined
    geometry = undefined
    changing = false
  }
  const control: BottomSheet = {
    get isOpen() {
      return opened
    },
    get snapPoint() {
      return opened ? point : null
    },
    get visibleHeight() {
      return geometry && input
        ? Math.max(0, Math.min(geometry.height, geometry.height - input.y.get()))
        : 0
    },
    get paused() {
      return held
    },
    get disposed() {
      return ended
    },
    open: (next = point) => setTarget(next),
    snapTo: (next) => setTarget(next),
    expand: () => adjacent(true),
    collapse: () => adjacent(false),
    dismiss: () => setTarget(null),
    remeasure,
    pause() {
      held = true
      input?.pause()
    },
    play() {
      if (ended) return
      held = false
      input?.play()
      move()
    },
    dispose() {
      if (ended) return
      ended = true
      detach()
      for (const view of [panel, handle, ...(scroll ? [scroll] : [])])
        view.off('loaded', attach)
      panel.off('unloaded', detach)
      for (const view of new Set([
        host,
        panel,
        ...(content ? [content] : []),
        ...(scroll ? [scroll] : []),
      ]))
        view.off('layoutChanged', queueMeasure)
      backdrop?.off('tap', backdropTap)
      if (isAndroid)
        Application.android.off(Application.android.activityBackPressedEvent, back)
      if (content) content.verticalAlignment = original.contentAlignment!
      panel.height = original.height
      panel.iosIgnoreSafeArea = original.ignoreSafeArea
      panel.paddingBottom = original.paddingBottom
      panel.marginTop = original.marginTop
      panel.marginBottom = original.marginBottom
      panel.verticalAlignment = original.alignment
      panel.visibility = original.visibility
      panel.translateY = original.y
      host.clipToBounds = original.clipping
      handle.accessible = original.accessible
      handle.accessibilityLabel = original.label
      handle.accessibilityValue = original.value
      if (backdrop) {
        backdrop.opacity = original.backdropOpacity!
        backdrop.visibility = original.backdropVisibility!
      }
      if (owners.get(panel) === control) owners.delete(panel)
    },
  }
  owners.set(panel, control)
  if (content && points.includes('content')) content.verticalAlignment = 'top'
  // The geometry owns the panel's placement and its rows' distance from the bottom inset;
  // Core would otherwise stretch it to the screen edges or inset its rows a second time.
  panel.iosIgnoreSafeArea = true
  panel.verticalAlignment = 'top'
  panel.marginBottom = 0
  panel.visibility = 'hidden'
  host.clipToBounds = true
  handle.accessible = true
  handle.accessibilityLabel =
    options.accessibility?.label ?? (handle.accessibilityLabel || 'Bottom sheet')
  handle.accessibilityValue = 'Closed'
  if (backdrop) backdrop.visibility = 'hidden'
  for (const view of [panel, handle, ...(scroll ? [scroll] : [])])
    view.on('loaded', attach)
  panel.on('unloaded', detach)
  for (const view of new Set([
    host,
    panel,
    ...(content ? [content] : []),
    ...(scroll ? [scroll] : []),
  ]))
    view.on('layoutChanged', queueMeasure)
  backdrop?.on('tap', backdropTap)
  if (isAndroid)
    Application.android.on(Application.android.activityBackPressedEvent, back)
  try {
    attach()
  } catch (error) {
    control.dispose()
    throw error
  }
  return control
}
