import { Application, knownFolders, type View } from '@nativescript/core'
import { animate, configure, type Animation } from '../dist/index.js'
import { getDriver, setDriver } from '../dist/driver/index.js'
import { createTrack } from '../dist/core/track.js'
import { resolveTransition } from '../dist/core/transition.js'
import { PlaybackReportWriter } from '../demo/src/playback-report-writer'

declare const __PLAYBACK_EFFICIENCY_BUILD__: Record<string, unknown>

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
const action = 'org.nativescript.jolt.RESOURCE_PROFILE'
const modes = [
  'idle',
  'playback',
  'playback-probe',
  'retention',
  'retention-drop',
  'retention-cycles',
  'report',
  'report-worker',
  'compile',
]

/** Opt-in diagnostic. One fresh process per case; reports contain no frame history. */
export function installResourceProfile(view: View, signal: { aborted: boolean }) {
  const native = view.android as android.view.View
  const base = getDriver()
  const folder = knownFolders.externalDocuments()
  let active = false
  let retained: Animation[] = []
  let probe: org.rafaelaugusto.jolt.fixture.BudgetProbe | undefined
  let writer: PlaybackReportWriter | undefined
  const tracks: WeakRef<object>[] = []
  const snapshots: object[] = []
  const memory = () =>
    JSON.parse(org.rafaelaugusto.jolt.fixture.PlaybackEfficiencyProbe.memoryDetails())
  const resources = () => ({
    cpuMs: android.os.Process.getElapsedCpuTime(),
    threadCpuMs: android.os.Debug.threadCpuTimeNanos() / 1e6,
    timeMs: java.lang.System.nanoTime() / 1e6,
    xDip: native.getTranslationX() / native.getResources().getDisplayMetrics().density,
  })
  const save = (phase: string, extra: object = {}) => {
    folder.getFile('jolt-resource-profile.json').writeTextSync(
      JSON.stringify({
        build: __PLAYBACK_EFFICIENCY_BUILD__,
        phase,
        ...extra,
      }),
    )
  }
  const collect = async (label: string) => {
    await wait(0)
    ;(globalThis as unknown as { gc?: () => void }).gc?.()
    java.lang.System.gc()
    await wait(150)
    if (signal.aborted) throw Error('Profile cancelled')
    ;(globalThis as unknown as { gc?: () => void }).gc?.()
    java.lang.System.gc()
    await wait(150)
    const row = {
      label,
      ...memory(),
      handles: retained.length,
      trackedReferences: tracks.length,
      liveTracks: tracks.filter((ref) => ref.deref() !== undefined).length,
    }
    snapshots.push(row)
    save('checkpoint', { snapshots })
    return row
  }
  const run = async (mode: string) => {
    if (active || !modes.includes(mode)) return
    active = true
    snapshots.length = 0
    tracks.length = 0
    configure({ reducedMotion: 'never', timeScale: 1 })
    setDriver({
      ...base,
      play(target, track, at, done) {
        if (mode.startsWith('retention')) tracks.push(new WeakRef(track))
        return base.play(target, track, at, done)
      },
    })
    let result: object = {}
    try {
      await collect('before')
      if (mode === 'report-worker') {
        writer = new PlaybackReportWriter()
        const ready = await writer.ready
        result = { worker: { ...ready, mainThreadId: android.os.Process.myTid() } }
        await collect('worker-ready')
      }
      save('running', { mode, snapshots })
      await wait(250)
      android.os.Trace.beginAsyncSection(`jolt-profile:${mode}`, 1)
      const begin = resources()
      if (mode === 'idle' || mode.startsWith('playback')) {
        if (mode === 'playback-probe')
          probe = new org.rafaelaugusto.jolt.fixture.BudgetProbe(native)
        if (mode !== 'idle')
          retained = [
            animate(
              view,
              { x: [0, 160, 0] },
              { duration: 1200, ease: 'easeInOut', repeat: Infinity },
            ),
          ]
        await wait(12_000)
      } else if (mode.startsWith('retention')) {
        for (let round = 0; round < (mode === 'retention-cycles' ? 20 : 4); round++) {
          for (let i = 0; i < 250; i++) {
            const animation = animate(
              view,
              { x: [0, 160, 0] },
              { duration: 4000, ease: 'easeInOut' },
            )
            animation.stop()
            if (mode === 'retention') retained.push(animation)
          }
          await collect(`batch-${round + 1}`)
        }
      } else if (mode === 'report' || mode === 'report-worker') {
        // The real previous audit report, supplied by the collector, not invented data.
        const input =
          mode === 'report'
            ? JSON.parse(folder.getFile('profile-input.json').readTextSync())
            : undefined
        const times: number[] = []
        const writes: object[] = []
        for (let i = 0; i < 6; i++) {
          const start = performance.now()
          if (writer) writes.push(await writer.replay())
          else {
            const text = JSON.stringify(input, null, 2)
            folder.getFile('profile-output.json').writeTextSync(text)
          }
          times.push(performance.now() - start)
          await wait(100)
        }
        result = { ...result, exports: times, writes }
      } else if (mode === 'compile') {
        const times: number[] = []
        let points = 0
        for (let batch = 0; batch < 4; batch++) {
          const start = performance.now()
          for (let i = 0; i < 250; i++) {
            const transition = resolveTransition(
              {
                type: 'spring',
                duration: 1600,
                bounce: 0.3,
              },
              'x',
              2,
            )
            const track = createTrack('x', [0, 160 + i], transition, 0, {
              timeScale: 1,
              reducedMotion: false,
            })
            points += track.values.length
          }
          times.push(performance.now() - start)
          await wait(100)
        }
        result = { compilationBatchesMs: times, points }
      }
      const end = resources()
      android.os.Trace.endAsyncSection(`jolt-profile:${mode}`, 1)
      // Serialize native samples only after the measured interval, then discard them.
      if (probe) {
        const frames = JSON.parse(probe.finish())
        result = {
          ...result,
          probeWorkMs: frames.probeWorkMs,
          callbacks: frames.frames.length,
        }
        probe = undefined
      }
      retained.forEach((animation) => animation.stop())
      await collect('held')
      writer?.dispose()
      writer = undefined
      retained = []
      tracks.length = 0
      await collect('released')
      await wait(2000)
      await collect('quiet')
      save('done', {
        mode,
        begin,
        end,
        result,
        snapshots,
        profiler:
          'External Perfetto scheduling; memory snapshots outside playback interval.',
      })
    } catch (error) {
      save('error', { mode, error: String(error), snapshots })
    } finally {
      retained.forEach((animation) => animation.stop())
      retained = []
      probe?.cancel()
      probe = undefined
      writer?.dispose()
      writer = undefined
      setDriver(base)
      active = false
    }
  }
  Application.android.registerBroadcastReceiver(action, (_context, intent) => {
    void run(intent.getStringExtra('mode') ?? '')
  })
  save('ready', {
    modes,
    debuggable: !!(Application.android.context.getApplicationInfo().flags & 2),
    environment: JSON.parse(
      org.rafaelaugusto.jolt.fixture.BudgetProbe.environment(native),
    ),
  })
  return () => {
    Application.android.unregisterBroadcastReceiver(action)
    retained.forEach((animation) => animation.stop())
    probe?.cancel()
    writer?.dispose()
    setDriver(base)
  }
}
