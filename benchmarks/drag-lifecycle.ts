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
  type GestureEventData,
} from '@nativescript/core'
import {
  animate,
  configure,
  drag,
  motionScope,
  type Drag,
  type DragRelease,
} from '@rafaelaugusto/jolt'

declare const __BENCHMARK_BUILD__: Record<string, unknown>
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
const near = (actual: number, expected: number, tolerance = 4) =>
  check(
    Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected} ± ${tolerance}`,
  )
const controllers: Drag[] = []
const checks: string[] = []
let stage = 'layout'
function actualX(view: Label) {
  if (isAndroid)
    return Utils.layout.toDeviceIndependentPixels(view.android.getTranslationX())
  const layer = (view.ios as UIView).layer
  return Number(
    (layer.presentationLayer() ?? layer).valueForKeyPath('transform.translation.x'),
  )
}
// Scripted pan input exercises real controllers/drivers. OS gestures are checked separately.
function pan(view: Label, state: number, x: number, velocity = 0) {
  const event = {
    eventName: 'pan',
    object: view,
    view,
    state,
    deltaX: x,
    deltaY: 0,
    ios: {
      numberOfTouches: state === 3 ? 0 : 1,
      translationInView: () => ({ x, y: 0 }),
      velocityInView: () => ({ x: velocity, y: 0 }),
    },
  } as unknown as GestureEventData
  for (const observer of [...(view.getGestureObservers(GestureTypes.pan) ?? [])])
    observer.callback(event)
}
function begin(view: Label) {
  for (const observer of [...(view.getGestureObservers(GestureTypes.touch) ?? [])])
    observer.callback({ action: 'down' } as unknown as GestureEventData)
  pan(view, 1, 0)
}
function save(status: string, error?: unknown) {
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
    .getFile('jolt-drag-checks.json')
    .writeTextSync(JSON.stringify(report, null, 2))
  if (isAndroid) android.util.Log.i('JoltDragChecks', JSON.stringify(report))
}
async function run(view: Label) {
  const own = (options: Parameters<typeof drag>[1]) => {
    const controller = drag(view, options)
    controllers.push(controller)
    return controller
  }
  const pass = () => {
    checks.push(stage)
    save('running')
  }
  configure({ reducedMotion: 'never', timeScale: 1 })
  stage = 'hard bounded native release and velocity-selected snap'
  let release: DragRelease | undefined
  let settles = 0
  let controller = own({
    axis: 'x',
    bounds: { left: 0, right: 140 },
    snap: [0, 70, 140],
    onRelease: (event) => (release = event),
    onSettle: () => settles++,
  })
  begin(view)
  pan(view, 2, 35, 600)
  pan(view, 3, 35, 600)
  check(release?.target.x === 140, 'Velocity did not select far snap')
  const until = Date.now() + 850
  while (Date.now() < until) {
    check(
      actualX(view) >= -1 && actualX(view) <= 141,
      'Native release crossed hard bounds',
    )
    await wait(16)
  }
  check(await release!.animation, 'Release failed')
  near(actualX(view), 140)
  check(settles === 1, 'Wrong settle count')
  pass()

  stage = 'grab native release preserves visible position and cancels completion'
  controller.dispose()
  view.translateX = 0
  controller = own({ axis: 'x', snap: [0, 140], onRelease: (event) => (release = event) })
  begin(view)
  pan(view, 2, 20, 500)
  pan(view, 3, 20, 500)
  await wait(70)
  const before = actualX(view)
  begin(view)
  near(actualX(view), before, 6)
  check((await release!.animation) === false, 'Grab did not cancel release')
  controller.cancel()
  await wait(60)
  const held = actualX(view)
  await wait(180)
  near(actualX(view), held)
  pass()

  stage = 'rubberband cancelled contact freezes without release'
  controller.dispose()
  view.translateX = 0
  let released = 0,
    cancelled = 0
  controller = own({
    axis: 'x',
    bounds: { left: 0, right: 100 },
    rubberband: true,
    onRelease: () => released++,
    onCancel: () => cancelled++,
  })
  begin(view)
  pan(view, 2, 180, 800)
  await wait(60)
  const resisted = actualX(view)
  check(resisted > 100 && resisted < 180, 'No rubberband resistance')
  pan(view, 0, 180)
  await wait(250)
  near(actualX(view), resisted)
  check(cancelled === 1 && released === 0, 'Cancelled gesture launched release')
  begin(view)
  await wait(60)
  near(actualX(view), resisted)
  pan(view, 2, -10)
  await wait(60)
  check(actualX(view) < resisted && actualX(view) > 100, 'Rubberband regrab jumped')
  controller.cancel()
  pass()

  stage = 'scope suspension cancels release; resume accepts fresh pan'
  controller.dispose()
  view.translateX = 0
  const scope = motionScope()
  controller = scope.drag(view, {
    axis: 'x',
    snap: [0, 140],
    onRelease: (event) => (release = event),
  })
  controllers.push(controller)
  begin(view)
  pan(view, 2, 20, 500)
  pan(view, 3, 20, 500)
  await wait(60)
  scope.suspend()
  await wait(60)
  const paused = actualX(view)
  await wait(200)
  near(actualX(view), paused)
  check((await release!.animation) === false, 'Scope suspension did not cancel')
  check(!view.getGestureObservers(GestureTypes.pan)?.length, 'Suspended pan listener')
  scope.resume()
  begin(view)
  pan(view, 2, 10)
  await wait(60)
  near(actualX(view), paused + 10)
  scope.dispose()
  pass()

  stage = 'unload reload detaches native input and reuses controller'
  view.translateX = 0
  controller = own({ axis: 'x' })
  begin(view)
  pan(view, 2, 30)
  const parent = view.parent as StackLayout
  parent.removeChild(view)
  check(!controller.dragging, 'Unload left contact active')
  check(!view.getGestureObservers(GestureTypes.pan)?.length, 'Unload leaked pan')
  parent.addChild(view)
  await wait(120)
  begin(view)
  pan(view, 2, 10)
  await wait(60)
  near(actualX(view), 40)
  controller.dispose()
  pass()

  stage = 'reduced motion keeps direct input and settles immediately'
  view.translateX = 0
  configure({ reducedMotion: 'always' })
  controller = own({ axis: 'x', snap: [0, 140], onRelease: (event) => (release = event) })
  begin(view)
  pan(view, 2, 90)
  await wait(60)
  near(actualX(view), 90)
  pan(view, 3, 90)
  check(await release!.animation, 'Reduced release failed')
  await wait(80)
  near(actualX(view), 140)
  controller.dispose()
  configure({ reducedMotion: 'never' })
  pass()

  stage = 'disposing old drag preserves newer native translation owner'
  view.translateX = 0
  controller = own({ axis: 'x', snap: [0, 140] })
  begin(view)
  pan(view, 2, 20, 500)
  pan(view, 3, 20, 500)
  await wait(60)
  const outside = animate(view, { x: 50 }, { duration: 300 })
  controller.dispose()
  check(await outside, 'Disposal cancelled external owner')
  near(actualX(view), 50)
  pass()

  stage = 'twenty replacement and disposal cycles restore observer counts'
  for (let i = 0; i < 20; i++) {
    const first = own({ axis: 'x' })
    const second = own({ axis: 'x' })
    check(first.disposed, 'Replacement did not dispose old owner')
    check(
      view.getGestureObservers(GestureTypes.pan)?.length === 1,
      'Duplicate pan observers',
    )
    second.dispose()
    second.dispose()
    check(!view.getGestureObservers(GestureTypes.pan)?.length, 'Leaked pan')
    check(!view.getGestureObservers(GestureTypes.touch)?.length, 'Leaked touch')
  }
  pass()
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
    title.text = 'Drag lifecycle / native playback'
    const box = new Label()
    box.text = 'Drag'
    box.width = 80
    box.height = 80
    box.horizontalAlignment = 'left'
    box.backgroundColor = new Color('#b6ee64')
    const status = new Label()
    status.text = 'Waiting'
    status.textWrap = true
    stack.addChild(title)
    stack.addChild(box)
    stack.addChild(status)
    page.content = stack
    let started = false
    page.on('loaded', () => {
      if (started) return
      started = true
      setTimeout(
        () =>
          void run(box).then(
            () => (status.text = `PASS ${checks.length} checks`),
            (error) => {
              controllers.forEach((controller) => controller.dispose())
              configure({ reducedMotion: 'user' })
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
