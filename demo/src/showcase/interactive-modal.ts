import { Application, File, knownFolders, type View } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import {
  interactiveModal,
  type InteractiveModal,
} from '@rafaelaugusto/jolt/interactive-navigation'
import { launchArgument } from '../launch'

declare const JoltInteractiveModal: { activeCount(): number; recognizerCount(): number }
export const modalResult = ref('A moment of your own.')
export const modalLocked = ref(false),
  modalCancelNext = ref(false)
export const modalReduced = ref(false)
export const modalCloseOnOpen = ref(false),
  modalNoncancelable = ref(false)
export const modalDisposeNext = ref(false),
  modalInstant = ref(false),
  modalScroll = ref(false)
export let modalMotion: InteractiveModal | undefined
let root: View | undefined, host: View | undefined
let callbacks = 0,
  unmounts = 0
const events: object[] = []
export function modalAuditEnabled() {
  return launchArgument('interactive-modal-audit') !== undefined
}
export function modalSnapshot(name: string, extra?: unknown) {
  if (!modalAuditEnabled()) return
  const controller = root?.viewController as UIViewController | undefined
  const matrix = controller?.view.transform
  events.push({
    name,
    time: Date.now(),
    state: modalMotion?.state,
    callbacks,
    unmounts,
    loaded: root?.isLoaded ?? false,
    attached: !!(root as any)?._modalParent,
    presented: !!controller?.presentingViewController,
    active: JoltInteractiveModal.activeCount(),
    recognizers: JoltInteractiveModal.recognizerCount(),
    transform: matrix && [matrix.a, matrix.b, matrix.c, matrix.d, matrix.tx, matrix.ty],
    page: host?.page?.id,
    depth: host?.page?.frame?.backStack.length,
    orientation: controller?.view.window?.windowScene?.interfaceOrientation,
    extra,
  })
  File.fromPath(
    knownFolders.documents().path + '/jolt-interactive-modal.json',
  ).writeTextSync(JSON.stringify({ events }))
}
export function modalRoot(view: View) {
  root = view
  modalSnapshot('loaded')
}
export function modalUnmounted() {
  unmounts++
  modalSnapshot('unmounted')
}
export function modalClosed(value: unknown) {
  callbacks++
  modalResult.value = 'Back, on your terms.'
  modalSnapshot('callback', value)
  setTimeout(() => modalSnapshot('closed-settled'), 100)
}
export function createModalMotion(presenter: View) {
  host = presenter
  root = undefined
  modalLocked.value = false
  const motion = interactiveModal({
    spring: { duration: 480, bounce: 0 },
    canBegin: () => !modalLocked.value,
    onState(event) {
      modalSnapshot('state', event)
      if (event.state === 'presenting' && modalCloseOnOpen.value) {
        modalCloseOnOpen.value = false
        modalSnapshot('early-close', [motion.close('early'), motion.close('duplicate')])
      }
      if (event.outcome === 'cancelled')
        modalResult.value = 'Changed your mind. Still here.'
      if (event.state === 'dragging' && modalCancelNext.value) {
        modalCancelNext.value = false
        setTimeout(() => motion.cancel(), 150)
      }
      if (event.state === 'dragging' && modalDisposeNext.value) {
        modalDisposeNext.value = false
        setTimeout(() => motion.dispose(), 150)
      }
      setTimeout(() => modalSnapshot('state-settled', event), 100)
    },
  })
  modalMotion = motion
  return motion
}
Application.on(Application.suspendEvent, () => modalSnapshot('background'))
Application.on(Application.resumeEvent, () =>
  setTimeout(() => modalSnapshot('foreground'), 250),
)
