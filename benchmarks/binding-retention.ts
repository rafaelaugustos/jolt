import { Utils, isIOS, type View, type AbsoluteLayout } from '@nativescript/core'
import { set } from '../dist/index.js'
import { inspectViewBindings } from '../dist/motion-value.js'
import { inspectViewMotion } from '../dist/engine.js'
import { instrumentBudgetDriver } from './binding-budget-driver'
import { retentionProbe } from './binding-native-diagnostics'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
interface Work {
  start(): number
  dispose(): void
}
export async function runBindingRetention(
  canvas: AbsoluteLayout,
  mount: (count: number) => Promise<View[]>,
  workload: (views: View[]) => Work,
  ready: (views: View[]) => void,
  resources: () => unknown,
  live: () => { nodes: number; clock: number },
  publish: (progress: object) => void,
) {
  const weak = retentionProbe()
  const collect = async () => {
    Utils.GC()
    if (!isIOS) {
      java.lang.System.gc()
      java.lang.System.runFinalization()
    }
    await wait(300)
  }
  const settle = async () => {
    await collect()
    await collect()
    return weak.snapshot()
  }
  const rounds: object[] = []
  const progress = {
    views: 64,
    properties: 3,
    layers: 2,
    warmups: 3,
    measuredCycles: 12,
    collection:
      'two JS GC requests; Android also requests System.gc/runFinalization; 300ms after each',
    retainedControl: {} as Record<string, number>,
    releasedControl: {} as Record<string, number>,
    baseline: {} as object,
    rounds,
  }
  // Negative control: a deliberate strong reference must remain visible to the weak probe.
  let held: View[] = await mount(1)
  let heldNative: UIView | android.view.View | undefined = isIOS
    ? held[0]!.ios
    : held[0]!.android
  held.forEach((view) => weak.watch(view))
  canvas.removeChildren()
  const retainedControl = await settle()
  // Read after collection to keep the native proxy live across the await. Core
  // may clear View.nativeViewProtected when the view is detached.
  check(
    isIOS
      ? (heldNative as UIView).superview === null
      : (heldNative as android.view.View).getParent() === null,
    'Control view is still parented',
  )
  progress.retainedControl = retainedControl
  publish(progress)
  check(retainedControl.alive === 1, 'Weak probe missed the intentionally retained view')
  held = []
  heldNative = undefined
  const releasedControl = await settle()
  progress.releasedControl = releasedControl
  publish(progress)
  check(releasedControl.alive === 0, 'Released control view survived collection')
  weak.reset()
  const baseline = { heap: weak.snapshot(), resources: resources() }
  progress.baseline = baseline
  for (let cycle = 0; cycle < 15; cycle++) {
    let views = await mount(64)
    views.forEach((view) => weak.watch(view))
    ready(views)
    set(views, { x: 24, scale: 1.25 })
    let work: Work | undefined
    const diagnostic = instrumentBudgetDriver()
    try {
      work = workload(views)
      const startMs = work.start()
      await wait(250)
      const loaded = { heap: weak.snapshot(), resources: resources() }
      work.dispose()
      work.dispose()
      work = undefined
      check(
        views.every(
          (v) => inspectViewBindings(v).length === 0 && inspectViewMotion(v).length === 0,
        ),
        'Retained binding/channel',
      )
      canvas.removeChildren()
      views = []
      const disposed = diagnostic.snapshot()
      await wait(650)
      const idle = diagnostic.snapshot()
      for (const name of ['activeTracks', 'pendingFrames', 'pendingTimers'] as const)
        check(idle[name] === 0, `Retained ${name}`)
      for (const name of [
        'frameRequests',
        'frameCallbacks',
        'plays',
        'timerCallbacks',
        'endCallbacks',
      ] as const)
        check(idle[name] === disposed[name], `Work at rest: ${name}`)
      check(live().nodes === 0 && live().clock === 0, 'Retained live source')
      const uncollected = { heap: weak.snapshot(), resources: resources() }
      const heap = await settle()
      ready([])
      rounds.push({
        cycle,
        warmup: cycle < 3,
        startMs,
        loaded,
        uncollected,
        collected: { heap, resources: resources() },
        disposed,
        idle,
        live: live(),
      })
      publish(progress)
      check(
        heap.watched === 64 && heap.alive === 0,
        'Native views survived bounded collection',
      )
      weak.reset()
    } finally {
      work?.dispose()
      canvas.removeChildren()
      diagnostic.restore()
    }
  }
  return progress
}
