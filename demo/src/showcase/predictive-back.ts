import { Application, File, isAndroid, type View } from '@nativescript/core'
import { ref } from 'nativescript-vue'
import { configure } from '@rafaelaugusto/jolt'
import {
  predictiveBack,
  type PredictiveBack,
  type PredictiveBackEvent,
} from '@rafaelaugusto/jolt/predictive-back'
import { launchArgument, onLaunch } from '../launch'
export const backAudit = ref(false),
  backLocked = ref(false),
  backReduced = ref(false),
  backCancelNext = ref(false)
export const backResult = ref('A little room to change your mind.')
export let backControl: PredictiveBack | undefined
const events: PredictiveBackEvent[] = [],
  snapshots: object[] = []
let commits = 0
onLaunch(() => {
  backAudit.value = launchArgument('predictive-back-audit') !== undefined
})
export function bindBack(
  view: View,
  navigate: (options: { animated: false }) => Promise<boolean>,
) {
  configure({ reducedMotion: backReduced.value ? 'always' : 'user' })
  const Native = isAndroid
    ? (org.rafaelaugusto.jolt as any).PredictiveBackSession
    : undefined
  const nativeView = view.nativeViewProtected as android.view.View
  const frame = view.page?.frame
  function snapshot() {
    if (!backAudit.value) return
    const v = nativeView
    const row = {
      page: frame?.currentPage?.id,
      state: control.state,
      supported: control.supported,
      callbacks: Native?.callbackCount(),
      active: Native?.activeCount(),
      progressEvents: Native?.progressEventCount(),
      transform: v && [
        v.getTranslationX(),
        v.getTranslationY(),
        v.getScaleX(),
        v.getScaleY(),
        v.getAlpha(),
        v.getRotation(),
      ],
    }
    snapshots.push(row)
    const path =
      Application.android.context.getExternalFilesDir(null)!.getAbsolutePath() +
      '/jolt-predictive-back.json'
    File.fromPath(path).writeTextSync(
      JSON.stringify({ ...row, commits, events, snapshots }),
    )
  }
  const control = predictiveBack(
    view,
    { x: [0, 28], y: [0, 14], scale: [1, 0.9], rotate: [0, 0.6] },
    {
      spring: { duration: 380, bounce: 0 },
      commit: async (options) => {
        commits++
        return navigate(options)
      },
      onState(event) {
        events.push(event)
        if (event.state === 'tracking' && backCancelNext.value) {
          backCancelNext.value = false
          setTimeout(() => control.cancel(), 220)
        }
        if (event.outcome === 'cancelled')
          backResult.value =
            event.reason === 'rejected'
              ? 'Stay a while. Your place is saved.'
              : 'Changed your mind. Still here.'
        if (event.outcome === 'completed') backResult.value = 'Back, on your terms.'
        if (event.state === 'disposed' && backControl === control) backControl = undefined
        void Promise.resolve().then(snapshot)
      },
    },
  )
  backControl = control
  snapshot()
  return control
}
