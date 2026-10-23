/** Real native Android rendering, lifecycle and pacing checks. Timers only take discrete measurements. */
import {
  Application,
  Color,
  Device,
  GridLayout,
  ScrollView,
  StackLayout,
  Utils,
  isAndroid,
  knownFolders,
  type LayoutBase,
} from '@nativescript/core'
import {
  confetti,
  configure,
  motionScope,
  particles,
  type ParticleOptions,
} from '@rafaelaugusto/jolt'
import { currentAndroidParticles } from '../dist/driver/android-particles.js'
import { getDriver } from '../dist/driver/index.js'

declare global {
  namespace org.rafaelaugusto.jolt.fixture {
    class ParticleProbe {
      static pixels(
        drawable: unknown,
        width: number,
        height: number,
      ): { readonly length: number; readonly [index: number]: number }
    }
  }
}
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const assert = (value: unknown, message: string) => {
  if (!value) throw new Error(message)
}
type Native = org.rafaelaugusto.jolt.ParticleEmitter
function stats(native: Native) {
  const intervals = native.getFrameIntervals()
  const ms = Array.from({ length: intervals.length }, (_, i) => intervals[i]! / 1e6).sort(
    (a, b) => a - b,
  )
  const percentile = (p: number) =>
    ms.length ? ms[Math.min(ms.length - 1, Math.floor(ms.length * p))]! : 0
  return {
    live: native.getLiveCount(),
    peak: native.getPeakCount(),
    capacity: native.getCapacity(),
    emitted: native.getEmittedCount(),
    skipped: native.getSkippedCount(),
    time: native.getTimeSeconds(),
    frames: native.getFrameCount(),
    draws: native.getDrawCount(),
    updateMeanMs: native.getWorkNanos() / 1e6 / Math.max(1, native.getFrameCount()),
    drawMeanMs: native.getDrawNanos() / 1e6 / Math.max(1, native.getDrawCount()),
    frameMs: {
      p50: percentile(0.5),
      p95: percentile(0.95),
      max: ms.at(-1) ?? 0,
      count: ms.length,
    },
    stopped: native.isStopped(),
    observing: native.isObserving(),
  }
}

