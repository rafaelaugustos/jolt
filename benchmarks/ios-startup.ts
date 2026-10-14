import {
  Application,
  Button,
  Color,
  Device,
  GridLayout,
  Label,
  Page,
  ScrollView,
  StackLayout,
  knownFolders,
} from '@nativescript/core'
import { animate } from '../dist/index.js'
import { getDriver, setDriver, type Driver } from '../dist/driver/index.js'
import type { Track } from '../dist/track.js'

declare const __BENCHMARK_BUILD__: Record<string, unknown>

const warmups = 5
const repetitions = 30
const pauseMs = 150
const now = () => CACurrentMediaTime() * 1000
const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const thermalNames = ['nominal', 'fair', 'serious', 'critical']
const thermalState = () => thermalNames[NSProcessInfo.processInfo.thermalState]

interface Sample {
  totalMs: number
  driverMs?: number
  outsideDriverMs?: number
}

function summary(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return {
    min: sorted[0],
    median:
      sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2,
    p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
    max: sorted[sorted.length - 1],
  }
}

function assertReady(rows: Label[]) {
  if (UIApplication.sharedApplication.applicationState !== UIApplicationState.Active) {
    throw new Error('Keep the benchmark in the foreground for the entire run.')
  }
  if (NSProcessInfo.processInfo.thermalState !== NSProcessInfoThermalState.Nominal) {
    throw new Error('Let the device cool to a nominal thermal state, then run again.')
  }
  if (NSProcessInfo.processInfo.lowPowerModeEnabled) {
    throw new Error('Disable Low Power Mode before measuring.')
  }
  if (
    rows.some(
      (row) =>
        !row.isLoaded || !row.nativeViewProtected || row.getActualSize().height <= 0,
    )
  ) {
    throw new Error('All rows must be loaded and laid out before measuring.')
  }
}

function reset(rows: Label[]) {
  for (const row of rows) {
    row.opacity = 1
    row.translateY = 0
  }
}

async function measure(rows: Label[], instrumented: boolean, native: Driver) {
  let driverMs = 0
  const driver: Driver = {
    ...native,
    play(...args) {
      const start = now()
      const handle = native.play(...args)
      driverMs += now() - start
      return handle
    },
  }
  setDriver(instrumented ? driver : native)
  const samples: Sample[] = []
  try {
    for (let i = -warmups; i < repetitions; i++) {
      reset(rows)
      await pause(pauseMs)
      assertReady(rows)
      driverMs = 0
      const start = now()
      const animation = animate(rows, 'fadeInUp', { stagger: 30 })
      const totalMs = now() - start
      // Cancellation, native transaction flushing, and the next run's reset are not timed.
      animation.stop()
      if (await animation.finished) throw new Error('Expected the run to be cancelled.')
      if (i >= 0) {
        samples.push(
          instrumented
            ? { totalMs, driverMs, outsideDriverMs: totalMs - driverMs }
            : { totalMs },
        )
      }
    }
    return {
      samples,
      totalMs: summary(samples.map((sample) => sample.totalMs)),
      ...(instrumented
        ? {
            driverMs: summary(samples.map((sample) => sample.driverMs!)),
            outsideDriverMs: summary(samples.map((sample) => sample.outsideDriverMs!)),
          }
        : {}),
    }
  } finally {
    setDriver(native)
  }
}

async function inspectTracks(rows: Label[], native: Driver) {
  const tracks: Track[] = []
  setDriver({
    ...native,
    play(view, track, startedAt, onEnd) {
      tracks.push(track)
      return native.play(view, track, startedAt, onEnd)
    },
  })
  try {
    reset(rows)
    await pause(pauseMs)
    assertReady(rows)
    const animation = animate(rows, 'fadeInUp', { stagger: 30 })
    animation.stop()
    await animation.finished
    if (tracks.length !== rows.length * 2) throw new Error('Unexpected track count.')
    const uniqueValues = new Set(tracks.map((track) => JSON.stringify(track.values)))
    const uniqueTimes = new Set(tracks.map((track) => JSON.stringify(track.times)))
    return {
      tracks: tracks.length,
      nativeArrays: tracks.length * 2,
      values: tracks.reduce((sum, track) => sum + track.values.length, 0),
      keyTimes: tracks.reduce((sum, track) => sum + track.times.length, 0),
      uniqueValueArrays: uniqueValues.size,
      uniqueKeyTimeArrays: uniqueTimes.size,
      layerSubmissions: rows.reduce(
        (sum, row) =>
          sum +
          ((
            row.nativeViewProtected as UIView & {
              outerShadowContainerLayer?: CALayer
            }
          ).outerShadowContainerLayer
            ? 4
            : 2),
        0,
      ),
      properties: [...new Set(tracks.map((track) => track.property))],
      lastDelayMs: Math.max(...tracks.map((track) => track.delay)),
    }
  } finally {
    setDriver(native)
  }
}

