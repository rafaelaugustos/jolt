import {
  Application,
  Color,
  Device,
  GridLayout,
  Label,
  Page,
  ScrollView,
  StackLayout,
  Utils,
  isIOS,
  knownFolders,
  type View,
} from '@nativescript/core'
import {
  animate,
  bind,
  configure,
  motionScope,
  motionValue,
  set,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
import { runInteractionReplayChecks } from './interaction-replay-checks'
import { runScrollHandoffChecks } from './scroll-handoff-checks'
import { runSizeChecks } from './size-checks'
import { runLiveSpringChecks } from './live-spring-checks'
import { runGestureLifecycleChecks } from './gesture-lifecycle-checks'

declare const __NATIVE_CI_BUILD__: Record<string, unknown>
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const checks: string[] = []
const samples: object[] = []
let stage = 'initial layout'
let runId = ''
let injected = false
let terminal = false
const scope = motionScope()
const owned: PlaybackAnimation[] = []
const own = (a: PlaybackAnimation) => {
  owned.push(a)
  return a
}
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const near = (property: string, actual: number, expected: number, tolerance: number) => {
  samples.push({ stage, property, actual, expected, tolerance })
  check(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${property}: ${actual} != ${expected} ± ${tolerance}`,
  )
}
function read(
  view: View,
  property: 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotate' | 'opacity',
) {
  if (isIOS) {
    const layer = (view.ios as UIView).layer.presentationLayer()
    check(!!layer, 'No presentation layer: view is not rendered')
    const paths = {
      x: 'transform.translation.x',
      y: 'transform.translation.y',
      scaleX: 'transform.scale.x',
      scaleY: 'transform.scale.y',
      rotate: 'transform.rotation.z',
      opacity: 'opacity',
    }
    const value = Number(layer!.valueForKeyPath(paths[property]))
    return property === 'rotate' ? (value * 180) / Math.PI : value
  }
  const v = view.android as android.view.View
  return property === 'x'
    ? Utils.layout.toDeviceIndependentPixels(v.getTranslationX())
    : property === 'y'
      ? Utils.layout.toDeviceIndependentPixels(v.getTranslationY())
      : property === 'scaleX'
        ? v.getScaleX()
        : property === 'scaleY'
          ? v.getScaleY()
          : property === 'rotate'
            ? v.getRotation()
            : v.getAlpha()
}
function save(status: 'running' | 'passed' | 'failed', error?: unknown) {
  if (terminal) return
  terminal = status !== 'running'
  const report = {
    schema: 1,
    runId,
    status,
    stage,
    checks,
    samples,
    injected,
    error: error === undefined ? undefined : String(error),
    build: __NATIVE_CI_BUILD__,
    platform: Device.os,
    os: Device.osVersion,
    model: Device.model,
  }
  knownFolders
    .documents()
    .getFile('jolt-native-ci.json')
    .writeTextSync(JSON.stringify(report, null, 2))
  console.log('JoltNativeCI', JSON.stringify(report))
}
async function run(view: Label, other: Label, host: StackLayout, status: Label) {
  const pass = () => {
    checks.push(stage)
    status.text = `PASS ${checks.length}: ${stage}`
    save('running')
  }
  const reset = async () => {
    owned.splice(0).forEach((a) => a.stop())
    set(view, { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0, opacity: 1 })
    await wait(100)
  }
  configure({ reducedMotion: 'never', timeScale: 1 })
  await reset()
  stage = 'combined native transform and opacity'
  const combined = own(
    animate(
      view,
      {
        x: [0, 120],
        y: [0, 60],
        scaleX: [1, 1.4],
        scaleY: [1, 0.8],
        rotate: [0, 40],
        opacity: [1, 0.4],
      },
      { duration: 2000, ease: 'linear' },
    ),
  )
  combined.pause()
  combined.progress = 0.5
  await wait(180)
  near('x', read(view, 'x'), injected ? 160 : 60, 3)
  near('y', read(view, 'y'), 30, 3)
  near('scaleX', read(view, 'scaleX'), 1.2, 0.04)
  near('scaleY', read(view, 'scaleY'), 0.9, 0.04)
  near('rotate', read(view, 'rotate'), 20, 2)
  near('opacity', read(view, 'opacity'), 0.7, 0.04)
  pass()

  await reset()
  stage = 'live intermediate native position'
  const moving = own(animate(view, { x: 140 }, { duration: 1800, ease: 'linear' }))
  await wait(320)
  const middle = read(view, 'x')
  samples.push({ stage, middle })
  check(middle > 2 && middle < 130, `No intermediate native motion: ${middle}`)
  pass()
  stage = 'pause holds and resume completes'
  moving.pause()
  await wait(100)
  const held = read(view, 'x')
  await wait(180)
  near('paused x', read(view, 'x'), held, 2)
  moving.play()
  check(await moving, 'Resume did not complete')
  await wait(80)
  near('resumed x', read(view, 'x'), 140, 2)
  pass()

  await reset()
  stage = 'interruption starts at visible position'
  const first = own(animate(view, { x: 150 }, { duration: 1800, ease: 'linear' }))
  await wait(320)
  const before = read(view, 'x')
  const replacement = own(animate(view, { x: 0 }, { duration: 500 }))
  near('handoff x', read(view, 'x'), before, 6)
  check((await first) === false, 'Replaced animation reported success')
  check(await replacement, 'Replacement failed')
  await wait(80)
  near('final x', read(view, 'x'), 0, 2)
  pass()

  await reset()
  stage = 'one motion value coordinates native bindings'
  const value = motionValue(0)
  const release = bind(view, { x: value.to([0, 1], [0, 120]) })
  const releaseOther = bind(other, {
    y: value.to([0, 1], [0, 60]),
    opacity: value.to([0, 1], [1, 0.4]),
  })
  try {
    const linked = own(animate(value, 1, { duration: 1800, ease: 'linear' }))
    linked.pause()
    linked.progress = 0.5
    await wait(180)
    near('bound x', read(view, 'x'), 60, 3)
    near('bound y', read(other, 'y'), 30, 3)
    near('bound opacity', read(other, 'opacity'), 0.7, 0.04)
  } finally {
    release()
    releaseOther()
  }
  pass()

  await reset()
  stage = 'scope disposal cancels native work'
  const pending = scope.animate(view, { x: 140 }, { duration: 1800, ease: 'linear' })
  await wait(180)
  scope.reset()
  check((await pending) === false && scope.size === 0, 'Scope did not clean up')
  await wait(80)
  const stopped = read(view, 'x')
  await wait(180)
  near('stopped x', read(view, 'x'), stopped, 2)
  pass()

  await reset()
  stage = 'unload and reload release the old animation'
  const leaving = own(animate(view, { x: 140 }, { duration: 1800 }))
  await wait(180)
  const parent = view.parent as GridLayout
  parent.removeChild(view)
  check((await leaving) === false, 'Unload did not cancel')
  parent.addChild(view)
  await wait(180)
  const reloaded = own(animate(view, { x: 0 }, { duration: 200 }))
  check(await reloaded, 'Reload failed')
  pass()

  await reset()
  stage = 'reduced motion settles spatial animation'
  configure({ reducedMotion: 'always' })
  check(await own(animate(view, { x: 100 }, 'bouncy')), 'Reduced motion failed')
  await wait(120)
  near('reduced x', read(view, 'x'), 100, 2)
  configure({ reducedMotion: 'never' })
  pass()

  await reset()
  stage = 'live native spring followers and layers'
  samples.push(...(await runLiveSpringChecks(view, other)))
  pass()

  stage = 'native gesture values and scroll delegate lifecycle'
  samples.push(await runGestureLifecycleChecks(host))
  pass()

  stage = 'recorded interaction replay and negative control'
  samples.push(await runInteractionReplayChecks(view, runId))
  samples.push(await runScrollHandoffChecks(host, runId))
  pass()

  stage = 'real dimensions in StackLayout and GridLayout'
  await runSizeChecks(host, (message) => {
    status.text = message
  })
  const sizes = JSON.parse(
    knownFolders.documents().getFile('jolt-size-checks.json').readTextSync(),
  )
  check(
    sizes.status === 'passed' && sizes.count === 20,
    `Size checks: ${JSON.stringify(sizes)}`,
  )
  pass()
}
export function runNativeCI() {
  Application.run({
    create() {
      const page = new Page()
      page.actionBarHidden = true
      const root = new StackLayout()
      root.padding = 20
      const status = new Label()
      status.text = 'Native CI'
      status.textWrap = true
      const stageView = new GridLayout()
      stageView.height = 190
      const make = (text: string) => {
        const v = new Label()
        v.text = text
        v.width = 72
        v.height = 48
        v.backgroundColor = new Color('#dcf71d')
        v.horizontalAlignment = 'left'
        v.verticalAlignment = 'top'
        stageView.addChild(v)
        return v
      }
      const first = make('Jolt'),
        second = make('Linked')
      second.marginTop = 90
      const scroll = new ScrollView()
      scroll.height = 400
      const host = new StackLayout()
      scroll.content = host
      root.addChild(status)
      root.addChild(stageView)
      root.addChild(scroll)
      page.content = root
      let started = false
      page.on('loaded', () => {
        if (started) return
        started = true
        if (isIOS) {
          const args = NSProcessInfo.processInfo.arguments
          for (let i = 0; i < args.count; i++) {
            const arg = String(args.objectAtIndex(i))
            if (arg.startsWith('--run=')) runId = arg.slice(6)
            if (arg === '--inject-failure') injected = true
          }
        } else {
          const activity =
            Application.android.foregroundActivity ?? Application.android.startActivity
          const intent = activity.getIntent()
          runId = String(intent.getStringExtra('run') ?? '')
          injected = intent.getBooleanExtra('inject-failure', false)
        }
        save('running')
        const watchdog = setTimeout(
          () => save('failed', 'Native probe watchdog expired'),
          90000,
        )
        void wait(350)
          .then(() => run(first, second, host, status))
          .then(
            () => save('passed'),
            (error) => {
              status.text = String(error)
              save('failed', error)
            },
          )
          .finally(() => {
            clearTimeout(watchdog)
            owned.forEach((a) => a.stop())
            scope.dispose()
            configure({ reducedMotion: 'user', timeScale: 1 })
          })
      })
      return page
    },
  })
}
