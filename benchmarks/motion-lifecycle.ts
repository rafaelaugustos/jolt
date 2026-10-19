import {
  Application,
  Color,
  Device,
  GestureTypes,
  Label,
  Page,
  StackLayout,
  Utils,
  isAndroid,
  knownFolders,
} from '@nativescript/core'
import { animate, configure, motionScope, type MotionScope } from '@rafaelaugusto/jolt'

declare const __BENCHMARK_BUILD__: Record<string, unknown>
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const near = (actual: number, expected: number, tolerance = 3) => {
  if (!Number.isFinite(actual) || Math.abs(actual - expected) > tolerance)
    throw new Error(`Expected ${expected} ± ${tolerance}, observed ${actual}`)
}
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
function x(view: Label) {
  if (isAndroid)
    return Utils.layout.toDeviceIndependentPixels(view.android.getTranslationX())
  const layer = (view.ios as UIView).layer
  return Number(
    (layer.presentationLayer() ?? layer).valueForKeyPath('transform.translation.x'),
  )
}
const checks: string[] = []
const owned: MotionScope[] = []
const scope = () => {
  const owner = motionScope()
  owned.push(owner)
  return owner
}
let stage = 'layout'
const save = (status: string, error?: unknown) => {
  const report = {
    status,
    stage,
    checks,
    platform: Device.os,
    os: Device.osVersion,
    model: Device.model,
    build: __BENCHMARK_BUILD__,
    error: error ? String(error) : undefined,
  }
  knownFolders
    .documents()
    .getFile('jolt-motion-checks.json')
    .writeTextSync(JSON.stringify(report, null, 2))
  if (isAndroid) android.util.Log.i('JoltMotionChecks', JSON.stringify(report))
}
async function run(first: Label, second: Label) {
  const pass = () => {
    checks.push(stage)
    save('running')
  }
  configure({ reducedMotion: 'never', timeScale: 1 })
  stage = 'scope disposal preserves another owner'
  const a = scope(),
    b = scope()
  const cancelled = a.animate(first, { x: 140 }, { duration: 1400, ease: 'linear' })
  b.animate(second, { x: 120 }, { duration: 600, ease: 'linear' })
  await wait(220)
  a.dispose()
  const frozen = x(first)
  check(frozen > 5 && frozen < 100, 'Animation must be mid-flight')
  await wait(480)
  near(x(first), frozen)
  near(x(second), 120)
  check((await cancelled) === false, 'Disposed animation must cancel')
  pass()

  stage = 'suspend freezes and resume continues native playback'
  first.translateX = 0
  const c = scope(),
    paused = c.animate(first, { x: 160 }, { duration: 1000, ease: 'linear' })
  await wait(180)
  c.suspend()
  await wait(60)
  const held = x(first)
  await wait(250)
  near(x(first), held)
  c.resume()
  check(await paused, 'Resumed animation should complete')
  near(x(first), 160)
  pass()

  stage = 'state interruption preserves presentation'
  first.translateX = 0
  second.translateX = 0
  const d = scope()
  const states = d.states(
    { first, second },
    {
      sending: { first: { x: 160 }, second: { x: 100 } },
      idle: { first: { x: 0 }, second: { x: 0 } },
      success: { first: { x: 80 }, second: { x: 60 } },
    },
    { transition: { type: 'spring', duration: 900, bounce: 0.25 } },
  )
  const sending = states.to('sending')
  await wait(140)
  const before = x(first)
  const idle = states.to('idle')
  near(x(first), before, 5)
  check((await sending) === false, 'Superseded state must cancel')
  check(await idle, 'Replacement state must complete')
  near(x(first), 0)
  near(x(second), 0)
  pass()

  stage = 'rapid states and reduced motion settle only latest'
  configure({ reducedMotion: 'always' })
  const old = states.to('sending'),
    latest = states.to('success')
  check((await old) === false, 'Stale reduced-motion completion')
  check(await latest, 'Latest reduced state')
  // UIKit commits an immediate model change at the next display transaction.
  await wait(80)
  near(x(first), 80)
  check(states.settled === 'success', 'Wrong settled state')
  pass()
  configure({ reducedMotion: 'never' })

  stage = 'disposed states cancel and release pending loaded listeners'
  const unmounted = new Label(),
    e = scope()
  const pending = e
    .states({ unmounted }, { active: { unmounted: { x: 10 } } })
    .to('active')
  e.dispose()
  check((await pending) === false, 'Pending state must cancel')
  check(!unmounted.hasListeners('loaded'), 'Loaded listener leaked')
  pass()

  stage = 'recycled scopes restore listener and handle counts'
  const baseline = first.getGestureObservers(GestureTypes.touch)?.length ?? 0
  for (let i = 0; i < 20; i++) {
    const owner = scope()
    owner.press(first)
    const animation = owner.animate(
      first,
      { x: [0, 60] },
      { duration: 400, repeat: Infinity },
    )
    owner.reset()
    check((await animation) === false, 'Reset must cancel loop')
    check(owner.size === 0, 'Reset leaked scope entries')
    owner.dispose()
  }
  check(
    (first.getGestureObservers(GestureTypes.touch)?.length ?? 0) === baseline,
    'Touch observers leaked',
  )
  pass()

  stage = 'unload cancels playback without destroying scope'
  const f = scope(),
    parent = first.parent as StackLayout
  const leaving = f.animate(first, { x: 140 }, { duration: 1000 })
  await wait(100)
  parent.removeChild(first)
  check((await leaving) === false, 'Unload did not cancel native work')
  check(!f.disposed, 'Unload permanently disposed scope')
  parent.addChild(first)
  await wait(100)
  const reloaded = f.animate(first, { x: 0 }, { duration: 150 })
  check(await reloaded, 'Reloaded scope should remain usable')
  pass()

  stage = 'scope disposal preserves newer animation on same property'
  const g = scope(),
    replaced = g.animate(first, { x: 140 }, { duration: 1000 })
  await wait(80)
  const outside = animate(first, { x: 30 }, { duration: 200 })
  g.dispose()
  check((await replaced) === false, 'Old animation must cancel')
  check(await outside, 'Disposal cancelled another owner')
  near(x(first), 30)
  pass()
  owned.forEach((owner) => owner.dispose())
  configure({ reducedMotion: 'user' })
  save('passed')
}
Application.run({
  create: () => {
    const page = new Page()
    page.actionBarHidden = true
    const stack = new StackLayout()
    stack.padding = 24
    const title = new Label()
    title.text = 'Motion scopes / states checks'
    title.textWrap = true
    const first = new Label()
    first.text = 'A'
    first.width = 60
    first.height = 60
    first.backgroundColor = new Color('#a8e65b')
    first.horizontalAlignment = 'left'
    const second = new Label()
    second.text = 'B'
    second.width = 60
    second.height = 60
    second.backgroundColor = new Color('#79b7f2')
    second.horizontalAlignment = 'left'
    const status = new Label()
    status.text = 'Waiting for layout'
    status.textWrap = true
    stack.addChild(title)
    stack.addChild(first)
    stack.addChild(second)
    stack.addChild(status)
    page.content = stack
    let started = false
    page.on('loaded', () => {
      if (started) return
      started = true
      setTimeout(() => {
        void run(first, second).then(
          () => {
            status.text = `PASS ${checks.length} native checks`
          },
          (error) => {
            owned.forEach((owner) => owner.dispose())
            configure({ reducedMotion: 'user' })
            save('failed', error)
            status.text = `FAIL ${stage}: ${error}`
          },
        )
      }, 700)
    })
    return page
  },
})
