declare const JoltSharedLayoutFlight: { activeCount(): number }
import {
  Application,
  File,
  knownFolders,
  isIOS,
  type Frame,
  type View,
} from '@nativescript/core'
import { ref } from 'nativescript-vue'
import {
  sharedNavigation,
  type SharedNavigation,
  type SharedNavigationResult,
} from '@rafaelaugusto/jolt/shared-navigation'
import { launchArgument, onLaunch } from '../launch'
export const navigationResult = ref('Tap a place. Keep the connection.')
export const navigationResults: SharedNavigationResult[] = []
export const navigationMissing = ref(false)
export const navigationReduced = ref(false)
export const navigationShifted = ref(false)
let owner: Frame | undefined, control: SharedNavigation | undefined
export const navigationChecks = ref(false)
onLaunch(() => {
  navigationChecks.value = launchArgument('shared-navigation-audit') !== undefined
})
export function navigateShared(
  view: View,
  tag: string,
  navigate: (options: { animated: false }) => unknown,
) {
  const frame = view.page.frame
  if (owner !== frame || !control || control.state === 'disposed') {
    owner = frame
    control = sharedNavigation(frame, {
      transition: { type: 'spring', duration: 650, bounce: 0.12 },
      layoutTimeout: 1500,
    })
  }
  const animation = control.navigate({ tag, navigate })
  animation.finished.then((result) => {
    navigationResults.push(result)
    navigationResult.value =
      result.status === 'completed'
        ? 'Connected, there and back.'
        : result.reason === 'missing-target'
          ? 'No target. The route still works.'
          : result.reason === 'reduced-motion'
            ? 'Reduced motion. Same destination.'
            : `${result.status}: ${result.reason || ''}`
    if (!navigationChecks.value) return
    const visible: { tag: string; visible: boolean }[] = []
    function visit(node: View) {
      if (node.sharedTransitionTag)
        visible.push({
          tag: node.sharedTransitionTag,
          visible: isIOS
            ? !node.nativeViewProtected.hidden
            : node.nativeViewProtected.getVisibility() === 0,
        })
      node.eachChildView((child) => {
        visit(child)
        return true
      })
    }
    visit(frame.currentPage)
    const report = JSON.stringify({
      results: navigationResults,
      state: control?.state,
      nativeActive: isIOS
        ? JoltSharedLayoutFlight.activeCount()
        : (org.rafaelaugusto.jolt as any).SharedLayoutFlight.activeCount(),
      visible,
    })
    File.fromPath(
      knownFolders.documents().path + '/jolt-shared-navigation.json',
    ).writeTextSync(report)
    if (!isIOS) {
      const folder = Application.android.context?.getExternalFilesDir(null)
      if (folder)
        File.fromPath(
          folder.getAbsolutePath() + '/jolt-shared-navigation.json',
        ).writeTextSync(report)
    }
    console.log('JOLT_NAVIGATION ' + report)
  })
  return animation
}
