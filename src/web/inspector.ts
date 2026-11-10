import { createAdapterInspector } from '../core/adapter-inspection.js'
import { playbackSource, type PlaybackAnimation } from '../core/playback.js'
import { inspectorSpring, type InspectorSpring } from '../core/inspector-spring.js'
import type { WebRuntime, WebDiagnostics } from './public.js'
import {
  inspectorPlot,
  validatePlotSample,
  type PlotSample,
  type PlotEvent,
} from '../core/inspection-plot.js'
export { inspectorPlot } from '../core/inspection-plot.js'
export type { PlotSample, PlotEvent } from '../core/inspection-plot.js'
export { inspectorSpring } from '../core/inspector-spring.js'
export type { InspectorSpring } from '../core/inspector-spring.js'
export type {
  AdapterInspector,
  AdapterInspectionSnapshot,
} from '../core/adapter-inspection.js'

export function springCode(options: {
  target?: string
  to: number
  spring: InspectorSpring
}) {
  const target = options.target ?? 'card'
  if (!/^[A-Za-z_$][\w$]*$/.test(target) || !Number.isFinite(options.to))
    throw new TypeError('Use a target identifier and finite translation.')
  return `runtime.animate(${target}, { x: ${options.to} }, ${JSON.stringify({ ...inspectorSpring(options.spring), velocity: 0 }, null, 2)})\n`
}

