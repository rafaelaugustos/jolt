import {
  Application,
  Color,
  Device,
  FlexboxLayout,
  GridLayout,
  Label,
  StackLayout,
  Utils,
  View,
  isIOS,
  knownFolders,
} from '@nativescript/core'
import {
  animate,
  animateSize,
  bind,
  configure,
  motionValue,
  seekableTimeline,
  set,
  springValue,
  type Animation,
} from '@rafaelaugusto/jolt'
import { physicsWorld } from '@rafaelaugusto/jolt/physics'
import { livePaintChecks } from './live-paint-checks'
import { waitForLayoutProgress } from './native-layout-progress'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const near = (actual: number, expected: number, tolerance = 2) =>
  check(
    Math.abs(actual - expected) <= tolerance,
    `${actual} != ${expected} ± ${tolerance}`,
  )
function paint(view: View) {
  if (isIOS) {
    const layer = (view.ios as UIView).layer,
      color = UIColor.colorWithCGColor(layer.backgroundColor)
    const r = new interop.Reference<number>(),
      g = new interop.Reference<number>(),
      b = new interop.Reference<number>(),
      a = new interop.Reference<number>()
    color.getRedGreenBlueAlpha(r, g, b, a)
    return {
      color:
        ((Math.round(a.value * 255) << 24) |
          (Math.round(r.value * 255) << 16) |
          (Math.round(g.value * 255) << 8) |
          Math.round(b.value * 255)) >>>
        0,
      radius: layer.cornerRadius,
    }
  }
  const native = view.android as android.view.View,
    drawable = native.getBackground()
  const type = drawable.getClass()
  const read = (name: string) => {
    const field = type.getDeclaredField(name)
    field.setAccessible(true)
    return name === 'backgroundColor'
      ? field.getInt(drawable) >>> 0
      : field.getFloat(drawable)
  }
  return {
    color: read('backgroundColor'),
    radius:
      read('borderTopLeftRadius') / native.getResources().getDisplayMetrics().density,
  }
}
function presentation(view: View, key: 'x' | 'y' | 'scaleX' | 'opacity') {
  if (isIOS) {
    const layer = (view.ios as UIView).layer.presentationLayer()
    check(layer, 'Missing native presentation layer')
    return Number(
      layer!.valueForKeyPath(
        {
          x: 'transform.translation.x',
          y: 'transform.translation.y',
          scaleX: 'transform.scale.x',
          opacity: 'opacity',
        }[key],
      ),
    )
  }
  const native = view.android as android.view.View
  const density = native.getResources().getDisplayMetrics().density
  return key === 'x'
    ? native.getTranslationX() / density
    : key === 'y'
      ? native.getTranslationY() / density
      : key === 'scaleX'
        ? native.getScaleX()
        : native.getAlpha()
}
function bounds(view: View) {
  if (isIOS) {
    const frame = (view.ios as UIView).bounds
    return { width: frame.size.width, height: frame.size.height }
  }
  const native = view.android as android.view.View
  return {
    width: Utils.layout.toDeviceIndependentPixels(native.getWidth()),
    height: Utils.layout.toDeviceIndependentPixels(native.getHeight()),
  }
}
function tile(width = 80, height = 80) {
  const view = new Label()
  view.width = width
  view.height = height
  view.borderRadius = 8
  view.backgroundColor = new Color('#8CB5FF')
  view.horizontalAlignment = 'left'
  view.verticalAlignment = 'top'
  return view
}
/** Boundary measurements against the production native demo, with no mock drivers. */
export async function runNativeCapabilitiesChecks(
  host: GridLayout,
  status: (message: string) => void,
) {
  const report = {
    startedAt: Date.now(),
    platform: Device.os,
    device: Device.model,
    passed: [] as string[],
    samples: [] as unknown[],
    failure: undefined as string | undefined,
  }
  const cleanup: (() => void)[] = []
  const mark = (name: string) => {
    report.passed.push(name)
    status(`${report.passed.length} checks · ${name}`)
  }
  const keep = <T extends Animation>(a: T) => {
    cleanup.push(() => a.stop())
    return a
  }
  const clear = () => {
    cleanup
      .splice(0)
      .reverse()
      .forEach((off) => off())
    host.removeChildren()
  }
  const nodes = () =>
    isIOS ? JoltLiveSpring.nodeCount() : org.rafaelaugusto.jolt.LiveSpring.nodeCount()
  const worlds = () =>
    isIOS ? JoltCircleWorld.worldCount() : org.rafaelaugusto.jolt.CircleWorld.worldCount()
  try {
    configure({ reducedMotion: 'never', timeScale: 1 })
    await livePaintChecks(host, mark, report.samples)
    const before = nodes(),
      card = tile(160, 160)
    host.addChild(card)
    await wait(120)
    const input = motionValue(0),
      live = springValue(input, { stiffness: 140, damping: 14 })
    cleanup.push(() => live.dispose())
    const color = live.to([0, 1], ['#408CB5FF', '#FFEFA26F']),
      radius = live.to([0, 1], [8, 70])
    const release = bind(card, {
      backgroundColor: color,
      borderRadius: radius,
      x: live.to([0, 1], [0, 40]),
    })
    cleanup.push(release)
    set(input, 1)
    await wait(180)
    live.pause()
    await wait(60)
    const sample = paint(card)
    report.samples.push({
      live: live.get(),
      paint: sample,
      expectedColor: color.get().argb >>> 0,
      expectedRadius: radius.get(),
    })
    const expected = color.get().argb >>> 0
    for (const shift of [0, 8, 16, 24])
      near((sample.color >>> shift) & 255, (expected >>> shift) & 255, 1)
    near(sample.radius, Math.min(80, Math.max(0, radius.get())), 0.5)
    check(live.get() > 0 && live.get() < 1.3, 'Spring did not move to intermediate state')
    mark('live native color alpha and radius match the retained spring')
    for (let i = 0; i < 300; i++) set(input, i % 2)
    check(nodes() === before + 1, 'Retarget allocated native nodes')
    const held = paint(card)
    await wait(120)
    check(JSON.stringify(held) === JSON.stringify(paint(card)), 'Paused paint moved')
    live.play()
    set(input, 0)
    await wait(900)
    mark('rapid paint retarget and paused native state')
    card.backgroundColor = new Color('#556677')
    set(input, 1)
    await wait(900)
    near(paint(card).color, 0xff556677, 0)
    check(paint(card).radius > 60, 'Color takeover removed radius binding')
    mark('external color owns its channel while radius continues')
    configure({ reducedMotion: 'always' })
    set(input, 0)
    await wait(60)
    near(paint(card).radius, 8, 0.5)
    configure({ reducedMotion: 'never' })
    release()
    live.dispose()
    check(nodes() === before, 'Paint graph leaked native nodes')
    mark('paint Reduce Motion and disposal')
    clear()

    const view = tile(60, 60),
      bar = tile(200, 10)
    bar.marginTop = 130
    bar.originX = 0
    host.addChild(view)
    host.addChild(bar)
    await wait(120)
    const value = motionValue(0)
    cleanup.push(bind(bar, { scaleX: value }))
    const scene = keep(
      seekableTimeline(
        [
          {
            target: view,
            keyframes: { x: [0, 160] },
            transition: { duration: 1600, ease: 'linear' },
          },
          {
            target: view,
            at: 400,
            keyframes: { scale: [1, 1.5], opacity: [0.4, 1] },
            transition: { duration: 800, ease: 'linear' },
          },
          { value, keyframes: [0, 1], transition: { duration: 1600, ease: 'linear' } },
        ],
        { paused: true },
      ),
    )
    for (const progress of [0.1, 0.5, 1, 0.25]) {
      scene.progress = progress
      await wait(80)
      near(presentation(view, 'x'), 160 * progress)
      near(presentation(bar, 'scaleX'), progress, 0.025)
      const local = Math.max(0, Math.min(1, (1600 * progress - 400) / 800))
      near(presentation(view, 'scaleX'), 1 + 0.5 * local, 0.025)
      near(presentation(view, 'opacity'), 0.4 + 0.6 * local, 0.025)
      report.samples.push({
        scene: progress,
        x: presentation(view, 'x'),
        bar: presentation(bar, 'scaleX'),
      })
    }
    mark('scene delays overlaps and backward seek from paused endpoint')
    let rejected = false
    try {
      near(presentation(view, 'x'), 160 * 0.25 + 10, 2)
    } catch {
      rejected = true
    }
    check(rejected, 'Native geometry negative control failed')
    mark('scene geometry negative control rejects ten DIP error')
    const newer = keep(animate(view, { x: [80, 80] }, { duration: 2000, ease: 'linear' }))
    newer.pause()
    scene.progress = 0.7
    await wait(80)
    near(presentation(view, 'x'), 80)
    scene.play()
    await wait(130)
    check(scene.progress > 0.7, 'Native scene clock did not resume')
    scene.pause()
    const heldProgress = scene.progress
    await wait(100)
    near(scene.progress, heldProgress, 0.001)
    scene.stop()
    check((await scene) === false, 'Interrupted scene reported completion')
    mark('scene seek preserves newer owner and native playback clock')
    newer.stop()
    configure({ timeScale: 0.5 })
    const scaled = keep(
      seekableTimeline(
        [
          {
            target: view,
            keyframes: { y: [0, 100] },
            transition: {
              duration: 500,
              repeat: 1,
              repeatType: 'reverse',
              ease: 'linear',
            },
          },
        ],
        { paused: true },
      ),
    )
    near(scaled.duration, 2000, 0)
    scaled.progress = 0.75
    await wait(60)
    near(presentation(view, 'y'), 50)
    scaled.stop()
    configure({ timeScale: 1 })
    mark('scene repeat direction and timeScale')
    const unload = keep(
      seekableTimeline([
        { target: view, keyframes: { x: [0, 100] }, transition: { duration: 1000 } },
      ]),
    )
    host.removeChild(view)
    check((await unload) === false, 'Unloaded scene remained active')
    host.addChild(view)
    await wait(80)
    mark('scene unload is terminal and releases ownership')
    clear()

    for (const direction of ['row', 'column'] as const) {
      const flex = new FlexboxLayout()
      flex.flexDirection = direction
      flex.flexWrap = 'nowrap'
      flex.height = 260
      flex.alignItems = 'stretch'
      const first = new StackLayout()
      first.width = direction === 'row' ? 110 : 210
      first.height = direction === 'row' ? 210 : 70
      first.backgroundColor = new Color('#D8E6C5')
      first.padding = 8
      FlexboxLayout.setFlexGrow(first, 0)
      FlexboxLayout.setFlexShrink(first, 0)
      const text = new Label()
      text.text =
        'Real text wraps when layout changes. Native siblings keep their own geometry.'
      text.textWrap = true
      text.fontSize = 16
      first.addChild(text)
      const sibling = tile(50, 40)
      FlexboxLayout.setFlexGrow(sibling, 1)
      FlexboxLayout.setFlexShrink(sibling, 1)
      flex.addChild(first)
      flex.addChild(sibling)
      host.addChild(flex)
      await wait(140)
      const axis = direction === 'row' ? 'width' : 'height',
        start = bounds(first)[axis],
        end = direction === 'row' ? 220 : 150
      const animation = keep(
        animateSize(first, { [axis]: end }, { duration: 700, ease: 'linear' }),
      )
      // animateSize starts its clock on the first layout frame, which can arrive
      // late on shared runners. Observe native progress before testing pause.
      const progress = await waitForLayoutProgress(
        () => bounds(first)[axis],
        start + 10,
        end - 5,
        `Flex ${direction}`,
      )
      animation.pause()
      await wait(60)
      const middle = bounds(first)[axis]
      check(
        middle > start + 10 && middle < end - 5,
        `Flex ${direction} did not reflow: ${start},${middle},${end}`,
      )
      const position = sibling.getLocationRelativeTo(flex)!
      near(direction === 'row' ? position.x : position.y, middle, 3)
      near(presentation(first, 'scaleX'), 1, 0.001)
      const pause = bounds(first)
      await wait(100)
      near(bounds(first)[axis], pause[axis], 0.5)
      animation.play()
      await animation
      near(bounds(first)[axis], end, 2)
      report.samples.push({
        flex: direction,
        start,
        middle,
        progress,
        end: bounds(first),
        sibling: position,
      })
      mark(`flex ${direction} real bounds sibling allocation pause resume`)
      const intrinsic = keep(
        animateSize(
          first,
          { height: 'auto' },
          () => {
            text.fontSize = 19
            text.text += ' A larger font recalculates intrinsic height.'
          },
          { duration: 350, ease: 'linear' },
        ),
      )
      await intrinsic
      check(String(first.height) === 'auto', 'Flex auto declaration was not restored')
      check(bounds(first).height > 30, 'Flex intrinsic height missing')
      mark(`flex ${direction} intrinsic content and font update`)
      const resize = keep(
        animateSize(first, { width: 170, height: 'auto' }, { duration: 450 }),
      )
      await wait(100)
      text.fontSize = 30
      flex.width = Math.max(260, bounds(flex).width - 40)
      await resize
      // Column cross-axis stretch remains the parent's allocation policy.
      near(bounds(first).width, direction === 'row' ? 170 : bounds(flex).width, 2)
      check(String(first.height) === 'auto', 'Resized flex lost semantic auto')
      report.samples.push({ flexResize: direction, fontSize: 30, bounds: bounds(first) })
      const reducedSize = keep(animateSize(first, { width: 130 }, { duration: 700 }))
      await wait(90)
      configure({ reducedMotion: 'always' })
      check(await reducedSize, 'Flex Reduce Motion did not complete')
      near(bounds(first).width, direction === 'row' ? 130 : bounds(flex).width, 2)
      configure({ reducedMotion: 'never' })
      mark(`flex ${direction} active parent resize large text and Reduce Motion`)
      clear()
    }
    const invalidFlex = new FlexboxLayout()
    invalidFlex.flexWrap = 'wrap'
    const invalid = tile()
    invalidFlex.addChild(invalid)
    host.addChild(invalidFlex)
    await wait(80)
    let invalidRejected = false
    try {
      animateSize(invalid, { width: 100 })
    } catch {
      invalidRejected = true
    }
    check(invalidRejected, 'Unsupported flex wrap was accepted')
    mark('unsupported flex layout rejects before mutation')
    clear()

    const initialWorlds = worlds(),
      a = tile(40, 40),
      b = tile(40, 40),
      c = tile(40, 40)
    for (const body of [a, b, c]) {
      body.borderRadius = 20
      host.addChild(body)
    }
    await wait(120)
    const w = physicsWorld(
      host,
      [
        { id: 'a', view: a, radius: 20, x: 60, y: 110, mass: 1 },
        { id: 'b', view: b, radius: 20, x: 160, y: 110, mass: 2 },
        { id: 'c', view: c, radius: 20, x: 260, y: 110, mass: 3 },
      ],
      {
        gravity: { x: 0, y: 0 },
        damping: 0.7,
        springs: [
          { id: 'ab', from: 'a', to: 'b', length: 70, line: { color: '#687C70' } },
          { id: 'bc', from: 'b', to: 'c', length: 70, line: { color: '#687C70' } },
        ],
      },
    )
    cleanup.push(() => w.dispose())
    await wait(220)
    const snapshot = w.snapshot()
    check(
      snapshot.guides === 2 && snapshot.springs.length === 2,
      'Native spring guides missing',
    )
    for (const [i, body] of [a, b, c].entries()) {
      const p = body.getLocationRelativeTo(host)!
      near(p.x + 20, snapshot.bodies[i]!.x, 2)
      near(p.y + 20, snapshot.bodies[i]!.y, 2)
    }
    check(
      snapshot.bodies[0]!.x > 60 && snapshot.bodies[2]!.x < 260,
      'Both spring endpoints did not react',
    )
    report.samples.push({ world: snapshot })
    mark('native connected bodies and guide presentation')
    w.pause()
    const paused = w.snapshot()
    await wait(130)
    check(
      w.snapshot().frames === paused.frames && !paused.clock,
      'Paused connected world kept stepping',
    )
    w.spring('ab', { from: 'a', to: 'b', length: 80, line: { color: '#687C70' } })
    check(
      w
        .snapshot()
        .bodies.every(
          (body, i) =>
            body.vx === paused.bodies[i]!.vx && body.vy === paused.bodies[i]!.vy,
        ),
      'Spring replacement reset velocity',
    )
    w.spring('bc', null)
    check(w.snapshot().guides === 1, 'Removed spring guide leaked')
    w.play()
    w.impulse('a', { x: 150, y: -80 })
    await wait(100)
    configure({ reducedMotion: 'always' })
    const reduced = w.snapshot()
    await wait(100)
    check(
      !reduced.clock && w.snapshot().frames === reduced.frames,
      'Reduced world kept stepping',
    )
    configure({ reducedMotion: 'never' })
    w.play()
    await wait(80)
    mark('body spring pause replacement removal and Reduce Motion')
    host.removeChild(a)
    await wait(80)
    check(
      w.snapshot().status === 'disposed',
      'Removed endpoint did not dispose linked world',
    )
    w.dispose()
    check(
      worlds() === initialWorlds && w.snapshot().guides === 0,
      'Connected world resources leaked',
    )
    mark('removed body disposes links guides and native world')
  } catch (error) {
    report.failure = String(error)
    status(`FAILED: ${report.failure}`)
  } finally {
    clear()
    configure({ reducedMotion: 'user', timeScale: 1 })
  }
  knownFolders
    .documents()
    .getFile('jolt-native-capabilities.json')
    .writeTextSync(JSON.stringify(report, null, 2))
  console.log('JOLT_NATIVE_CAPABILITIES', JSON.stringify(report))
  return report
}
