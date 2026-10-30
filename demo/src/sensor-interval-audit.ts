import {
  Application,
  Device,
  File,
  isIOS,
  knownFolders,
  type View,
} from '@nativescript/core'
import { bind } from '@rafaelaugusto/jolt'
import { sensor, type Sensor, type SensorKind } from '@rafaelaugusto/jolt/sensors'

declare const JoltSensorSource: { activeCount(): number; sourceCount(): number }
declare const JoltLiveSpring: { nodeCount(): number; activeCount(): number }

type Interval = number | 'auto'
type Source = { source: Sensor; requested: Interval; bindings: Map<string, () => void> }

/** Opt-in diagnostics: native bindings drive the views; JS reads only window boundaries. */
export function sensorIntervalAudit(
  views: { card: View; shine: View; glow: View },
  show: (state: string, detail: string) => void,
) {
  const session = Date.now()
  const sources = new Map<string, Source>()
  const events: any[] = []
  let started = false,
    running = false,
    disposed = false
  let status = 'ready',
    failure: string | null = null
  let cancelWait: (() => void) | undefined
  const native = () => ({
    active: JoltSensorSource.activeCount(),
    sources: JoltSensorSource.sourceCount(),
    nodes: JoltLiveSpring.nodeCount(),
    clock: JoltLiveSpring.activeCount(),
  })
  const write = () =>
    File.fromPath(knownFolders.documents().path + '/sensor-intervals.json').writeTextSync(
      JSON.stringify(
        {
          schemaVersion: 1,
          platform: 'ios',
          session,
          status,
          failure,
          device: {
            model: Device.model,
            os: Device.osVersion,
            displayMaximumFPS: UIScreen.mainScreen.maximumFramesPerSecond,
            simulator:
              !!NSProcessInfo.processInfo.environment.objectForKey('SIMULATOR_UDID'),
          },
          events,
        },
        null,
        2,
      ),
    )
  function snapshot(name: string, phase: string) {
    const event = {
      name,
      phase,
      sequence: events.length,
      time: Date.now(),
      monotonicMs: CACurrentMediaTime() * 1000,
      native: native(),
      sources: Object.fromEntries(
        [...sources].map(([id, item]) => [
          id,
          {
            kind: item.source.kind,
            requested: item.requested,
            bindings: [...item.bindings.keys()],
            ...item.source.snapshot(),
          },
        ]),
      ),
    }
    events.push(event)
    write()
    return event
  }
  function wait(ms: number) {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        cancelWait = undefined
        resolve()
      }, ms)
      cancelWait = () => {
        clearTimeout(timer)
        cancelWait = undefined
        reject(new Error('Audit interrupted'))
      }
    })
  }
  function create(id: string, kind: SensorKind, interval: Interval) {
    const source = sensor(kind, { interval })
    sources.set(id, { source, requested: interval, bindings: new Map() })
    if (!source.available || source.status === 'error')
      throw new Error('Real motion hardware is unavailable')
    return source
  }
  function attach(id: string, target: 'card' | 'shine' | 'glow') {
    const item = sources.get(id)!
    if (item.bindings.has(target)) throw new Error('Binding already exists')
    const value = item.source.x
    item.bindings.set(
      target,
      bind(
        views[target],
        target === 'card'
          ? { rotateX: value.to([-0.6, 0.6], [-17, 17]) }
          : {
              x: value.to(
                item.source.kind === 'gravity' ? [-6, 6] : [-0.6, 0.6],
                [-45, 45],
              ),
            },
      ),
    )
  }
  function detach(id: string, target: string) {
    const item = sources.get(id)!
    item.bindings.get(target)?.()
    item.bindings.delete(target)
  }
  function release(id: string) {
    const item = sources.get(id)!
    for (const target of [...item.bindings.keys()]) detach(id, target)
    item.source.dispose()
    item.source.dispose() // Disposal must remain idempotent.
  }
  function cleanup() {
    for (const id of sources.keys()) release(id)
  }
  async function window(phase: string, milliseconds = 4000) {
    show(phase, 'Settling · real Core Motion input')
    await wait(1500)
    const before = snapshot('window-start', phase)
    show(phase, 'Measuring · no JavaScript polling')
    await wait(milliseconds)
    const after = snapshot('window-end', phase)
    const seconds = (after.monotonicMs - before.monotonicMs) / 1000
    const rates = Object.entries(after.sources)
      .map(([id, item]) => {
        const old = before.sources[id]
        if (!old) throw new Error('Source changed during measurement')
        return `${id}: ${((item.samples - old.samples) / seconds).toFixed(1)} samples/s · ${((item.frames - old.frames) / seconds).toFixed(1)} commits/s`
      })
      .join('\n')
    show(phase, `${rates}\nCore Motion subscriptions: ${after.native.active}`)
    await wait(1200)
  }
  function interrupted() {
    if (running) cancelWait?.()
    cleanup()
  }
  async function run() {
    if (started || disposed) return
    started = true
    if (!isIOS) {
      show('Failed', 'This audit requires a physical iPhone')
      return
    }
    running = true
    status = 'running'
    Application.on(Application.suspendEvent, interrupted)
    try {
      if (NSProcessInfo.processInfo.environment.objectForKey('SIMULATOR_UDID'))
        throw new Error('This audit requires real Core Motion input on a physical iPhone')
      snapshot('baseline', 'start')
      for (const interval of ['auto', 16, 33, 100] as const) {
        sources.clear()
        create('rotation', 'rotation', interval)
        create('gravity', 'gravity', interval)
        attach('rotation', 'card')
        attach('gravity', 'glow')
        snapshot('configured', `interval-${interval}`)
        await window(`interval-${interval}`)
        cleanup()
        snapshot('disposed', `interval-${interval}`)
      }
      sources.clear()
      create('slow', 'rotation', 100)
      create('fast', 'gravity', 16)
      snapshot('configured', 'idle')
      await window('idle', 2000)
      attach('slow', 'card')
      attach('slow', 'shine') // Two native consumers of the same scalar source.
      snapshot('configured', 'slow-only')
      await window('slow-only')
      attach('fast', 'glow')
      snapshot('configured', 'mixed')
      await window('mixed')
      detach('slow', 'shine')
      snapshot('configured', 'one-slow-binding')
      await window('one-slow-binding')
      release('fast')
      snapshot('configured', 'fast-removed')
      await window('fast-removed')
      detach('slow', 'card')
      sources.get('slow')!.source.play() // play() without demand must not acquire hardware.
      snapshot('configured', 'last-binding-removed')
      await window('last-binding-removed', 2000)
      attach('slow', 'card')
      snapshot('configured', 'reattached')
      await window('reattached')
      cleanup()
      snapshot('configured', 'all-disposed')
      await window('all-disposed', 2000)
      status = 'completed'
      snapshot('complete', 'complete')
      show('Completed', '12 windows captured · native resources released')
    } catch (error) {
      failure = String(error)
      status = 'failed'
      cleanup()
      snapshot('failed', 'failed')
      show('Failed', failure)
    } finally {
      running = false
      Application.off(Application.suspendEvent, interrupted)
    }
  }
  return {
    run,
    dispose() {
      if (disposed) return
      disposed = true
      if (running) interrupted()
      else if (started && isIOS) {
        cleanup()
        snapshot('route-disposed', 'cleanup')
      }
    },
  }
}
