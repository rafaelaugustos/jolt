import {
  Application,
  Color,
  GridLayout,
  Label,
  isIOS,
  type View,
} from '@nativescript/core'
import { bind, configure, motionValue, set, springValue } from '@rafaelaugusto/jolt'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const check = (ok: unknown, message: string) => {
  if (!ok) throw new Error(message)
}
const packed = (color: UIColor) => {
  const r = new interop.Reference<number>(),
    g = new interop.Reference<number>(),
    b = new interop.Reference<number>(),
    a = new interop.Reference<number>()
  color.getRedGreenBlueAlpha(r, g, b, a)
  return (
    ((Math.round(a.value * 255) << 24) |
      (Math.round(r.value * 255) << 16) |
      (Math.round(g.value * 255) << 8) |
      Math.round(b.value * 255)) >>>
    0
  )
}
/** Reads the rendered native layers/drawable, never the stale Core style model. */
function sample(view: Label) {
  if (isIOS) {
    const native = view.ios as UILabel,
      layer = native.layer
    let border: CALayer | undefined
    for (let i = 0; i < (layer.sublayers?.count ?? 0); i++) {
      const candidate = layer.sublayers!.objectAtIndex(i)
      if (candidate.name === 'jolt:live-paint') border = candidate
    }
    const edge = border?.sublayers?.objectAtIndex(0) as CAShapeLayer | undefined
    const path = (layer.mask as CAShapeLayer)?.path
    const ring = (edge?.mask as CAShapeLayer)?.path
    const contains = (path: interop.Pointer, x: number, y: number) =>
      CGPathContainsPoint(path, null, CGPointMake(x, y), true)
    return {
      background: packed(UIColor.colorWithCGColor(layer.backgroundColor)),
      text: packed(native.textColor),
      border: edge ? packed(UIColor.colorWithCGColor(edge.fillColor)) : undefined,
      asymmetric:
        !!path &&
        !contains(path, 10, 10) &&
        contains(path, 150, 10) &&
        contains(path, 10, 150) &&
        !contains(path, 150, 150),
      topWidth: !!ring && contains(ring, 80, 6) && !contains(ring, 80, 15),
      scale: native.transform.a,
    }
  }
  const native = view.android as android.widget.TextView,
    drawable = native.getBackground(),
    density = native.getResources().getDisplayMetrics().density
  const read = (name: string, color = false) => {
    const field = drawable.getClass().getDeclaredField(name)
    field.setAccessible(true)
    return color ? field.getInt(drawable) >>> 0 : field.getFloat(drawable) / density
  }
  return {
    background: read('backgroundColor', true),
    text: native.getCurrentTextColor() >>> 0,
    border: read('borderTopColor', true),
    asymmetric:
      Math.abs(read('borderTopLeftRadius') - 64) < 0.1 &&
      Math.abs(read('borderBottomRightRadius') - 64) < 0.1 &&
      Math.abs(read('borderTopRightRadius') - 8) < 0.1 &&
      Math.abs(read('borderBottomLeftRadius') - 8) < 0.1,
    topWidth:
      Math.abs(read('borderTopWidth') - 12) < 0.1 &&
      Math.abs(read('borderRightWidth') - 3) < 0.1,
    scale: native.getScaleX(),
  }
}

export async function livePaintChecks(
  host: GridLayout,
  mark: (name: string) => void,
  samples: unknown[],
) {
  const card = new Label()
  card.text = 'Live paint'
  card.width = 160
  card.height = 160
  card.horizontalAlignment = 'left'
  card.verticalAlignment = 'top'
  card.backgroundColor = new Color('#8CB5FF')
  card.color = new Color('#17332B')
  card.borderRadius = 8
  card.borderWidth = 3
  card.borderColor = new Color('#17332B')
  host.addChild(card)
  await wait(120)
  const input = motionValue(0),
    live = springValue(input, { stiffness: 180, damping: 24 })
  const releases: (() => void)[] = []
  try {
    releases.push(
      bind(card, {
        backgroundColor: live.to([0, 1], ['#8CB5FF', '#EFA26F']),
        color: live.to([0, 1], ['#17332B', '#6B203F']),
        borderTopLeftRadius: live.to([0, 1], [8, 64]),
        borderBottomRightRadius: live.to([0, 1], [8, 64]),
        borderTopWidth: live.to([0, 1], [3, 12]),
        scale: live.to([0, 1], [1, 1.1]),
      }),
    )
    // Mavis #191: a root border setter must not detach retained background/radius.
    const rootBorder = bind(card, {
      borderColor: input.to([0, 1], ['#17332B', '#993C56']),
    })
    releases.push(rootBorder)
    set(input, 1)
    await wait(1100)
    let state = sample(card)
    samples.push({ livePaint: 'mixed root/live', ...state })
    check(
      state.background === 0xffefa26f && state.text === 0xff6b203f,
      'Mixed paint lost background/text',
    )
    check(
      state.border === 0xff993c56 && state.asymmetric && state.topWidth,
      'Mixed paint lost border/corners',
    )
    check(Math.abs(state.scale - 1.1) < 0.002, 'Mixed paint lost scale')
    mark('mixed root border and live paint retain independent native channels')
    rootBorder()
    const old = bind(card, { borderColor: live.to([0, 1], ['#17332B', '#993C56']) })
    const latest = bind(card, { borderColor: live.to([0, 1], ['#17332B', '#336699']) })
    releases.push(old, latest)
    old()
    await wait(60)
    check(sample(card).border === 0xff336699, 'Stale cleanup overwrote newer live border')
    mark('live border replacement and stale cleanup preserve the new owner')
    live.pause()
    set(input, 0)
    Application.notify({ eventName: Application.suspendEvent })
    Application.notify({ eventName: Application.resumeEvent })
    await wait(100)
    check(
      sample(card).background === 0xffefa26f && live.paused,
      'Suspend lost manually paused paint',
    )
    live.play()
    await wait(1100)
    check(
      sample(card).background === 0xff8cb5ff,
      'Resumed native paint did not reach target',
    )
    mark('paint pause, app suspend/resume and playback preserve native state')
    host.removeChild(card)
    await wait(40)
    host.addChild(card)
    await wait(100)
    configure({ reducedMotion: 'always' })
    set(input, 1)
    await wait(80)
    state = sample(card)
    samples.push({ livePaint: 'reloaded/reduced', ...state })
    check(
      state.background === 0xffefa26f && state.asymmetric && state.topWidth,
      'Reload/reduced paint mismatch',
    )
    mark('reloaded paint and Reduce Motion update native edges immediately')
    const invalid = new GridLayout()
    host.addChild(invalid)
    try {
      let rejected = false
      try {
        bind([card, invalid] as View[], { color: live.to([0, 1], ['red', 'blue']) })
      } catch {
        rejected = true
      }
      check(rejected, 'Invalid text target was accepted')
      set(input, 0)
      await wait(60)
      check(
        sample(card).text === 0xff17332b,
        'Invalid batch replaced the valid text binding',
      )
    } finally {
      host.removeChild(invalid)
    }
    mark('invalid native text batches reject before replacing existing bindings')
  } finally {
    releases.reverse().forEach((release) => release())
    live.dispose()
    configure({ reducedMotion: 'never' })
    host.removeChild(card)
  }
}
