import {
  Application,
  File,
  isIOS,
  knownFolders,
  type Frame,
  type View,
} from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import {
  sharedNavigationEntry,
  type SharedNavigationEntry,
  type SharedNavigationEntryEvent,
  type SharedNavigationRouteOptions,
} from '@rafaelaugusto/jolt/shared-navigation'
import { launchArgument, onLaunch } from '../launch'
declare const JoltSharedLayoutFlight: { activeCount(): number }
declare const JoltInteractiveNavigation: {
  activeCount(): number
  recognizerCount(): number
}
export const entryAudit = ref(false),
  entryMissing = ref(false),
  entryReduced = ref(false),
  entryShifted = ref(false),
  entryLocked = ref(false),
  entryCancelNext = ref(false)
export const entryResult = ref('Open a place. Bring it back by hand.')
export let sharedEntry: SharedNavigationEntry | undefined
const events: SharedNavigationEntryEvent[] = [],
  snapshots: object[] = []
let backCalls = 0
onLaunch(() => {
  entryAudit.value = launchArgument('shared-entry-audit') !== undefined
})
export async function openSharedEntry(
  frame: Frame,
  mode: string,
  open: (options: SharedNavigationRouteOptions) => unknown,
  back: (options: SharedNavigationRouteOptions) => Promise<boolean>,
) {
  if (sharedEntry && sharedEntry.state !== 'disposed') return
  configure({ reducedMotion: entryReduced.value ? 'always' : 'user' })
  entryLocked.value = false
  const delegate = isIOS ? frame.ios.controller.delegate : undefined
  const source = frame.currentPage
  function snapshot() {
    if (!entryAudit.value) return
    const visible: object[] = []
    function visit(view: View) {
      const native = view.nativeViewProtected
      if (view.sharedTransitionTag && native)
        visible.push({
          tag: view.sharedTransitionTag,
          visible: isIOS ? !native.hidden : native.getVisibility() === 0,
        })
      view.eachChildView((child) => {
        visit(child)
        return true
      })
    }
    visit(source)
    if (frame.currentPage !== source) visit(frame.currentPage)
    const native = isIOS ? undefined : (org.rafaelaugusto.jolt as any)
    const row = {
      state: control.state,
      page: frame.currentPage?.id,
      depth: frame.backStack.length,
      visible,
      flights: isIOS
        ? JoltSharedLayoutFlight.activeCount()
        : native.SharedLayoutFlight.activeCount(),
      active: isIOS
        ? JoltInteractiveNavigation.activeCount()
        : native.SharedNavigationScene.activeCount(),
      inputs: isIOS
        ? JoltInteractiveNavigation.recognizerCount()
        : native.PredictiveBackSession.callbackCount(),
      retained: isIOS ? 0 : native.SharedNavigationScene.retainedCount(),
      pixels: isIOS ? 0 : native.SharedNavigationScene.retainedPixelCount(),
      delegatePreserved: isIOS ? frame.ios.controller.delegate === delegate : true,
    }
    snapshots.push(row)
    const directory = isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
    File.fromPath(directory + '/jolt-shared-entry.json').writeTextSync(
      JSON.stringify({ ...row, backCalls, events, snapshots }),
    )
  }
  const control = sharedNavigationEntry(frame, {
    tag: mode === 'image' ? 'interactive-cove' : 'interactive-pass',
    spring: { duration: 480, bounce: 0 },
    back: async (options) => {
      backCalls++
      return back(options)
    },
    onState(event) {
      if (entryAudit.value) events.push(event)
      if (event.state === 'tracking' && entryCancelNext.value) {
        entryCancelNext.value = false
        setTimeout(() => control.cancel(), 180)
      }
      if (event.outcome === 'cancelled')
        entryResult.value = 'Changed your mind. Still connected.'
      if (event.outcome === 'completed')
        entryResult.value = 'One connection, all the way back.'
      if (entryAudit.value) void Promise.resolve().then(snapshot)
    },
  })
  sharedEntry = control
  const result = await control.open(open)
  if (result.reason) entryResult.value = 'A simple return. Nothing left behind.'
  snapshot()
}
