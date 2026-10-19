import {
  Application,
  Color,
  Device,
  Label,
  Page,
  StackLayout,
  Utils,
  isIOS,
  isAndroid,
  knownFolders,
} from '@nativescript/core'
import {
  animate,
  animateLayout,
  configure,
  motionScope,
  type Animation,
} from '@rafaelaugusto/jolt'
declare const __BENCHMARK_BUILD__: Record<string, unknown>
const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
const near = (value: number, expected: number, tolerance = 4) =>
  check(
    Number.isFinite(value) && Math.abs(value - expected) <= tolerance,
    `${value} != ${expected} ± ${tolerance}`,
  )
const checks: string[] = []
let stage = 'initial layout'
const handles: Animation[] = []
function save(status: string, error?: unknown) {
  const report = {
    status,
    checks,
    stage,
    platform: Device.os,
    os: Device.osVersion,
    build: __BENCHMARK_BUILD__,
    error: error ? String(error) : undefined,
  }
  knownFolders
    .documents()
    .getFile('jolt-layout-checks.json')
    .writeTextSync(JSON.stringify(report, null, 2))
  if (isAndroid) android.util.Log.i('JoltLayoutChecks', JSON.stringify(report))
}
function visible(view: Label) {
  if (isIOS) {
    const frame = (view.ios as UIView).frame
    return {
      x: frame.origin.x,
      y: frame.origin.y,
      width: frame.size.width,
      height: frame.size.height,
    }
  }
  const native = view.android as android.view.View
  const dip = Utils.layout.toDeviceIndependentPixels
  return {
    x: dip(native.getX() + native.getPivotX() * (1 - native.getScaleX())),
    y: dip(native.getY() + native.getPivotY() * (1 - native.getScaleY())),
    width: dip(native.getWidth() * native.getScaleX()),
    height: dip(native.getHeight() * native.getScaleY()),
  }
}
function nativeY(view: Label) {
  return isIOS
    ? Number((view.ios as UIView).layer.valueForKeyPath('transform.translation.y'))
    : Utils.layout.toDeviceIndependentPixels(view.android.getTranslationY())
}
function label(text: string, height = 50) {
  const view = new Label()
  view.text = text
  view.width = 100
  view.height = height
  view.horizontalAlignment = 'left'
  view.backgroundColor = new Color('#b6ee64')
  return view
}
async function run(root: StackLayout, host: StackLayout, a: Label, b: Label) {
  configure({ reducedMotion: 'never' })
  const play: typeof animateLayout = ((...args: any[]) => {
    const handle = (animateLayout as (...args: any[]) => Animation)(...args)
    handles.push(handle)
    return handle
  }) as typeof animateLayout
  const pass = () => {
    checks.push(stage)
    save('running')
  }
  const noWork = () => {
    if (isIOS)
      check(
        Number(JoltInteractiveAnimation.activeCount()) === 0,
        'Native interactive frame loop leaked',
      )
  }
  try {
    stage = 'insert keeps old children at their visible positions before moving'
    const initial = visible(a),
      initialB = visible(b),
      head = label('Inserted', 60)
    const insertion = play(host, () => host.insertChild(head, 0), {
      duration: 200,
      delay: 180,
      ease: 'linear',
    })
    await wait(70)
    near(visible(a).y, initial.y)
    near(visible(b).y, initialB.y)
    check(await insertion, 'Insert failed')
    near(visible(a).y, initial.y + 60)
    noWork()
    pass()

    stage = 'reordering existing native children preserves their old positions'
    const oldA = visible(a),
      oldB = visible(b)
    const reorder = play(
      host,
      () => {
        host.removeChild(b)
        host.insertChild(b, 1)
      },
      { duration: 200, delay: 180 },
    )
    await wait(70)
    near(visible(a).y, oldA.y)
    near(visible(b).y, oldB.y)
    check(await reorder, 'Reorder failed')
    check(visible(b).y < visible(a).y, 'Wrong final order')
    pass()

    stage = 'resize preserves noncentral origin and existing application transforms'
    a.originX = 0.2
    a.translateX = 7
    a.scaleX = 1.3
    await wait(50)
    const oldSize = visible(a)
    const resize = play(
      host,
      () => {
        a.width = 180
        a.height = 90
      },
      { duration: 200, delay: 180 },
    )
    await wait(70)
    near(visible(a).x, oldSize.x)
    near(visible(a).width, oldSize.width)
    near(visible(a).height, oldSize.height)
    check(await resize, 'Resize failed')
    near(visible(a).width, 234)
    near(a.scaleX, 1.3)
    near(a.translateX, 7)
    pass()

    stage = 'interruption during a zero-destination native transform preserves geometry'
    const first = play(
      host,
      () => {
        head.height = 150
        a.width = 100
      },
      { duration: 700, ease: 'linear' },
    )
    await wait(120)
    const inFlight = visible(a)
    const second = play(
      host,
      () => {
        head.height = 30
        a.width = 200
      },
      { duration: 200, delay: 180, ease: 'linear' },
    )
    await wait(60)
    near(visible(a).y, inFlight.y, 8)
    near(visible(a).width, inFlight.width, 8)
    check((await first) === false, 'Interrupted operation did not cancel')
    check(await second, 'Second operation failed')
    near(nativeY(a), 0)
    near(visible(a).width, 260)
    pass()

    stage = 'keyed reorder unload and reinsertion do not commit a temporary layout offset'
    const departing = play(host, () => (head.height = 140), {
      duration: 700,
      ease: 'linear',
    })
    await wait(100)
    const beforeReinsert = visible(a)
    const reinsert = play(
      host,
      () => {
        host.removeChild(a)
        host.addChild(a)
        head.height = 50
      },
      { duration: 150, delay: 180 },
    )
    await wait(60)
    near(visible(a).y, beforeReinsert.y, 8)
    check((await departing) === false, 'Reinsert did not cancel prior layout')
    check(await reinsert, 'Reinsert failed')
    near(nativeY(a), 0)
    near(a.translateY, 0)
    pass()

    stage = 'stop settles temporary transforms and releases native hooks'
    const stopped = play(host, () => (head.height = 120), { duration: 1000 })
    await wait(70)
    stopped.stop()
    check((await stopped) === false, 'Stop must cancel')
    near(nativeY(a), 0)
    near(a.translateY, 0)
    noWork()
    if (isIOS)
      check(!Object.hasOwn(a, '_modifyNativeViewFrame'), 'Interactive layout hook leaked')
    pass()

    stage = 'cleanup preserves a newer explicit animation owner'
    const layout = play(host, () => (head.height = 30), { duration: 1000 })
    await wait(60)
    const external = animate(a, { x: 60 }, { duration: 200 })
    handles.push(external)
    layout.stop()
    check(await external, 'Layout stop cancelled newer owner')
    near(a.translateX, 60)
    near(nativeY(a), 0)
    pass()

    stage = 'unload cancels a pending layout and reload accepts a new operation'
    const leaving = play(host, () => (head.height = 70))
    root.removeChild(host)
    check((await leaving) === false, 'Unload did not cancel')
    root.insertChild(host, 0)
    await wait(100)
    check(await play(host, () => (head.height = 40), { duration: 100 }), 'Reload failed')
    noWork()
    pass()

    stage = 'scope disposal and repeated pending replacements remove listeners'
    const scope = motionScope()
    const scoped = scope.animateLayout(host, () => (head.height = 80))
    scope.dispose()
    check((await scoped) === false, 'Scope did not cancel pending layout')
    const pending: Animation[] = []
    for (let i = 0; i < 20; i++)
      pending.push(play(host, () => (head.height = 40 + i), { duration: 100 }))
    const results = await Promise.all(pending.map((handle) => handle.finished))
    check(
      results.slice(0, -1).every((result) => !result) && results.at(-1),
      'Pending coalescing failed',
    )
    noWork()
    pass()

    stage = 'reduced motion settles changed layout without native frame work'
    configure({ reducedMotion: 'always' })
    check(
      await play(host, () => {
        head.height = 100
        a.width = 150
      }),
      'Reduced layout failed',
    )
    near(nativeY(a), 0)
    near(visible(a).width, 195)
    noWork()
    configure({ reducedMotion: 'never' })
    pass()

    stage = 'no-op requests a pass and resolves without a timer fallback'
    check(await play(host), 'No-op failed')
    noWork()
    pass()

    stage = 'application suspension cancels a pending layout hook'
    const suspended = play(host, () => (head.height = 40))
    Application.notify({ eventName: Application.suspendEvent, object: Application })
    check((await suspended) === false, 'Suspension failed')
    Application.notify({ eventName: Application.resumeEvent, object: Application })
    await wait(60)
    check(await play(host, () => (head.height = 65), { duration: 100 }), 'Resume failed')
    noWork()
    pass()
    save('passed')
  } finally {
    handles.forEach((handle) => handle.stop())
    configure({ reducedMotion: 'user' })
  }
}
Application.run({
  create: () => {
    const page = new Page()
    page.actionBarHidden = true
    const root = new StackLayout()
    root.padding = 20
    const host = new StackLayout()
    host.width = 300
    host.horizontalAlignment = 'left'
    const a = label('A'),
      b = label('B')
    host.addChild(a)
    host.addChild(b)
    const status = new Label()
    status.text = 'Waiting'
    status.textWrap = true
    root.addChild(host)
    root.addChild(status)
    page.content = root
    let started = false
    page.on('loaded', () => {
      if (started) return
      started = true
      setTimeout(() => {
        const timeout = setTimeout(() => {
          save('failed', `Timeout at ${stage}`)
          status.text = `Timeout: ${stage}`
        }, 15000)
        void run(root, host, a, b).then(
          () => {
            clearTimeout(timeout)
            status.text = `PASS ${checks.length}`
          },
          (error) => {
            clearTimeout(timeout)
            save('failed', error)
            status.text = String(error)
          },
        )
      }, 700)
    })
    return page
  },
})
