import {
  Application,
  isIOS,
  SharedTransition,
  Trace,
  Transition,
  View,
  type NavigationTransition,
} from '@nativescript/core'
import { onReducedMotion, reducedMotion, timeScale } from '../config.js'
import { springPhysics } from '../spring.js'
import { springs, type Spring } from '../transition.js'

export type InteractiveModalState =
  | 'ready'
  | 'presenting'
  | 'idle'
  | 'dragging'
  | 'finishing'
  | 'cancelling'
  | 'closed'
  | 'disposed'
export interface InteractiveModalEvent {
  state: InteractiveModalState
  outcome?: 'completed' | 'cancelled'
  /** Modal heights per second; supplied only at release. */
  release?: Readonly<{ progress: number; velocity: number }>
}
export interface InteractiveModalOptions {
  spring?:
    | keyof typeof springs
    | Pick<Spring, 'duration' | 'bounce' | 'stiffness' | 'damping' | 'mass'>
  /** Synchronous gesture gate. Core's cancelable:false is also respected. */
  canBegin?: () => boolean
  /** Boundaries only; gesture updates and settling execute in Objective-C. */
  onState?: (event: InteractiveModalEvent) => void
}
export interface InteractiveModal {
  readonly supported: boolean
  /** Use for one Core showModal / NativeScript-Vue $showModal presentation. */
  readonly transition: NavigationTransition | undefined
  readonly state: InteractiveModalState
  /** Close once, forwarding Core's callback arguments. Queues during opening. */
  close(...args: unknown[]): boolean
  /** Roll back a held drag; an already committed release finishes normally. */
  cancel(): void
  /** Detach without closing the modal. Core closeModal remains available. */
  dispose(): void
}