function createPage() {
  const page = new Page()
  page.actionBarHidden = true
  page.backgroundColor = new Color('#101827')
  const layout = new GridLayout()
  layout.rows = 'auto, auto, *'
  layout.padding = 16
  const status = new Label()
  status.text = 'Jolt · iOS startup benchmark\n50 and 200 rows · fadeInUp · stagger 30 ms'
  status.color = new Color('#ffffff')
  status.textWrap = true
  layout.addChild(status)
  const button = new Button()
  button.text = 'Run benchmark'
  GridLayout.setRow(button, 1)
  layout.addChild(button)
  const scroll = new ScrollView()
  GridLayout.setRow(scroll, 2)
  layout.addChild(scroll)
  const stack = new StackLayout()
  scroll.content = stack
  page.content = layout

  let running = false
  const run = async () => {
    if (running) return
    running = true
    button.isEnabled = false
    const native = getDriver()
    const previousIdleTimer = UIApplication.sharedApplication.idleTimerDisabled
    UIApplication.sharedApplication.idleTimerDisabled = true
    const report = {
      schema: 1,
      startedAt: new Date().toISOString(),
      build: __BENCHMARK_BUILD__,
      device: {
        model: Device.model,
        os: Device.osVersion,
        osBuild: NSProcessInfo.processInfo.operatingSystemVersionString,
        simulator: !!NSProcessInfo.processInfo.environment.objectForKey(
          'SIMULATOR_MODEL_IDENTIFIER',
        ),
        maximumFramesPerSecond: UIScreen.mainScreen.maximumFramesPerSecond,
        thermalState: thermalState(),
        lowPowerMode: NSProcessInfo.processInfo.lowPowerModeEnabled,
        reduceMotion: UIAccessibilityIsReduceMotionEnabled(),
      },
      settings: { warmups, repetitions, pauseMs, staggerMs: 30 },
      cases: [] as unknown[],
      completed: false,
      error: undefined as string | undefined,
      finishedAt: '',
      finalThermalState: '',
    }
    try {
      // Each case has exactly this many attached, non-virtualized rows, including offscreen rows.
      for (const count of [50, 200]) {
        stack.removeChildren()
        const rows = Array.from({ length: count }, (_, i) => {
          const row = new Label()
          row.text = `Row ${i + 1}`
          row.height = 36
          row.marginBottom = 4
          row.paddingLeft = 12
          row.color = new Color('#ffffff')
          row.backgroundColor = new Color('#243349')
          stack.addChild(row)
          return row
        })
        status.text = `Measuring ${count} rows… Keep this app in the foreground.`
        await pause(1000)
        const plain = await measure(rows, false, native)
        const diagnostic = await measure(rows, true, native)
        const workload = await inspectTracks(rows, native)
        reset(rows)
        await pause(pauseMs)
        // Let one real stagger finish to check completion; it is not a timing sample.
        const animation = animate(rows, 'fadeInUp', { stagger: 30 })
        const timeout = setTimeout(() => animation.stop(), 15000)
        const completed = await animation.finished
        clearTimeout(timeout)
        if (!completed) throw new Error('The full stagger did not finish successfully.')
        assertReady(rows)
        report.cases.push({
          rows: count,
          plain,
          diagnostic,
          workload,
          completionVerified: true,
        })
      }
      report.completed = true
      status.text = 'Done. Results saved to Documents/jolt-startup.json.'
    } catch (error) {
      report.error = String(error)
      status.text = `Benchmark failed: ${report.error}`
    } finally {
      setDriver(native)
      report.finishedAt = new Date().toISOString()
      report.finalThermalState = thermalState()!
      knownFolders
        .documents()
        .getFile('jolt-startup.json')
        .writeTextSync(JSON.stringify(report, null, 2))
      console.log(`JOLT_BENCHMARK ${JSON.stringify(report)}`)
      UIApplication.sharedApplication.idleTimerDisabled = previousIdleTimer
      button.isEnabled = true
      running = false
    }
  }
  button.on('tap', run)
  page.once('loaded', () => {
    if (
      NSProcessInfo.processInfo.environment.objectForKey('JOLT_BENCHMARK_AUTORUN') === '1'
    ) {
      setTimeout(run, 2000)
    }
  })
  return page
}

Application.run({ create: createPage })
