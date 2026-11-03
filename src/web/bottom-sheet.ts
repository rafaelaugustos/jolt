import {
  releaseStop,
  sheetGeometry,
  validateSnaps,
  type SheetSnap,
} from '../core/sheet-geometry.js'
import type { SpringParams } from '../core/spring.js'
import { EffectStyles, effectOptions, effectOwnership, effectTarget } from './effect.js'
import { ownAttribute, type WebInteraction } from './interaction.js'
import { createKeyboardSubscription } from './keyboard.js'
import type { PlatformHost } from './platform-host.js'
import type { WebGestures } from './gestures.js'
import { bounded } from './surface-effect.js'

export type WebSheetSnap = SheetSnap
export interface WebBottomSheetOptions {
  /** A positioned, clipped host containing the panel as a direct child. */
  host: HTMLElement
  /** Focusable drag handle inside the panel; arrows/Home/End/Escape are supported. */
  handle: HTMLElement
  snap: readonly SheetSnap[]
  scrollView?: HTMLElement
  content?: HTMLElement
  backdrop?: HTMLElement
  backdropOpacity?: number
  keyboard?: 'follow' | 'none'
  dismissible?: boolean
  safeArea?: { top?: number; bottom?: number }
  returnFocus?: HTMLElement
  spring?: SpringParams
  label?: string
  onChange?: (point: SheetSnap | null) => void
  onDismiss?: () => void
}
export interface WebBottomSheet extends WebInteraction {
  readonly isOpen: boolean
  readonly snapPoint: SheetSnap | null
  readonly visibleHeight: number
  open(point?: SheetSnap): void
  snapTo(point: SheetSnap): void
  expand(): void
  collapse(): void
  dismiss(): void
  remeasure(): void
}

