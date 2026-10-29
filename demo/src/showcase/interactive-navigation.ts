import { Application, File, knownFolders, type Frame } from '@nativescript/core'
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
export const interactiveLifecycleAudit = ref(false)
export const interactiveLocked = ref(false)
export const interactiveReduced = ref(false)
export const interactiveCancelNext = ref(false)
export const interactiveEvents: InteractiveNavigationEvent[] = []
const snapshots: object[] = []
export let interactiveControl: InteractiveNavigation | undefined
const controls: InteractiveNavigation[] = []
let lifecycleFrame: Frame | undefined, lifecycleDelegate: unknown
const lifecycleSnapshots: object[] = []
const pageIdentities = new WeakMap<object, number>()
let nextIdentity = 0
function identity(page: object | undefined) {
  if (!page) return null
  if (!pageIdentities.has(page)) pageIdentities.set(page, ++nextIdentity)
  return pageIdentities.get(page)
}
export function interactiveCheckpoint(name: string) {
  if (!interactiveLifecycleAudit.value || !lifecycleFrame) return
  const frame = lifecycleFrame,
    nav = frame.ios.controller
  const pages = [...frame.backStack.map((entry) => entry.resolvedPage), frame.currentPage]
  const matrix = (view: UIView) => {
    const m = view.transform
    return [m.a, m.b, m.c, m.d, m.tx, m.ty]
  }
  const pans: object[] = []
  const gestures = nav.view.gestureRecognizers
  for (let i = 0; i < (gestures?.count ?? 0); i++) {
    const gesture = gestures.objectAtIndex(i)
    if (gesture instanceof UIScreenEdgePanGestureRecognizer)
      pans.push({ state: gesture.state, enabled: gesture.enabled })
  }
  lifecycleSnapshots.push({
    name,
    time: Date.now(),
    state: interactiveControl?.state ?? 'disposed',
    events: interactiveEvents.length,
    page: identity(frame.currentPage),
    backStack: frame.backStack.map((entry) => identity(entry.resolvedPage)),
    nativeStack: nav.viewControllers.count,
    nativeActive: JoltInteractiveNavigation.activeCount(),
    recognizers: JoltInteractiveNavigation.recognizerCount(),
    delegatePreserved: nav.delegate === lifecycleDelegate,
    frameLoaded: frame.isLoaded,
    orientation: nav.view.window?.windowScene?.interfaceOrientation,
    deviceOrientation: UIDevice.currentDevice.orientation,
    viewport: { width: nav.view.bounds.size.width, height: nav.view.bounds.size.height },
    pans,
    pages: pages
      .filter((page) => page?.ios?.viewLoaded)
      .map((page) => ({
        identity: identity(page),
        transform: matrix(page!.ios.view),
        bounds: {
          width: page!.ios.view.bounds.size.width,
          height: page!.ios.view.bounds.size.height,
        },
      })),
  })
  File.fromPath(
    knownFolders.documents().path + '/jolt-navigation-lifecycle.json',
  ).writeTextSync(
    JSON.stringify({ events: interactiveEvents, snapshots: lifecycleSnapshots }),
  )
}
onLaunch(() => {
  interactiveAudit.value = launchArgument('interactive-navigation-audit') !== undefined
  interactiveLifecycleAudit.value =
    launchArgument('interactive-navigation-lifecycle') !== undefined
  if (interactiveLifecycleAudit.value) {
    UIDevice.currentDevice.beginGeneratingDeviceOrientationNotifications()
    Application.ios.addNotificationObserver(
      UIDeviceOrientationDidChangeNotification,
      () => interactiveCheckpoint('device-orientation'),
    )
  }
})
Application.on(Application.suspendEvent, () => interactiveCheckpoint('background'))
Application.on(Application.resumeEvent, () => {
  if (interactiveLifecycleAudit.value)
    setTimeout(() => interactiveCheckpoint('foreground'), 250)
})
Application.on(Application.orientationChangedEvent, () => {
  if (interactiveLifecycleAudit.value)
    setTimeout(() => interactiveCheckpoint('orientation'), 500)
})

export function createInteractiveEntry(frame: Frame) {
  const delegate = frame.ios.controller.delegate
  if (interactiveLifecycleAudit.value) {
    lifecycleFrame = frame
    lifecycleDelegate = delegate
  }
  interactiveLocked.value = false
  const motion = interactiveNavigation(frame, {
    spring: { duration: 480, bounce: 0 },
    onState(event) {
      interactiveEvents.push(event)
      if (interactiveLifecycleAudit.value) {
        void Promise.resolve().then(() => interactiveCheckpoint('event-' + event.state))
        if (event.state === 'dragging')
          for (const delay of [350, 700, 1100, 1700, 2600, 3600])
            setTimeout(() => interactiveCheckpoint('gesture-sample'), delay)
      }
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
