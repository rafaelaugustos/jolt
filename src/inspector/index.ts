import { Application, isIOS, type View } from '@nativescript/core'
import { getDriver, setDriver, type Driver } from '../driver/index.js'
import { inspectViewMotion, type Animation } from '../engine.js'
import { inspectViewBindings, type DerivedValue } from '../motion-value.js'
import { isProperty, readValue, type Property } from '../properties.js'
import type { Track } from '../track.js'
import type { PlaybackAnimation } from '../playback.js'
import {
  inspectorCostTime,
  probeProperties,
  startProbe,
  type NativeProbe,
} from './probe.js'
export { inspectorSpring, springCode } from './tuning.js'
export { inspectorPlot } from './plot.js'
export type { InspectorSpring } from './tuning.js'

export interface InspectorEvent {
  at: number
  property: Property
  kind: 'start' | 'replace' | 'stop' | 'complete' | 'pause' | 'play' | 'seek'
  owner: string
  previous?: string
  label?: string
  previousLabel?: string
}
export interface InspectorSample {
  at: number
  expected: number | null
  observed: number | null
  source: 'presentation-layer' | 'native-view' | 'unavailable'
}
export interface InspectorProperty {
  property: Property
  layer?: string
  owner: string
  label: string
  target: number
  value: number
  velocity: number
  elapsed: number
  delay: number
  duration: number
  paused: boolean
}
export interface InspectorNode {
  id: string
  label: string
  kind: string
  value: number
  input?: InspectorNode
  mappings: { input: number[]; output: number[]; clamp: boolean }[]
}
export interface InspectorSnapshot {
  selected: string | null
  property: Property
  properties: InspectorProperty[]
  bindings: { property: Property; value: number; source: InspectorNode }[]
  events: InspectorEvent[]
  samples: InspectorSample[]
  status: string
  overhead: {
    reads: number
    jsReadMs: number
    hookMs: number
    nativeSamples: number
    nativeSampleMs: number
    nativeDrainMs: number
    dropped: number
  }
}
export interface MotionInspector {
  watch(view: View, id: string): () => void
  select(id: string, property?: Property): void
  label(animation: Animation | DerivedValue, label: string): void
  read(): InspectorSnapshot
  /** Explicit edit command; reading/selecting never changes playback. */
  control(
    animation: PlaybackAnimation,
    command: 'pause' | 'play' | 'seek',
    progress?: number,
  ): void
  dispose(): void
}

interface Segment {
  at: number
  owner: string
  position(at: number): number
}
interface ObservedTrack {
  track: Track
  view: View
  owner: string
  anchor: number
  elapsed: number
  paused: boolean
  stopped: boolean
  adopted?: boolean
}
let installed = false

