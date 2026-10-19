import {
  Application,
  Color,
  Device,
  GridLayout,
  Label,
  Page,
  knownFolders,
  isIOS,
  isAndroid,
  Utils,
} from '@nativescript/core'
import {
  animate,
  configure,
  interactionSurface,
  motionScope,
  type PlaybackAnimation,
} from '@rafaelaugusto/jolt'
declare const __BENCHMARK_BUILD__: Record<string, unknown>
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
const near = (value: number, expected: number, tolerance = 3) =>
  check(
    Number.isFinite(value) && Math.abs(value - expected) <= tolerance,
    `${value} != ${expected} ± ${tolerance}`,
  )
const checks: string[] = []
let stage = 'layout'
const handles: PlaybackAnimation[] = []
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
    .getFile('jolt-interaction-checks.json')
    .writeTextSync(JSON.stringify(report, null, 2))
  if (isAndroid) android.util.Log.i('JoltInteractionChecks', JSON.stringify(report))
}
function x(view: Label) {
  if (isAndroid)
    return Utils.layout.toDeviceIndependentPixels(view.android.getTranslationX())
  return Number((view.ios as UIView).layer.valueForKeyPath('transform.translation.x'))
}
function active() {
  return isIOS ? Number(JoltInteractiveAnimation.activeCount()) : 0
}
async function run(parent: GridLayout, view: Label) {
  const surface = interactionSurface(parent)
  const play = (...args: Parameters<typeof animate>) => {
    const handle = animate(...args)
    handles.push(handle)
    return handle
  }
  const pass = () => {
    checks.push(stage)
    save('running')
  }
  configure({ reducedMotion: 'never', timeScale: 1 })
  try {
    stage = 'live geometry follows playback and natural completion'
    const first = play(view, { x: [0, 160] }, { duration: 600, ease: 'linear' })
    await wait(200)
    check(x(view) > 10 && x(view) < 130, 'Native geometry is already at the destination')
    if (isIOS)
      near(
        Number(
          (view.ios as UIView).layer
            .presentationLayer()
            ?.valueForKeyPath('transform.translation.x'),
        ),
        x(view),
        7,
      )
    check(await first, 'Natural completion failed')
    near(x(view), 160)
    check(active() === 0, 'Native frame loop leaked')
    pass()

    stage = 'pause endpoints scrub and resume retain native geometry'
    const held = play(view, { x: [0, 160] }, { duration: 1000, ease: 'linear' })
    held.pause()
    held.progress = 1
    await wait(50)
    near(x(view), 160)
    held.progress = 0.25
    await wait(50)
    near(x(view), 40)
    check(active() === 0, 'Paused native frame loop')
    held.play()
    check(await held, 'Resume failed')
    near(x(view), 160)
    pass()

    stage = 'interruption reads native position and selective stop preserves another axis'
    const both = play(
      view,
      { x: [0, 160], y: [0, 60] },
      { duration: 1000, ease: 'linear' },
    )
    await wait(200)
    const before = x(view)
    const replacement = play(view, { x: 0 }, { duration: 250 })
    near(x(view), before, 5)
    check(await replacement, 'Replacement failed')
    near(x(view), 0)
    check((await both) === false, 'Replaced group must cancel')
    near(view.translateY, 60)
    pass()

    stage = 'repeating reverse motion and stop leave live geometry usable'
    const loop = play(
      view,
      { x: [0, 100] },
      { duration: 200, repeat: Infinity, repeatType: 'reverse', ease: 'linear' },
    )
    await wait(270)
    check(x(view) > 5 && x(view) < 95, 'Reverse loop not moving')
    loop.stop()
    const stopped = x(view)
    await wait(180)
    near(x(view), stopped)
    check((await loop) === false && active() === 0, 'Loop did not clean up')
    pass()

    stage = 'unload cancels native frame work and reload accepts a new animation'
    const leaving = play(view, { x: 150 }, { duration: 1000 })
    await wait(80)
    parent.removeChild(view)
    check((await leaving) === false, 'Unload failed to cancel')
    check(active() === 0, 'Unload leaked native frame loop')
    parent.addChild(view)
    await wait(100)
    check(await play(view, { x: 0 }, { duration: 100 }), 'Reload failed')
    near(x(view), 0)
    pass()

    stage = 'scope cleanup preserves a newer property owner'
    const scope = motionScope()
    const owned = scope.animate(view, { x: 180 }, { duration: 1000 })
    await wait(80)
    const external = play(view, { x: 45 }, { duration: 200 })
    scope.dispose()
    check((await owned) === false, 'Owned animation did not cancel')
    check(await external, 'Scope killed newer owner')
    near(x(view), 45)
    pass()

    stage = 'reduced motion does not allocate a native frame loop'
    configure({ reducedMotion: 'always' })
    check(await play(view, { x: 90 }), 'Reduced motion failed')
    await wait(50)
    near(x(view), 90)
    check(active() === 0, 'Reduced motion allocated frame work')
    configure({ reducedMotion: 'never' })
    pass()

    stage = 'delay and finite reverse finish at the correct endpoint'
    const delayed = play(
      view,
      { x: [10, 100] },
      { delay: 160, duration: 120, repeat: 1, repeatType: 'reverse', ease: 'linear' },
    )
    await wait(70)
    near(x(view), 10)
    check(await delayed, 'Delayed reverse failed')
    near(x(view), 10)
    check(active() === 0, 'Finite repeat leaked')
    pass()

    if (isIOS) {
      stage = 'application suspension commits live geometry and releases native work'
      const suspended = play(view, { x: [0, 180] }, { duration: 1000, ease: 'linear' })
      await wait(150)
      const beforeSuspend = x(view)
      Application.notify({ eventName: Application.suspendEvent, object: Application })
      check((await suspended) === false, 'Suspension did not cancel')
      near(x(view), beforeSuspend, 5)
      check(active() === 0, 'Suspension leaked frame loop')
      Application.notify({ eventName: Application.resumeEvent, object: Application })
      check(await play(view, { x: 0 }, { duration: 100 }), 'Playback after resume failed')
      pass()
    }

    stage = 'surface disposal preserves existing playback and excludes future work'
    const running = play(view, { x: [0, 100] }, { duration: 250, ease: 'linear' })
    surface.dispose()
    check(await running, 'Disposing surface cancelled animation')
    const ordinary = play(view, { x: [0, 160] }, { duration: 400, ease: 'linear' })
    if (isIOS) {
      near(x(view), 160)
      check(active() === 0, 'Disposed surface still selects interactive driver')
    }
    ordinary.stop()
    pass()
    save('passed')
  } finally {
    surface.dispose()
    handles.forEach((handle) => handle.stop())
    configure({ reducedMotion: 'user' })
  }
}
Application.run({
  create: () => {
    const page = new Page()
    page.actionBarHidden = true
    const parent = new GridLayout()
    parent.rows = '100,*'
    parent.padding = 20
    const box = new Label()
    box.text = 'Interaction'
    box.width = 90
    box.height = 60
    box.horizontalAlignment = 'left'
    box.backgroundColor = new Color('#b6ee64')
    const status = new Label()
    status.text = 'Waiting'
    status.textWrap = true
    GridLayout.setRow(status, 1)
    parent.addChild(box)
    parent.addChild(status)
    page.content = parent
    let started = false
    page.on('loaded', () => {
      if (started) return
      started = true
      setTimeout(
        () =>
          void run(parent, box).then(
            () => (status.text = `PASS ${checks.length}`),
            (error) => {
              save('failed', error)
              status.text = String(error)
            },
          ),
        700,
      )
    })
    return page
  },
})
