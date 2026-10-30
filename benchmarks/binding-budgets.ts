import {
  Application,
  AbsoluteLayout,
  Button,
  Color,
  Device,
  File,
  GridLayout,
  Label,
  Page,
  isIOS,
  knownFolders,
  type View,
} from '@nativescript/core'
import { animate, bind, motionValue, set, stop, type Animation } from '../dist/index.js'
import { getDriver } from '../dist/driver/index.js'
import { inspectViewBindings } from '../dist/motion-value.js'
import { inspectViewMotion } from '../dist/engine.js'
import {
  budgetCases,
  budgetSettings as settings,
  layerDuration,
  type BudgetCase,
} from './binding-budget-plan'
import { instrumentBudgetDriver } from './binding-budget-driver'
import { mountInputBudget } from './binding-budget-input'

declare const __BENCHMARK_BUILD__: Record<string, unknown>
interface Resources {
  timeMs: number
  cpuMs: number
  memoryBytes: number
  memoryMetric: string
  thermalState: number
  lowPowerMode: boolean
}
interface NativeProbe {
  finish(): string
  cancel(): void
}
declare const JoltBudgetProbe: {
  environment(): string
  resources(): string
  start(target: UIView): NativeProbe
}
declare const org: {
  rafaelaugusto: {
    jolt: {
      LiveSpring: { nodeCount(): number; activeCount(): number }
      fixture: {
        BudgetProbe: {
          new (view: android.view.View): NativeProbe
          resources(view: android.view.View): string
          environment(view: android.view.View): string
        }
      }
    }
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const now = () => getDriver().now()
const option = (name: string) => {
  if (isIOS) {
    const args = NSProcessInfo.processInfo.arguments
    for (let i = 0; i < args.count; i++) {
      const value = String(args.objectAtIndex(i))
      if (value.startsWith(`--${name}=`)) return value.slice(name.length + 3)
    }
    return undefined
  }
  return (
    (Application.android.foregroundActivity ?? Application.android.startActivity)
      ?.getIntent()
      .getStringExtra(name) ?? undefined
  )
}
let suspensions = 0
Application.on(Application.suspendEvent, () => suspensions++)
const resources = (view: View): Resources =>
  JSON.parse(
    isIOS
      ? JoltBudgetProbe.resources()
      : org.rafaelaugusto.jolt.fixture.BudgetProbe.resources(view.android),
  )
const environment = (view: View) =>
  JSON.parse(
    isIOS
      ? JoltBudgetProbe.environment()
      : org.rafaelaugusto.jolt.fixture.BudgetProbe.environment(view.android),
  )
const probe = (view: View): NativeProbe =>
  isIOS
    ? JoltBudgetProbe.start(view.ios)
    : new org.rafaelaugusto.jolt.fixture.BudgetProbe(view.android)
const live = () =>
  isIOS
    ? { nodes: JoltLiveSpring.nodeCount(), clock: JoltLiveSpring.activeCount() }
    : {
        nodes: org.rafaelaugusto.jolt.LiveSpring.nodeCount(),
        clock: org.rafaelaugusto.jolt.LiveSpring.activeCount(),
      }
function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}

function workload(item: BudgetCase, views: View[]) {
  const handles: Animation[] = []
  const value = motionValue(settings.baseX)
  let removeBinding: (() => void) | undefined, removeObserver: (() => void) | undefined
  let observations = 0,
    ended = false
  const begin = now()
  if (item.path === 'value')
    removeBinding = bind(
      views,
      item.properties === 1
        ? { x: value }
        : {
            x: value,
            scale: value.to([24, 48], [settings.baseScale, 1.35], { clamp: false }),
          },
    )
  const bindMs = now() - begin
  return {
    bindMs,
    start() {
      const start = now()
      if (item.observe) removeObserver = value.subscribe(() => observations++)
      if (item.playback === 'finite') {
        const options = { duration: settings.finiteDurationMs, ease: 'linear' as const }
        handles.push(
          item.path === 'value'
            ? animate(value, [24, 48, 24], options)
            : animate(
                views,
                item.properties === 1
                  ? { x: [24, 48, 24] }
                  : { x: [24, 48, 24], scale: [1.25, 1.35, 1.25] },
                options,
              ),
        )
      }
      for (let layer = 0; layer < item.layers; layer++) {
        const amplitude = 12 / item.layers
        const options = {
          duration: layerDuration(item, layer),
          ease: 'linear' as const,
          layer: `budget-${layer}`,
          repeat: item.playback === 'finite' ? 0 : Infinity,
          repeatType: 'reverse' as const,
        }
        handles.push(
          item.path === 'value'
            ? animate(value, [0, amplitude, 0], options)
            : animate(
                views,
                { x: [0, amplitude, 0], scale: [1, 1 + 0.1 / item.layers, 1] },
                options,
              ),
        )
      }
      return now() - start
    },
    observations: () => observations,
    async completion() {
      return Promise.all(handles.map((h) => h.finished))
    },
    dispose() {
      if (ended) return
      ended = true
      removeObserver?.()
      // Unbind first: stopping a source must not recompile all bindings during teardown.
      removeBinding?.()
      stop(value)
      handles.forEach((h) => h.stop())
      stop(views)
    },
  }
}

function createPage() {
  const page = new Page()
  page.actionBarHidden = true
  page.backgroundColor = new Color('#101413')
  const root = new GridLayout()
  root.rows = 'auto, auto, auto, *, auto'
  root.padding = 24
  const title = new Label()
  title.text = 'JOLT / MOTION LAB'
  title.fontSize = 13
  title.letterSpacing = 0.15
  title.color = new Color('#d6ff5f')
  root.addChild(title)
  const heading = new Label()
  heading.text = 'Room to move.'
  heading.fontSize = 34
  heading.fontWeight = 'bold'
  heading.color = new Color('#f4f5ee')
  heading.marginTop = 16
  heading.marginBottom = 10
  GridLayout.setRow(heading, 1)
  root.addChild(heading)
  const status = new Label()
  status.automationText = 'budget-status'
  status.text = 'Bindings · layers · native playback'
  status.textWrap = true
  status.fontSize = 14
  status.color = new Color('#a6b4ac')
  status.marginBottom = 20
  GridLayout.setRow(status, 2)
  root.addChild(status)
  const canvas = new AbsoluteLayout()
  canvas.backgroundColor = new Color('#19221e')
  canvas.borderRadius = 22
  canvas.clipToBounds = true
  GridLayout.setRow(canvas, 3)
  root.addChild(canvas)
  const button = new Button()
  button.text = 'Run measurement'
  button.automationText = 'budget-run'
  button.marginTop = 18
  button.backgroundColor = new Color('#d6ff5f')
  button.color = new Color('#101413')
  button.borderRadius = 16
  GridLayout.setRow(button, 4)
  root.addChild(button)
  page.content = root
  let running = false,
    aborted = false
  page.on('unloaded', () => {
    aborted = true
  })

  const mount = async (count: number) => {
    canvas.removeChildren()
    const width = canvas.getActualSize().width
    const height = canvas.getActualSize().height
    const columns = Math.ceil(Math.sqrt((count * width) / height))
    const rows = Math.ceil(count / columns)
    const cellW = (width - 58) / columns,
      cellH = (height - 32) / rows
    const size = Math.max(5, Math.min(40, cellW - 6, cellH - 6))
    const views = Array.from({ length: count }, (_, i) => {
      const view = new GridLayout()
      view.width = view.height = size
      view.borderRadius = Math.min(10, size / 3)
      view.backgroundColor = new Color(
        ['#d6ff5f', '#83c9ad', '#e6d5a1', '#b09ce8'][i % 4]!,
      )
      AbsoluteLayout.setLeft(view, 4 + (i % columns) * cellW)
      AbsoluteLayout.setTop(view, 16 + Math.floor(i / columns) * cellH)
      canvas.addChild(view)
      return view
    })
    await wait(350)
    check(
      views.every((v) => v.isLoaded && v.getActualSize().width > 0),
      'Tiles were not laid out.',
    )
    return views
  }
  const reset = (views: View[]) =>
    set(views, { x: settings.baseX, scale: settings.baseScale })
  const save = (report: object) => {
    const path = isIOS
      ? knownFolders.documents().path
      : Application.android.context.getExternalFilesDir(null)!.getAbsolutePath()
    const input = (report as { input?: string }).input
    File.fromPath(
      `${path}/${input ? `binding-input-${input}` : 'binding-budgets'}.json`,
    ).writeTextSync(JSON.stringify(report))
  }
  async function run() {
    if (running) return
    running = true
    aborted = false
    button.isEnabled = false
    const beforeSuspend = suspensions
    const previousIdle = isIOS ? UIApplication.sharedApplication.idleTimerDisabled : false
    if (isIOS) UIApplication.sharedApplication.idleTimerDisabled = true
    else page.android.setKeepScreenOn(true)
    const env = environment(canvas)
    const filter = option('budget-case')
    const selected = filter ? budgetCases.filter((c) => c.id === filter) : budgetCases
    const report = {
      schema: 1,
      session: option('budget-session') ?? `${Date.now()}`,
      startedAt: new Date().toISOString(),
      build: __BENCHMARK_BUILD__,
      device: env,
      platform: Device.os,
      settings,
      selected: selected.map((c) => c.id),
      recording: option('budget-recording') === 'true',
      cases: [] as object[],
      completed: false,
      error: undefined as string | undefined,
      finalResources: {},
    }
    const ready = (views: View[]) => {
      check(
        !aborted && suspensions === beforeSuspend,
        'Run interrupted by navigation/backgrounding.',
      )
      check(
        isIOS
          ? UIApplication.sharedApplication.applicationState === UIApplicationState.Active
          : page.android.hasWindowFocus(),
        'App lost foreground focus.',
      )
      const state = resources(canvas)
      check(
        state.thermalState === 0 && !state.lowPowerMode,
        'Use nominal temperature with power saving disabled.',
      )
      check(
        views.every((v) => v.isLoaded),
        'Tile unloaded.',
      )
    }
    let current: ReturnType<typeof workload> | undefined
    let sampler: NativeProbe | undefined
    let diagnostic: ReturnType<typeof instrumentBudgetDriver> | undefined
    try {
      check(selected.length > 0, 'Unknown workload.')
      check(
        env.physical || option('budget-allow-simulator') === 'true',
        'Physical device required. Harness-only checks need --budget-allow-simulator=true.',
      )
      check(
        isIOS ? !env.reduceMotion : env.animatorScale === 1,
        'Use ordinary animation settings for measurements.',
      )
      for (const item of selected) {
        status.text = `${item.views} views · ${item.layers} layers\n${item.id}`
        const views = await mount(item.views)
        reset(views)
        await wait(120)
        ready(views)
        const before = resources(canvas)
        const preparation: { kind: string; bindMs: number; startMs: number }[] = []
        for (
          let iteration = -settings.warmups - 1;
          iteration < settings.preparations;
          iteration++
        ) {
          reset(views)
          await wait(80)
          ready(views)
          current = workload(item, views)
          const startMs = current.start()
          if (iteration === -settings.warmups - 1 || iteration >= 0)
            preparation.push({
              kind: iteration < 0 ? 'first-use-in-process' : 'warm',
              bindMs: current.bindMs,
              startMs,
            })
          current.dispose()
          current.dispose()
          current = undefined
        }
        const trials: object[] = []
        for (let trial = 0; trial < settings.trials; trial++) {
          reset(views)
          await wait(120)
          ready(views)
          diagnostic = instrumentBudgetDriver()
          current = workload(item, views)
          const bound = views.reduce((sum, v) => sum + inspectViewBindings(v).length, 0)
          sampler = probe(views[0]!)
          const startedAt = now(),
            startMs = current.start()
          const afterStart = diagnostic.snapshot()
          await wait(
            item.playback === 'finite'
              ? settings.finiteWindowMs
              : settings.endlessWindowMs,
          )
          // Slow hosts may spend seconds rebuilding a window. Retain that cost
          // and wait for two actual boundary submissions, up to the same 30 s
          // validation ceiling; elapsed time is never normalized or discarded.
          if (item.playback === 'window') {
            const expected = afterStart.plays + item.views * item.properties * 2
            while (diagnostic.snapshot().plays < expected && now() - startedAt < 24000)
              await wait(4000)
            check(
              diagnostic.snapshot().plays >= expected,
              'Two composition boundaries were not reached.',
            )
          }
          const playbackEnd = diagnostic.snapshot()
          const native = JSON.parse(sampler.finish())
          sampler = undefined
          const observations = current.observations()
          const completed =
            item.playback === 'finite' ? await current.completion() : undefined
          current.dispose()
          current.dispose()
          current = undefined
          const afterDispose = diagnostic.snapshot()
          await wait(settings.idleWindowMs)
          const idle = diagnostic.snapshot()
          const remainingBindings = views.reduce(
            (sum, v) => sum + inspectViewBindings(v).length,
            0,
          )
          const remainingChannels = views.reduce(
            (sum, v) => sum + inspectViewMotion(v).length,
            0,
          )
          const nativeLive = live()
          trials.push({
            trial,
            bound,
            startedAt,
            startMs,
            afterStart,
            playbackEnd,
            native,
            observations,
            completed,
            afterDispose,
            idle,
            remainingBindings,
            remainingChannels,
            nativeLive,
            ...diagnostic.evidence(),
          })
          diagnostic.restore()
          diagnostic = undefined
          check(
            remainingBindings === 0 &&
              remainingChannels === 0 &&
              nativeLive.nodes === 0 &&
              nativeLive.clock === 0,
            'Work retained after disposal.',
          )
          check(
            idle.activeTracks === 0 &&
              idle.pendingFrames === 0 &&
              idle.pendingTimers === 0,
            'Pending Jolt work after disposal.',
          )
          check(
            idle.frameCallbacks === afterDispose.frameCallbacks &&
              idle.plays === afterDispose.plays &&
              idle.timerCallbacks === afterDispose.timerCallbacks &&
              idle.endCallbacks === afterDispose.endCallbacks,
            'Jolt woke while idle.',
          )
          check(
            !completed || completed.every(Boolean),
            'Finite animation did not complete.',
          )
          ready(views)
        }
        canvas.removeChildren()
        views.length = 0
        await wait(200)
        report.cases.push({
          workload: item,
          before,
          preparation,
          trials,
          afterUnmount: resources(canvas),
        })
        save(report)
      }
      report.completed = true
      status.text = 'Completed'
      heading.text = 'Measured. Saved.'
    } catch (error) {
      report.error = String(error)
      status.text = `Failed: ${report.error}`
    } finally {
      current?.dispose()
      sampler?.cancel()
      diagnostic?.restore()
      report.finalResources = resources(canvas)
      save(report)
      if (isIOS) UIApplication.sharedApplication.idleTimerDisabled = previousIdle
      else page.android.setKeepScreenOn(false)
      button.isEnabled = true
      running = false
      console.log(`JOLT_BINDING_BUDGET ${report.completed ? 'completed' : report.error}`)
    }
  }
  button.on('tap', run)
  page.once('loaded', () => {
    const input = option('budget-input')
    if (input) {
      void mountInputBudget(page, input, {
        environment,
        resources,
        probe,
        live,
        save,
        build: __BENCHMARK_BUILD__,
        session: option('budget-session') ?? `${Date.now()}`,
        recording: option('budget-recording') === 'true',
      })
    } else if (option('budget-autorun') === 'true') setTimeout(run, 1800)
  })
  return page
}
Application.run({ create: createPage })
