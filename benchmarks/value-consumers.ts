/** Opt-in native checks used by the normal demo's --value-observer-checks launch flag. */
import {
  Application,
  Device,
  Utils,
  isIOS,
  knownFolders,
  type View,
} from '@nativescript/core'
import { animate, bind, motionValue, stop } from '@rafaelaugusto/jolt'
// Same built driver module as the demo alias; instrumentation is never part of the public API.
import { getDriver } from '../dist/driver/index.js'

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const now = () =>
  isIOS ? CACurrentMediaTime() * 1000 : java.lang.System.nanoTime() / 1e6
const check = (condition: boolean, message: string) => {
  if (!condition) throw new Error(message)
}
const x = (view: View) =>
  isIOS
    ? Number(
        (
          (view.ios as UIView).layer.presentationLayer() ?? (view.ios as UIView).layer
        ).valueForKeyPath('transform.translation.x'),
      )
    : Utils.layout.toDeviceIndependentPixels(view.android.getTranslationX())

export async function checkValueConsumers(view: View, status: (text: string) => void) {
  const driver = getDriver()
  const original = driver.frame
  const cleanup: (() => void)[] = []
  const costs: number[] = []
  let frames = 0
  let callbacks = 0
  const results: Record<string, unknown> = {
    platform: Device.os,
    version: Device.osVersion,
  }
  const save = () =>
    knownFolders
      .documents()
      .getFile('jolt-value-consumers.json')
      .writeText(JSON.stringify(results, null, 2))
  driver.frame = (callback) =>
    original(() => {
      const started = now()
      try {
        callback()
      } finally {
        frames++
        costs.push(now() - started)
      }
    })
  try {
    const value = motionValue(0)
    cleanup.push(() => stop(value), bind(view, { x: value }))
    animate(value, 100, {
      duration: 800,
      ease: 'linear',
      repeat: Infinity,
      repeatType: 'reverse',
    })
    await wait(500)
    check(frames === 0, 'Native-only binding scheduled JS observation frames')
    results.nativeOnly = { observerFrames: frames }
    const measurements: unknown[] = []
    for (const count of [1, 8, 32]) {
      const sources = Array.from({ length: count }, () => motionValue(0))
      const releases = sources.map((source) => {
        animate(source, 1, {
          duration: 700,
          ease: 'linear',
          repeat: Infinity,
          repeatType: 'reverse',
        })
        const release = source.to([0, 1], [0, 100]).subscribe(
          () => {
            callbacks++
          },
          { immediate: false },
        )
        const dispose = () => {
          release()
          stop(source)
        }
        cleanup.push(dispose)
        return dispose
      })
      frames = callbacks = 0
      costs.length = 0
      await wait(500)
      const sorted = [...costs].sort((a, b) => a - b)
      check(callbacks > count, 'Observers did not deliver multiple frames')
      measurements.push({
        sources: count,
        frames,
        callbacks,
        meanBatchMs: costs.reduce((a, b) => a + b, 0) / costs.length,
        p95BatchMs: sorted[Math.floor(sorted.length * 0.95)],
      })
      releases.forEach((release) => release())
      const ended = frames
      await wait(80)
      check(frames === ended, 'Frame source kept running after unsubscribe')
    }
    results.observers = measurements
    stop(value)
    animate(value, 50, { duration: 700, ease: 'linear' })
    animate(value, [0, 10], {
      duration: 400,
      ease: 'linear',
      repeat: Infinity,
      repeatType: 'reverse',
      layer: 'pulse',
    })
    const samples: unknown[] = []
    const sample = (phase: string) => {
      const expected = value.get(),
        actual = x(view)
      samples.push({ phase, expected, actual })
      check(
        Math.abs(expected - actual) < 4,
        `Native composition mismatch: ${JSON.stringify(samples.at(-1))}`,
      )
    }
    await wait(250)
    sample('finite-base')
    await wait(600)
    sample('base-completed')
    stop(value)
    animate(value, [0, 15], {
      duration: 701,
      ease: 'linear',
      repeat: Infinity,
      repeatType: 'reverse',
    })
    animate(value, [0, 10], {
      duration: 709,
      ease: 'linear',
      repeat: Infinity,
      repeatType: 'reverse',
      layer: 'pulse',
    })
    await wait(3800)
    sample('before-window')
    await wait(500)
    sample('after-window')
    results.composition = samples
    callbacks = 0
    const unsubscribe = value.subscribe(() => {
      callbacks++
    })
    cleanup.push(unsubscribe)
    await wait(100)
    results.status = 'Background check ready'
    await save()
    status(String(results.status))
    let suspendedAt = -1
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('No real background/resume within 45s')),
        45000,
      )
      const suspended = () => {
        suspendedAt = callbacks
      }
      const resumed = () => {
        results.background = {
          callbacksAtSuspend: suspendedAt,
          callbacksAtResume: callbacks,
        }
        clearTimeout(timer)
        suspendedAt >= 0 && callbacks === suspendedAt
          ? resolve()
          : reject(new Error('Callbacks ran in background or suspend was missing'))
      }
      Application.on(Application.suspendEvent, suspended)
      Application.on(Application.resumeEvent, resumed)
      cleanup.push(() => {
        clearTimeout(timer)
        Application.off(Application.suspendEvent, suspended)
        Application.off(Application.resumeEvent, resumed)
      })
    })
    await wait(150)
    check(callbacks > suspendedAt, 'Delivery did not resume')
    unsubscribe()
    stop(value)
    const ended = frames
    await wait(100)
    check(frames === ended, 'Frame source survived cleanup')
    results.status = 'Passed value consumer checks'
  } catch (error) {
    results.status = `Failed: ${String(error)}`
  } finally {
    cleanup.reverse().forEach((release) => release())
    driver.frame = original
    await save()
    status(String(results.status))
  }
}
