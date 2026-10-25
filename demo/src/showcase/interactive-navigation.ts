import { File, knownFolders, type Frame } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import {
  interactiveNavigation,
  type InteractiveNavigation,
  type InteractiveNavigationEvent,
} from '@rafaelaugusto/jolt/interactive-navigation'
import { launchArgument, onLaunch } from '../launch'

declare const JoltInteractiveNavigation: {
  activeCount(): number
  recognizerCount(): number
}
export const interactiveResult = ref('Your pace. Your way back.')
export const interactiveAudit = ref(false)
export const interactiveLocked = ref(false)
export const interactiveReduced = ref(false)
export const interactiveCancelNext = ref(false)
export const interactiveEvents: InteractiveNavigationEvent[] = []
const snapshots: object[] = []
export let interactiveControl: InteractiveNavigation | undefined
const controls: InteractiveNavigation[] = []
onLaunch(() => {
  interactiveAudit.value = launchArgument('interactive-navigation-audit') !== undefined
})

export function createInteractiveEntry(frame: Frame) {
  const delegate = frame.ios.controller.delegate
  interactiveLocked.value = false
  const motion = interactiveNavigation(frame, {
    spring: { duration: 480, bounce: 0 },
    onState(event) {
      interactiveEvents.push(event)
      if (event.state === 'dragging' && interactiveCancelNext.value) {
        interactiveCancelNext.value = false
        setTimeout(() => motion.cancel(), 150)
      }
      if (event.state === 'disposed') {
        const index = controls.indexOf(motion)
        if (index !== -1) controls.splice(index, 1)
        interactiveControl = controls.at(-1)
      }
      if (event.outcome === 'cancelled')
        interactiveResult.value = 'Changed your mind. Still here.'
      if (event.outcome === 'completed') interactiveResult.value = 'Back, on your terms.'
      if (!interactiveAudit.value) return
      void Promise.resolve().then(() => {
        const transform = frame.currentPage?.ios.view.transform
        snapshots.push({
          event,
          page: frame.currentPage?.id,
          stackDepth: frame.backStack.length,
          nativeActive: JoltInteractiveNavigation.activeCount(),
          recognizers: JoltInteractiveNavigation.recognizerCount(),
          transform: transform && [
            transform.a,
            transform.b,
            transform.c,
            transform.d,
            transform.tx,
            transform.ty,
          ],
        })
        const report = {
          events: interactiveEvents,
          snapshots,
          state: motion.state,
          page: frame.currentPage?.id,
          backStack: frame.backStack.map((entry) => entry.resolvedPage?.id),
          nativeActive: JoltInteractiveNavigation.activeCount(),
          recognizers: JoltInteractiveNavigation.recognizerCount(),
          delegatePreserved: frame.ios.controller.delegate === delegate,
          transform: frame.currentPage?.ios.view.transform,
        }
        File.fromPath(
          knownFolders.documents().path + '/jolt-interactive-navigation.json',
        ).writeTextSync(JSON.stringify(report))
        console.log('JOLT_INTERACTIVE_NAVIGATION ' + JSON.stringify(report))
      })
    },
  })
  controls.push(motion)
  interactiveControl = motion
  return motion
}
