import {
  Color,
  File,
  Utils,
  isIOS,
  knownFolders,
  path,
  type View,
} from '@nativescript/core'
import {
  animate,
  configure,
  motionScope,
  motionValue,
  playbackProgress,
  timeline,
} from '@rafaelaugusto/jolt'
import { registerNativeProperty } from '@rafaelaugusto/jolt/native'
declare class JoltRevealView extends UIView {
  static new(): JoltRevealView
  reveal: number
}
declare global {
  namespace org.rafaelaugusto.jolt.fixture {
    class RevealView extends android.view.View {
      constructor(context: android.content.Context)
      getReveal(): number
      setReveal(value: number): void
    }
  }
}

import { getDriver } from '../dist/driver/index.js'

const reveal = registerNativeProperty<number>({
  name: 'jolt.conformance/reveal',
  units: ['filled fraction 0..1'],
  platforms: ['ios', 'android'],
  encode: (value) => [value],
  decode: (value) => value[0]!,
  create: (target) =>
    isIOS
      ? JoltPropertySink.scalarTargetKeyPath(target as NSObject, 'reveal')
      : org.rafaelaugusto.jolt.PropertySink.scalar(target, 'getReveal', 'setReveal'),
})
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const close = (a: number, b: number, tolerance = 0.06) => {
  if (Math.abs(a - b) > tolerance) throw new Error(`${a} != ${b} (±${tolerance})`)
}
export async function checkPlaybackAdapters(host: View, report: (text: string) => void) {
  const measurements: Record<string, unknown> = {}
  const results: { name: string; passed: boolean; detail?: string }[] = []
  const check = async (name: string, run: () => void | Promise<void>) => {
    report(name)
    try {
      await run()
      results.push({ name, passed: true })
    } catch (error) {
      results.push({ name, passed: false, detail: String(error) })
    }
  }
  let target: any, remove: () => void
  if (isIOS) {
    const native = JoltRevealView.new()
    native.frame = CGRectMake(0, 0, 180, 24)
    native.backgroundColor = new Color('#27384d').ios
    host.ios.addSubview(native)
    target = native
    remove = () => native.removeFromSuperview()
  } else {
    const native = new org.rafaelaugusto.jolt.fixture.RevealView(
        host.android.getContext(),
      ),
      density = Utils.layout.getDisplayDensity()
    native.setBackgroundColor(new Color('#27384d').android)
    native.layout(0, 0, 180 * density, 24 * density)
    host.android.getOverlay().add(native)
    target = native
    remove = () => host.android.getOverlay().remove(native)
  }
  const property = reveal(target),
    driver = getDriver(),
    original = driver.frame
  let frames = 0
  driver.frame = (callback) => {
    frames++
    return original(callback)
  }
  const systemScale = isIOS
    ? 1
    : android.provider.Settings.Global.getFloat(
        Utils.android.getApplicationContext().getContentResolver(),
        'animator_duration_scale',
        1,
      )
  try {
    if (systemScale !== 1) {
      await check(`Animator duration scale ${systemScale}`, async () => {
        property.set(0)
        const native = property.animate(1, { duration: 600, ease: 'linear' })
        const source = playbackProgress(native)
        if (systemScale > 0) {
          await wait(100)
          measurements.scaledPresentationLagMs =
            (source.get() - property.get()) * native.duration
          if (property.get() <= 0)
            throw new Error('Scaled native property did not advance')
          native.pause()
          const held = property.get()
          await wait(120)
          close(property.get(), held, 0.015)
          native.progress = 0.7
          close(property.get(), 0.7, 0.02)
          close(source.get(), 0.7, 0.02)
          native.play()
        }
        if (!(await native.finished)) throw new Error('Scaled animation did not finish')
        close(property.get(), 1, 0.01)
        close(source.get(), 1, 0.01)
        let launched = false
        const scene = timeline([
          {
            at: 100,
            run: () => {
              launched = true
              return property.animate(0.2, { duration: 100, ease: 'linear' })
            },
          },
        ])
        if (!(await scene.finished) || !launched)
          throw new Error('Scaled timeline did not finish')
        close(property.get(), 0.2, 0.01)
      })
    } else {
      await check('Native tween / pause / seek / resume', async () => {
        property.set(0)
        const animation = property.animate(1, { duration: 900, ease: 'linear' })
        await wait(220)
        animation.pause()
        const held = property.get()
        if (held < 0.1 || held > 0.5) throw new Error(`No native movement: ${held}`)
        await wait(200)
        close(property.get(), held, 0.01)
        animation.progress = 0.65
        close(property.get(), 0.65, 0.02)
        animation.progress = 1
        animation.progress = 0.4
        close(property.get(), 0.4, 0.02)
        animation.play()
        await animation.finished
        close(property.get(), 1, 0.01)
      })
      await check('Native value bindings / layers / no observer frames', async () => {
        frames = 0
        const value = motionValue(0),
          release = property.bind(value, (n) => 0.1 + 0.7 * n)
        const base = animate(value, 1, { duration: 1000, ease: 'linear' })
        const layer = animate(value, 0.1, {
          duration: 1000,
          ease: 'linear',
          layer: 'pulse',
        })
        await wait(300)
        const presented = property.get()
        measurements.layerBindingPresentationLag = 0.1 + 0.7 * value.get() - presented
        if (presented <= 0.1 || presented > 1)
          throw new Error(`Native binding did not advance: ${presented}`)
        base.pause()
        layer.pause()
        await wait(180)
        close(property.get(), 0.1 + 0.7 * value.get(), 0.015)
        base.play()
        layer.play()
        await base.finished
        await layer.finished
        release()
        if (frames !== 0) throw new Error(`${frames} JS observation frames`)
      })
      await check('Observable progress follows source and cancellation', async () => {
        property.set(0)
        const animation = property.animate(1, { duration: 1000, ease: 'linear' })
        const progress = playbackProgress(animation)
        let observed = 0
        const off = progress.subscribe((p) => {
          observed = p
        })
        await wait(260)
        animation.pause()
        await wait(80)
        close(observed, animation.progress, 0.01)
        close(property.get(), observed)
        animation.progress = 0.7
        await wait(60)
        close(observed, 0.7, 0.01)
        animation.stop()
        await wait(80)
        close(progress.get(), 0.7, 0.01)
        off()
      })
      await check('Timeline holds pending launches and native participants', async () => {
        let launched = false
        property.set(0)
        const value = motionValue(0)
        const scene = timeline([
          { at: 0, run: () => property.animate(1, { duration: 900, ease: 'linear' }) },
          [value, 1, { duration: 900, ease: 'linear', at: 0 }],
          {
            at: 450,
            run: () => {
              launched = true
              return animate(motionValue(0), 1, { duration: 100 })
            },
          },
        ])
        await wait(180)
        scene.pause()
        const held = property.get()
        await wait(500)
        if (launched) throw new Error('A pending step launched during pause')
        close(property.get(), held, 0.01)
        scene.play()
        await scene.finished
        if (!launched) throw new Error('Pending step did not resume')
        close(property.get(), 1, 0.01)
      })
      await check('Native spring / interruption / isolated owners', async () => {
        property.set(0)
        const first = property.animate(1, 'smooth')
        await wait(180)
        const second = property.animate(0.3, { duration: 300, ease: 'linear' })
        if (await first.finished) throw new Error('Interrupted animation completed')
        await second.finished
        close(property.get(), 0.3, 0.01)
      })
      await check('Slow motion and reduced motion', async () => {
        try {
          configure({ timeScale: 0.5, reducedMotion: 'never' })
          property.set(0)
          const slow = property.animate(1, { duration: 400, ease: 'linear' })
          if (slow.duration !== 800) throw new Error(`Slow duration ${slow.duration}`)
          await wait(200)
          measurements.slowMotionPresentationLagMs =
            (slow.progress - property.get()) * slow.duration
          slow.pause()
          close(property.get(), slow.progress, 0.015)
          slow.stop()
          configure({ timeScale: 1, reducedMotion: 'always' })
          const spatial = registerNativeProperty<number>({
            name: `jolt.conformance/spatial-${Date.now()}`,
            units: ['fraction'],
            platforms: ['ios', 'android'],
            spatial: true,
            encode: (n) => [n],
            decode: (v) => v[0]!,
            create: (target) =>
              isIOS
                ? JoltPropertySink.scalarTargetKeyPath(target as NSObject, 'reveal')
                : org.rafaelaugusto.jolt.PropertySink.scalar(
                    target,
                    'getReveal',
                    'setReveal',
                  ),
          })(target)
          const handle = spatial.animate(1, { duration: 1000 })
          if (handle.duration !== 0)
            throw new Error('Reduced spatial property retained motion')
          await handle.finished
          close(playbackProgress(handle).get(), 1, 0.001)
          spatial.dispose()
        } finally {
          configure({ timeScale: 1, reducedMotion: 'user' })
        }
      })
      await check('Scope disposal preserves unrelated native properties', async () => {
        const sink = isIOS
          ? JoltPropertySink.scalarTargetKeyPath(target, 'alpha')
          : org.rafaelaugusto.jolt.PropertySink.scalar(target, 'getAlpha', 'setAlpha')
        const unrelated = registerNativeProperty<number>({
          name: `jolt.conformance/alpha-${Date.now()}`,
          units: ['opacity'],
          platforms: ['ios', 'android'],
          encode: (n) => [n],
          decode: (v) => v[0]!,
          create: () => sink,
        })(target)
        const scope = motionScope(),
          handle = scope.add(property.animate(0.8, { duration: 800 }))
        const other = unrelated.animate(0.4, { duration: 300 })
        await wait(80)
        scope.dispose()
        if (await handle.finished) throw new Error('Disposed animation completed')
        if (!(await other.finished)) throw new Error('Unrelated property was interrupted')
        close(unrelated.get(), 0.4, 0.01)
        unrelated.dispose()
      })
      await check(
        'Invalidated native target cancels and releases the player',
        async () => {
          const sink = isIOS
            ? JoltPropertySink.scalarTargetKeyPath(target as NSObject, 'reveal')
            : org.rafaelaugusto.jolt.PropertySink.scalar(target, 'getReveal', 'setReveal')
          const detached = registerNativeProperty<number>({
            name: `jolt.conformance/destroy-${Date.now()}`,
            units: ['fraction'],
            platforms: ['ios', 'android'],
            encode: (n) => [n],
            decode: (v) => v[0]!,
            create: () => sink,
          })(target)
          const handle = detached.animate(1, { duration: 500 })
          sink.dispose()
          if (await handle.finished)
            throw new Error('Invalid native sink reported success')
          detached.dispose()
        },
      )
      await check(
        'Native binding samples once; busy-JS behavior is measured',
        async () => {
          const value = motionValue(0)
          let calls = 0
          const off = property.bind(value, (n) => {
            calls++
            return n
          })
          const handle = animate(value, 1, { duration: 600, ease: 'linear' })
          await wait(50)
          const before = calls,
            position = property.get(),
            started = Date.now()
          while (Date.now() - started < 180) {
            Math.sqrt(Date.now())
          }
          const after = property.get()
          if (calls !== before) throw new Error('Mapping ran during native frames')
          measurements.busyJS = {
            blockedMs: Date.now() - started,
            nativeValueBefore: position,
            nativeValueAfter: after,
            setupCalls: calls,
          }
          console.log('JoltNativeBusyJS ' + JSON.stringify(measurements.busyJS))
          await handle.finished
          off()
        },
      )
      await check('Repeated ownership and disposal returns to baseline', async () => {
        for (let i = 0; i < 20; i++) {
          const handle = property.animate(i % 2, { duration: 500 })
          handle.stop()
        }
        property.dispose()
        await wait(50)
        const active = isIOS
          ? JoltPropertyPlayer.activeCount()
          : org.rafaelaugusto.jolt.PropertyPlayer.activeCount()
        if (active !== 0) throw new Error(`${active} native players retained`)
      })
    }
  } finally {
    driver.frame = original
    property.dispose()
    remove()
  }
  const result = {
    platform: isIOS ? 'ios' : 'android',
    systemScale,
    measurements,
    passed: results.every((r) => r.passed),
    results,
  }
  const filename = path.join(knownFolders.documents().path, 'jolt-playback-adapters.json')
  await File.fromPath(filename).writeText(JSON.stringify(result, null, 2))
  console.log('JoltPlaybackAdapters ' + JSON.stringify(result))
  report(
    result.passed
      ? `${results.length} native checks passed`
      : `FAILED: ${results
          .filter((r) => !r.passed)
          .map((r) => r.name + ': ' + r.detail)
          .join('; ')}`,
  )
}
