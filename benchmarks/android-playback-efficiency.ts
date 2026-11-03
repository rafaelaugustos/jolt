import { Application, isAndroid, type View } from '@nativescript/core'
import { animate, configure, type Animation } from '../dist/index.js'
import { getDriver, setDriver, type Driver } from '../dist/driver/index.js'
import { androidPlayback } from '../dist/driver/android-playback.js'

declare const __PLAYBACK_EFFICIENCY_BUILD__: Record<string, unknown>
declare global {
  namespace org.rafaelaugusto.jolt.fixture {
    class PlaybackEfficiencyProbe {
      verify(view: android.view.View): string
      measure(
        view: android.view.View,
        points: number,
        count: number,
        compact: boolean,
      ): string
      release(): void
      static memory(): string
    }
    class BudgetProbe {
      constructor(view: android.view.View)
      finish(): string
      static environment(view: android.view.View): string
    }
  }
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/** Reference backend only for the two explicitly supplied demo targets. */
export function legacyNumericDriver(views: readonly View[], base = getDriver()): Driver {
  const linear = new android.view.animation.LinearInterpolator()
  return {
    ...base,
    play(view, track, startedAt, onEnd) {
      if (!views.includes(view) || track.property !== 'x')
        return base.play(view, track, startedAt, onEnd)
      const native = view.android as android.view.View
      const unit = native.getResources().getDisplayMetrics().density
      const animator = org.rafaelaugusto.jolt.KeyframeFactory.create(
        native,
        android.view.View.TRANSLATION_X,
        track.times,
        track.values,
        unit,
      )
      animator.setDuration(Math.max(1, track.duration))
      animator.setStartDelay(track.delay)
      animator.setInterpolator(linear)
      if (track.repeat > 0) {
        animator.setRepeatCount(Number.isFinite(track.repeat) ? track.repeat : -1)
        animator.setRepeatMode(
          track.reverse
            ? android.animation.ValueAnimator.REVERSE
            : android.animation.ValueAnimator.RESTART,
        )
      }
      native.setTranslationX(track.values[0]! * unit)
      return androidPlayback(animator, track, onEnd)
    },
  }
}

/** All memory snapshots happen outside timing/frame windows. */
export async function runPlaybackEfficiency(
  view: View,
  save: (report: object) => void,
  signal: { aborted: boolean },
) {
  if (!isAndroid) throw Error('Android only')
  const native = view.android as android.view.View
  const Probe = org.rafaelaugusto.jolt.fixture.PlaybackEfficiencyProbe
  const probe = new Probe()
  const base = getDriver()
  const report = {
    kind: 'android-playback-efficiency',
    build: __PLAYBACK_EFFICIENCY_BUILD__,
    startedAt: new Date().toISOString(),
    environment: JSON.parse(
      org.rafaelaugusto.jolt.fixture.BudgetProbe.environment(native),
    ),
    debuggable: !!(
      Application.android.context.getApplicationInfo().flags &
      android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE
    ),
    phase: 'checking',
    checks: {} as object,
    batches: [] as object[],
    playback: [] as object[],
    retention: [] as object[],
    error: undefined as string | undefined,
  }
  const check = () => {
    if (signal.aborted || !view.isLoaded || !native.hasWindowFocus())
      throw Error('Audit cancelled or lost foreground')
  }
  const collect = async () => {
    ;(globalThis as unknown as { gc?: () => void }).gc?.()
    java.lang.System.gc()
    await wait(120)
    check()
    return JSON.parse(Probe.memory())
  }
  let animations: Animation[] = []
  let frameProbe: org.rafaelaugusto.jolt.fixture.BudgetProbe | undefined
  try {
    check()
    configure({ reducedMotion: 'never', timeScale: 1 })
    report.checks = JSON.parse(probe.verify(native))
    save(report)
    // Warm both implementations before rotating their measurement order.
    for (const compact of [false, true]) {
      probe.measure(native, 241, 100, compact)
      probe.release()
    }
    report.phase = 'batches'
    for (const points of [2, 41, 241, 601]) {
      for (let round = 0; round < 5; round++) {
        for (const compact of round % 2 ? [true, false] : [false, true]) {
          const before = await collect()
          const measurement = JSON.parse(probe.measure(native, points, 300, compact))
          const retained = await collect()
          probe.release()
          const released = await collect()
          report.batches.push({ round, ...measurement, before, retained, released })
          save(report)
        }
      }
    }
    // A native callback recorder observes 30-second playback; no JS frame listener.
    report.phase = 'playback'
    for (let round = 0; round < 3; round++) {
      for (const compact of round % 2 ? [true, false] : [false, true]) {
        check()
        setDriver(compact ? base : legacyNumericDriver([view], base))
        view.translateX = 0
        const before = await collect()
        frameProbe = new org.rafaelaugusto.jolt.fixture.BudgetProbe(native)
        animations = [
          animate(
            view,
            { x: [0, 160, 0] },
            { duration: 1200, ease: 'easeInOut', repeat: Infinity },
          ),
        ]
        await wait(30_000)
        check()
        const frames = JSON.parse(frameProbe.finish())
        frameProbe = undefined
        animations.forEach((animation) => animation.stop())
        animations = []
        const released = await collect()
        report.playback.push({ round, compact, before, released, frames })
        save(report)
      }
    }
    setDriver(base)
    report.phase = 'retention'
    const retainedHandles: Animation[] = []
    for (let round = 0; round < 4; round++) {
      const before = await collect()
      for (let i = 0; i < 250; i++) {
        const animation = animate(
          view,
          { x: [0, 160, 0] },
          { duration: 4000, ease: 'easeInOut' },
        )
        animation.stop()
        retainedHandles.push(animation)
      }
      report.retention.push({
        round,
        handles: retainedHandles.length,
        before,
        after: await collect(),
      })
      save(report)
    }
    retainedHandles.length = 0
    report.retention.push({ handles: 0, after: await collect() })
    report.phase = 'done'
    save(report)
    return report
  } catch (error) {
    report.phase = 'error'
    report.error = String(error)
    save(report)
    throw error
  } finally {
    frameProbe?.finish()
    animations.forEach((animation) => animation.stop())
    probe.release()
    setDriver(base)
    view.translateX = 0
  }
}
