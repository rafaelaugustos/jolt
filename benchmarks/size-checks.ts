import {
  Application,
  Button,
  Color,
  Device,
  GridLayout,
  Label,
  StackLayout,
  Utils,
  isIOS,
  knownFolders,
  View,
} from '@nativescript/core'
import {
  animateSize,
  configure,
  motionScope,
  type SizeAnimation,
  type SizeDimensions,
  type SizeOptions,
  type SpringName,
} from '@rafaelaugusto/jolt'

const wait = (ms: number) => new Promise<void>((done) => setTimeout(done, ms))
const check = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
const near = (a: number, b: number, tolerance = 3) =>
  check(Math.abs(a - b) <= tolerance, `${a} != ${b} ± ${tolerance}`)
const bounds = (view: View) => {
  if (isIOS) {
    const b = (view.ios as UIView).bounds
    return { width: b.size.width, height: b.size.height }
  }
  const v = view.android as android.view.View
  return {
    width: Utils.layout.toDeviceIndependentPixels(v.getWidth()),
    height: Utils.layout.toDeviceIndependentPixels(v.getHeight()),
  }
}

/** Runs against the real native tree used by the normal Vue demo, not a fake driver. */
export async function runSizeChecks(
  host: StackLayout | GridLayout,
  status: (message: string) => void,
) {
  const passed: string[] = []
  const handles: SizeAnimation[] = []
  const samples: unknown[] = []
  let stage = 'setup'
  let failure: string | undefined
  const measurementMs: number[] = []
  const layoutMs: number[] = []
  let root: View = host
  while (root.parent instanceof View && root.parent.typeName !== 'Page')
    root = root.parent
  const ownMeasure = Object.getOwnPropertyDescriptor(root, 'measure')
  const ownLayout = Object.getOwnPropertyDescriptor(root, 'layout')
  const measure = root.measure
  const layout = root.layout
  root.measure = function (...args) {
    const start = performance.now()
    try {
      measure.apply(this, args)
    } finally {
      measurementMs.push(performance.now() - start)
    }
  }
  root.layout = function (...args) {
    const start = performance.now()
    try {
      layout.apply(this, args)
    } finally {
      layoutMs.push(performance.now() - start)
    }
  }
  const mark = (name: string) => {
    passed.push(name)
    status(`${passed.length} checks · ${name}`)
  }
  function run(
    view: View,
    dimensions: SizeDimensions,
    options?: SizeOptions | SpringName,
  ): SizeAnimation
  function run(
    view: View,
    dimensions: SizeDimensions,
    change: () => void,
    options?: SizeOptions | SpringName,
  ): SizeAnimation
  function run(
    view: View,
    dimensions: SizeDimensions,
    changeOrOptions?: (() => void) | SizeOptions | SpringName,
    options?: SizeOptions | SpringName,
  ): SizeAnimation {
    const animation =
      typeof changeOrOptions === 'function'
        ? animateSize(view, dimensions, changeOrOptions, options)
        : animateSize(view, dimensions, changeOrOptions)
    handles.push(animation)
    return animation
  }
  const fixture = (parent: StackLayout | GridLayout) => {
    host.removeChildren()
    const card = new StackLayout()
    card.width = 280
    card.height = 50
    card.padding = 12
    card.backgroundColor = new Color('#E4EEFF')
    card.horizontalAlignment = 'left'
    card.verticalAlignment = 'top'
    card.clipToBounds = true
    const label = new Label()
    label.text =
      'Real dimensions preserve text shapes. A multiline label wraps as the width changes, without a scale transform. More content makes the intrinsic height larger.'
    label.textWrap = true
    label.fontSize = 18
    card.addChild(label)
    const next = new Button()
    next.text = 'Following test row'
    next.height = 44
    GridLayout.setRow(next, 1)
    parent.addChild(card)
    parent.addChild(next)
    host.addChild(parent)
    return { card, label, next }
  }
  try {
    configure({ reducedMotion: 'never', timeScale: 1 })
    for (const kind of ['stack', 'grid'] as const) {
      stage = `${kind}: fixed, intrinsic and combined axes`
      const parent = kind === 'stack' ? new StackLayout() : new GridLayout()
      if (parent instanceof GridLayout) parent.rows = 'auto,auto'
      const { card, label, next } = fixture(parent)
      await wait(180)
      const transition = run(
        card,
        { width: 220, height: 180 },
        { duration: 600, ease: 'linear' },
      )
      await wait(280)
      const middle = bounds(card)
      check(
        middle.height > 60 && middle.height < 175,
        `${kind}: intermediate height ${middle.height}`,
      )
      check(
        middle.width < 275 && middle.width > 220,
        `${kind}: intermediate width ${middle.width}`,
      )
      near(card.scaleX, 1)
      near(card.scaleY, 1)
      const cardY = card.getLocationOnScreen().y
      near(next.getLocationOnScreen().y - cardY, middle.height, 5)
      if (isIOS) {
        const native = card.ios as UIView
        check(
          native.pointInsideWithEvent(CGPointMake(10, middle.height - 2), null),
          'inside hit bounds',
        )
        check(
          !native.pointInsideWithEvent(CGPointMake(10, middle.height + 2), null),
          'outside hit bounds',
        )
      } else {
        const rect = new android.graphics.Rect()
        ;(card.android as android.view.View).getHitRect(rect)
        near(Utils.layout.toDeviceIndependentPixels(rect.height()), middle.height)
      }
      samples.push({ kind, middle, native: true })
      check(await transition.finished, 'fixed complete')
      near(bounds(card).height, 180)
      mark(`${kind}: native intermediate bounds, siblings and hit bounds`)
      await run(card, { height: 'auto' }, { duration: 180 })
      check(card.height === 'auto', 'semantic auto restored')
      const original = bounds(card).height
      await run(
        card,
        { height: 'auto' },
        () => {
          label.text += '\nMore content arrives and grows the layout without stretching.'
        },
        { duration: 200 },
      )
      check(bounds(card).height > original, 'auto → new auto')
      mark(`${kind}: fixed → auto → content-driven auto`)
      const old = run(card, { height: 40 }, { duration: 700 })
      await wait(120)
      const before = bounds(card).height
      const replacement = run(card, { height: 'auto', width: 260 }, { duration: 300 })
      near(bounds(card).height, before)
      check(!(await old.finished), 'replaced false')
      await replacement
      mark(`${kind}: interrupted reversal and combined auto`)
      const late = run(card, { height: 'auto', width: 200 }, { duration: 450 })
      await wait(110)
      label.fontSize = 22
      label.text += '\nLate content and a larger font.'
      await late
      check(card.height === 'auto', 'late content preserves auto')
      const endpoint = bounds(card).height
      card.requestLayout()
      await wait(80)
      near(bounds(card).height, endpoint)
      mark(`${kind}: late content and font resizing retarget`)
      stage = `${kind}: parent constraints`
      card.width = 180
      parent.width = 290
      await wait(80)
      const resizing = run(card, { width: 'auto', height: 'auto' }, { duration: 500 })
      await wait(120)
      parent.width = 230
      await resizing
      near(bounds(card).width, 230)
      parent.width = 'auto'
      await wait(60)
      mark(`${kind}: parent resizing retargets auto`)
      stage = `${kind}: controls and ownership`
      const held = run(card, { height: 80 }, { duration: 500 })
      await wait(160)
      held.pause()
      const size = bounds(card).height
      await wait(150)
      near(bounds(card).height, size, 0.1)
      held.play()
      await held
      near(bounds(card).height, 80)
      mark(`${kind}: pause/resume`)
      card.height = 'auto'
      await wait(50)
      const restore = run(card, { height: 30 }, { duration: 500 })
      await wait(120)
      restore.stop({ restore: true })
      await wait(50)
      check(card.height === 'auto', 'restore declaration')
      const stop = run(card, { height: 30 }, { duration: 500 })
      await wait(120)
      const stopped = bounds(card).height
      stop.stop()
      await wait(50)
      near(bounds(card).height, stopped)
      check(!(await stop), 'stop false')
      const owned = run(card, { height: bounds(card).height + 100 }, { duration: 500 })
      await wait(100)
      card.height = 93
      await wait(60)
      check(!(await owned), 'external ownership cancels')
      near(bounds(card).height, 93)
      mark(`${kind}: hold, restore and external ownership`)
      const scope = motionScope()
      const scoped = scope.animateSize(card, { height: 200 }, { duration: 400 })
      await wait(80)
      scope.suspend()
      check(scoped.paused, 'scope pause')
      scope.resume()
      await scoped
      check(scope.size === 0, 'completed scope releases')
      const unload = run(card, { height: 25 }, { duration: 300 })
      parent.removeChild(card)
      check(!(await unload), 'unload cancelled')
      parent.insertChild(card, 0)
      await wait(60)
      configure({ reducedMotion: 'always' })
      await run(card, { height: 72 }, { duration: 2000 })
      near(bounds(card).height, 72)
      configure({ reducedMotion: 'never' })
      mark(`${kind}: scope, unload/reload and reduced motion`)
      card.padding = 0
      card.minHeight = 0
      await run(card, { height: 0 }, { duration: 100 })
      near(bounds(card).height, 0)
      card.minHeight = 35
      card.maxHeight = 120
      await run(card, { height: 300 }, { duration: 150 })
      check(bounds(card).height <= 123, `maxHeight respected: ${bounds(card).height}`)
      await run(card, { height: 0 }, { duration: 150 })
      check(bounds(card).height >= 32, `minHeight respected: ${bounds(card).height}`)
      mark(`${kind}: zero and min/max`)
      card.height = 50
      const bounce = run(card, { height: 120 }, 'bouncy')
      const sizes: number[] = []
      const observe = () => {
        sizes.push(bounds(card).height)
      }
      card.on('layoutChanged', observe)
      await bounce
      card.off('layoutChanged', observe)
      check(
        sizes.every((value) => value >= 34 && value <= 121),
        'spring overshoot obeys bounds',
      )
      mark(`${kind}: bounded spring overshoot`)
      card.scaleX = 0.85
      await run(card, { width: 210, height: 85 }, { duration: 120 })
      near(bounds(card).width, 210)
      near(bounds(card).height, 85)
      near(card.scaleX, 0.85, 0.001)
      card.scaleX = 1
    }
    status(`PASS · ${passed.length} native size checks`)
  } catch (error) {
    failure = String(error)
    status(`FAIL · ${stage} · ${String(error)}`)
    console.log('JoltSizeChecks', stage, String(error))
  } finally {
    handles.forEach((handle) => handle.stop({ restore: true }))
    if (ownMeasure) Object.defineProperty(root, 'measure', ownMeasure)
    else delete (root as Partial<View>).measure
    if (ownLayout) Object.defineProperty(root, 'layout', ownLayout)
    else delete (root as Partial<View>).layout
    configure({ reducedMotion: 'user', timeScale: 1 })
    const metrics = (values: number[]) => {
      const sorted = [...values].sort((a, b) => a - b)
      return {
        calls: values.length,
        totalMs: values.reduce((a, b) => a + b, 0),
        p50Ms: sorted[Math.floor(sorted.length * 0.5)],
        p95Ms: sorted[Math.floor(sorted.length * 0.95)],
        maxMs: sorted.at(-1),
      }
    }
    const report = {
      status: failure ? 'failed' : 'passed',
      error: failure,
      platform: Device.os,
      os: Device.osVersion,
      passed,
      stage,
      samples,
      count: passed.length,
      rootMeasure: metrics(measurementMs),
      rootLayout: metrics(layoutMs),
    }
    knownFolders
      .documents()
      .getFile('jolt-size-checks.json')
      .writeTextSync(JSON.stringify(report, null, 2))
    console.log('JoltSizeChecks', JSON.stringify(report))
  }
}
