import type { SpringParams } from '../core/spring.js'
import { effectOptions, effectOwnership, effectTarget } from './effect.js'
import type { WebInteraction } from './interaction.js'
import type { PlatformHost } from './platform-host.js'
import type { WebGestures } from './gestures.js'

export type WebModalState =
  'closed' | 'opening' | 'open' | 'dragging' | 'closing' | 'disposed'
export interface WebInteractiveModalOptions {
  /** Drag surface inside the dialog; interactive descendants retain their input. */
  handle?: HTMLElement
  spring?: SpringParams
  canBegin?: () => boolean
  onState?: (state: WebModalState) => void
  returnFocus?: HTMLElement
}
export interface WebInteractiveModal extends WebInteraction {
  readonly state: WebModalState
  open(): void
  close(returnValue?: string): boolean
  /** Roll back an interactive or requested dismissal. The dialog remains open. */
  cancel(): void
}

export function createInteractiveModal(
  dialog: HTMLDialogElement,
  options: WebInteractiveModalOptions,
  host: PlatformHost,
): WebInteractiveModal {
  const view = effectTarget(dialog, host)
  effectOptions(options, ['handle', 'spring', 'canBegin', 'onState', 'returnFocus'])
  if (
    !(dialog instanceof view.HTMLDialogElement) ||
    typeof dialog.showModal !== 'function' ||
    dialog.open
  )
    throw new TypeError(
      'interactiveModal needs a mounted, initially closed HTMLDialogElement.',
    )
  const surface = options.handle ?? dialog
  effectTarget(surface, host)
  if (!dialog.contains(surface))
    throw new TypeError('The modal handle must belong to its dialog.')
  for (const fn of [options.canBegin, options.onState])
    if (fn !== undefined && typeof fn !== 'function')
      throw new TypeError('Modal callbacks must be functions.')
  let state: WebModalState = 'closed',
    ended = false,
    held = false,
    result = ''
  let gesture: WebGestures | undefined,
    binding: ReturnType<PlatformHost['bindLayer']> | undefined,
    focus: HTMLElement | undefined
  const off: (() => void)[] = []
  const notify = (next: WebModalState) => {
    if (state === next) return
    state = next
    try {
      options.onState?.(next)
    } catch (error) {
      host.error(error)
    }
  }
  const distance = () =>
    Math.max(
      1,
      view.innerHeight - dialog.getBoundingClientRect().top + gesture!.y.get() + 32,
    )
  const bounds = () =>
    gesture!.updateBounds({ left: 0, right: 0, top: 0, bottom: distance() })
  const settled = () => {
    if (ended) return
    if (state === 'closing') {
      // showModal/close own the browser top layer, focus and inert background.
      releaseInput()
      dialog.close(result)
      notify('closed')
      if (
        !dialog.open &&
        focus?.isConnected &&
        (host.document.activeElement === host.document.body ||
          dialog.contains(host.document.activeElement))
      )
        focus.focus({ preventScroll: true })
    } else if (dialog.open) notify('open')
  }
  const cancel = () => {
    if (ended || !dialog.open) return
    notify('opening')
    if (!ended && state === 'opening' && dialog.open) gesture?.settleTo({ y: 0 })
  }
  const dispose = () => {
    if (ended) return
    ended = true
    gesture?.dispose()
    binding?.dispose()
    for (const cleanup of off.splice(0).reverse()) cleanup()
    notify('disposed')
  }
  const releaseInput = () => {
    gesture?.dispose()
    binding?.dispose()
    gesture = undefined
    binding = undefined
  }
  function setupInput() {
    gesture = host.gestures(dialog, {
      pan: {
        axis: 'y',
        bounds: { top: 0, bottom: view.innerHeight + 64, left: 0, right: 0 },
      },
      spring: options.spring,
      onContactStart(event) {
        const rect = surface.getBoundingClientRect()
        let allowed =
          dialog.open &&
          !held &&
          state !== 'closing' &&
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        try {
          if (allowed && options.canBegin) allowed = options.canBegin()
        } catch (error) {
          allowed = false
          host.error(error)
        }
        if (!allowed) gesture?.cancel()
        else bounds()
      },
      onStart() {
        notify('dragging')
      },
      onEnd(event) {
        if (event.y + event.velocityY * 0.2 > Math.max(80, dialog.offsetHeight * 0.3))
          handle.close()
        else cancel()
      },
      onCancel() {
        if (!ended && state === 'dragging')
          queueMicrotask(() => {
            if (!ended && state === 'dragging') cancel()
          })
      },
      onSettled: settled,
    })
    binding = host.bindLayer(dialog, { y: gesture.y }, host.layer('modal'))
  }
  const handle: WebInteractiveModal = {
    get state() {
      return state
    },
    get disposed() {
      return ended
    },
    get paused() {
      return held
    },
    open() {
      if (ended || held || dialog.open) return
      focus =
        options.returnFocus ??
        (host.document.activeElement instanceof view.HTMLElement
          ? host.document.activeElement
          : undefined)
      dialog.showModal()
      try {
        setupInput()
      } catch (error) {
        releaseInput()
        dialog.close()
        throw error
      }
      bounds()
      gesture!.jumpTo({ y: host.reduced() ? 0 : distance() })
      notify('opening')
      if (!ended && state === 'opening' && dialog.open) gesture?.settleTo({ y: 0 })
    },
    close(returnValue = '') {
      if (typeof returnValue !== 'string')
        throw new TypeError('Dialog returnValue must be a string.')
      if (ended || held || !dialog.open || state === 'closing') return false
      result = returnValue
      bounds()
      notify('closing')
      if (ended || handle.state !== 'closing' || !dialog.open) return false
      gesture!.settleTo({ y: distance() })
      return true
    },
    cancel,
    pause() {
      if (!ended) {
        held = true
        gesture?.pause()
      }
    },
    play() {
      if (!ended) {
        held = false
        gesture?.play()
      }
    },
    dispose,
  }
  try {
    off.push(effectOwnership(dialog, 'modal', host, dispose))
    const escape = (event: Event) => {
      event.preventDefault()
      handle.close()
    }
    const closed = () => {
      if (!dialog.open && !ended) {
        releaseInput()
        notify('closed')
      }
    }
    dialog.addEventListener('cancel', escape)
    dialog.addEventListener('close', closed)
    off.push(
      () => dialog.removeEventListener('cancel', escape),
      () => dialog.removeEventListener('close', closed),
    )
    const resize = () => {
      if (dialog.open && !ended) {
        bounds()
        if (state === 'closing') gesture?.settleTo({ y: distance() })
        else cancel()
      }
    }
    view.addEventListener('resize', resize)
    off.push(() => view.removeEventListener('resize', resize))
    off.push(
      host.register(host.document.documentElement, handle, () => {
        if (!dialog.isConnected || (binding && dialog.open && !binding.owns())) dispose()
        else if (!dialog.open) {
          releaseInput()
          notify('closed')
        }
      }),
    )
    return handle
  } catch (error) {
    dispose()
    throw error
  }
}
