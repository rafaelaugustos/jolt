import { Device, Screen, isIOS, type View } from '@nativescript/core'
import { getDriver } from '../dist/driver/index.js'
import { createTrack, type Track } from '../dist/track.js'
import { resolveTransition } from '../dist/transition.js'
import { nativeTracePosition } from '@rafaelaugusto/jolt/testing/native'

export function samplingTrack(fast: boolean) {
  return createTrack(
    'x',
    [0, 240],
    resolveTransition(
      fast
        ? { type: 'spring', duration: 200, bounce: 0.4 }
        : { duration: 4000, ease: 'easeInOut' },
      'x',
      2,
    ),
    0,
  )
}
export function uniformSamplingTrack(track: Track): Track {
  const steps = Math.max(1, Math.min(6000, Math.ceil((track.duration * 60) / 1000)))
  const times = Array.from({ length: steps + 1 }, (_, i) => i / steps)
  return { ...track, times, values: times.map((p) => track.valueAt(p * track.duration)) }
}
export async function runCurveSamplingChecks(
  view: View,
  signal?: { readonly aborted: boolean },
) {
  const driver = getDriver(),
    start = driver.now()
  if (!driver.control) throw new Error('A seekable native driver is required.')
  const present = () =>
    new Promise<void>((resolve, reject) => {
      let cancel = () => {}
      const timer = setTimeout(() => {
        cancel()
        reject(new Error('Sampling presentation timed out.'))
      }, 1500)
      cancel = driver.frame(() => {
        cancel = driver.frame(() => {
          clearTimeout(timer)
          resolve()
        })
      })
    })
  const observations: {
    hz: number
    at: number
    requestedAt: number
    expected: number
    actual: number
    error: number
  }[] = []
  const assertPosition = (actual: number, expected: number) => {
    if (!Number.isFinite(actual) || Math.abs(actual - expected) > 0.28)
      throw new Error(`Native sampling error: ${actual} versus ${expected}`)
  }
  let active: unknown
  const stop = () => {
    if (active) {
      driver.stop(view, active)
      active = undefined
    }
  }
  const preparation = []
  const measuredNow = () =>
    isIOS ? CACurrentMediaTime() * 1000 : java.lang.System.nanoTime() / 1e6
  try {
    for (const fast of [true, false]) {
      const track = samplingTrack(fast),
        uniform = uniformSamplingTrack(track)
      const measure = (t: Track) => {
        const times = []
        for (let i = 0; i < 7; i++) {
          const start = measuredNow()
          const handle = driver.play(view, t, start, () => {})
          times.push(measuredNow() - start)
          driver.stop(view, handle)
        }
        return times.sort((a, b) => a - b)[3]!
      }
      preparation.push({
        name: fast ? 'fast spring' : 'slow ease',
        adaptiveKeyframes: track.values.length,
        uniformKeyframes: uniform.values.length,
        adaptiveNativeSetupMs: measure(track),
        uniformNativeSetupMs: measure(uniform),
      })
    }
    const track = samplingTrack(true)
    active = driver.play(view, track, driver.now(), () => {})
    const steps = Math.floor((track.duration * 120) / 1000)
    for (let i = 0; i <= steps; i++) {
      if (signal?.aborted) throw new Error('Sampling check cancelled.')
      const requestedAt = (i * 1000) / 120
      const at = isIOS ? requestedAt : Math.trunc(requestedAt)
      driver.control(view, active, at, true, 'seek')
      await present()
      const actual = nativeTracePosition(view, 'x'),
        expected = track.valueAt(at)
      assertPosition(actual, expected)
      observations.push({
        hz: 120,
        at,
        requestedAt,
        expected,
        actual,
        error: Math.abs(actual - expected),
      })
      if (i % 2 === 0)
        observations.push({
          hz: 60,
          at,
          requestedAt,
          expected,
          actual,
          error: Math.abs(actual - expected),
        })
    }
    // Resume with the visible value and the source curve's interruption velocity.
    const at = isIOS ? (1000 / 120) * 7 : Math.trunc((1000 / 120) * 7)
    driver.control(view, active, at, true, 'seek')
    await present()
    const visible = nativeTracePosition(view, 'x'),
      incoming = track.velocityAt(at)
    const replacement = createTrack(
      'x',
      [visible, 0],
      resolveTransition({ type: 'spring', duration: 400, bounce: 0.3 }, 'x', 2),
      incoming,
    )
    if (Math.abs(replacement.velocityAt(0) - incoming) > 2)
      throw new Error('Interruption velocity changed.')
    stop()
    active = driver.play(view, replacement, driver.now(), () => {})
    driver.control(view, active, 0, true, 'seek')
    await present()
    assertPosition(nativeTracePosition(view, 'x'), visible)
    driver.control(view, active, replacement.duration, true, 'seek')
    await present()
    assertPosition(nativeTracePosition(view, 'x'), 0)
    let negativeControl = false
    try {
      assertPosition(nativeTracePosition(view, 'x'), 8)
    } catch {
      negativeControl = true
    }
    if (!negativeControl) throw new Error('Sampling negative control did not fail.')
    return {
      status: 'passed',
      platform: isIOS ? 'ios' : 'android',
      os: Device.osVersion,
      density: Screen.mainScreen.scale,
      cadence:
        'held presentation at 60/120 Hz logical timestamps (Android seek truncates to integer ms); not measured display refresh',
      maxErrorDIP: Math.max(...observations.map((o) => o.error)),
      maxErrorPhysicalPixels:
        Math.max(...observations.map((o) => o.error)) * Screen.mainScreen.scale,
      observations,
      preparation,
      interruption: { incoming, received: replacement.velocityAt(0) },
      negativeControl,
      durationMs: driver.now() - start,
    }
  } finally {
    stop()
  }
}