/** A full-window iOS modal transition using NativeScript's modal owner/delegate. */
export function interactiveModal(
  options: InteractiveModalOptions = {},
): InteractiveModal {
  const input =
    typeof options.spring === 'string' ? springs[options.spring] : options.spring
  if (options.spring !== undefined && !input) throw new TypeError('Unknown modal spring.')
  for (const [key, value] of Object.entries(input ?? {}) as [string, unknown][]) {
    if (!['type', 'duration', 'bounce', 'stiffness', 'damping', 'mass'].includes(key))
      throw new TypeError(`Unsupported modal spring option: ${key}.`)
    if (key === 'type' && value !== 'spring')
      throw new TypeError('Modal motion requires a spring.')
    if (key !== 'type' && (typeof value !== 'number' || !Number.isFinite(value)))
      throw new RangeError(`${key} must be finite.`)
    if (['duration', 'stiffness', 'mass'].includes(key) && (value as number) <= 0)
      throw new RangeError(`${key} must be positive.`)
    if (key === 'damping' && (value as number) < 0)
      throw new RangeError('damping must be nonnegative.')
  }
  const physics = springPhysics(input ?? springs.smooth)
  if (Object.values(physics).some((value) => !Number.isFinite(value)))
    throw new RangeError('Modal spring physics must be finite.')
  const supported =
    isIOS &&
    typeof JoltInteractiveModal !== 'undefined' &&
    typeof View.closedModallyEvent === 'string'
  let state: InteractiveModalState = 'ready'
  let transition: NavigationTransition | undefined
  let view: View | undefined, native: JoltInteractiveModal | undefined
  let start: (() => void) | undefined, offMotion: (() => void) | undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let pendingClose: unknown[] | undefined
  let disposing = false,
    suspended = false,
    shown = false,
    returning = false
  const update = (value: {
    interactiveBegan?: boolean
    interactiveCancelled?: boolean
  }) => {
    if (transition?.instance) SharedTransition.updateState(transition.instance.id, value)
  }
  const emit = (
    next: InteractiveModalState,
    outcome?: InteractiveModalEvent['outcome'],
    release?: InteractiveModalEvent['release'],
  ) => {
    if (state === 'disposed') return
    state = next
    try {
      options.onState?.({
        state,
        ...(outcome ? { outcome } : {}),
        ...(release ? { release } : {}),
      })
    } catch (error) {
      Trace.write(
        `Interactive modal observer failed: ${String(error)}`,
        'Jolt',
        Trace.messageType.error,
      )
    }
  }
  const release = () => {
    if (state === 'disposed') return
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    view?.off('shownModally', arrived)
    view?.off('closedModally', closed)
    view?.off('unloaded', unloaded)
    Application.off(Application.suspendEvent, suspend)
    Application.off(Application.resumeEvent, resume)
    offMotion?.()
    offMotion = undefined
    native?.dispose()
    native = undefined
    if (transition?.instance) SharedTransition.finishState(transition.instance.id)
    view = undefined
    start = undefined
    pendingClose = undefined
    emit('disposed')
  }
  const cancelled = () => {
    if (state === 'disposed') return
    // UIKit's dismissal completion must observe interactiveCancelled before we
    // clear it. Core clears interactiveBegan after preserving the modal's owner.
    const core = transition?.instance && SharedTransition.getState(transition.instance.id)
    if (core?.interactiveBegan) {
      timer = setTimeout(cancelled, 10)
      return
    }
    timer = undefined
    update({ interactiveCancelled: false })
    emit('idle', 'cancelled')
    if (disposing) release()
  }
  const arrived = () => {
    shown = true
    // UIKit skips animator creation for Core's animated:false. Keep ordinary
    // close usable; no native interactive recognizer is attached in that mode.
    if (state === 'ready') emit('idle')
    if (pendingClose && state === 'idle') {
      const args = pendingClose
      pendingClose = undefined
      control.close(...args)
    }
  }
  const closed = () => {
    if (state === 'disposed' || state === 'closed') return
    emit('closed', 'completed')
    release()
  }
  const checkDetached = () => {
    timer = undefined
    if (
      !suspended &&
      view &&
      !view.isLoaded &&
      !view.viewController?.presentingViewController
    )
      control.dispose()
  }
  const unloaded = () => {
    if (state === 'cancelling') return
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(checkDetached, 0)
  }
  const suspend = () => {
    suspended = true
    native?.cancel()
  }
  const resume = () => {
    suspended = false
    if (state !== 'cancelling') unloaded()
  }
  class ModalMotion extends Transition {
    override setupInteractiveGesture(callback: () => void, modal: View) {
      if (view || state === 'disposed')
        throw new Error('Use a fresh interactiveModal for each presentation.')
      view = modal
      start = callback
      view.on('shownModally', arrived)
      view.on('closedModally', closed)
      view.on('unloaded', unloaded)
    }
    override iosPresentedController(presented: UIViewController) {
      if (native || state === 'disposed' || !view) return undefined
      returning = false
      native = JoltInteractiveModal.attachStiffnessDampingMassShouldBeginOnEvent(
        presented,
        physics.stiffness,
        physics.damping,
        physics.mass,
        () => {
          try {
            return (
              !disposing &&
              shown &&
              state === 'idle' &&
              !suspended &&
              (options.canBegin?.() ?? true) === true
            )
          } catch {
            return false
          }
        },
        (event) => {
          if (state === 'disposed') return
          if (event === 2) {
            update({ interactiveBegan: true, interactiveCancelled: false })
            emit('dragging')
            start?.()
          } else if (event === 3 || event === 4) {
            update({ interactiveCancelled: event === 4 })
            emit(
              event === 3 ? 'finishing' : 'cancelling',
              undefined,
              native && { progress: native.progress, velocity: native.velocity },
            )
          } else if (event === 0) emit(returning ? 'finishing' : 'presenting')
          else if (event === 1) {
            emit('idle')
            if (disposing) release()
            else if (shown) arrived()
          } else if (event === 6) cancelled()
          // Core's closedModally event owns final disposal and callback delivery.
        },
      )
      native.preparePresentingReducedTimeScale(true, reducedMotion(), timeScale())
      return native
    }
    override iosDismissedController() {
      if (!native || state === 'disposed') return undefined
      returning = true
      native.preparePresentingReducedTimeScale(false, reducedMotion(), timeScale())
      return native
    }
    override iosInteractionDismiss() {
      return native?.interactive ? native : undefined
    }
  }
  const control: InteractiveModal = {
    supported,
    get transition() {
      return transition
    },
    get state() {
      return state
    },
    close(...args) {
      if (
        !supported ||
        disposing ||
        ['closed', 'disposed', 'dragging', 'finishing', 'cancelling'].includes(state)
      )
        return false
      if (!shown || state === 'presenting' || state === 'ready') {
        if (pendingClose) return false
        pendingClose = args
        return true
      }
      if (!view) return false
      update({ interactiveBegan: false, interactiveCancelled: false })
      emit('finishing')
      view.closeModal(...args)
      return true
    },
    cancel() {
      native?.cancel()
    },
    dispose() {
      if (state === 'disposed' || disposing) return
      disposing = true
      pendingClose = undefined
      native?.cancel()
      if (
        state !== 'dragging' &&
        state !== 'cancelling' &&
        state !== 'finishing' &&
        state !== 'presenting'
      )
        release()
    },
  }
  if (supported) {
    transition = SharedTransition.custom(new ModalMotion(), {
      interactive: { dismiss: {} },
    })
    Application.on(Application.suspendEvent, suspend)
    Application.on(Application.resumeEvent, resume)
    offMotion = onReducedMotion((value) => {
      if (value) control.cancel()
    })
  }
  return control
}