/** Opt-in pull-only tools. The application keeps ownership of watched targets and animations. */
export function createMotionInspector(
  document: Document,
  runtime: WebRuntime,
  options: {
    development: true
    capacity?: number
    /** Borrow an existing diagnostic collector, leaving its disposal to the caller. */
    diagnostics?: WebDiagnostics
  },
) {
  if (options.development !== true)
    throw new TypeError('Motion inspection requires development: true.')
  const adapters = createAdapterInspector({
    development: true,
    capacity: options.capacity,
    now: () => document.defaultView!.performance.now(),
  })
  const diagnostics =
    options.diagnostics ??
    runtime.diagnostics({ development: true, maxEvents: options.capacity })
  const surfaces = new Map<string, WeakRef<HTMLElement>>()
  const animations = new Map<string, WeakRef<PlaybackAnimation>>()
  const capacity = options.capacity ?? 256
  const history: (PlotSample & {
    id: string
    property: 'x' | 'y' | 'opacity'
    source: 'computed-style' | 'unavailable'
  })[] = []
  let disposed = false
  const validID = (id: string) => {
    if (disposed) throw new Error('Web inspector is disposed.')
    if (!/^[A-Za-z][\w.-]{0,63}$/.test(id) || surfaces.has(id) || animations.has(id))
      throw new TypeError('Use a unique non-personal ASCII inspector ID.')
    if (surfaces.size + animations.size >= 128)
      throw new RangeError('Inspect at most 128 explicit resources.')
  }
  return {
    adapters,
    /** Explicit pull sampling; no timer, animation-frame loop or inferred GPU observation. */
    sample(
      id: string,
      property: 'x' | 'y' | 'opacity',
      expected: number | null,
      event?: PlotEvent,
    ) {
      if (disposed) throw new Error('Web inspector is disposed.')
      if (!surfaces.has(id)) throw new TypeError('Watch a target before sampling.')
      if (!['x', 'y', 'opacity'].includes(property))
        throw new TypeError('Sample x, y or opacity.')
      const at = document.defaultView!.performance.now()
      validatePlotSample({ at, expected, observed: null, event })
      const target = surfaces.get(id)?.deref()
      let observed: number | null = null
      if (target?.isConnected && target.ownerDocument === document) {
        const style = document.defaultView!.getComputedStyle(target)
        if (property === 'opacity') observed = Number(style.opacity)
        else {
          const matrix = new (
            document.defaultView as Window & typeof globalThis
          ).DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform)
          if (matrix.is2D) observed = property === 'x' ? matrix.m41 : matrix.m42
        }
        if (!Number.isFinite(observed)) observed = null
      }
      const sample = {
        id,
        property,
        at,
        expected,
        observed,
        source:
          observed === null ? ('unavailable' as const) : ('computed-style' as const),
        ...(event ? { event } : {}),
      }
      history.push(sample)
      if (history.length > capacity) history.shift()
      return { ...sample }
    },
    samples(id: string, property: 'x' | 'y' | 'opacity') {
      if (disposed) throw new Error('Web inspector is disposed.')
      return history
        .filter((s) => s.id === id && s.property === property)
        .map((s) => ({ ...s }))
    },
    plot(id: string, property: 'x' | 'y' | 'opacity') {
      if (disposed) throw new Error('Web inspector is disposed.')
      return inspectorPlot(history.filter((s) => s.id === id && s.property === property))
    },
    clearSamples() {
      if (disposed) throw new Error('Web inspector is disposed.')
      history.length = 0
    },
    watch(target: HTMLElement, id: string) {
      validID(id)
      if (!target?.isConnected || target.ownerDocument !== document)
        throw new TypeError('Watch a mounted surface in this runtime document.')
      for (let i = history.length - 1; i >= 0; i--)
        if (history[i]!.id === id) history.splice(i, 1)
      const ref = new WeakRef(target)
      surfaces.set(id, ref)
      return () => {
        if (surfaces.get(id) === ref) surfaces.delete(id)
      }
    },
    track(animation: PlaybackAnimation, id: string) {
      validID(id)
      playbackSource(animation)
      const ref = new WeakRef(animation)
      animations.set(id, ref)
      return () => {
        if (animations.get(id) === ref) animations.delete(id)
      }
    },
    control(id: string, command: 'pause' | 'play' | 'seek' | 'stop', progress?: number) {
      if (disposed) throw new Error('Web inspector is disposed.')
      const animation = animations.get(id)?.deref()
      if (!animation)
        throw new TypeError('Track an application-owned playback before editing it.')
      if (command === 'seek') {
        if (!Number.isFinite(progress) || progress! < 0 || progress! > 1)
          throw new RangeError('Seek progress is 0–1.')
        animation.progress = progress!
      } else if (command === 'pause' || command === 'play' || command === 'stop')
        animation[command]()
      else throw new TypeError('Unsupported inspector command.')
    },
    /** Only the application callback can replace its animation. No hidden preview owner. */
    tune(
      spring: InspectorSpring,
      apply: (settings: ReturnType<typeof inspectorSpring>) => void,
    ) {
      if (disposed) throw new Error('Web inspector is disposed.')
      const settings = inspectorSpring(spring)
      apply({ ...settings })
      return settings
    },
    read() {
      if (disposed) throw new Error('Web inspector is disposed.')
      const targets: {
        id: string
        target: number
        transform: string
        opacity: number
      }[] = []
      for (const [id, ref] of surfaces) {
        const target = ref.deref()
        if (!target || target.ownerDocument !== document) {
          surfaces.delete(id)
          continue
        }
        if (!target.isConnected) continue
        const style = document.defaultView!.getComputedStyle(target)
        targets.push({
          id,
          target: diagnostics.identify(target),
          transform: style.transform,
          opacity: Number(style.opacity),
        })
      }
      const playback: {
        id: string
        owner: number
        time: number
        duration: number
        paused: boolean
        completed: boolean
      }[] = []
      for (const [id, ref] of animations) {
        const animation = ref.deref()
        if (!animation) {
          animations.delete(id)
          continue
        }
        const state = playbackSource(animation).read()
        if (state.settled) {
          animations.delete(id)
          continue
        }
        playback.push({
          id,
          owner: diagnostics.identify(animation),
          time: state.time,
          duration: state.duration,
          paused: state.paused,
          completed: state.completed,
        })
      }
      return {
        version: 1 as const,
        targets,
        playback,
        diagnostics: diagnostics.snapshot(),
        adapters: adapters.read(),
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      surfaces.clear()
      animations.clear()
      history.length = 0
      adapters.dispose()
      if (!options.diagnostics) diagnostics.dispose()
    },
  }
}
export type WebMotionInspector = ReturnType<typeof createMotionInspector>