export function createBottomSheet(
  panel: HTMLElement,
  options: WebBottomSheetOptions,
  host: PlatformHost,
): WebBottomSheet {
  const view = effectTarget(panel, host)
  effectOptions(options, [
    'host',
    'handle',
    'snap',
    'scrollView',
    'content',
    'backdrop',
    'backdropOpacity',
    'keyboard',
    'dismissible',
    'safeArea',
    'returnFocus',
    'spring',
    'label',
    'onChange',
    'onDismiss',
  ])
  effectTarget(options.host, host)
  effectTarget(options.handle, host)
  if (
    panel.parentElement !== options.host ||
    !panel.contains(options.handle) ||
    panel === options.handle
  )
    throw new TypeError(
      'A sheet needs a direct host parent and a separate handle inside its panel.',
    )
  if (view.getComputedStyle(options.host).position === 'static')
    throw new TypeError('Position the sheet host before creating a sheet.')
  for (const target of [options.content, options.scrollView])
    if (target) {
      effectTarget(target, host)
      if (!panel.contains(target) || panel === target)
        throw new TypeError('Sheet content and scrolling belong inside the panel.')
    }
  if (options.backdrop) {
    effectTarget(options.backdrop, host)
    if (options.backdrop.parentElement !== options.host || options.backdrop === panel)
      throw new TypeError('The backdrop must be a sibling of the sheet.')
  }
  if (options.keyboard !== undefined && !['follow', 'none'].includes(options.keyboard))
    throw new TypeError('Unknown keyboard policy.')
  if (options.dismissible !== undefined && typeof options.dismissible !== 'boolean')
    throw new TypeError('dismissible must be boolean.')
  for (const callback of [options.onChange, options.onDismiss])
    if (callback !== undefined && typeof callback !== 'function')
      throw new TypeError('Sheet callbacks must be functions.')
  validateSnaps(options.snap)
  const snaps = [...options.snap],
    opacity = bounded(options.backdropOpacity ?? 0.4, 'backdropOpacity', 0, 1)
  if (options.safeArea) effectOptions(options.safeArea, ['top', 'bottom'])
  const safeTop = bounded(options.safeArea?.top ?? 0, 'safeArea.top', 0, 10000),
    safeBottom = bounded(options.safeArea?.bottom ?? 0, 'safeArea.bottom', 0, 10000)
  const styles = new EffectStyles(panel),
    attributes = new Map<string, () => void>(),
    off: (() => void)[] = []
  const backdropStyles = options.backdrop ? new EffectStyles(options.backdrop) : undefined
  let ended = false,
    held = false,
    point: SheetSnap | null = null,
    wasOpen = false
  let focus: HTMLElement | undefined, gesture: WebGestures | undefined
  let binding: ReturnType<PlatformHost['bindLayer']> | undefined
  const keyboard = createKeyboardSubscription(() => {
    if (gesture) remeasure()
  }, host)
  const measure = () => {
    const rect = options.host.getBoundingClientRect()
    return sheetGeometry(
      snaps,
      options.host.clientHeight,
      rect.bottom,
      view.innerHeight,
      options.keyboard === 'none' ? 0 : keyboard.snapshot().height,
      safeTop,
      safeBottom,
      options.content?.scrollHeight ?? panel.scrollHeight,
    )
  }
  let geometry = measure()
  const bounds = () => ({
    left: 0,
    right: 0,
    top: Math.min(...geometry.stops.map((s) => s.y)),
    bottom: geometry.closedY,
  })
  const attr = (name: string, value: string) => {
    attributes.get(name)?.()
    attributes.set(name, ownAttribute(options.handle, name, value))
  }
  const callback = (fn: (() => void) | undefined) => {
    try {
      fn?.()
    } catch (error) {
      host.error(error)
    }
  }
  const display = () => {
    if (!gesture || ended) return
    const height = Math.max(0, geometry.height - gesture.y.get())
    if (backdropStyles) {
      backdropStyles.set(
        'opacity',
        String(
          opacity *
            Math.min(1, height / Math.max(1, ...geometry.stops.map((s) => s.height))),
        ),
      )
      backdropStyles.set('pointer-events', point === null ? 'none' : 'auto')
    }
    attr('aria-valuenow', String(Math.round(height)))
    attr('aria-valuetext', point === null ? 'Closed' : String(point))
  }
  const settled = () => {
    if (ended) return
    display()
    if (point === null) {
      styles.set('visibility', 'hidden')
      if (wasOpen) {
        wasOpen = false
        if (focus?.isConnected && panel.contains(host.document.activeElement))
          focus.focus({ preventScroll: true })
        callback(options.onDismiss)
      }
    }
  }
  const move = (next: SheetSnap | null, immediate = false) => {
    if (ended) return
    const stop = next === null ? undefined : geometry.stops.find((s) => s.point === next)
    if (next !== null && !stop) throw new RangeError('Unknown sheet snap point.')
    if (next !== null && point === null) {
      focus =
        options.returnFocus ??
        (host.document.activeElement instanceof view.HTMLElement
          ? host.document.activeElement
          : undefined)
      wasOpen = true
      styles.set('visibility', 'visible')
    }
    const changed = point !== next
    point = next
    if (immediate) {
      gesture?.jumpTo({ y: stop?.y ?? geometry.closedY })
      settled()
    } else gesture?.settleTo({ y: stop?.y ?? geometry.closedY })
    display()
    if (changed) callback(() => options.onChange?.(next))
  }
  function remeasure() {
    if (ended) return
    if (
      !panel.isConnected ||
      !options.host.isConnected ||
      panel.parentElement !== options.host ||
      !styles.owns() ||
      (binding && !binding.owns())
    ) {
      dispose()
      return
    }
    const next = measure()
    const changed = JSON.stringify(next) !== JSON.stringify(geometry)
    geometry = next
    styles.set('top', `${geometry.top}px`)
    styles.set('height', `${geometry.height + geometry.extension}px`)
    if (changed) gesture?.updateBounds(bounds())
    attr('aria-valuemax', String(Math.round(geometry.height)))
    if (changed) move(point, true)
  }
  function dispose() {
    if (ended) return
    ended = true
    keyboard.dispose()
    // Restore geometry while the binding still owns its geometry lease.
    styles.restore()
    binding?.dispose()
    gesture?.dispose()
    for (const cleanup of off.splice(0).reverse()) cleanup()
    for (const restore of attributes.values()) restore()
    backdropStyles?.restore()
  }
  const ordered = () => [...geometry.stops].sort((a, b) => a.height - b.height)
  const control: WebBottomSheet = {
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    get isOpen() {
      return point !== null
    },
    get snapPoint() {
      return point
    },
    get visibleHeight() {
      return gesture ? Math.max(0, geometry.height - gesture.y.get()) : 0
    },
    open(next = ordered()[0]!.point) {
      move(next)
    },
    snapTo: (next) => move(next),
    expand() {
      move(
        ordered().find((s) => s.height > control.visibleHeight + 1)?.point ??
          ordered().at(-1)!.point,
      )
    },
    collapse() {
      move(
        ordered()
          .reverse()
          .find((s) => s.height < control.visibleHeight - 1)?.point ??
          ordered()[0]!.point,
      )
    },
    dismiss() {
      if (options.dismissible !== false) move(null)
    },
    remeasure,
    pause() {
      if (!ended) {
        held = true
        gesture?.pause()
        keyboard.pause()
      }
    },
    play() {
      if (!ended) {
        held = false
        keyboard.play()
        gesture?.play()
      }
    },
    cancel() {
      if (!ended) move(point)
    },
    dispose,
  }
  try {
    off.push(effectOwnership(panel, 'sheet', host, dispose))
    styles.set('position', 'absolute')
    styles.set('left', '0px')
    styles.set('right', '0px')
    styles.set('margin', '0px')
    styles.set('box-sizing', 'border-box')
    styles.set('visibility', 'hidden')
    attr('role', 'slider')
    attr('tabindex', '0')
    attr('aria-orientation', 'vertical')
    attr('aria-valuemin', '0')
    attr('aria-label', options.label ?? 'Sheet height')
    gesture = host.gestures(panel, {
      pan: { axis: 'y', bounds: bounds() },
      initial: { y: geometry.closedY },
      spring: options.spring,
      scroll: options.scrollView ? { element: options.scrollView, axis: 'y' } : undefined,
      onEnd(event) {
        move(
          releaseStop(geometry, event.y, event.velocityY, options.dismissible !== false)
            ?.point ?? null,
        )
      },
      onCancel() {
        queueMicrotask(() => {
          if (!ended && !gesture?.active) move(point)
        })
      },
      onSettled: settled,
    })
    binding = host.bindLayer(panel, { y: gesture.y }, host.layer('sheet'))
    off.push(gesture.y.subscribe(display))
    const key = (event: KeyboardEvent) => {
      if (held || event.defaultPrevented) return
      if (event.key === 'ArrowUp') control.expand()
      else if (event.key === 'ArrowDown') control.collapse()
      else if (event.key === 'Home') move(ordered()[0]!.point)
      else if (event.key === 'End') move(ordered().at(-1)!.point)
      else if (event.key === 'Escape') control.dismiss()
      else return
      event.preventDefault()
    }
    options.handle.addEventListener('keydown', key)
    off.push(() => options.handle.removeEventListener('keydown', key))
    const click = () => {
      if (!held) control.dismiss()
    }
    options.backdrop?.addEventListener('click', click)
    off.push(() => options.backdrop?.removeEventListener('click', click))
    const observer = new view.ResizeObserver(remeasure)
    observer.observe(options.host)
    if (options.content) observer.observe(options.content)
    off.push(
      () => observer.disconnect(),
      host.register(panel, control, () => {
        if (!styles.owns() || !binding?.owns() || !panel.isConnected) dispose()
      }),
    )
    remeasure()
    display()
    return control
  } catch (error) {
    dispose()
    throw error
  }
}
