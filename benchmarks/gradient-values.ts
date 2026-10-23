/** Real native gradient/value conformance; discrete measurement timers are test instrumentation only. */
import {
  Application,
  Color,
  Device,
  GridLayout,
  View,
  Utils,
  isIOS,
  knownFolders,
  type LayoutBase,
} from '@nativescript/core'
import {
  animate,
  bind,
  configure,
  gradient,
  motionScope,
  motionValue,
  playbackProgress,
  set,
  stop,
  type Gradient,
  type MotionValue,
  type GradientType,
} from '@rafaelaugusto/jolt'
import { getDriver } from '../dist/driver/index.js'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const assert = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message)
}
const listeners = (value: MotionValue) =>
  (value as unknown as { listeners: Set<unknown> }).listeners.size
const nativeLayers = (view: View) => {
  if (!isIOS) return []
  const layers = (view.ios as UIView).layer.sublayers
  return layers
    ? (Array.from({ length: layers.count }, (_, i) => layers.objectAtIndex(i)).filter(
        (layer) => layer instanceof CAGradientLayer,
      ) as CAGradientLayer[])
    : []
}
function androidLayer(view: View): org.rafaelaugusto.jolt.GradientLayer | undefined {
  const find = (
    drawable: android.graphics.drawable.Drawable,
  ): org.rafaelaugusto.jolt.GradientLayer | undefined => {
    if (drawable instanceof org.rafaelaugusto.jolt.GradientLayer) return drawable
    if (drawable instanceof android.graphics.drawable.LayerDrawable)
      for (let i = 0; i < drawable.getNumberOfLayers(); i++) {
        const found = find(drawable.getDrawable(i))
        if (found) return found
      }
  }
  return find((view.android as android.view.View).getBackground())
}
function read(view: View, type: GradientType) {
  if (!isIOS) {
    const layer = androidLayer(view)!
    const g = layer.getGeometry(),
      s = layer.getStops(),
      c = layer.getColors()
    return {
      x: g[1]!,
      y: g[2]!,
      angle: g[0]!,
      radius: g[3]!,
      stops: Array.from({ length: s.length }, (_, i) => s[i]!),
      colors: Array.from({ length: c.length }, (_, i) => c[i]! >>> 0),
      corner: Utils.layout.toDeviceIndependentPixels(layer.getCorner()),
      samples: layer.getSampleCount(),
    }
  }
  const layer = nativeLayers(view)[0]!
  const presented = (layer.presentationLayer() ?? layer) as CAGradientLayer
  const a = presented.startPoint,
    b = presented.endPoint
  const { width, height } = layer.bounds.size
  const angle =
    type === 'conic'
      ? (Math.atan2(-(b.x - a.x) * width, (b.y - a.y) * height) * 180) / Math.PI
      : (Math.atan2((b.x - a.x) * height, -(b.y - a.y) * width) * 180) / Math.PI
  const colors = presented.colors as NSArray<any>
  const positions = presented.locations as NSArray<number>
  return {
    x: a.x,
    y: a.y,
    angle,
    radius: ((b.x - a.x) * width) / Math.min(width, height),
    stops: Array.from({ length: positions.count }, (_, i) =>
      Number(positions.objectAtIndex(i)),
    ),
    colors: Array.from(
      { length: colors.count },
      (_, i) =>
        Color.fromIosColor(UIColor.colorWithCGColor(colors.objectAtIndex(i))).argb >>> 0,
    ),
    corner: layer.cornerRadius,
    samples: layer.animationKeys()?.count ?? 0,
  }
}
function position(view: View) {
  return isIOS
    ? Number(
        (
          (view.ios as UIView).layer.presentationLayer() ?? (view.ios as UIView).layer
        ).valueForKeyPath('transform.translation.x'),
      )
    : Utils.layout.toDeviceIndependentPixels(
        (view.android as android.view.View).getTranslationX(),
      )
}