export async function checkParticles(
  host: LayoutBase,
  report: (text: string) => void,
  mode = 'all',
) {
  if (!isAndroid) return
  const Native = org.rafaelaugusto.jolt.ParticleEmitter
  const baseline = Native.getActiveCount()
  const driver = getDriver(),
    frame = driver.frame
  let observerFrames = 0
  driver.frame = (callback) => {
    observerFrames++
    return frame.call(driver, callback)
  }
  const results: {
    name: string
    passed: boolean
    detail?: string
    samples: unknown[]
  }[] = []
  let samples: unknown[] = []
  const scroll = new ScrollView(),
    content = new StackLayout(),
    target = new GridLayout()
  scroll.height = 170
  content.height = 420
  target.width = 180
  target.height = 90
  target.marginTop = 40
  target.backgroundColor = new Color('#20283c')
  content.addChild(target)
  scroll.content = content
  host.addChild(scroll)
  const scope = motionScope()
  const context = Utils.android.getApplicationContext()
  const density = Utils.layout.getDisplayDensity()
  const scale = android.provider.Settings.Global.getFloat(
    context.getContentResolver(),
    'animator_duration_scale',
    1,
  )
  await wait(250)
  const active = (overlay = false) => {
    const result = currentAndroidParticles(target, overlay)
    assert(result, 'Native emitter not attached')
    return result!
  }
  const start = async (options: ParticleOptions = {}) => {
    const off = scope.use(() => particles(target, options))
    await wait(60)
    return { native: active(), off }
  }
  const burst = async (count = 80) => {
    const off = scope.use(() => confetti(target, { count }))
    await wait(60)
    return { native: active(true), off }
  }
  const check = async (name: string, run: () => Promise<void>) => {
    report(name)
    samples = []
    scope.reset()
    target.translateX = 0
    target.rotate = 0
    target.width = 180
    target.height = 90
    target.visibility = 'visible'
    scroll.scrollToVerticalOffset(0, false)
    if (!target.parent) content.addChild(target)
    await wait(80)
    try {
      await run()
      results.push({ name, passed: true, samples })
    } catch (error) {
      results.push({ name, passed: false, detail: String(error), samples })
    } finally {
      scope.reset()
      assert(
        Native.getActiveCount() === baseline,
        'Native emitter resources did not return to baseline',
      )
    }
  }
  try {
    if (mode === 'background') {
      await check('Real background cancels without replay or backlog', async () => {
        const { native } = await start({ rate: 60 })
        let suspended = false,
          resumed = false
        const suspend = () => {
          suspended = native.isStopped()
          samples.push({ event: 'suspend', ...stats(native) })
        }
        const resume = () => {
          resumed = true
        }
        Application.on(Application.suspendEvent, suspend)
        Application.on(Application.resumeEvent, resume)
        try {
          report('Background ready')
          const deadline = Date.now() + 15000
          while (!resumed && Date.now() < deadline) await wait(100)
          await wait(150)
          assert(suspended && resumed, 'Missing real app lifecycle')
          assert(
            !currentAndroidParticles(target) && native.getCapacity() === 0,
            'Background replay/resources',
          )
        } finally {
          Application.off(Application.suspendEvent, suspend)
          Application.off(Application.resumeEvent, resume)
        }
      })
    } else if (mode === 'setting-change') {
      await check(
        'Animator scale zero cancels natively while Jolt motion is forced on',
        async () => {
          configure({ reducedMotion: 'never' })
          const { native } = await start({ rate: 60 })
          report('Scale change ready')
          const deadline = Date.now() + 15000
          while (!native.isStopped() && Date.now() < deadline) await wait(100)
          samples.push(stats(native))
          assert(
            native.isStopped() && native.getCapacity() === 0 && !native.isObserving(),
            'Native scale observer did not cancel',
          )
          await wait(200)
          assert(!currentAndroidParticles(target), 'Disabled emitter restarted')
        },
      )
    } else if (mode === 'scale') {
      await check(
        `Animator scale ${scale}: coherent wall-time emission and lifetime`,
        async () => {
          configure({ reducedMotion: 'never' })
          if (scale === 0) {
            scope.use(() => particles(target))
            scope.use(() => confetti(target))
            await wait(150)
            assert(
              !currentAndroidParticles(target) && !currentAndroidParticles(target, true),
              'Scale zero started an effect',
            )
            samples.push({ active: Native.getActiveCount(), forcedMotion: true })
          } else {
            const began = Date.now()
            const { native } = await start({ rate: 100, duration: 400, lifetime: 300 })
            while (!native.isStopped() && Date.now() - began < 2000) await wait(20)
            const elapsed = Date.now() - began
            samples.push({ elapsed, ...stats(native) })
            assert(
              native.isStopped() && elapsed >= 650 && elapsed < 1100,
              `Wall-time deadline changed: ${elapsed}`,
            )
            assert(
              native.getEmittedCount() >= 35 && native.getEmittedCount() <= 40,
              'Scaled emission count drift',
            )
          }
        },
      )
    } else {
      await check(
        'Circle/ring/rectangle, native colors and density-scaled raster size',
        async () => {
          for (const shape of ['circle', 'ring', 'rectangle'] as const) {
            const { native, off } = await start({
              shape,
              colors: ['#ff0000'],
              rate: 10,
              duration: 100,
              lifetime: 1200,
              size: 16,
              velocity: 0,
              spread: 0,
              fadeOut: false,
            })
            await wait(120)
            assert(native.getLiveCount() === 1, 'Expected one stationary particle')
            const view = target.android as android.view.View
            const pixels = org.rafaelaugusto.jolt.fixture.ParticleProbe.pixels(
              native,
              view.getWidth(),
              view.getHeight(),
            )
            const width = pixels[3]! - pixels[1]! + 1,
              height = pixels[4]! - pixels[2]! + 1
            samples.push({
              shape,
              density,
              width,
              height,
              center: pixels[5]! >>> 0,
              ...stats(native),
            })
            assert(pixels[0]! > 0, 'Native shape drew no pixels')
            if (shape !== 'rectangle')
              assert(
                Math.abs(width - 16 * density) < 3 && Math.abs(height - 16 * density) < 3,
                'DIP size was not scaled once',
              )
            assert(
              shape === 'ring' ? pixels[5] === 0 : pixels[5]! >>> 0 === 0xffff0000,
              'Shape hole/color mismatch',
            )
            off()
          }
        },
      )
      await check(
        'Native rate/lifetime, finite emission and automatic buffer disposal',
        async () => {
          const { native } = await start({ rate: 100, lifetime: 500, duration: 300 })
          await wait(350)
          samples.push(stats(native))
          assert(
            native.getEmittedCount() === 30 && native.getLiveCount() > 0,
            'Finite count/deadline mismatch',
          )
          await wait(500)
          samples.push(stats(native))
          assert(
            native.isStopped() && native.getCapacity() === 0 && !native.isObserving(),
            'Finite native resources retained',
          )
          assert(
            !currentAndroidParticles(target),
            'JS lifecycle survived native completion',
          )
        },
      )
      await check('Center/top/bottom sources, resize and physical units', async () => {
        for (const source of ['center', 'top', 'bottom'] as const) {
          const { native, off } = await start({
            source,
            rate: 10,
            lifetime: 1600,
            velocity: 60,
            angle: 90,
            spread: 0,
            gravity: 20,
            spin: 180,
            fadeOut: false,
          })
          await wait(150)
          const particle = native.getParticle(0),
            age = native.getTimeSeconds() - 0.1
          const initialY = source === 'top' ? 0 : source === 'bottom' ? 90 : 45
          assert(
            Math.abs(particle[1]! - (initialY + 60 * age + 10 * age * age)) < 0.1,
            'Velocity/gravity units or direction',
          )
          target.width = 220
          target.height = 120
          await wait(130)
          assert(
            native.getBounds().width() === Math.round(220 * density),
            'Overlay did not resize',
          )
          samples.push({
            source,
            particle: Array.from({ length: 3 }, (_, i) => particle[i]),
            ...stats(native),
          })
          off()
          target.width = 180
          target.height = 90
          await wait(40)
        }
      })
      await check(
        'Confetti window origin after scroll/transforms; previous burst stays fixed',
        async () => {
          const { native, off } = await burst()
          const origin = native.getOriginInWindow()
          const point = Array.create('int', 2)
          const view = target.android as android.view.View
          view.getLocationInWindow(point)
          assert(
            Math.abs(origin[0]! - point[0]! - view.getWidth() / 2) < 2 &&
              Math.abs(origin[1]! - point[1]! - view.getHeight() / 2) < 2,
            'Initial window center',
          )
          scroll.scrollToVerticalOffset(30, false)
          target.translateX = 14
          target.rotate = 25
          await wait(100)
          const held = native.getOriginInWindow()
          assert(
            held[0] === origin[0] && held[1] === origin[1],
            'Flying burst followed the target',
          )
          off()
          const next = await burst()
          const moved = next.native.getOriginInWindow()
          samples.push({
            before: [origin[0], origin[1]],
            after: [moved[0], moved[1]],
            density,
          })
          assert(
            Math.abs(moved[0]! - origin[0]! - 14 * density) < 3 &&
              Math.abs(moved[1]! - origin[1]! + 30 * density) < 3,
            'Scrolled/transformed center mismatch',
          )
        },
      )
      await check('Independent emitter/burst ownership and stale cleanup', async () => {
        const old = await start(),
          pop = await burst(),
          replacement = await start({ shape: 'ring' })
        old.off()
        old.off()
        assert(
          old.native.isStopped() &&
            !replacement.native.isStopped() &&
            !pop.native.isStopped(),
          'Stale/independent ownership broken',
        )
        replacement.off()
        assert(!pop.native.isStopped(), 'Emitter cleanup stopped confetti')
      })
      await check(
        'Unload/reload, zero size and detached native views cancel without replay',
        async () => {
          const detached = await start()
          content.removeChild(target)
          await wait(50)
          assert(
            detached.native.isStopped() && detached.native.getCapacity() === 0,
            'Detached view retained resources',
          )
          content.addChild(target)
          await wait(100)
          assert(!currentAndroidParticles(target), 'Reload replayed emitter')
          const zero = await start()
          target.height = 0
          await wait(100)
          assert(zero.native.isStopped(), 'Zero size did not cancel')
          target.height = 90
        },
      )
      await check(
        'Calls before load/size wait; scope disposal cancels pending/native work',
        async () => {
          content.removeChild(target)
          scope.use(() => particles(target))
          await wait(50)
          assert(!currentAndroidParticles(target), 'Unloaded target started emission')
          content.addChild(target)
          await wait(100)
          const native = active()
          assert(!native.isStopped(), 'Loaded target did not start')
          scope.reset()
          assert(native.isStopped(), 'Scope did not cancel native work')
          for (let i = 0; i < 20; i++) {
            const emitter = await start({ rate: 100, lifetime: 1000 })
            emitter.off()
            emitter.off()
            assert(
              emitter.native.getCapacity() === 0 && !emitter.native.isObserving(),
              'Repeated cleanup leaked buffers/observer',
            )
          }
        },
      )
      await check(
        'Reduced motion changes cancel active effects and skip new ones',
        async () => {
          const a = await start(),
            b = await burst()
          configure({ reducedMotion: 'always' })
          assert(
            a.native.isStopped() && b.native.isStopped(),
            'Live motion preference ignored',
          )
          scope.use(() => particles(target))
          scope.use(() => confetti(target))
          await wait(60)
          assert(
            !currentAndroidParticles(target) && !currentAndroidParticles(target, true),
            'Reduced effects started',
          )
          configure({ reducedMotion: 'user' })
          await wait(60)
          assert(
            !currentAndroidParticles(target),
            'Motion restoration replayed particles',
          )
        },
      )
      await check(
        'Busy JavaScript stalls native UI drawing but never emits an expired backlog',
        async () => {
          const { native } = await start({ rate: 100, lifetime: 300, duration: 300 })
          await wait(80)
          const before = native.getFrameCount(),
            end = Date.now() + 750
          while (Date.now() < end) {
            /* Deliberately block the shared UI thread. */
          }
          const afterBlock = native.getFrameCount()
          await wait(100)
          samples.push({ before, afterBlock, ...stats(native) })
          assert(afterBlock === before, 'Fixture did not block the native UI clock')
          assert(
            native.isStopped() &&
              native.getCapacity() === 0 &&
              native.getEmittedCount() < 30,
            'Expired backlog emitted on return',
          )
        },
      )
      await check('Ordinary native frame pacing and peak population', async () => {
        const { native } = await start({
          source: 'top',
          angle: 90,
          rate: 30,
          lifetime: 5000,
          size: 5,
          velocity: 45,
          velocityRange: 15,
        })
        await wait(4000)
        samples.push(stats(native))
        assert(
          native.getPeakCount() <= 150 && native.getDrawCount() > 20,
          'Ordinary native draw/count failed',
        )
      })
      await check(
        'Stress 10000 live particles remains bounded and releases native resources',
        async () => {
          const { native, off } = await start({
            source: 'top',
            angle: 90,
            spread: 30,
            rate: 10000,
            lifetime: 1000,
            size: 3,
            velocity: 100,
          })
          await wait(3500)
          samples.push(stats(native))
          assert(
            native.getPeakCount() <= 10000 &&
              native.getPeakCount() >= 9000 &&
              native.getCapacity() === 10000,
            'Stress allocation/population bound',
          )
          off()
          assert(native.getCapacity() === 0, 'Stress buffers retained')
        },
      )
    }
  } finally {
    configure({ reducedMotion: 'user' })
    scope.dispose()
    driver.frame = frame
    if (scroll.parent === host) host.removeChild(scroll)
  }
  assert(observerFrames === 0, `Particle playback requested ${observerFrames} JS frames`)
  const result = {
    passed: results.every((r) => r.passed),
    platform: Device.os,
    version: Device.osVersion,
    model: Device.model,
    sdk: android.os.Build.VERSION.SDK_INT,
    density,
    animatorScale: scale,
    observerFrames,
    activeAfter: Native.getActiveCount(),
    results,
  }
  await knownFolders
    .documents()
    .getFile('jolt-particles.json')
    .writeText(JSON.stringify(result, null, 2))
  report(
    result.passed
      ? `${results.length} particle checks passed`
      : `FAILED: ${results
          .filter((r) => !r.passed)
          .map((r) => r.name)
          .join(', ')}`,
  )
  return result
}