/** Import only inside a development entry. One inspector may own the optional hooks. */
export function createMotionInspector(options: {
  development: true
  capacity?: number
  hertz?: number
}): MotionInspector {
  if (options.development !== true)
    throw new Error('The motion inspector requires development: true.')
  if (installed) throw new Error('Dispose the existing motion inspector first.')
  const capacity = options.capacity ?? 240,
    hertz = options.hertz ?? 60
  if (
    !Number.isInteger(capacity) ||
    capacity < 8 ||
    capacity > 600 ||
    !Number.isFinite(hertz) ||
    hertz < 1 ||
    hertz > 120
  )
    throw new RangeError('Inspector capacity is 8–600 and hertz is 1–120.')
  const base = getDriver()
  const views = new Map<string, View>(),
    releases = new Map<string, () => void>()
  const identities = new WeakMap<object, string>(),
    labels = new WeakMap<object, string>()
  const handles = new Map<unknown, ObservedTrack>()
  const names = new Map<string, string>()
  const histories = new Map<Property, Segment[]>()
  const events: InspectorEvent[] = [],
    samples: InspectorSample[] = []
  let nextId = 0,
    selected: string | null = null,
    property: Property = 'x'
  let probe: NativeProbe | undefined,
    disposed = false,
    status = 'No view selected'
  const overhead = {
    reads: 0,
    jsReadMs: 0,
    hookMs: 0,
    nativeSamples: 0,
    nativeSampleMs: 0,
    nativeDrainMs: 0,
    dropped: 0,
  }
  const identity = (value: object) => {
    let id = identities.get(value)
    if (!id) identities.set(value, (id = `owner-${++nextId}`))
    return id
  }
  const boundedPush = <T>(array: T[], item: T) => {
    array.push(item)
    if (array.length > capacity) array.shift()
  }
  const isSelected = (view: View) => !!selected && views.get(selected) === view
  const pruneAdopted = () => {
    // Handles captured after play() started do not have our completion callback.
    for (const [handle, run] of handles)
      if (run.adopted && !inspectViewMotion(run.view).some((e) => e.handle === handle))
        handles.delete(handle)
  }
  const position = (run: ObservedTrack, at: number) =>
    run.track.valueAt(run.elapsed + (run.paused ? 0 : at - run.anchor))
  const segment = (run: ObservedTrack, at: number) => {
    if (!isSelected(run.view)) return
    let history = histories.get(run.track.property)
    if (!history) histories.set(run.track.property, (history = []))
    const frozen = { ...run }
    boundedPush(history, {
      at,
      owner: run.owner,
      position: (time) => position(frozen, time),
    })
  }
  const note = (run: ObservedTrack, kind: InspectorEvent['kind'], previous?: string) => {
    if (isSelected(run.view))
      boundedPush(events, {
        at: base.now(),
        property: run.track.property,
        owner: run.owner,
        kind,
        previous,
      })
  }
  const wrapper = Object.create(base) as Driver
  wrapper.play = (view, track, startedAt, onEnd) => {
    if (!isSelected(view)) return base.play(view, track, startedAt, onEnd)
    const begin = base.now()
    const cost = inspectorCostTime()
    const entries = inspectViewMotion(view).filter(
      (entry) => entry.property === track.property,
    )
    const entry = entries.find((e) => e.track === track)
    const previous = histories.get(track.property)?.at(-1)?.owner
    const run: ObservedTrack = {
      view,
      track,
      owner: identity(entry?.owner ?? track),
      anchor: startedAt,
      elapsed: 0,
      paused: false,
      stopped: false,
    }
    let completed = false,
      handle: unknown
    const finished = (ok?: boolean) => {
      completed = true
      if (!disposed && !run.stopped && isSelected(view)) {
        note(run, ok === false ? 'stop' : 'complete')
        const at = base.now(),
          value = ok === false ? position(run, at) : track.to
        let history = histories.get(track.property)
        if (!history) histories.set(track.property, (history = []))
        boundedPush(history, { at, owner: run.owner, position: () => value })
      }
      handles.delete(handle)
      onEnd(ok)
    }
    const nativeBegin = inspectorCostTime()
    handle = base.play(view, track, startedAt, finished)
    const nativeCost = inspectorCostTime() - nativeBegin
    if (!completed) {
      run.elapsed = base.elapsed?.(handle) ?? base.now() - startedAt
      run.anchor = base.now()
      handles.set(handle, run)
      segment(run, begin)
      note(
        run,
        previous && previous !== 'model' && previous !== run.owner ? 'replace' : 'start',
        previous,
      )
    }
    overhead.hookMs += inspectorCostTime() - cost - nativeCost
    return handle
  }
  wrapper.stop = (view, handle) => {
    const cost = inspectorCostTime()
    const run = handles.get(handle)
    if (run) {
      const at = base.now()
      run.elapsed += run.paused ? 0 : at - run.anchor
      run.anchor = at
      run.paused = true
      run.stopped = true
      segment(run, at)
      note(run, 'stop')
      handles.delete(handle)
    }
    overhead.hookMs += inspectorCostTime() - cost
    base.stop(view, handle)
  }
  if (base.control)
    wrapper.control = (view, handle, elapsed, paused, command) => {
      base.control!(view, handle, elapsed, paused, command)
      const cost = inspectorCostTime()
      const run = handles.get(handle)
      if (run) {
        run.elapsed = base.elapsed?.(handle) ?? elapsed
        run.anchor = base.now()
        run.paused = paused
        segment(run, run.anchor)
        note(run, command ?? 'seek')
      }
      overhead.hookMs += inspectorCostTime() - cost
    }
  // Native implementations use closures, but bind inherited methods for custom drivers too.
  for (const key of [
    'now',
    'frame',
    'clock',
    'sync',
    'elapsed',
    'presented',
    'after',
    'layoutFrame',
    'afterLayout',
    'reducedMotion',
    'watchReducedMotion',
  ] as const) {
    const fn = base[key]
    if (fn)
      Object.defineProperty(wrapper, key, { value: fn.bind(base), configurable: true })
  }
  const halt = () => {
    probe?.dispose()
    probe = undefined
  }
  const suspend = () => {
    halt()
    status = 'Sampling stopped in background; select a view to resume'
  }
  const assertOpen = () => {
    if (disposed) throw new Error('Motion inspector is disposed.')
  }
  const graph = (
    node: ReturnType<typeof inspectViewBindings>[number]['source'],
  ): InspectorNode => ({
    id: identity(node.identity),
    label: labels.get(node.identity) ?? node.kind,
    kind: node.kind,
    value: node.value,
    mappings: node.mappings.map((m) => ({
      input: [...m.input],
      output: [...m.output],
      clamp: m.clamp,
    })),
    input: node.input ? graph(node.input) : undefined,
  })
  const result: MotionInspector = {
    watch(view, id) {
      assertOpen()
      if (!id || id.length > 100 || views.has(id) || views.size >= 32)
        throw new Error(
          'Watch up to 32 views using unique, nonempty IDs of at most 100 characters.',
        )
      views.set(id, view)
      const unloaded = () => {
        if (selected === id) {
          halt()
          status = 'Selected view unloaded'
        }
      }
      view.on('unloaded', unloaded)
      const release = () => {
        if (views.get(id) !== view) return
        if (selected === id) {
          halt()
          selected = null
          histories.clear()
          samples.length = 0
          events.length = 0
        }
        view.off('unloaded', unloaded)
        views.delete(id)
        releases.delete(id)
        for (const [handle, run] of handles) if (run.view === view) handles.delete(handle)
      }
      releases.set(id, release)
      return release
    },
    select(id, nextProperty = 'x') {
      assertOpen()
      pruneAdopted()
      const view = views.get(id)
      if (!view) throw new Error(`Unknown inspector view: ${id}`)
      if (!isProperty(nextProperty)) throw new Error('Unknown inspector property.')
      halt()
      selected = id
      property = nextProperty
      histories.clear()
      samples.length = 0
      events.length = 0
      // Existing animations are inspected without replaying or stealing ownership.
      const existing = inspectViewMotion(view)
      for (const entry of existing) {
        if (
          entry.layer !== undefined ||
          existing.some((e) => e.property === entry.property && e.layer !== undefined)
        )
          continue
        const run = {
          view,
          track: entry.track,
          owner: identity(entry.owner),
          elapsed: entry.elapsed,
          anchor: base.now(),
          paused: entry.paused,
          stopped: false,
          adopted: true,
        }
        segment(run, run.anchor)
        if (!handles.has(entry.handle)) handles.set(entry.handle, run)
      }
      for (const run of handles.values()) if (run.view === view) segment(run, base.now())
      if (
        !histories.has(property) &&
        !existing.some((e) => e.property === property) &&
        !inspectViewBindings(view).some((b) => b.property === property)
      ) {
        try {
          const value = readValue(view, property)
          histories.set(property, [
            { at: base.now(), owner: 'model', position: () => value },
          ])
        } catch {
          /* A view may not expose this optional decoration. */
        }
      }
      try {
        if (!(probeProperties as readonly string[]).includes(property)) {
          status = `Native sampling unavailable for ${property}`
          return
        }
        probe = startProbe(view, capacity, hertz)
        status = 'Sampling native values'
      } catch (error) {
        status = `Native sampling unavailable: ${String(error)}`
      }
    },
    label(animation, label) {
      assertOpen()
      if (!label || label.length > 100) throw new Error('Use a short nonempty label.')
      labels.set(animation, label)
      names.set(identity(animation), label)
      if (names.size > capacity) names.delete(names.keys().next().value!)
    },
    read() {
      assertOpen()
      pruneAdopted()
      const begin = inspectorCostTime(),
        view = selected ? views.get(selected) : undefined
      if (probe) {
        const batch = probe.drain()
        const index = (probeProperties as readonly string[]).indexOf(property) + 1
        const history = histories.get(property) ?? []
        for (const row of batch.rows) {
          const at = row[0]!
          if (at === null) continue
          const source = [...history].reverse().find((s) => s.at <= at)
          const expected = source?.position(at)
          const observed = index > 0 ? (row[index] ?? null) : null
          boundedPush(samples, {
            at,
            expected:
              expected !== undefined && Number.isFinite(expected) ? expected : null,
            observed,
            source:
              observed === null
                ? 'unavailable'
                : isIOS
                  ? 'presentation-layer'
                  : 'native-view',
          })
        }
        Object.assign(overhead, {
          nativeSamples: batch.samples,
          nativeSampleMs: batch.sampleCpuMs,
          nativeDrainMs: batch.drainCpuMs,
          dropped: batch.dropped,
        })
        if (!batch.active) {
          halt()
          status = 'Native sampling stopped; select a view to resume'
        }
      }
      const properties = view
        ? inspectViewMotion(view).map((e) => ({
            property: e.property,
            layer: e.layer,
            owner: identity(e.owner),
            label: labels.get(e.owner) ?? identity(e.owner),
            target: e.track.to,
            value: e.track.valueAt(e.elapsed),
            velocity: e.paused ? 0 : e.track.velocityAt(e.elapsed),
            elapsed: e.elapsed,
            delay: e.track.delay,
            duration: e.track.end,
            paused: e.paused,
          }))
        : []
      const bindings = view
        ? inspectViewBindings(view).map((b) => ({
            property: b.property,
            value: b.value,
            source: graph(b.source),
          }))
        : []
      overhead.reads++
      overhead.jsReadMs += inspectorCostTime() - begin
      return {
        selected,
        property,
        properties,
        bindings,
        events: events.map((e) => ({
          ...e,
          label: names.get(e.owner),
          previousLabel: e.previous ? names.get(e.previous) : undefined,
        })),
        samples: samples.map((s) => ({ ...s })),
        status,
        overhead: { ...overhead },
      }
    },
    control(animation, command, progress) {
      assertOpen()
      if (command === 'seek') {
        if (
          progress === undefined ||
          !Number.isFinite(progress) ||
          progress < 0 ||
          progress > 1 ||
          !Number.isFinite(animation.duration)
        )
          throw new RangeError(
            'Scrubbing requires a finite animation and progress from 0 to 1.',
          )
        animation.pause()
        animation.progress = progress
      } else animation[command]()
    },
    dispose() {
      if (disposed) return
      disposed = true
      halt()
      for (const release of [...releases.values()]) release()
      handles.clear()
      names.clear()
      histories.clear()
      events.length = 0
      samples.length = 0
      Application.off(Application.suspendEvent, suspend)
      if (getDriver() === wrapper) setDriver(base)
      installed = false
    },
  }
  setDriver(wrapper)
  installed = true
  Application.on(Application.suspendEvent, suspend)
  return result
}