export async function checkGradientValues(
  host: LayoutBase,
  report: (message: string) => void,
  mode = 'all',
) {
  const driver = getDriver(),
    originalFrame = driver.frame
  let observerFrames = 0
  driver.frame = (callback) => {
    observerFrames++
    return originalFrame.call(driver, callback)
  }
  const results: {
    name: string
    passed: boolean
    detail?: string
    samples: unknown[]
  }[] = []
  let samples: unknown[] = []
  const canvas = new GridLayout()
  canvas.width = 220
  canvas.height = 100
  canvas.borderRadius = 18
  const marker = new GridLayout()
  marker.width = marker.height = 16
  marker.backgroundColor = new Color('white')
  marker.horizontalAlignment = 'left'
  canvas.addChild(marker)
  host.addChild(canvas)
  await wait(200)
  const scope = motionScope()
  let value = motionValue(0),
    glow: Gradient | undefined,
    type: GradientType = 'radial'
  const options = () => ({
    type,
    colors: [value.to([0, 1], ['rgba(255, 0, 85, 0.5)', '#0088ff']), '#111827'],
    stops: [value.to([0, 1], [0.1, 0.4], { clamp: false }), 1],
    angle: value.to([0, 1], [0, 300], { clamp: false }),
    center: {
      x: value.to([0, 1], [0.1, 0.7], { clamp: false }),
      y: value.to([1, 0], [0.2, 0.8], { clamp: false }),
    },
    radius: value.to([0, 1], [0.3, 0.8], { clamp: false }),
  })
  const setup = () => {
    stop(value)
    scope.reset()
    type = 'radial'
    value = motionValue(0)
    set(marker, { x: 0, opacity: 1 })
    canvas.width = 220
    canvas.height = 100
    canvas.borderRadius = 18
    scope.use(() =>
      bind(marker, {
        x: value.to([0, 1], [0, 100], { clamp: false }),
        opacity: value.to([0, 1], [0.2, 1]),
      }),
    )
    glow = scope.gradient(canvas, options())
  }
  const sample = (phase: string, expected = value.get()) => {
    const state = read(canvas, type),
      x = position(marker),
      inferred = (state.x - 0.1) / 0.6
    samples.push({ phase, expected, nativeViewX: x, gradient: state })
    if (type !== 'linear') {
      assert(
        Math.abs(inferred - expected) < 0.08,
        `Gradient clock drift at ${phase}: ${inferred} vs ${expected}`,
      )
      assert(
        Math.abs(inferred - x / 100) < 0.06,
        `Gradient/view mismatch at ${phase}: ${inferred} vs ${x / 100}`,
      )
      assert(
        Math.abs(state.y - (0.8 - 0.6 * inferred)) < 0.015,
        `Incoherent center at ${phase}`,
      )
      assert(
        Math.abs(state.stops[0]! - Math.max(0, Math.min(1, 0.1 + 0.3 * inferred))) <
          0.015,
        `Incoherent stops at ${phase}`,
      )
    } else {
      const error = ((state.angle - expected * 300 + 540) % 360) - 180
      assert(Math.abs(error) < 15, `Linear angle drift: ${error}`)
    }
    assert(
      state.colors.length === 2 && state.stops.length === 2,
      'Native stop/color count mismatch',
    )
  }
  const check = async (name: string, run: () => Promise<void>) => {
    report(name)
    setup()
    samples = []
    await wait(180)
    try {
      await run()
      results.push({ name, passed: true, samples })
    } catch (error) {
      results.push({ name, passed: false, detail: String(error), samples })
    }
  }
  try {
    if (mode === 'background') {
      await check(
        'Real background/foreground reattaches without duplicate subscriptions',
        async () => {
          let suspended = false,
            resumed = false
          const onSuspend = () => {
            suspended = listeners(value) === 0
            samples.push({ event: 'suspend', listeners: listeners(value), suspended })
          }
          const onResume = () => {
            resumed = true
            samples.push({ event: 'resume', listeners: listeners(value) })
          }
          Application.on(Application.suspendEvent, onSuspend)
          Application.on(Application.resumeEvent, onResume)
          try {
            const run = scope.add(animate(value, 1, { duration: 8000, ease: 'linear' }))
            report('Background ready')
            const deadline = Date.now() + 15000
            while (!resumed && Date.now() < deadline) await wait(100)
            await wait(100)
            assert(suspended && resumed, 'Missing real lifecycle cleanup/rebind')
            assert(listeners(value) === 1, 'Foreground did not reattach exactly once')
            sample('foreground')
            run.stop()
          } finally {
            Application.off(Application.suspendEvent, onSuspend)
            Application.off(Application.resumeEvent, onResume)
          }
        },
      )
    } else if (mode === 'reduced') {
      await check(
        'Reduced motion keeps destination geometry and animated colors/stops',
        async () => {
          configure({ reducedMotion: 'always' })
          try {
            for (const next of ['linear', 'radial', 'conic'] as const) {
              glow!.remove()
              set(value, 0)
              type = next
              glow = scope.gradient(canvas, options())
              const run = scope.add(animate(value, 1, { duration: 700, ease: 'linear' }))
              await wait(200)
              const state = read(canvas, type)
              samples.push({ type, gradient: state })
              if (type === 'linear')
                assert(
                  Math.abs(((state.angle - 300 + 540) % 360) - 180) < 1,
                  'Reduced angle did not jump',
                )
              else assert(Math.abs(state.x - 0.7) < 0.01, 'Reduced center did not jump')
              assert(
                state.stops[0]! > 0.1 && state.stops[0]! < 0.4,
                'Reduced stops did not interpolate',
              )
              assert(
                state.colors[0] !== new Color('#0088ff').argb >>> 0,
                'Reduced color jumped',
              )
              await run.finished
            }
          } finally {
            configure({ reducedMotion: 'user' })
          }
        },
      )
    } else {
      await check('Mixed values and native color/alpha', async () => {
        set(value, 0.5)
        await wait(40)
        sample('set-half')
        const expected =
          value.to([0, 1], ['rgba(255, 0, 85, 0.5)', '#0088ff']).get().argb >>> 0
        assert(
          read(canvas, type).colors[0] === expected,
          'Derived color/alpha was not applied',
        )
      })
      await check(
        'Autonomous native synchronization and zero observer frames',
        async () => {
          const run = scope.add(animate(value, 1, { duration: 1200, ease: 'linear' }))
          for (let i = 0; i < 4; i++) {
            await wait(200)
            sample(`playing-${i}`)
          }
          await run.finished
          await wait(35)
          sample('finished', 1)
          assert(observerFrames === 0, `Requested ${observerFrames} JS observer frames`)
        },
      )
      await check('Pause, seek, rewind and resume of the source', async () => {
        const run = scope.add(animate(value, 1, { duration: 1200, ease: 'linear' }))
        await wait(250)
        run.pause()
        await wait(40)
        const held = read(canvas, type).x
        await wait(250)
        assert(
          Math.abs(read(canvas, type).x - held) < 0.002,
          'Gradient moved while paused',
        )
        run.progress = 0.7
        await wait(40)
        sample('seek', 0.7)
        run.progress = 0.2
        run.play()
        await wait(250)
        sample('resumed')
        await run.finished
      })
      await check(
        'Scalar layers and interruption keep sibling components coherent',
        async () => {
          scope.add(animate(value, 1, { duration: 1400, ease: 'linear' }))
          await wait(120)
          const pulse = scope.add(
            animate(value, [0, 0.15, 0], {
              duration: 600,
              ease: 'linear',
              layer: 'pulse',
            }),
          )
          await wait(240)
          sample('pulse')
          await pulse.finished
          // Core Animation commits the rebuilt layer at the next render transaction.
          await wait(40)
          sample('base-after-pulse')
          set(value, 0.4)
          await wait(40)
          sample('interrupted', 0.4)
        },
      )
      await check('Component replacement and structural color changes', async () => {
        const release = glow!.bind({ angle: value })
        glow!.bind({ angle: value.to([0, 1], [0, 90]) })
        release()
        set(value, 0.6)
        await wait(40)
        sample('new-owner', 0.6)
        glow!.set({ colors: ['red', 'green', 'blue'] })
        await wait(30)
        assert(read(canvas, type).colors.length === 3, 'Color structure not replaced')
        glow!.set({ colors: ['red', 'blue'] })
        set(value, 0.3)
        await wait(30)
        assert(read(canvas, type).colors.length === 2, 'Removed bound color revived')
      })
      await check('Resize and corners preserve native bindings', async () => {
        scope.add(animate(value, 1, { duration: 1200, ease: 'linear' }))
        await wait(150)
        canvas.width = 280
        canvas.height = 130
        canvas.borderRadius = 28
        canvas.requestLayout()
        await wait(200)
        sample('resized')
        assert(Math.abs(read(canvas, type).corner - 28) < 0.1, 'Corner radius lost')
      })
      await check('Scope suspension holds then catches up to the source', async () => {
        // Keep this source animation outside the suspended ownership scope.
        const run = animate(value, 1, { duration: 1400, ease: 'linear' })
        await wait(200)
        scope.suspend()
        await wait(40)
        const held = read(canvas, type).x
        assert(listeners(value) === 0, 'Source subscription survived suspension')
        await wait(250)
        assert(Math.abs(read(canvas, type).x - held) < 0.002, 'Suspended gradient moved')
        scope.resume()
        await wait(80)
        sample('scope-resumed')
        assert(listeners(value) === 1, 'Duplicate source subscription')
        run.stop()
      })
      await check(
        'Unload/reload and repeated bind/remove restore resources',
        async () => {
          set(value, 0.3)
          host.removeChild(canvas)
          host.addChild(canvas)
          await wait(100)
          sample('reloaded', 0.3)
          assert(listeners(value) === 1, 'Reload duplicated subscription')
          scope.reset()
          for (let i = 0; i < 20; i++) {
            const layer = gradient(canvas, options())
            const off = layer.bind({ radius: value })
            off()
            off()
            layer.remove()
            layer.remove()
            assert(listeners(value) === 0, 'Gradient subscription leaked')
            assert(
              isIOS ? nativeLayers(canvas).length === 0 : !androidLayer(canvas),
              'Native gradient layer leaked',
            )
          }
        },
      )
      await check('Linear, radial and conic native geometry', async () => {
        for (const next of ['linear', 'radial', 'conic'] as const) {
          glow!.remove()
          type = next
          glow = scope.gradient(canvas, options())
          set(value, 0.4)
          await wait(60)
          sample(next, 0.4)
        }
      })
      await check(
        'Derived playback progress follows its existing animation',
        async () => {
          scope.reset()
          set(marker, { x: 0 })
          const run = scope.add(
            animate(marker, { x: 100 }, { duration: 1200, ease: 'linear' }),
          )
          const p = playbackProgress(run)
          glow = scope.gradient(canvas, {
            type: 'radial',
            colors: ['red', 'blue'],
            center: { x: p, y: 0.5 },
            radius: 0.5,
          })
          await wait(250)
          run.pause()
          run.progress = 0.65
          await wait(40)
          const state = read(canvas, type)
          samples.push({ gradient: state, view: position(marker) })
          assert(
            Math.abs(state.x - 0.65) < 0.01 && Math.abs(position(marker) - 65) < 1,
            'Progress seek mismatch',
          )
          run.play()
          await run.finished
        },
      )
      await check('Busy UI thread has no JavaScript paint/observer backlog', async () => {
        const run = scope.add(animate(value, 1, { duration: 1200, ease: 'linear' }))
        await wait(150)
        const end = Date.now() + 220
        while (Date.now() < end) {
          /* Deliberate contention. */
        }
        await wait(80)
        sample('after-block')
        assert(observerFrames === 0, 'Binding requested JS frames during contention')
        await run.finished
      })
      await check(
        'Long compound playback reuses source phase at window boundaries',
        async () => {
          const run = scope.add(animate(value, 1, { duration: 4800, ease: 'linear' }))
          await wait(4250)
          sample('after-window')
          await run.finished
        },
      )
    }
  } finally {
    stop(value)
    scope.dispose()
    driver.frame = originalFrame
    if (canvas.parent === host) host.removeChild(canvas)
  }
  const output = {
    passed: results.every((r) => r.passed),
    platform: Device.os,
    version: Device.osVersion,
    model: Device.model,
    observerFrames,
    results,
  }
  await knownFolders
    .documents()
    .getFile('jolt-gradient-values.json')
    .writeText(JSON.stringify(output, null, 2))
  report(
    output.passed
      ? `${results.length} gradient checks passed`
      : `FAILED: ${results
          .filter((r) => !r.passed)
          .map((r) => r.name)
          .join(', ')}`,
  )
  return output
}
